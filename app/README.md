# docker-scrollytelling

A single-page, scroll-driven 3D explainer of a multi-stage Dockerfile — built
with Vite, Three.js, anime.js v4, SVG, and Canvas 2D. Scroll to build the image
layer by layer; falls back to a static blueprint without WebGL or with
reduced-motion.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
```

## Test
```bash
npm test         # unit (vitest)
npm run test:e2e # smoke (playwright)
```

## Credits
- Whale model (`public/whale.glb`): "Docker logo" by David Balan — CC-BY, via [Poly Pizza](https://poly.pizza/m/54F5KRzf3UQ).
- Container model (`public/container.glb`): "Container Small" by Quaternius — CC0 (public domain), via [Poly Pizza](https://poly.pizza/m/B79i6fHgVU).
- Ambient track (`public/ambient.mp3`): "Stranger Things" by Music Unlimited — Pixabay Content License (royalty-free), via [Pixabay](https://pixabay.com/music/).

The two models are re-skinned into the blueprint style at runtime; the track loops as background audio once the visitor enables sound.
