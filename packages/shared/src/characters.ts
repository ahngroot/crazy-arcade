/** Appearance only: every selection uses the same player rules and starting stats. */
export const CHARACTERS = [
  "배찌",
  "우니",
  "노랑 후드",
  "럭셔리 마리드",
  "슈퍼 다오",
  "슈",
  "디지니",
  "다오",
  "에띠",
  "모스",
  "후우",
  "마리드",
  "케피",
] as const;
export function isCharacterId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < CHARACTERS.length
  );
}
