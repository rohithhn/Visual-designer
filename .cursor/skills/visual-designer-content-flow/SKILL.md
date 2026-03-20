---
name: visual-designer-content-flow
description: >
  Governs the Enkrypt Visual Designer pipeline: paste-to-preview flow, content API (heading/subheading/footer extraction),
  visual brief construction, and image generation prompting. Use this skill whenever modifying ANY of the following:
  content generation logic, image generation prompts or constraints, the visual brief / imagePromptBuilder.ts,
  slot layout or text slot height, background rules ("one bg" enforcement), brand color application in images,
  or the paste-to-preview rendering pipeline. Also apply when debugging image output issues (wrong background,
  red accents on non-threat content, missing red on threat content, double-layer cards, transparent fills, oversized slots,
  generic/bland/safe visuals, missed illustration opportunities).
---

# Visual Designer: Content + Image Flow

## Architecture Overview

| Stage | File / API | Input → Output |
|---|---|---|
| 1. Content | Content/Structure API | Raw pasted text → `heading`, `subheading`, `footer` (JSON) |
| 2. Visual Brief | `imagePromptBuilder.ts` → `buildVisualBrief()` | Pasted text + content JSON → structured 7-field visual brief |
| 3. Image | Image Generation API | Structured brief + theme + constraints → single background image |
| 4. Slots | Layout / Preview renderer | `heading`, `subheading`, `footer` → text slots composited over image |

**Key principle:** Heading, subheading, and footer are **never rendered inside the image**. They live in their own text slots. The image is built around the *topic and mood* of the content, not its literal title text.

---

## Stage 1 — Content API (paste → structured fields)

- **Input:** Raw pasted text (+ optional custom instructions / source image)
- **Output:** JSON `{ heading, subheading, footer }`
- These three fields are displayed by the app in separate **text slots** overlaid on the image.

---

## Stage 2 — Visual Brief (`imagePromptBuilder.ts`)

**File:** `src/app/utils/imagePromptBuilder.ts`

### How it works

1. **`buildVisualBrief(rawContent, content, apiKey, provider)`** — calls the LLM with a structured analysis prompt (see below). Returns a 7-field brief.
2. **`getFallbackVisualBrief(content)`** — used when no raw content or API fails. Runs `detectRedSignal()` on heading/subheading/footer and produces a structured brief matching the same format.
3. **`buildContentAndVisualBlock(content, visualBrief, omitContentTextInImage)`** — wraps the brief into the final prompt block. Extracts the `RED DECISION` field and surfaces it as a top-level `⚑ RED COLOR INSTRUCTION` line so the image model cannot miss it.

### LLM call settings

- `temperature: 0.75` — creative but grounded
- `max_tokens: 700` — enough for a full structured brief
- Content truncated at 3000 chars for the prompt

### The structured brief format (7 required fields)

Every brief — whether LLM-generated or fallback — must output these fields in order:

```
VISUAL TYPE: [one of 7 types — see below]
RED DECISION: [ACTIVE — apply red #D92D20 to: {exact element names} | INACTIVE — do NOT use red anywhere]
COMPOSITION: [focal point] + [zone layout %] + [depth layers] + [creative surprise]
SUBJECT: [concrete domain artefacts — no category words]
STYLE: [one style committed fully]
PALETTE: [all slots: background, primary, secondary, optional third, neutrals, text, red scope, green scope]
SUPPORTING TEXT: [specific labels, stats, badges, code fragments, annotations to include]
```

**Why structured fields matter:** The image model receives these as discrete instructions. The `RED DECISION` field is extracted by `buildContentAndVisualBlock` and surfaced separately as `⚑ RED COLOR INSTRUCTION` in the prompt — so even if the image model skims the brief, it still hits the red instruction.

---

## Red Color — How It Actually Works

### Step 1: `detectRedSignal()` scans the raw content

The `THREAT_SIGNALS` array in `imagePromptBuilder.ts` is the source of truth. Add signals here to expand detection:

```ts
const THREAT_SIGNALS = [
  "attack", "threat", "adversarial", "jailbreak", "prompt injection", "exploit",
  "breach", "vulnerability", "cve", "red team", "red teaming", "malicious", "bypass",
  "evasion", "data poisoning", "poisoning", "backdoor", "compromise", "intrusion",
  "exfiltration", "risk", "danger", "critical", "severe", "high severity", "unsafe",
  "failure mode", "incident", "data leak", "non-compliant", "policy violation",
  "flagged", "blocked", "denied", "attack vector", "zero-day", "ransomware",
];
```

`getFallbackVisualBrief` uses this directly. The LLM in `buildVisualBrief` is instructed to run the same scan semantically (catching paraphrases, implicit threat scenarios, before/after structures).

### Step 2: `buildVisualBrief` LLM prompt forces an explicit decision

The LLM is instructed:
- Run the signal scan **first, before any creative decisions**
- Output `RED DECISION: ACTIVE — apply red #D92D20 to: {exact named element}` or `RED DECISION: INACTIVE — do NOT use red anywhere`
- For ACTIVE: name specific elements (e.g. "the attack node in the network diagram, the terminal line showing the malicious prompt")

### Step 3: `buildContentAndVisualBlock` extracts and surfaces the decision

```ts
const match = visualBrief.match(/RED DECISION:\s*(.+?)(?:\n|$)/i);
if (match) {
  redInstruction = `\n⚑ RED COLOR INSTRUCTION (mandatory — override any defaults): ${match[1].trim()}\n`;
}
```

This `⚑` line appears at the top of the content block — before the full brief — so the image model reads it early in context.

### Step 4: `brandColorRules` in LeftPanel.tsx references the decision

The static brand color rules tell the image model:
> "Read the ⚑ RED COLOR INSTRUCTION and RED DECISION field. If ACTIVE, apply red to ONLY the named element. If INACTIVE, do NOT use red anywhere — not as border, frame, accent, glow, or emphasis."

### Red element targeting (when ACTIVE)

| Content element | How to target in brief |
|---|---|
| Attack node in network diagram | "red fill + soft red glow on the attack node glyph only" |
| CVE badge | "red background pill with white CVE identifier text" |
| Threat badge / severity label | "red background, white text — 'CRITICAL' or 'HIGH'" |
| Before/after split — "before" panel | "red tint overlay (#D92D20 at 15% opacity) on the compromised panel" |
| Danger step in process flow | "red circle for step number, red connector arrow to next step" |
| Cracked / compromised element | "red fracture lines radiating from break point" |
| Intrusion path arrow | "red dashed directional arrow showing attack vector" |
| Terminal line showing malicious input | "red-colored text on the injected line only" |
| Risk score above threshold | "red numeral with red upward arrow" |

---

## Stage 3 — Image Generation Prompt (LeftPanel.tsx)

The final `imgPrompt` string is assembled in `generateSingleVisual()` and has this structure:

```
[role sentence]
[templateCtx — theme color/mood reference]
[brandColorRules — includes red decision reference]
--- CONTENT & VISUAL DIRECTION ---
[contentAndVisualBlock — includes ⚑ RED INSTRUCTION + full 7-field brief]
---
[layoutCtx]
[visualSlotSizeCtx]
REQUIREMENTS:
  [one-background rule]
  [no thick border]
  [curved corners]
  [no logo]
  [palette + aspect ratio]
```

### Dynamic creative direction — what the brief drives

The 7-field brief is the creative engine. It tells the image model:

**VISUAL TYPE** — which format to use. This determines the entire output character:
| Type | Output character |
|---|---|
| `diagram-illustration` | Technical precision with illustration polish — not a bare whiteboard diagram |
| `editorial-illustration` | Bold abstract shapes, metaphorical, magazine-cover energy |
| `abstract-illustration` | Pure form and color — no literal subject, mood is the message |
| `icon-diagram` | Icons as spatial heroes — strong layout logic, not decoration |
| `data-visualization` | Data is the subject — numbers, charts, trends |
| `dark-technical` | Near-black BG, glowing nodes, terminal/hacker aesthetic |
| `product-ui` | Partial screen fragments, device frames, UI components |

**COMPOSITION** — zone structure + creative surprise. Examples:
- "Left 60%: neural network diagram. Right 40%: 3 stacked stat callouts. Hero attack node at 3× scale — size conveys severity. Creative surprise: nodes arranged in shape of a shield."
- "Single enormous KPI numeral occupying 55% of canvas, floating in warm off-white space. Supporting sparkline lower-left, trend arrow pointing up-right."
- "Diagonal composition — primary element anchored lower-left, energy flows to upper-right. Nothing on the horizontal axis."

**STYLE** — committed single style:
| Style | BG | Character |
|---|---|---|
| `flat-vector-precise` | Light | Clean edges, exact geometry, no object gradients |
| `dark-editorial` | Near-black #0D0F14 | Glowing accents, scanline texture, high contrast |
| `bold-color-block` | Any | Bauhaus-level color zones, minimal detail |
| `editorial-illustration` | Light | Painterly-meets-digital, expressive shapes |
| `glassmorphism` | Light | Frosted panels, backdrop blur, layered depth |
| `isometric-precision` | Light | 30° isometric grid, ambient shadow layers |
| `cinematic-duotone` | Dark | Two-color film treatment, uneven bleed |
| `abstract-geometric` | Any | Pure shape and form, extreme scale contrasts |

**PALETTE** — full palette with all slots named. Permitted accents beyond brand orange/pink:
- Electric teal `#06B6D4` — AI/ML nodes, data streams, tech-positive elements
- Violet `#7C3AED` — embedding space, AI model visualization
- Amber `#F59E0B` — process highlights, step numbers, warmth
- Deep navy `#0A0F1E` / near-black `#0D0F14` / deep teal `#0F2A2A` — valid dark backgrounds for security content

---

## Stage 4 — Text Slot Height

Slot height must **hug the text** with no extra padding.

**Formula:**
```
slot height = ascent + measureWrappedHeight(text, font, lineHeight)
```

- `ascent` ≈ 0.65–0.75 × font size (space above baseline for first line)
- `measureWrappedHeight` uses the same font and line height as the drawing pass
- **Do not add** extra bottom padding (no `+ fontSize * 0.6`, no fixed minimum)

---

## Common Failure Modes

### Red color failures

| Symptom | Root cause | Fix |
|---|---|---|
| No red on threat/attack content | `THREAT_SIGNALS` doesn't cover the phrasing used | Add the missed phrase to `THREAT_SIGNALS` array in `imagePromptBuilder.ts` |
| Brief says ACTIVE but image ignores it | `buildContentAndVisualBlock` regex failed to extract RED DECISION | Check brief format — RED DECISION must be on its own line with no prefix |
| Red spread decoratively across image | Brief scoped red too loosely ("use red as accent") | Name the EXACT element: "attack node glyph only — no red elsewhere" |
| Red on non-threat content | `detectRedSignal` false positive OR LLM misread INACTIVE | Check the raw content; if LLM hallucinated ACTIVE, the content has threat-adjacent language |
| Red on borders/frames despite INACTIVE | `brandColorRules` not being followed | The instruction is already in place; may indicate an image model compliance issue — add "no red anywhere including borders and frames" to the SUPPORTING TEXT field |

### Creativity / quality failures

| Symptom | Root cause | Fix |
|---|---|---|
| Generic stock-art output | VISUAL TYPE defaulted to icon-diagram for non-diagram content | Set VISUAL TYPE to editorial-illustration or abstract-illustration for concept/strategy content |
| Boring flat composition | No creative surprise in COMPOSITION field | Add: scale contrast (hero 3× others), diagonal tension, extreme negative space, or off-canvas bleed |
| All elements same weight | No focal point specified | One hero element at 2–3× the scale of all supporting elements |
| Safe palette, looks AI-generated | Only orange/pink in PALETTE | Add a third accent (teal, violet, amber) and vary saturation — supporting elements at 60–70% of hero saturation |
| Feels like a PowerPoint slide | Too many equal elements, no depth | Reduce to 3–5 elements max; add foreground/midground/background depth layers |
| Illustration opportunity missed | Defaulted to icons for thought leadership content | Use `editorial-illustration` or `abstract-illustration` for non-technical, concept-heavy content |
| Dark security content looks washed out | Light palette used for dark-technical content | Switch PALETTE to deep navy/near-black background; use cool white #F0F4FF for labels |

### Background / layout failures

| Symptom | Root cause | Fix |
|---|---|---|
| White card on colored gradient | Model defaulted to 2-layer composition | One-background rule is in `imgPrompt` REQUIREMENTS — if persisting, add "NO floating cards or panels" to SUPPORTING TEXT field |
| Transparent / missing background | Prompt said "transparent" somewhere | Always use "single flat fill at 20–30% opacity" language |
| Everything crammed | No breathing room instruction | Add "generous padding, nothing touches edges" to COMPOSITION field in brief |

### Style / rendering failures

| Symptom | Root cause | Fix |
|---|---|---|
| Photorealistic output | STYLE not specified | `buildVisualBrief` must always set STYLE field |
| Mixed styles | STYLE not committed | State one style in STYLE field; add "commit fully — no style mixing" |
| Sharp rectangular containers | Curved corners rule missed | Rule is in REQUIREMENTS block of `imgPrompt` — already enforced |

### Content failures

| Symptom | Root cause | Fix |
|---|---|---|
| Heading/subheading in image | `omitContentTextInImage` wasn't set | Check the flag; `buildContentAndVisualBlock` adds the "do not render" instruction |
| Generic image unrelated to content | Brief used heading only, LLM didn't mine content | Ensure raw content is passed to `buildVisualBrief` (not empty); check content truncation at 3000 chars |
| No information value, purely decorative | SUPPORTING TEXT field was too vague | Be explicit: "CVE-2024-XXXX badge", "94% detection rate with arrow", "'BLOCKED' status label" |

### Slot failures

| Symptom | Root cause | Fix |
|---|---|---|
| Slot too tall, extra space below text | Extra bottom padding in height calc | Remove `+ fontSize * 0.6`; use `ascent + wrappedHeight` only |

---

## When NOT to apply this skill

- Changes to the Nanobanana/image API integration layer that don't affect prompt construction
- UI changes outside the preview/slot rendering area
- Content API schema changes unrelated to `heading`, `subheading`, `footer` fields
- General React or Next.js component work with no connection to the visual designer pipeline
