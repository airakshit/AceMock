# Ace Mock — Design System Guide

Welcome to the **Ace Mock Design System**. This guide provides a straightforward reference for building clean, consistent, and accessible interfaces across the platform.

---

## Architecture & File Map

```
src/
├── styles/
│   └── design-tokens.css       # Core CSS variables (OKLCH colors, spacing, shadows, radius)
├── app/
│   └── globals.css             # Tailwind v4 @theme inline mappings & base typography
└── lib/
    └── design-system/
        ├── index.ts            # Public barrel export
        ├── typography.ts       # Text hierarchy & styles (Geist + Plus Jakarta Sans)
        ├── colors.ts           # Semantic colors (difficulty, statuses, metric accents)
        ├── layout.ts           # Layout containers, shells, and responsive grids
        ├── motion.ts           # Micro-interactions, hover lifts, and focus rings
        └── README.md           # This developer guide
```

---

## 1. Typography (`typography`)

Typography pairs **Plus Jakarta Sans** (high-precision geometric display font) with **Geist Sans** (readable, neutral body font) and **Geist Mono** (tabular numbers and code).

### Usage Example:
```tsx
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

// Hero headline
<h1 className={typography.hero}>Master Your Next Exam</h1>

// Page title & subtitle
<h1 className={typography.pageTitle}>Mock Tests</h1>
<p className={typography.pageSubtitle}>Full-length and subject-wise practice tests.</p>

// Section header
<h2 className={typography.sectionTitle}>Popular Mock Tests</h2>
<p className={typography.sectionSubtitle}>Hand-picked tests attempted most.</p>

// Eyebrow label
<span className={typography.eyebrow}>Recommended</span>

// Metrics & tabular numbers
<span className={typography.metric}>94.8%</span>
```

### Available Tokens:
- `typography.hero`: 32px–48px extra-bold headline
- `typography.pageTitle`: 24px–30px bold page title
- `typography.pageSubtitle`: 14px–16px descriptive subtitle
- `typography.sectionTitle`: 18px–20px bold section heading
- `typography.sectionSubtitle`: 12px–14px section description
- `typography.cardTitle`: 16px semibold card title
- `typography.cardSubtitle`: 12px muted card subtitle
- `typography.metric`: 24px–30px bold tabular figures
- `typography.eyebrow`: 11px uppercase wide tracking label
- `typography.body`: 14px standard body reading text
- `typography.bodyMuted`: 14px secondary muted text
- `typography.caption`: 12px metadata or caption text
- `typography.code`: 12px monospace text
- `typography.link`: Brand colored interactive link

---

## 2. Colors & Semantic Tokens (`colors`)

Colors are calibrated in **OKLCH** color space for perceptual uniformity between Light and Dark modes.

### The Ace Mock color scheme

Every color in the app rolls up to one of these roles. Prefer the semantic
token over a raw palette class — it is already tuned for both modes, so no
`dark:` variants are needed:

| Role | Token | Hue | Use for |
|---|---|---|---|
| Brand | `text-brand`, `bg-brand-gradient` | Indigo 264 | identity, primary actions, focus, active nav |
| Success | `text-success`, `bg-success/10`, `border-success/25` | Emerald 163 | correct answers, Easy, uploaded, positive trends |
| Warning | `text-warning`, `bg-warning/10`, `border-warning/25` | Amber 70 | Medium, pending, uploads, hints, time pressure |
| Danger | `text-danger`, `bg-danger/10`, `border-danger/25` | Rose 22 | incorrect answers, Hard, failed, destructive |
| Info | `text-info`, `bg-info/10`, `border-info/25` | Cyan 226 | processing, documents, tips (echoes brand accent) |

Category accents for subject tags: `cat-physics` (blue), `cat-math` (violet),
`cat-general` (neutral). Chemistry and English intentionally reuse
`success`/`warning` so the tag row stays inside the scheme.

Raw palette classes (`emerald-*`, `amber-*`, `rose-*`, `sky-*`) are overridden
in `globals.css` to sit on the same muted scale — they are a fallback for
one-off tints, not the default. `red-*` is aliased onto the rose family so the
app only ever ships one danger hue.

**Dark mode is deliberately faded**: surfaces sit at oklch 0.175–0.225 with
low chroma, shadows stay under 0.22 alpha, and the palette loses ~20% chroma
versus stock, so long study sessions stay comfortable.

### Brand Palette:
- **Light Mode Brand**: Electric Indigo `oklch(0.54 0.22 264)`
- **Dark Mode Brand**: Soft Iris `oklch(0.66 0.13 264)`

### Difficulty Badges:
```tsx
import { colors, type DifficultyLevel } from "@/lib/design-system";

const diff = colors.difficulty[difficulty as DifficultyLevel];
<span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium", diff.badge)}>
  <span className={cn("size-1.5 rounded-full", diff.dot)} />
  {diff.label}
</span>
```
- **Easy**: `bg-success/10 text-success border-success/25`
- **Medium**: `bg-warning/10 text-warning border-warning/25`
- **Hard**: `bg-danger/10 text-danger border-danger/25`

### Metric Card Accents:
- `colors.metricAccent.default`
- `colors.metricAccent.brand`
- `colors.metricAccent.success`
- `colors.metricAccent.info`
- `colors.metricAccent.warning`

---

## 3. Layouts & Grids (`layout`)

Standardized layout containers and responsive grid configurations.

```tsx
import { layout } from "@/lib/design-system";

// Mock tests grid: 1 col on mobile, 2 on tablet, 3 on desktop, 4 on wide
<div className={layout.gridCards}>
  {tests.map(test => <MockTestCard key={test.id} test={test} />)}
</div>

// Metrics overview grid
<div className={layout.gridMetrics}>
  {metrics.map(metric => <MetricCard key={metric.id} {...metric} />)}
</div>
```

---

## 4. Motion & Micro-interactions (`motion`)

Provides tactile feedback and subtle animations that feel premium without distracting.

```tsx
import { motion } from "@/lib/design-system";

// Card lift on hover
<article className={cn("rounded-xl border bg-card p-5", motion.cardHover)}>
  {/* Card content */}
</article>

// Button tactile click feedback
<button className={cn("rounded-lg px-4 py-2", motion.buttonPress)}>
  Click me
</button>
```

---

## 5. UI Pattern Components

Key reusable patterns located in `src/components/patterns/`:
1. **`MockTestCard`**: Card for displaying practice tests with difficulty, duration, question count, and interactive actions.
2. **`MetricCard`**: Statistical metric card with tabular numbers, optional trend indicator, and accent pill.
3. **`PageHeader` & `SectionHeader`**: Consistent headers with optional kicker pill, descriptions, and action buttons.
4. **`AuthCard`**: Centered card with glassmorphism aura for Sign In and Sign Up flows.
