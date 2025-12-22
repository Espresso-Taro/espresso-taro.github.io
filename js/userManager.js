import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MAX_USER_NAME_LENGTH = 8;
const MAX_USERS_PER_DEVICE = 8;

function countChars(str) {
  return [...str].length; // 絵文字も1文字扱い
}

/**
 * 全世界で衝突しないユーザー識別子
 */
function generatePersonalId() {
  return crypto.randomUUID(); // UUID v4
}

export class UserManager {
  constructor({ selectEl, addBtn, renameBtn, deleteBtn, db }) {
    if (!db) throw new Error("UserManager: Firestore db is required");

    this.db = db;

    this.userSelect = selectEl || null;
    this.addBtn = addBtn || null;
    this.renameBtn = renameBtn || null;
    this.deleteBtn = deleteBtn || null;

    // [{ personalId, userName }]
    this.users = [];
    this.currentUserName = "";
    this.currentPersonalId = "";
    this._authUid = "";
    this._listeners = new Set();

    this._bindEvents();
  }

  /* =========================
     init
  ========================= */
  async init(authUid) {
    this._authUid = (authUid || "").toString();
    if (!this._authUid) throw new Error("UserManager.init: authUid is required");

    this.users = await this.listUsers();

    const lastPersonalId = this._getLastPersonalId();
    const lastUser = this.users.find(u => u.personalId === lastPersonalId);

    if (lastUser) {
      this.currentPersonalId = lastUser.personalId;
      this.currentUserName = lastUser.userName;
    } else if (this.users.length > 0) {
      this.currentPersonalId = this.users[0].personalId;
      this.currentUserName = this.users[0].userName;
    } else {
      const guest = await this._createUniqueGuestUser();
      this.currentPersonalId = guest.personalId;
      this.currentUserName = guest.userName;
      this.users = await this.listUsers();
    }

    this._setLastPersonalId(this.currentPersonalId);
    this.render();
    this._emitChanged();

    return this.currentUserName;
  }

  /* =========================
     Events
  ========================= */
  onUserChanged(fn) {
    if (typeof fn !== "function") return () => {};
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emitChanged() {
    for (const fn of this._listeners) {
      try {
        fn(this.currentUserName, this.currentPersonalId);
      } catch (e) {
        console.error("onUserChanged handler error:", e);
      }
    }
  }

  _bindEvents() {
    if (this.userSelect) {
      this.userSelect.addEventListener("change", () => {
        const pid = (this.userSelect.value || "").toString();
        const u = this.users.find(x => x.personalId === pid);
        if (!u) return;

        this.currentPersonalId = u.personalId;
        this.currentUserName = u.userName;
        this._setLastPersonalId(u.personalId);
        this._emitChanged();
      });
    }

    if (this.addBtn) {
      this.addBtn.addEventListener("click", async () => {
        const name = prompt("ユーザー名を8字以内で入力してください。");
        if (!name) return;
        try {
          await this.addUser(name);
        } catch (e) {
          alert(e.message || "ユーザー作成に失敗しました");
        }
      });
    }

    if (this.renameBtn) {
      this.renameBtn.addEventListener("click", async () => {
        if (!this.currentPersonalId) return;
        const newName = prompt("新しいユーザー名", this.currentUserName);
        if (!newName || newName === this.currentUserName) return;
        try {
          await this.renameUser(this.currentPersonalId, newName);
        } catch (e) {
          alert(e.message || "改名に失敗しました");
        }
      });
    }

    if (this.deleteBtn) {
      this.deleteBtn.addEventListener("click", async () => {
        if (!this.currentPersonalId) return;
    
        // ★ 追加：最後の1人は削除不可
        if (this.users.length <= 1) {
          alert(
            "このユーザーは削除できません。\n\n" +
            "先に別のユーザーを作成してから削除してください。"
          );
          return;
        }
    
        // confirm は使わない（②の方針）
        try {
          await this.deleteUser(this.currentPersonalId);
        } catch (e) {
          alert(e.message || "削除に失敗しました");
        }
      });
    }
  }

  /* =========================
     UI
  ========================= */
  render() {
    if (!this.userSelect) return;

    this.userSelect.innerHTML = "";
    for (const u of this.users) {
      const opt = document.createElement("option");
      opt.value = u.personalId;
      opt.textContent = u.userName;
      this.userSelect.appendChild(opt);
    }

    if (this.currentPersonalId) {
      this.userSelect.value = this.currentPersonalId;
    }
  }

  getCurrentUserName() {
    return this.currentUserName;
  }

  getCurrentPersonalId() {
    return this.currentPersonalId;
  }

  /* =========================
     Firestore
  ========================= */
  async listUsers() {
    const q = query(
      collection(this.db, "userProfiles"),
      where("uid", "==", this._authUid)
    );

    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const data = d.data() || {};
        return {
          personalId: (data.personalId || d.id || "").toString(),
          userName: (data.userName || "").toString()
        };
      })
      .filter(x => x.personalId && x.userName)
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }

  async addUser(nameRaw) {
    if (this.users.length >= MAX_USERS_PER_DEVICE) {
      throw new Error("この端末では最大10名までしか登録できません");
    }

    const name = nameRaw.trim();
    if (!name) throw new Error("ユーザー名が空です");

    if (countChars(name) > MAX_USER_NAME_LENGTH) {
      throw new Error("ユーザー名は8文字以内で入力してください");
    }

    const nameRef = doc(this.db, "userNames", name);
    if ((await getDoc(nameRef)).exists()) {
      throw new Error("このユーザー名は既に使われています");
    }

    await setDoc(nameRef, {
      createdAt: serverTimestamp(),
      createdByUid: this._authUid
    });

    const personalId = generatePersonalId();
    await setDoc(doc(this.db, "userProfiles", personalId), {
      personalId,
      uid: this._authUid,
      userName: name,
      createdAt: serverTimestamp()
    });

    this.users = await this.listUsers();
    this.currentPersonalId = personalId;
    this.currentUserName = name;
    this._setLastPersonalId(personalId);
    this.render();
    this._emitChanged();
  }

  async renameUser(personalId, newName) {
    const me = this.users.find(u => u.personalId === personalId);
    if (!me) throw new Error("権限がありません");

    const name = newName.trim();
    if (!name) throw new Error("ユーザー名が空です");

    if (countChars(name) > MAX_USER_NAME_LENGTH) {
      throw new Error("ユーザー名は8文字以内で入力してください");
    }

    const newRef = doc(this.db, "userNames", name);
    if ((await getDoc(newRef)).exists()) {
      throw new Error("新しいユーザー名は既に使われています");
    }

    await setDoc(newRef, {
      createdAt: serverTimestamp(),
      createdByUid: this._authUid
    });

    await deleteDoc(doc(this.db, "userNames", me.userName));

    await setDoc(
      doc(this.db, "userProfiles", personalId),
      { userName: name },
      { merge: true }
    );

    this._cleanupLocalStorageForUser(me.userName, personalId);

    this.users = await this.listUsers();
    this.currentPersonalId = personalId;
    this.currentUserName = name;
    this._setLastPersonalId(personalId);
    this.render();
    this._emitChanged();
  }
  
  async deleteUser(personalId) {
    const me = this.users.find(u => u.personalId === personalId);
    if (!me) return;
  
    // 1. userName の一意制約を解除
    await deleteDoc(doc(this.db, "userNames", me.userName));
  
    // 2. ★ 完全削除：userProfiles を Firestore から削除
    await deleteDoc(doc(this.db, "userProfiles", personalId));
  
    // 3. localStorage 掃除
    this._cleanupLocalStorageForUser(me.userName, personalId);
  
    // 4. ローカル配列からも除去
    this.users = this.users.filter(u => u.personalId !== personalId);
  
    // 5. current を安全に再設定
    if (this.users.length > 0) {
      this.currentPersonalId = this.users[0].personalId;
      this.currentUserName = this.users[0].userName;
      this._setLastPersonalId(this.currentPersonalId);
    } else {
      // 理論上は delete ボタン側で防がれているが、保険
      this.currentPersonalId = "";
      this.currentUserName = "";
      localStorage.removeItem(this._lastKey());
    }
  
    this.render();
    this._emitChanged();
  }


  /* =========================
     guest
  ========================= */
  async _createUniqueGuestUser() {
    for (let i = 0; i < 30; i++) {
      const name = `ゲスト${this._randBase36(5)}`;
      const ref = doc(this.db, "userNames", name);

      const ok = await runTransaction(this.db, async (tx) => {
        if ((await tx.get(ref)).exists()) return null;
        tx.set(ref, { createdAt: serverTimestamp(), createdByUid: this._authUid });
        return name;
      });

      if (ok) {
        const personalId = generatePersonalId();
        await setDoc(doc(this.db, "userProfiles", personalId), {
          personalId,
          uid: this._authUid,
          userName: ok,
          createdAt: serverTimestamp()
        });
        return { personalId, userName: ok };
      }
    }
    throw new Error("guest 作成失敗");
  }

  _randBase36(n) {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => (b % 36).toString(36)).join("");
  }

  /* =========================
     localStorage
  ========================= */
  _lastKey() {
    return `lastPersonalId_v1:${this._authUid}`;
  }

  _getLastPersonalId() {
    return localStorage.getItem(this._lastKey()) || "";
  }

  _setLastPersonalId(personalId) {
    localStorage.setItem(this._lastKey(), personalId);
  }

  _cleanupLocalStorageForUser(userName, personalId) {
    if (userName) localStorage.removeItem(`currentGroupId_v1:${userName}`);
    if (personalId) localStorage.removeItem(`currentGroupId_v1:${personalId}`);
  }
}
















