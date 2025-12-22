import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function memberIdOf(personalId, groupId) {
  return `${personalId}::${groupId}`;
}

export class GroupService {
  constructor(db) {
    if (!db) throw new Error("GroupService: db required");
    this.db = db;
  }


  /* =========================
     グループ作成（owner）
  ========================= */
  async createGroup({ groupName, ownerPersonalId, ownerUid }) {
    const name = (groupName || "").toString().trim();
    if (!name) throw new Error("グループ名が空です");
    if (name.length > 8) {
      throw new Error("グループ名は8文字以内にしてください");
    }
    if (!ownerPersonalId || !ownerUid) {
      throw new Error("owner情報が不正です");
    }
  
    const groupRef = doc(collection(this.db, "groups"));
    const groupId = groupRef.id;
  
    await setDoc(groupRef, {
      name,
      ownerPersonalId,
      ownerUid,
      createdAt: serverTimestamp()
    });
  
    await setDoc(
      doc(this.db, "groupMembers", `${ownerPersonalId}::${groupId}`),
      {
        groupId,
        personalId: ownerPersonalId,
        uid: ownerUid,
        role: "owner",
        createdAt: serverTimestamp()
      }
    );
  
    return { groupId, name };
  }



  /* =========================
     自分の所属グループ一覧
  ========================= */
  async getMyGroups(personalId) {
    if (!personalId) return [];
  
    const q = query(
      collection(this.db, "groupMembers"),
      where("personalId", "==", personalId)
    );
  
    const snap = await getDocs(q);
    const rows = [];
  
    for (const d of snap.docs) {
      const m = d.data();
      const groupId = m.groupId;
  
      let gName = "(no name)";
      let ownerUid = null;
      let ownerPersonalId = null;
  
      try {
        const gSnap = await getDoc(doc(this.db, "groups", groupId));
        if (gSnap.exists()) {
          const g = gSnap.data();
          gName = g.name ?? gName;
          ownerUid = g.ownerUid ?? null;
          ownerPersonalId = g.ownerPersonalId ?? null;
        }
      } catch {}
  
      rows.push({
        groupId,
        name: gName,
        role: m.role || "member",
        ownerUid,
        ownerPersonalId
      });
    }
  
    rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return rows;
  }


  /* =========================
     グループ検索
  ========================= */
  async searchGroupsByName(nameRaw) {
    const name = (nameRaw || "").toString().trim();
    if (!name) return [];
  
    const q = query(
      collection(this.db, "groups"),
      where("name", "==", name),
      limit(10)
    );
  
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ groupId: d.id, ...(d.data() || {}) }));
  }

  /* =========================
     参加申請（ID固定）
  ========================= */
  async requestJoin({ groupId, personalId, uid }) {
    if (!groupId || !personalId) {
      throw new Error("requestJoin: params invalid");
    }
  
    const reqRef = doc(
      this.db,
      "groupJoinRequests",
      memberIdOf(personalId, groupId)
    );
  
    await setDoc(reqRef, {
      groupId,
      personalId,
      uid,
      createdAt: serverTimestamp()
    });
  
    const memRef = doc(
      this.db,
      "groupMembers",
      memberIdOf(personalId, groupId)
    );
    if ((await getDoc(memRef)).exists()) {
      throw new Error("already member");
    }
  }


  /* =========================
     承認待ち一覧
  ========================= */
  async getPendingRequests(groupId) {
    if (!groupId) return [];

    const q = query(
      collection(this.db, "groupJoinRequests"),
      where("groupId", "==", groupId)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
  }

  /* =========================
     ★内部：同一人物の申請を全削除
  ========================= */
  async _deleteDuplicateJoinRequests({ groupId, personalId }) {
    if (!groupId || !personalId) return;
  
    const q = query(
      collection(this.db, "groupJoinRequests"),
      where("groupId", "==", groupId),
      where("personalId", "==", personalId)
    );
  
    const snap = await getDocs(q);
    await this._batchDeleteDocs(snap.docs.map(d => d.ref));
  }

  /* =========================
     承認
  ========================= */
  async approveMember({ requestId, ownerUid }) {
    if (!requestId) throw new Error("approveMember: requestId required");
  
    const reqRef = doc(this.db, "groupJoinRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error("申請が存在しません");
  
    const r = reqSnap.data();
    const { groupId, personalId, uid } = r;
  
    const memRef = doc(
      this.db,
      "groupMembers",
      memberIdOf(personalId, groupId)
    );
  
    const batch = writeBatch(this.db);
    batch.set(memRef, {
      groupId,
      personalId,
      uid,
      role: "member",
      approvedByUid: ownerUid || null,
      createdAt: serverTimestamp()
    });
    batch.delete(reqRef);
    await batch.commit();
  
    await this._deleteDuplicateJoinRequests({ groupId, personalId });
  }

  /* =========================
     却下
  ========================= */
  async rejectMember({ requestId }) {
    if (!requestId) throw new Error("rejectMember: requestId required");
  
    const reqRef = doc(this.db, "groupJoinRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
  
    const { groupId, personalId } = reqSnap.data();
    await this._deleteDuplicateJoinRequests({ groupId, personalId });
  }

  /* =========================
     退出
  ========================= */
  async leaveGroup({ groupId, personalId }) {
    if (!groupId || !personalId) throw new Error("leaveGroup: params invalid");
  
    const memRef = doc(
      this.db,
      "groupMembers",
      memberIdOf(personalId, groupId)
    );
    await deleteDoc(memRef);
  }

  /* =========================
     グループ削除
  ========================= */
  async deleteGroup({ groupId }) {
    if (!groupId) throw new Error("deleteGroup: groupId required");

    await deleteDoc(doc(this.db, "groups", groupId));

    {
      const q = query(
        collection(this.db, "groupMembers"),
        where("groupId", "==", groupId)
      );
      const snap = await getDocs(q);
      await this._batchDeleteDocs(snap.docs.map(d => d.ref));
    }

    {
      const q = query(
        collection(this.db, "groupJoinRequests"),
        where("groupId", "==", groupId)
      );
      const snap = await getDocs(q);
      await this._batchDeleteDocs(snap.docs.map(d => d.ref));
    }
  }

  async isAlreadyMember({ groupId, personalId }) {
    if (!groupId || !personalId) return false;
  
    const ref = doc(
      this.db,
      "groupMembers",
      `${personalId}::${groupId}`
    );
    const snap = await getDoc(ref);
    return snap.exists();
  }


  async _batchDeleteDocs(refs) {
    const chunkSize = 450;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const batch = writeBatch(this.db);
      for (const ref of refs.slice(i, i + chunkSize)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }

  async getMyPendingGroupIds(personalId) {
    if (!personalId) return new Set();
  
    const q = query(
      collection(this.db, "groupJoinRequests"),
      where("personalId", "==", personalId)
    );
  
    const snap = await getDocs(q);
    return new Set(snap.docs.map(d => d.data().groupId));
  }

}

















