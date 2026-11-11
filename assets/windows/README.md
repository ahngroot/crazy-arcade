# Windows executable icon

`icon-source.png` is the user's original PNG from the uploaded ZIP, preserved without alteration (126×103). It includes the brown background and shortcut-arrow graphic.

The user subsequently requested removal of the brown background. `icon-transparent.png` is the image-tool background-removal result, retaining the character and shortcut arrow. It is an edited derivative, not a pixel-identical original.

`app.ico` contains 16, 24, 32, 48, 64, 128 and 256 pixel entries. Sizes up to 64 use standard Windows 32-bit DIB images with alpha and AND masks; 128/256 use PNG. The transparent image is fitted proportionally into a 256×256 transparent square with Lanczos filtering, then exported to ICO. Small Windows icon sizes necessarily resample the image. The resource language is neutral (0).

The ZIP extracts into `crazy-myangcade-bazzi/` to give Explorer a fresh path instead of reusing an earlier file-icon cache. The executable name remains `crazy-myangcade.exe`. This is a compatibility revision following the user's report of a generic icon; a native Windows Explorer check remains necessary.

The packaging script replaces Node's icon resources before injecting the SEA payload, and verifies all seven icon image payloads after injection. Future Windows packages retain this icon. This changes the EXE file icon; the game's browser window remains controlled by the browser.
