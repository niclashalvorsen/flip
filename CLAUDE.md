# ARrom — Project Rules & Requirements

## What This Project Is
ARrom is a web-based AR product visualisation platform for Norwegian retail.
Users browse products and place them in their real home using augmented reality,
directly in the phone browser — no app download required.

---

## Non-Negotiable Rules

### 1. Models must always be 1:1 real-world scale
- GLB files must be scaled in metres (1 unit = 1 metre)
- `ar-scale="fixed"` must always be set when using model-viewer
- **Never** scale a placed model up or down for any reason, including zoom
- Dimensions come from the retailer product page, parsed by Claude API

### 2. No model scaling disguised as zoom
- Zoom features that scale 3D models are forbidden
- True camera zoom in WebXR is not possible (XR compositor controls the feed)
- If zoom is needed in future, it requires a native app (ARKit/ARCore)

### 3. AR placement uses WebXR + Three.js, not model-viewer
- `<model-viewer>` is only used for the 3D preview before AR is activated
- The AR scene (camera feed + placed objects) is built with Three.js + WebXR hit-test API
- Hit-test source uses `viewer` space for floor detection
- Objects snap to detected floor plane via reticle

### 4. HTTPS always
- AR will not work on HTTP — always serve over HTTPS
- GitHub Pages handles this for the deployed site

---

## Architecture Decisions (Do Not Undo)

- **Frontend:** React PWA, Vite, no TypeScript
- **3D/AR:** Three.js (AR scene) + Google model-viewer (3D preview only)
- **GLB format** for Android/web, USDZ for iOS Quick Look
- **iOS:** WebXR not supported in Safari — show unsupported message, do not fake it
- **Routing:** Simple React state machine (no react-router), views: home → AR scene
- **Lazy loading:** ARScene (Three.js) is lazy-loaded — only downloads when AR starts
- **Assets:** GLB files go in `public/`, referenced with `import.meta.env.BASE_URL`
- **Deploy:** GitHub Actions → GitHub Pages, base path `/flip/`

---

## AR Scene Interaction Model

- **Tap object** → select it (highlighted), follows reticle as you move
- **"Legg til her" button** → place new object at reticle position
- **"Fjern" button** → remove selected object (only shown when selected)
- **Rotation slider** → appears when object is selected, 0–359°, drives `rotation.y`
- **"Ferdig" button** → exit AR
- No tap-to-place (avoids accidental placement)
- No zoom in AR

---

## Product Pipeline Requirements

- Dimensions scraped from retailer product page (H×W×D, Norwegian format)
- Claude API parses raw text → `{ height_cm, width_cm, depth_cm }`
- Norwegian retailers list dimensions as B×H×D or H×B×D — verify per retailer
- Height passed to Meshy API in metres for 3D generation
- GLB compressed to under 5MB with gltf-transform
- Bounding box validated after generation (flag if >10% off expected dimensions)

---

## What We Have Proven (POC Done)
- WebXR AR placement works on Android Chrome
- Three.js hit-test floor detection works
- Object selection, movement, and rotation (slider) work
- Multiple objects can be placed simultaneously
- GLB loads from GitHub Pages via `import.meta.env.BASE_URL`

---

## Target Retailers (Priority Order)
1. Flisekompaniet — tiles/flooring (Phase 1)
2. Boen — parkett (Phase 1)
3. Jotun — paint colours (Phase 1, texture only)
4. Bohus, Skeidar — furniture (Phase 2)
5. Maxbo, Byggmakker — outdoor/terrasse (Phase 3)
