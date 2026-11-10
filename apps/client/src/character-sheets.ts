import a from "./assets/characters-walk-a.png";
import b from "./assets/characters-walk-b.png";
import c from "./assets/characters-walk-c.png";
import d from "./assets/characters-walk-d.png";

/** Each pair of rows is right profile / back; columns are the four walking steps.
 * Replace an entry's sheet or rows when a more accurate reference becomes available.
 * Bazzi and Shu's supplied side profiles remain in character-motion.png.
 */
export const CHARACTER_SHEETS = [
  { url: a, ids: [1, 2, 3] },
  { url: b, ids: [4, 6, 7] },
  { url: c, ids: [8, 9, 10] },
  { url: d, ids: [11, 12, 5] },
] as const;
