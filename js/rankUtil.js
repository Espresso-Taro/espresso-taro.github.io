export function rankByCPM(cpm, difficulty = "normal") {
  const base = Number(cpm) || 0;
  const k =
    difficulty === "easy" ? 1.05 :
    difficulty === "hard" ? 0.92 : 1.0;
  const v = base / k;

  const thresholds = [
    ["G-", 0], ["G", 7], ["G+", 14],
    ["F-", 21], ["F", 28], ["F+", 35],
    ["E-", 42], ["E", 49], ["E+", 56],
    ["D-", 63], ["D", 70], ["D+", 77],
    ["C-", 84], ["C", 91], ["C+", 98],
    ["B-", 105], ["B", 112], ["B+", 119],
    ["A-", 126], ["A", 133], ["A+", 140],
    ["S-", 147], ["S", 154], ["S+", 161],
    ["SS-", 168], ["SS", 175], ["SS+", 182],
    ["SSS-", 189], ["SSS", 196], ["SSS+", 203],
  ];

  let r = "G-";
  for (const [name, need] of thresholds) {
    if (v >= need) r = name;
    else break;
  }
  return r;
}


/* =========================================================
   追加：ランク比較用インデックス
========================================================= */
export function rankIndex(rank) {
  if (!rank) return -1;

  // + / - を含めた完全順序（低→高）
  const order = [
    "G-", "G", "G+",
    "F-", "F", "F+",
    "E-", "E", "E+",
    "D-", "D", "D+",
    "C-", "C", "C+",
    "B-", "B", "B+",
    "A-", "A", "A+",
    "S-", "S", "S+",
    "SS-", "SS", "SS+",
    "SSS-", "SSS", "SSS+"
  ];

  return order.indexOf(rank);
}
