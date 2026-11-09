/** Item-producing crates: ultra 5/60 (previously 1/6); other five items 11/60 each. */
const weights = [
  ["balloon", 11],
  ["range", 11],
  ["speed", 11],
  ["ultra", 5],
  ["needle", 11],
  ["shield", 11],
] as const;
export function rollCrateItem(unit: number): (typeof weights)[number][0] {
  let roll = unit * 60;
  for (const [kind, weight] of weights) {
    if (roll < weight) return kind;
    roll -= weight;
  }
  return "shield";
}
