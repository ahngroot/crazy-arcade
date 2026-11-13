/** Appearance only: every selection uses the same player rules and starting stats. */
export const CHARACTERS = [
  "배찌",
  "우니",
  "슈퍼 케피",
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
  "로두마니",
] as const;
export const RODUMANI_CHARACTER_ID = 13;
export function isCharacterId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < CHARACTERS.length
  );
}
