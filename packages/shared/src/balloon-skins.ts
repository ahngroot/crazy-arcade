/** Cosmetic IDs: 0 is the existing balloon, 1–14 are the user's supplied images. */
export const BALLOON_SKIN_COUNT = 15;
export function isBalloonSkinId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < BALLOON_SKIN_COUNT
  );
}
