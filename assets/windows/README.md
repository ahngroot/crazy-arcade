# Windows executable icon

`icon-source.png` is the user's original PNG from the uploaded ZIP, preserved without alteration (126×103). It includes the brown background and shortcut-arrow graphic.

The user subsequently requested removal of the brown background. `icon-transparent.png` is the image-tool background-removal result, retaining the character and shortcut arrow. It is an edited derivative, not a pixel-identical original.

`app.ico` contains 16, 24, 32, 48, 64, 128 and 256 pixel PNG entries. The transparent image is fitted proportionally into a 256×256 transparent square with Lanczos filtering, then exported to ICO. Small Windows icon sizes necessarily resample the image.

The packaging script replaces Node's icon resources before injecting the SEA payload, and verifies all seven icon image payloads after injection. Future Windows packages retain this icon. This changes the EXE file icon; the game's browser window remains controlled by the browser.
