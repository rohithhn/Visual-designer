---
name: studio-canvas-editor
description: >
  Governs the Studio tab — a fully editable fabric.js canvas editor grounded to the 1:1 background
  and Enkrypt logo. The AI generates content (heading/subheading/footer) AND an SVG visual (via
  GPT-4o-mini text API — cheap, no image API) parsed into individually editable fabric.js objects.
  Use this skill for ALL modifications to: StudioCanvas.tsx, StudioPanel.tsx, StudioToolbar.tsx,
  StudioPropertiesPanel.tsx, studioSVGGenerator.ts, studioLayoutGenerator.ts,
  studioComponentRenderer.ts, studioGenerator.ts, the 3-layer compositing system, the SVG engine,
  text slot construction, or the PNG export pipeline.
---

# Studio Canvas Editor

## Architecture Overview

```
Layer 1  HTML <img>        bg-1x1.png               Fixed. Never editable.
Layer 2  HTML <img>        enkrypt-logo.png          Fixed top-left. Never editable.
Layer 3  fabric.Canvas     SVG visual objects         Fully editable — each SVG element is a separate object.
                           + Text slots (H/Sub/F)
                           + AI image (v2 only)
```

The fabric canvas has `backgroundColor: "transparent"` so layers 1 and 2 show through.
Export composites all 3 layers on an offscreen HTML5 canvas → PNG.

---

## File Map

| File | Role |
|---|---|
| `src/app/components/StudioPanel.tsx` | Top-level: variant picker, left inputs, center canvas, right properties, generation orchestration |
| `src/app/components/StudioCanvas.tsx` | fabric.js canvas component — imperative API, history, export |
| `src/app/components/StudioToolbar.tsx` | Toolbar: select / add text / add rect / add circle / undo / redo / ungroup / delete / layer / download |
| `src/app/components/StudioPropertiesPanel.tsx` | Right panel: all editable properties for selected object + brand colour quick-picks |
| `src/app/utils/studioSVGGenerator.ts` | **Core SVG engine**: GPT-4o-mini generates SVG string → visual slot coordinates |
| `src/app/utils/studioLayoutGenerator.ts` | `generateStudioContent()` only (heading/sub/footer extraction). `generateLayout()` is deprecated. |
| `src/app/utils/studioComponentRenderer.ts` | `buildTextSlots()` (still used); `renderLayout()` and `renderAIImage()` are secondary |
| `src/app/utils/studioGenerator.ts` | v2 AI background image generation (OpenAI / Gemini image APIs) |

---

## Two Variants

### v1 — Design
1. User pastes raw content (+ optional visual direction hint)
2. `generateStudioContent()` → heading / subheading / footer
3. `generateVisualSVG()` → SVG string (GPT-4o-mini text API, cheap)
4. `StudioCanvas.renderSVG(svgString, content)` → `fabric.loadSVGFromString()` → each SVG element becomes an individually selectable fabric object, offset into the visual slot
5. `buildTextSlots(content)` overlaid on top (always editable)
6. User edits everything freely

### v2 — AI + Design
Steps 1–6 above, then:
7. User clicks "Generate AI image"
8. `generateStudioImage()` → AI background image placed behind all objects via `renderAIImageLayer()`

---

## Generation Flow (StudioPanel.tsx)

```
genStep: "idle" → "content" → "svg" → "done"
                                     → "image" (v2 only) → "done"
```

- Step "content": `generateStudioContent()` runs → sets `content` state
- Step "svg": `generateVisualSVG()` runs → calls `canvasRef.current.renderSVG(svg, content)` directly (no useEffect needed)
- `canvasReady` set to `true` after `renderSVG()` resolves

---

## SVG Engine (studioSVGGenerator.ts)

### Visual Slot Constants
```ts
CANVAS_RES  = 1080   // full canvas
SVG_SLOT_Y  = 260    // visual zone top (px) — below subheading
SVG_SLOT_H  = 635    // visual zone height (px) — stops before footer
SVG_SLOT_W  = 1080   // full width
```

### SVG Generation Prompt Rules
The AI is told to generate SVG with viewBox `0 0 1080 635` and:
- **Allowed**: `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<path>`, `<text>`, `<tspan>`, `<g>`
- **Forbidden**: `<defs>`, gradients, filters, `clipPath`, `mask`, `pattern`, `<use>`
- All fill/stroke as direct attributes (no CSS classes, no inline style)
- No background rect (bg-1x1.png handles the background)
- Arrowheads drawn manually as `<path>` triangles

### SVG → Fabric Pipeline (StudioCanvas.tsx `renderSVG`)
```ts
async renderSVG(svgString: string, content: GeneratedContent) {
  fc.clear();
  const { objects } = await fabric.loadSVGFromString(svgString);
  objects.forEach(obj => {
    obj.set({ top: obj.top + SVG_SLOT_Y, selectable: true, evented: true });
    fc.add(obj);
  });
  buildTextSlots(content).forEach(slot => {
    fc.add(slot);
    fc.bringObjectToFront(slot);
  });
}
```

**Key**: `SVG_SLOT_Y` offset places the SVG (which has Y starting at 0) into the correct canvas position below the subheading.

### Threat Detection
`hasThreat()` scans all text (raw content + heading + sub + footer + instruction) against `THREAT_SIGNALS`.
- Threat detected → AI uses `#D92D20` on threat-specific elements (attack nodes, danger labels) only
- No threat → AI explicitly told: no red anywhere

---

## Text Slot Positions (buildTextSlots in studioComponentRenderer.ts)

| Slot | Y position | FontSize | Note |
|---|---|---|---|
| Heading | `CANVAS_RES * 0.07` = 76px | 72px | White, bold |
| Subheading | `CANVAS_RES * 0.175` = 189px | 44px | Dark, medium |
| Footer | `CANVAS_RES * 0.855` = 923px | 36px | White, regular |

These sit at fixed positions. `SVG_SLOT_Y = 260` is derived from subheading bottom (~240px) + gap.

All three slots are `fabric.Textbox` — selectable, draggable, double-click to edit inline.

---

## Export Pipeline (StudioCanvas.tsx `exportPNG()`)

```
1. Create offscreen canvas (1080×1080)
2. drawImage(bg1x1, 0, 0, 1080, 1080)           ← Layer 1: background
3. drawImage(logo, top=43px, left=43px, h=43px)   ← Layer 2: logo
4. fc.toDataURL({ format:'png', multiplier:1 })
   drawImage(fabricDataURL, 0, 0, 1080, 1080)     ← Layer 3: all fabric objects (SVG + text slots + AI image)
5. return offscreen.toDataURL('image/png')
```

**Logo position in export must exactly match HTML overlay:** Both use `size × 0.04`.

---

## Undo / Redo (StudioCanvas.tsx)

- Snapshots: `fc.toJSON(["id", "__studioRole", "selectable", "evented", "editable"])` → `historyRef`
- `historyIdxRef` points to current state
- `suppressHistoryRef.current = true` prevents double-recording during `loadFromJSON` restores
- History resets completely on `renderSVG()` (fresh canvas = fresh history)

---

## Ungroup (StudioCanvas.tsx `ungroupSelected()`)

```ts
const items = group.removeAll();
fc.remove(group);
items.forEach(item => {
  const matrix = group.calcTransformMatrix();
  const point = fabric.util.transformPoint(new fabric.Point(item.left, item.top), matrix);
  item.set({ left: point.x, top: point.y, selectable: true, evented: true });
  fc.add(item);
});
```

Groups come from `<g>` elements in the SVG. Ungrouping lets users edit individual paths within a group.

---

## Brand Palette

| Token | Hex | Use |
|---|---|---|
| Orange | `#F97316` | Hero elements, stat values, CTA containers |
| Pink | `#EC4899` | Gradients, secondary accents, badge fills |
| Teal | `#06B6D4` | AI/ML nodes, data elements, tech accents |
| Violet | `#7C3AED` | Embedding spaces, model visualization |
| Amber | `#F59E0B` | Warning states, process highlights |
| Red | `#D92D20` | THREAT elements only — attack nodes, danger badges |
| Green | `#16A34A` | Success / secure / protected states only |
| Navy | `#0A0F1E` | Dark editorial backgrounds |
| Near-black | `#0D0F14` | Dark technical backgrounds |
| Slate | `#64748B` | Neutral text, dividers, supporting elements |
| Off-white | `#FAF9F7` | Light container fills |

---

## Common Failure Modes

### SVG engine failures

| Symptom | Root cause | Fix |
|---|---|---|
| Canvas blank after Generate | `renderSVG` called before `StudioCanvas` is mounted | Ensure `showCanvas` is true before the canvas component renders; canvas mounts on first render and keeps its ref |
| "LLM did not return valid SVG" | LLM output has markdown fences or extra text | `extractSVG()` strips fences and finds `<svg...>...</svg>`; if still failing, fallback SVG is used |
| SVG objects at wrong Y position | `SVG_SLOT_Y` offset not applied | Verify `obj.set({ top: (obj.top ?? 0) + SVG_SLOT_Y })` in `renderSVG` |
| Objects appear grouped when they should be separate | SVG uses `<g>` for everything | SVG prompt instructs AI to use `<g>` logically; user can Ungroup from toolbar |
| fabric.loadSVGFromString() returns undefined | SVG string is malformed | Wrap in try/catch; log the SVG for debugging; fallback SVG used |

### Rendering failures

| Symptom | Root cause | Fix |
|---|---|---|
| Text slots below SVG objects | Text slots not brought to front | `buildTextSlots` calls `fc.bringObjectToFront()` on each — confirm after all SVG objects added |
| AI image covers heading/footer | Image placement not slot-aware | Check `renderAIImage` bounds: `maxH = CANVAS_RES * 0.75`, centered at `y: 0.50` |

### Canvas / layer failures

| Symptom | Root cause | Fix |
|---|---|---|
| Background not visible through canvas | `backgroundColor` not transparent | Ensure `new fabric.Canvas(el, { backgroundColor: "transparent" })` |
| Export missing background | Step order wrong | Background (step 2) must precede fabric draw (step 4) in `exportPNG()` |

---

## What NOT to Change Without Cross-Checking

| Thing | Why it matters |
|---|---|
| `CANVAS_RES = 1080` | All coordinates scale to this; export resolution |
| `SVG_SLOT_Y = 260` | Must align with where the subheading ends (0.175 * 1080 + 44px fontSize + gap) |
| Text slot Y positions in `buildTextSlots()` | Must stay in sync with General tab defaults in App.tsx |
| Logo position (`size * 0.04`) | Must be identical in HTML overlay and `exportPNG()` draw call |
| `THREAT_SIGNALS` | Shared between `studioSVGGenerator.ts` and `studioGenerator.ts` — keep in sync |

---

## When NOT to Apply This Skill

- Changes to General / Blog / Content Writer / Researcher tabs
- `PreviewPanel.tsx` (different HTML5 Canvas 2D system)
- `imagePromptBuilder.ts` (used by General/Blog, not Studio)
- Header, App.tsx structural changes unrelated to Studio routing
- `LeftPanel.tsx` (General/Blog generation pipeline)
