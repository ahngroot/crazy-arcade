# Refined balloon art

Created with the image tool from the user's uploaded source PNGs after the user
requested cleaner artwork with close visual resemblance. These are refinements,
not pixel-identical copies or a measured 90% similarity result. The original files
remain under ../balloon-skins/ and ../placed-balloon.png.

Each atlas has 2 columns and 2 rows, in reading order:

- a.png: IDs 1, 2, 3, 4
- b.png: IDs 5, 6, 7, 8
- c.png: IDs 9, 10, 11, 12
- d.png: IDs 13, 14, 0, empty

balloon-art.ts records the body rectangles for these exact atlas dimensions.
When replacing an atlas, recheck those rectangles and the optical width report.
Transparent specks outside the connected sprite are discarded at runtime.
