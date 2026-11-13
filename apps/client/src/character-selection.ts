import {
  CHARACTERS,
  isCharacterId,
  RODUMANI_CHARACTER_ID,
} from "@bubble/shared";
import atlasUrl from "./assets/characters.png";
import pirateUrl from "./assets/practice-pirate/volume.png";
let selected = 0;
try {
  const saved = Number(localStorage.getItem("myangcade-character") ?? 0);
  if (isCharacterId(saved)) selected = saved;
} catch {}
export const selectedCharacter = () => selected;
export function characterPortrait(id: number) {
  if (id === RODUMANI_CHARACTER_ID)
    return `<span class="character-portrait" aria-hidden="true" style="background-image:url('${pirateUrl}');background-size:200% 200%;background-position:0 0;image-rendering:auto"></span>`;
  return `<span class="character-portrait" aria-hidden="true" style="background-image:url('${atlasUrl}');background-position:${((id % 4) * 100) / 3}% ${(Math.floor(id / 4) * 100) / 3}%"></span>`;
}
export function characterPicker() {
  return `<fieldset class="character-picker"><legend>캐릭터 선택</legend><p>모든 캐릭터의 능력치는 동일합니다.</p><div role="radiogroup" aria-label="캐릭터 선택">${CHARACTERS.map((name, id) => `<button type="button" role="radio" aria-checked="${selected === id}" aria-label="${name}" data-character="${id}">${characterPortrait(id)}<small>${name}</small></button>`).join("")}</div><p id="selected-character">선택: ${CHARACTERS[selected]}</p></fieldset>`;
}
export function bindCharacterPicker() {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-character]"),
  ];
  const choose = (id: number) => {
    selected = id;
    buttons.forEach((b) =>
      b.setAttribute(
        "aria-checked",
        String(Number(b.dataset.character) === id),
      ),
    );
    document.querySelector("#selected-character")!.textContent =
      `선택: ${CHARACTERS[id]}`;
    try {
      localStorage.setItem("myangcade-character", String(id));
    } catch {}
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () =>
      choose(Number(button.dataset.character)),
    );
    button.addEventListener("keydown", (e) => {
      const direction = ["ArrowRight", "ArrowDown"].includes(e.key)
        ? 1
        : ["ArrowLeft", "ArrowUp"].includes(e.key)
          ? -1
          : 0;
      if (!direction) return;
      e.preventDefault();
      const id =
        (Number(button.dataset.character) + direction + CHARACTERS.length) %
        CHARACTERS.length;
      choose(id);
      buttons[id].focus();
    });
  });
}
