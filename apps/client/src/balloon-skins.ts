import { isBalloonSkinId } from "@bubble/shared";
import defaultUrl from "./assets/placed-balloon.png";
import { polishedBalloonArt } from "./balloon-art";

// Source files stay untouched; the user-approved cleanup request uses refined art.
const files = import.meta.glob<string>(
  "./assets/balloon-skins/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const sources = [
  { id: 0, url: defaultUrl },
  ...Object.entries(files).flatMap(([path, url]) => {
    const id = Number(path.match(/\/(\d+)\.[^.]+$/)?.[1]);
    return isBalloonSkinId(id) && id > 0 ? [{ id, url }] : [];
  }),
].sort((a, b) => a.id - b.id);
export const balloonSkins = await Promise.all(
  sources.map(async (skin) => {
    const canvas = polishedBalloonArt.get(skin.id)!;
    return {
      ...skin,
      sourceUrl: skin.url,
      url: canvas.toDataURL(),
      image: canvas,
    };
  }),
);
export const balloonSkin = (id: number) =>
  balloonSkins.find((skin) => skin.id === id) ?? balloonSkins[0];
export const balloonTexture = (id: number, frame = 0) => {
  const skin = balloonSkin(id);
  const key = skin.id === 0 ? "art-balloon" : `art-balloon-skin-${skin.id}`;
  return frame === 0 ? key : `${key}-flow-${frame}`;
};
