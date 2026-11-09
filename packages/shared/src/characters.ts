/** Appearance only: every selection uses the same player rules and starting stats. */
export const CHARACTERS = [
  "초록 개구리",
  "빨강 헬멧",
  "노랑 후드",
  "검정 헬멧",
  "주황 후드",
  "은빛 머리",
  "하늘 후드",
  "보라 후드",
  "회색 머리",
  "분홍 헬멧",
  "파랑 곰",
  "초록 머리",
  "갈색 곰",
] as const;
export function isCharacterId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < CHARACTERS.length
  );
}
