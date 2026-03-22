---
name: enkrypt-researcher-url-rewriter
description: URL-to-opinion-piece pipeline for Enkrypt AI — fetch/extract text, analyze thesis and claims, rewrite with brand voice, attribution, and output shapes (LinkedIn, blog, snippet). Use when building Researcher mode or URL extraction APIs.
---

# Enkrypt AI — Researcher (URL → opinion piece)

**Scope:** This skill documents the **Researcher** product surface only. It does **not** replace or merge with `visual-designer-content-flow` or `enkrypt-content-writer` (though tone presets may be **referenced** consistently across apps).

## Purpose

Given a **URL** (or pasted article text when fetch is unavailable):

1. **Extract** core text, headlines, and lists; preserve **data points and stats** where present.
2. **Analyze** — main thesis, supporting arguments, cited numbers, and gaps or controversies (lightweight, not academic peer review).
3. **Rewrite** as an **Enkrypt AI opinion piece**: our positioning, differentiation, and approved tone.
4. **Attribute** the original source clearly.

## Extraction layer

- **Production (Vercel):** Server-side `POST /api/extract-url` fetches the URL and returns plain text (stripped HTML). Many sites block scrapers; failures should surface a clear error and **paste fallback**.
- **Client:** Never rely on browser `fetch` to arbitrary domains (CORS).

## Analysis prompt (conceptual)

Ask the model to output (internally or as structured JSON):

- `title_guess`, `thesis`, `key_claims[]`, `stats_or_data[]`, `tone_of_source`, `angles_for_enkrypt[]` (differentiation hooks).

## Rewrite prompt (conceptual)

- Input: extracted text + analysis summary + user **tone preset** (same IDs as Content Writer where possible).
- Output shape (user-selectable):

  | Shape | Description |
  |-------|-------------|
  | `linkedin` | Thought-leadership post, hot take / Enkrypt angle, short paragraphs. |
  | `blog` | Longer response building on or countering the source; sections. |
  | `snippet` | 2–4 sentences for social / email teaser. |

## Attribution (required)

Auto-append a **References** or **Source** line, e.g.:

- `Source: [Publication Name](URL) — accessed [ISO date].`
- If title unknown: `Source: [URL] — accessed [date].`

Do not imply Enkrypt authored the original piece; opinion is **ours**, facts attributed where needed.

## Tone presets

Reuse the same tone IDs as Content Writer for consistency:

`thought_leadership`, `awareness`, `product_launch`, `technical`, `data_research`.

## Use cases (for prompt examples / evals)

- Competitor report → differentiated Enkrypt perspective.
- Industry news → fast informed take.
- Research drop → accessible thought leadership.
- Partner/customer blog → companion or amplification post.

## When to update this skill

- New output shapes, attribution format, or compliance rules.
- Changes to `/api/extract-url` behavior or fallbacks.
- New tone or brand constraints from marketing.

---

*Independent from: `visual-designer-content-flow` and `enkrypt-content-writer` (cross-reference tones only).*
