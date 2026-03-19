---
name: visual-designer-content-flow
description: Documents the Enkrypt visual designer flow—content paste → content API (heading/subheading/footer) → image generation prompt. Use when modifying content generation, image prompts, or the paste-to-preview pipeline in the visual designer app.
---

# Visual Designer: Content + Image Flow

## Overview

When the user pastes raw content into the visual designer:

1. **First API call (content)** — Generates **heading**, **subheading**, and **footer** from the pasted content. This is the "content structure" step.
2. **Second step (image)** — An **image generation prompt** is built and sent to the image API. The generated image is a **supporting visual only**.

## Content API (First)

- Input: pasted raw text (and optional custom instructions).
- Output: JSON with `heading`, `subheading`, `footer`.
- These three fields are displayed by the app in separate slots (heading slot, subheading slot, footer slot). They are **not** rendered inside the generated image when in advanced/visual-only mode.

## Image Generation Prompt (Second)

- **Do not include heading, subheading, or footer in the image as content to render.** The app composites those three in separate slots. The image **can and should** include any other text that supports the message—labels, captions, bullet points, annotations, stats, callouts—without arbitrary limits. Do not restrict the image to "visual only" (icons/diagrams); allow text freely except for the three main fields.
- **Background:** Do **not** ask for a transparent background. The app already uses a white/light background. Instruct the model to use a **light background with subtle opacity** (e.g. light fill or soft gradient) so the image fits the existing light canvas. Avoid "transparent (alpha = 0)" or "no background"; use "light background" or "light fill with opacity" instead.
- The prompt may reference the topic/theme (e.g. "Topic: [heading/subheading/footer summary]") for context, but must state clearly: **do not render the heading, subheading, or footer as text in the image.** All other text is allowed and not limited.

## Summary

| Step        | API / action        | Output / instruction |
|------------|---------------------|----------------------|
| 1. Content | Content/structure API | `heading`, `subheading`, `footer` |
| 2. Image   | Image generation API  | Image may include any text (labels, captions, bullets, etc.) except heading/subheading/footer; **light background with opacity**, not transparent |

## When to Apply

- Changing how pasted content is turned into heading/subheading/footer.
- Editing the image generation prompt (e.g. background, content rules).
- Adding or removing steps in the paste → content → image pipeline.
