import { balloonSkins, balloonSkin } from "./balloon-skins";

let selected = 0;
try {
  selected = balloonSkin(
    Number(localStorage.getItem("myangcade-balloon") ?? 0),
  ).id;
} catch {}
export const selectedBalloon = () => selected;
export function balloonPicker() {
  return `<fieldset class="character-picker balloon-picker"><legend>물풍선 선택</legend><p>모든 물풍선의 성능은 동일합니다.</p><div role="radiogroup" aria-label="물풍선 선택">${balloonSkins.map(({ id, url }) => `<button type="button" role="radio" aria-checked="${selected === id}" aria-label="물풍선 ${id + 1}" data-balloon-skin="${id}"><img src="${url}" alt="" width="44" height="46" /></button>`).join("")}</div></fieldset>`;
}
export function bindBalloonPicker() {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-balloon-skin]"),
  ];
  const choose = (button: HTMLButtonElement) => {
    selected = balloonSkin(Number(button.dataset.balloonSkin)).id;
    buttons.forEach((b) =>
      b.setAttribute(
        "aria-checked",
        String(Number(b.dataset.balloonSkin) === selected),
      ),
    );
    try {
      localStorage.setItem("myangcade-balloon", String(selected));
    } catch {}
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => choose(button));
    button.addEventListener("keydown", (event) => {
      const step = ["ArrowRight", "ArrowDown"].includes(event.key)
        ? 1
        : ["ArrowLeft", "ArrowUp"].includes(event.key)
          ? -1
          : 0;
      if (!step) return;
      event.preventDefault();
      const next = buttons[(index + step + buttons.length) % buttons.length];
      choose(next);
      next.focus();
    });
  });
}
