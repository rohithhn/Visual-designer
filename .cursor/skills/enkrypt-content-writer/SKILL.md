---
name: enkrypt-content-writer
description: Content Generation Engine for Enkrypt AI — tones, formats (LinkedIn, blog, Twitter), length, CTAs, hashtags, emoji density, SEO/meta for blogs, and brand voice. Use when building or changing the in-app Content Writer mode or its prompts.
---

# Enkrypt AI — Content Writer (Content Generation Engine)

**Scope:** This skill documents the **Content Writer** product surface only. It does **not** replace or merge with `visual-designer-content-flow` (canvas / image pipeline).

## Purpose

Guide implementation and prompt design for:

- Topic/keyword-driven generation (optional URL for source context — extraction is handled by the Researcher/API path when used).
- **Tone presets** and **content types**.
- **Output controls**: length, hashtags, CTA, emoji density.
- **Blog mode**: sections, SEO keywords, meta description, social snippet.
- **Brand voice** alignment for Enkrypt AI (AI security / trust / clarity).

## Tone presets (copy for UI + system hints)

| ID | Label | Voice |
|----|--------|--------|
| `thought_leadership` | Thought leadership | Authoritative, forward-looking, industry insights; confident but not hypey. |
| `awareness` | Awareness | Accessible, problem-focused, educational; plain language. |
| `product_launch` | Product launch | Feature-forward, energetic, clear CTA; concrete benefits. |
| `technical` | Technical deep-dive | Detail-oriented, developer audience; precise terms, examples/code when relevant. |
| `data_research` | Data / research | Stat- and benchmark-driven; infographic-friendly structure (bullets, numbers). |

## Content types

- **LinkedIn post** — hook, short paragraphs, optional line breaks; professional.
- **Blog** — H2/H3 sections, key takeaways block, scannable lists; SEO + meta + social fields.
- **Twitter / X thread** — Numbered or clear break between tweets; character discipline per tweet (~260–280 safe target).

## Output controls (prompt mapping)

- **Length**: `short` | `medium` | `long` — map to approximate word counts / thread length in the user prompt (e.g. short ~150–250 words post; long blog ~900–1500+).
- **Hashtags**: `off` | `suggest` — if suggest, append 5–12 relevant hashtags in a final line or block (platform-appropriate count).
- **CTA**: `website` | `demo` | `blog` | `none` — inject one closing CTA line matching choice.
- **Emoji density**: `none` | `low` | `medium` — enforce in system instructions (none = zero emojis; low = 0–2; medium = sparse throughout).

## Blog-specific outputs

When type is blog, the model should return **structured segments** (app may use delimiters or JSON — see code). Required conceptual pieces:

1. **Body** — Full post with headings and **Key takeaways** section.
2. **SEO** — Natural integration of user-supplied keywords (no stuffing).
3. **Meta description** — ~150–160 characters, compelling.
4. **Social share snippet** — Short punchy line + optional hook for cards.

## Brand voice — Enkrypt AI

Default principles for system prompts:

- **Clarity over jargon**; explain security concepts simply when the tone is not “technical.”
- **Trust and substance** — avoid fear-mongering; prefer accurate, calm urgency for real risks.
- **Product truth** — no fabricated metrics or customer claims.
- **Visual brand alignment** (for cross-links only): warm gradient accents (orange → pink), red strictly for danger/warning, green for success/safe — **in prose**, not in generated images (that’s the visual-designer skill).

Maintain a short **“Do / Don’t”** block in code constants; extend this skill when marketing provides approved voice examples (paste into an internal appendix section).

## When to update this skill

- New tones, content types, or output knobs in the Content Writer UI.
- Marketing updates to Enkrypt voice, compliance, or CTA patterns.
- Changes to how blog SEO/meta/snippet are formatted for export.

---

*Independent from: `visual-designer-content-flow`.*
