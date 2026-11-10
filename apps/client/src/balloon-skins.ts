import { isBalloonSkinId } from "@bubble/shared";
import defaultUrl from "./assets/placed-balloon.png";
import { balloonCutout } from "./balloon-cutout";

// Only actual source files appear as choices; never show generated stand-ins.
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
    const image = new Image();
    image.src = skin.url;
    await image.decode();
    const canvas = skin.id === 0 ? image : balloonCutout(image, skin.id);
    return {
      ...skin,
      sourceUrl: skin.url,
      url: canvas instanceof HTMLCanvasElement ? canvas.toDataURL() : skin.url,
      image: canvas,
    };
  }),
);
export const balloonSkin = (id: number) =>
  balloonSkins.find((skin) => skin.id === id) ?? balloonSkins[0];
export const balloonTexture = (id: number) => {
  const skin = balloonSkin(id);
  return skin.id === 0 ? "art-balloon" : `art-balloon-skin-${skin.id}`;
};
