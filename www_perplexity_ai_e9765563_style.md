---
brand: "Perplexity"
source: "https://www.perplexity.ai/"
extracted: "2026-06-09"
theme: "light"
colors:
  canvas: "#fcfcf9"
  text: "#000000"
  border: "#d6d5d4"
  accent: "#016a71"
type:
  primary: "pplxSans"
  scale: [16]
spacing: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]
radius:
  sm: "12px"
  md: "6px"
  lg: "4px"
  xl: "9999px"
  pill: "11px"
---

# Brand Identity

> "clean paper white product surface — cyan accent on quiet ground"

---

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| `canvas` | `#fcfcf9` | Page background — base layer |
| `text` | `#000000` | Primary body text |
| `border` | `#d6d5d4` | Dividers, outlines, hairlines |
| `accent` | `#016a71` | Single CTA per screen — use sparingly |

### Extended Neutrals
`#271a00`, `#271a00`, `#fdfbfa`, `#081f22`

---

## Typography

### Import
```html
<link rel="stylesheet" href="https://frontend-cdn.perplexity.ai/_agi_assets/fonts/PPLX-Sans-Beta-v2-VF.woff2">
<link rel="stylesheet" href="https://frontend-cdn.perplexity.ai/_agi_assets/fonts/FKGroteskNeue.woff2">
```

### Font Stack

- **Primary:** `pplxSans` — all UI text, body, labels, headings

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| `<h2>` | 16px | 400 | 24px | normal |
| `<p>` | 16px | 400 | 24px | normal |
| `<a>` | 16px | 400 | 24px | normal |
| `<button>` | 16px | 400 | 24px | normal |
| `<span>` | 16px | 400 | 24px | normal |
| `<input>` | 16px | 400 | 24px | normal |

---

## Spacing & Layout

**Base unit:** 4px — all spacing values are multiples of 4.
**Scale:** `4px / 8px / 12px / 16px / 20px / 24px / 28px / 32px / 36px / 40px`

**Container padding:** `0px`

### Layout Patterns

| Display | Columns | Gap | Justify | Align |
|---------|---------|-----|---------|-------|
| flex | — | normal | normal | normal |
| flex | — | 8px | normal | center |
| grid | — | normal | normal | center |
| flex | — | 1px | normal | normal |
| flex | — | 16px | normal | center |
| flex | — | normal 4px | normal | center |

### Responsive Breakpoints

- `370px` — bp370
- `420px` — bp420
- `500px` — bp500
- `600px` — bp600
- `640px` — md
- `700px` — bp700
- `768px` — md1
- `852px` — bp852
- `900px` — bp900
- `970px` — bp970
- `1024px` — lg
- `1200px` — bp1200
- `1280px` — xl
- `1400px` — bp1400
- `1536px` — 3xl

```css
/* Tailwind v4 — override if different from defaults */
@theme {
  --breakpoint-bp370: 370px;
  --breakpoint-bp420: 420px;
  --breakpoint-bp500: 500px;
  --breakpoint-bp600: 600px;
  --breakpoint-md: 640px;
  --breakpoint-bp700: 700px;
}
```

---

## Corner Radius & Shadows

### Radius Scale
- `sm`: `12px`
- `md`: `6px`
- `lg`: `4px`
- `xl`: `9999px`
- `pill`: `11px`

---

## Core Components

### Button

```css
/* Primary */
background-color: #016a71;
color: #ffffff;
border: none;
border-radius: 12px;
padding: 8px;
font-size: 16px;
font-weight: 400;
letter-spacing: normal;
transition: all;
```

```css
/* Ghost / Secondary */
background-color: transparent;
color: rgba(39, 37, 30, 0.65);
border: 1px solid rgba(39, 37, 30, 0.65);
border-radius: 6px;
padding: 0px;
```

### Card

> No card elements detected — inferred from surface palette.
```css
background-color: —;
border: 1px solid #d6d5d4;
border-radius: 12px;
padding: 16px;
box-shadow: none;
```

### Input

```css
background-color: rgba(0, 0, 0, 0);
border: 0px solid rgba(39, 26, 0, 0.14);
border-radius: 0px;
padding: 0px;
font-size: 16px;
color: rgb(0, 0, 0);
```

### Motion Tokens

- `div` — `padding 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
- `div` — `opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
- `button` — `color 0.3s cubic-bezier(0, 0, 0.2, 1), background-color 0.3s cubic-bezier(0, 0, 0.2, 1), border-color 0.3s cubic-bezier(0, 0, 0.2, 1), text-decoration-color 0.3s cubic-bezier(0, 0, 0.2, 1), fill 0.3s cubic-bezier(0, 0, 0.2, 1), stroke 0.3s cubic-bezier(0, 0, 0.2, 1), opacity 0.3s cubic-bezier(0, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0, 0, 0.2, 1), transform 0.3s cubic-bezier(0, 0, 0.2, 1), filter 0.3s cubic-bezier(0, 0, 0.2, 1), -webkit-backdrop-filter 0.3s cubic-bezier(0, 0, 0.2, 1), backdrop-filter 0.3s cubic-bezier(0, 0, 0.2, 1)`
- `button` — `background-color 0.3s cubic-bezier(0, 0, 0.2, 1), border-color 0.3s cubic-bezier(0, 0, 0.2, 1), transform 0.3s cubic-bezier(0, 0, 0.2, 1), color 0.3s cubic-bezier(0, 0, 0.2, 1), opacity 0.3s cubic-bezier(0, 0, 0.2, 1)`
- `div` — `opacity 0.15s 0.15s`
- `div` — `opacity 0.15s`

---

## Interaction States

### Hover / Focus / Active Tokens

```css
:root {
  --action-ghost-accent-bg-hover: #016a710e;
  --tw-ring-color: #3b82f680;
  --action-tonal-warning-bg-hover: #97431a20;
  --link-accent-fg-active: #0f3639;
  --link-alert-fg-hover: #713417;
  --button-active-color: 0% 0 0;
  --action-ghost-neutral-bg-hover: #271a0009;
  --tw-ring-shadow: 0 0 #0000;
  --action-outlined-neutral-bg-hover: #271a0009;
  --border-focus-neutral-color: 26.42% .013 93.9 / .2;
  --tw-ring-offset-width: 0px;
  --action-outlined-neutral-bg-active: #271a0012;
  --tw-ring-offset-shadow: 0 0 #0000;
  --link-accent-fg-hover: #0c4f54;
  --tw-ring-inset: ;
  --dark-border-focus-neutral-color: 87.35% .002 67.8 / .2;
  --action-tonal-warning-bg-active: #97431a33;
  --action-solid-accent-bg-hover: #0c4f54;
  --dark-button-hover-color: 87.35% .002 67.8;
  --action-solid-neutral-bg-hover: #27251ea6;
}
```

### Input — Default & Focus
```css
/* Default */
background-color: rgba(0, 0, 0, 0);
border: 0px solid rgba(39, 26, 0, 0.14);
border-radius: 0px;
padding: 0px;
font-size: 16px;
color: rgb(0, 0, 0);

/* Focus — apply ring via box-shadow, never outline */
box-shadow: 0 0 0 2px #016a71;
border-color: #016a71;
```

---

## Prohibited Patterns

- No rectangular buttons — pill or large-radius shape only
- Accent `#016a71` reserved for one primary action per screen — never decorative fill
- No pure #000000 — use near-black ink for softness and optical balance
- No font substitutions — `pplxSans` is the only permitted UI typeface

---

## Design Rationale

The canvas (`#fcfcf9`) stays close to white to maximize contrast and legibility. The cyan accent (`#016a71`) appears exactly once per screen — its scarcity is its power; overuse destroys the hierarchy. `pplxSans` carries all UI text. Mixing typefaces is prohibited unless a secondary mono font is explicitly listed. Spacing follows a strict 4px base grid — never use arbitrary pixel values.

---

## CSS Custom Properties

```css
:root {
  /* ── Semantic Tokens ── */
  --canvas: #fcfcf9;
  --text: #000000;
  --border: #d6d5d4;
  --accent: #016a71;
  /* ── Source Variables ── */
  --ask-input-dropdown-shadow: 0 4px 6px -1px #00000014, 0 2px 4px -2px #00000014;
  --ask-input-dropdown-shadow-dark: 0 10px 15px -3px #0000001a, 0 4px 6px -4px #0000001a;
  --odin-light-0: #fff;
  --odin-light-100: #fdfbfa;
  --odin-light-200: #faf8f5;
  --odin-light-300: #f3f0ec;
  --odin-light-400: #ece9e4;
  --odin-light-500: #e5e2dc;
  --odin-light-600: #dedbd4;
  --odin-light-700: #d8d4cd;
  --odin-light-1000: #271a00;
  --odin-light-2000: #27251e;
  --odin-light-200-a-65: #faf8f5a6;
  --odin-light-1000-a-10½: #271a001b;
  --odin-light-1000-a-7: #271a0012;
  --odin-light-1000-a-3½: #271a0009;
  --odin-light-2000-a-65: #27251ea6;
  --odin-light-2000-a-50: #27251e80;
  --odin-light-2000-a-20: #27251e33;
  --odin-light-1000-a-14: #271a0024;
  --odin-light-700-a-70: #d8d4cdb3;
  --odin-dark-0: #000;
  --odin-dark-50: #121211;
  --odin-dark-100: #171615;
  --odin-dark-200: #1e1d1c;
}
```

---

## Tailwind v4 Theme

```css
@theme {
  --color-canvas: #fcfcf9;
  --color-text: #000000;
  --color-border: #d6d5d4;
  --color-accent: #016a71;
  --font-sans: "pplxSans", system-ui, sans-serif;
  --radius-sm: 12px;
  --radius-md: 6px;
  --radius-lg: 4px;
  --radius-xl: 9999px;
  --radius-pill: 11px;
}
```

---

## Implementation Checklist

- [ ] Paste CSS Custom Properties into `globals.css`
- [ ] Apply Tailwind v4 `@theme` block to `app.css`
- [ ] Import font in `layout.tsx`
- [ ] Build Button — primary + ghost variants
- [ ] Build Card — radius, border, shadow
- [ ] Build Input — border, radius, background
- [ ] Navbar — height, position, backdrop-filter, z-index
- [ ] Audit accent color — must appear once per screen max
- [ ] Spacing audit — no arbitrary pixel values

---

_Generated by `extract_style.py` · 2026-06-09 · https://www.perplexity.ai/_