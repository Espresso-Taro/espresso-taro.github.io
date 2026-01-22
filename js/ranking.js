// js/ranking.js
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { rankByCPM } from "./rankUtil.js";

export class RankingService {
  constructor({ db }) {
    if (!db) throw new Error("RankingService: db required");
    this.db = db;
  }

  async loadOverall({ difficulty } = {}) {
    const diff = difficulty || "normal";
    const snap = await getDoc(doc(this.db, "leaderboards", `overall_${diff}`));
    const top = snap.exists() ? (snap.data().top || []) : [];
    return top;
  }

  async loadDailyTask({ dailyTaskKey, dateKey, difficulty } = {}) {
    if (!dailyTaskKey || !dateKey) return [];
    const diff = difficulty || "normal";
    const scopeId = `daily_${dateKey}_${diff}_${dailyTaskKey}`;
    const snap = await getDoc(doc(this.db, "leaderboards", scopeId));
    const top = snap.exists() ? (snap.data().top || []) : [];
    return top;
  }

  async loadGroup({ groupId, difficulty } = {}) {
    if (!groupId) return [];
    const diff = difficulty || "normal";
    const scopeId = `group_${groupId}_${diff}`;
    const snap = await getDoc(doc(this.db, "leaderboards", scopeId));
    const top = snap.exists() ? (snap.data().top || []) : [];
    return top;
  }

  renderList(ul, rows, { highlightPersonalId = null } = {}) {
    if (!ul) return;
    ul.innerHTML = "";

    if (!rows || rows.length === 0) {
      const li = document.createElement("li");
      li.textContent = "記録がありません";
      ul.appendChild(li);
      return;
    }

    rows.forEach((r, idx) => {
      const li = document.createElement("li");

      // ★ userNameMap を廃止し、leaderboards.top に入っている userName を使う
      const name = r.userName || "(unknown)";

      const cpm = Number(r.cpm ?? 0);
      const rank = rankByCPM(cpm);

      li.textContent = `${idx + 1}位  ${name}  ${cpm.toFixed(0)} CPM  (${rank})`;

      if (highlightPersonalId && r.personalId === highlightPersonalId) {
        li.style.fontWeight = "bold";
      }

      ul.appendChild(li);
    });
  }
}
