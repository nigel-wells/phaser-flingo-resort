Offline asset trimmer

This repository includes a small Node script to preprocess character PNGs and remove background pixels by flood-filling from the image edges.

Install dependencies and run:

```bash
cd "c:/PhaserGames/Flingo Resort"
npm install
npm run trim-assets
```

Trimmed images will be written to `assets/characters/trimmed/` with the same filenames.

Notes:
- The script uses a corner-sampled background color and flood-fills edge-connected regions within a tolerance.
- It skips files that already contain alpha.
