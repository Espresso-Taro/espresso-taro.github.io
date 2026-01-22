const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

function scopeIdsFromScore(s) {
  const diff = s.difficulty || "normal";
  const ids = [{ scopeId: `overall_${diff}`, meta: { scopeType: "overall", difficulty: diff } }];

  if (s.isDailyTask && s.dateKey && s.dailyTaskKey) {
    ids.push({
      scopeId: `daily_${s.dateKey}_${diff}_${s.dailyTaskKey}`,
      meta: { scopeType: "daily", difficulty: diff, dateKey: s.dateKey, dailyTaskKey: s.dailyTaskKey }
    });
  }

  if (s.groupId) {
    ids.push({
      scopeId: `group_${s.groupId}_${diff}`,
      meta: { scopeType: "group", difficulty: diff, groupId: s.groupId }
    });
  }
  return ids;
}

function entryFromScore(s) {
  return {
    personalId: s.personalId,
    userName: s.userName || "(unknown)",
    cpm: Number(s.cpm || 0),
    timeSec: Number(s.timeSec || 0),
    rank: s.rank ?? null,
    uid: s.uid ?? null,
    createdAt: s.createdAt || admin.firestore.FieldValue.serverTimestamp()
  };
}

async function updateOneScope(scopeId, meta, entry) {
  const bestRef = db.doc(`leaderboardBest/${scopeId}/users/${entry.personalId}`);
  const boardRef = db.doc(`leaderboards/${scopeId}`);

  await db.runTransaction(async (tx) => {
    const bestSnap = await tx.get(bestRef);
    const prev = bestSnap.exists ? bestSnap.data() : null;

    // 既存best >= 新スコアなら何もしない
    if (prev && Number(prev.cpm || 0) >= entry.cpm) return;

    tx.set(bestRef, { ...entry, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const boardSnap = await tx.get(boardRef);
    const board = boardSnap.exists ? boardSnap.data() : null;
    const top = Array.isArray(board?.top) ? board.top : [];

    // personalId重複排除して差し替え
    const next = top.filter(x => x.personalId !== entry.personalId);
    next.push(entry);

    // cpm desc 上位10
    next.sort((a, b) => Number(b.cpm || 0) - Number(a.cpm || 0));
    const newTop = next.slice(0, 10);

    tx.set(boardRef, {
      ...meta,
      scopeId,
      top: newTop,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

exports.onScoreCreate = functions.firestore
  .document("scores/{id}")
  .onCreate(async (snap) => {
    const s = snap.data();
    if (!s?.personalId) return;

    const entry = entryFromScore(s);
    const scopes = scopeIdsFromScore(s);

    await Promise.all(scopes.map(x => updateOneScope(x.scopeId, x.meta, entry)));
  });
