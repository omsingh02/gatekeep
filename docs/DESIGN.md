# Gatekeep Mono: design system

Gatekeep is a calm, enterprise-clean product: **dark, neutral grey and monochrome**. Colour appears only to communicate status. This document is the single source of truth for every screen and email. If a screen needs something this document doesn't cover, add it here first.

**Implementation:** tokens live in `app/globals.css` (Tailwind v4 `@theme`), components in `components/ui/`. Components never use raw hex values or inline `style={{}}` for design decisions. They use the token utilities (`bg-surface`, `text-secondary`, `border-default`, …).


### Principles
1. **Neutral first.** Every surface, border and text colour comes from one pure-grey scale (R = G = B), with no blue tint.
2. **Colour means status, never decoration.** Green = success/active, amber = warning/expiring/limit, red = danger/denied/destructive. Nothing else is coloured.
3. **Flat and bordered.** Surfaces are solid fills separated by 1px borders. Shadows exist only on floating layers (dialogs, menus, toasts).
4. **Quiet hierarchy.** Hierarchy comes from type size and weight and from grey steps, not from colour or effects.
5. **Density with legibility.** Tables are compact, but body text is never below 13px and metadata never below 12px.
6. **One way to do each thing.** One button set, one input, one dialog, one toast, one empty-state pattern, one icon set.

### Theme: dark-first, token-based
**Dark only for v2.** It suits a security tool (calm, low-glare, "control room") and matches the existing brand perception.

**Every colour must go through semantic CSS variables**, which Tailwind v4 `@theme` maps to utilities like `bg-surface`, `text-muted` and `border-default`. Components never reference raw hex. Adding a light theme later (light mode is common in enterprise tools) is then only a `[data-theme="light"]` override block, with no component changes. **The email gets its own light, inline-styled template** (see below), because dark emails render poorly in many clients.

### Tokens

**Neutral scale** (pure grey, based on the original `#1a1a1a` / `#2a2a2a` / `#3a3a3a` / `#e0e0e0` family):

| Token | Hex | Role |
|---|---|---|
| `--gray-0` | `#111111` | Deepest: inset wells, code blocks, preview stage |
| `--gray-1` | `#1a1a1a` | **canvas** (page background) |
| `--gray-2` | `#212121` | **surface** (cards, panels, table, header, sidebar) |
| `--gray-3` | `#2a2a2a` | **surface-raised** (inputs, hover rows, dialogs, menus) |
| `--gray-4` | `#333333` | **border-subtle** (row dividers, inner separators) |
| `--gray-5` | `#3a3a3a` | **border** (default 1px border for cards and controls) |
| `--gray-6` | `#4a4a4a` | **border-strong** (hover border, selected outline) |
| `--gray-7` | `#737373` | **text-tertiary** (placeholders, disabled, captions) |
| `--gray-8` | `#a3a3a3` | **text-secondary** (labels, metadata, table headers) |
| `--gray-9` | `#e0e0e0` | **text-primary** (body, values) |
| `--gray-10` | `#f5f5f5` | **text-strong** (titles) and the **primary button fill** |

**Semantic colours** (the only colour in the product). Each has a solid value for text and icons and a tinted background at 10–12% alpha:

| Role | Text/icon | Background | Border | Used for |
|---|---|---|---|---|
| success | `#4ade80` | `rgba(74,222,128,.10)` | `rgba(74,222,128,.25)` | Active, unlocked, copied, granted |
| warning | `#fbbf24` | `rgba(251,191,36,.10)` | `rgba(251,191,36,.25)` | Expiring soon, limit reached, bulk caveats |
| danger | `#f87171` | `rgba(248,113,113,.10)` | `rgba(248,113,113,.25)` | Expired, denied, errors, destructive actions |
| danger-solid | `#dc2626` (hover `#b91c1c`) | — | — | Only the confirm button of a destructive dialog |

**Info is neutral:** grey icon, `--gray-3` background.

**Focus:** `outline: 2px solid rgba(255,255,255,.45); outline-offset: 2px` on every interactive element, using `:focus-visible` only. Never colour-only.

**Selection** (selected table row, active nav item, selected option): `--gray-3` background plus a `--gray-10` 2px left or bottom indicator. Not tinted.

**Typography:** Inter, with `tabular-nums` for numbers, sizes and dates.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| display | 40/44 (landing H1 only; 32/36 mobile) | 600, -0.02em | Hero only. **Solid `--gray-10`, never gradient.** |
| h1 | 24/32 | 600 | Page titles (Files, Shares) |
| h2 | 18/26 | 600 | Section and dialog titles |
| h3 | 15/22 | 600 | Card and panel titles |
| body | 14/20 | 400 | Default UI text, inputs, buttons |
| body-sm | 13/18 | 400 | Table cells, secondary lines |
| caption | 12/16 | 500 | Labels, badges, table headers, helper text |
| mono | 13/18 (JetBrains Mono / ui-monospace) | 400 | Short links, codes, passwords, invite text |

**Casing rule:** **sentence case everywhere**, including buttons, table headers, stat labels and tabs. No uppercase micro-labels; drop "ADMIN PANEL". The product name is always **"Gatekeep"**, wordmark included.

**Spacing:** a 4px base, with steps 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Card padding 20px (16px on mobile).
- Page gutter 32px (16px on mobile).
- Section gap 24px.

**Radius:**
- `--radius-sm 4px`: badges, checkboxes, keyboard hints.
- `--radius-md 6px`: buttons, inputs, selects, segmented controls, menu items.
- `--radius-lg 8px`: cards, panels, tables, dialogs, toasts, the auth card.
- `--radius-full`: avatars and status dots only.

**Elevation:**
- **Level 0:** no shadow, 1px border. Used for every in-page surface.
- **Level 1** (menus, popovers, toasts): border `--gray-5` + `0 8px 24px rgba(0,0,0,.35)`.
- **Level 2** (dialogs): border `--gray-5` + `0 16px 48px rgba(0,0,0,.45)` over a `rgba(0,0,0,.6)` backdrop. No blur, no stacked dialogs.

**Layout:**
- App container max **1280px**.
- Marketing container **1120px**.
- Auth and recipient card **400px**.
- Recipient preview stage max **1120px**.
- Dialogs at **480px** (sm) and **640px** (md), as a full-height sheet under 640px.

**Icons:** lucide only, `strokeWidth 1.75`.
- 16px in controls, 14px in dense table actions, 20px in empty states.
- Coloured `--gray-8` by default, `--gray-10` when active, and semantic colours only for status icons.
- **File-type icons are monochrome**, with no per-type colours.
- No emoji. No custom illustrations.

**Motion:** 120–160ms ease-out for hover, press and dialog fade/scale(0.98→1). No pulsing, ping or shake effects, so `.animate-shake` (`globals.css:94`) goes. Honour `prefers-reduced-motion`.

### Components (variants and states)

Every component gets the full state set: default, hover, active, focus-visible, disabled and loading where relevant.

- **Button**
  - Variants:
    - `primary` (fill `--gray-10`, text `--gray-1`)
    - `secondary` (fill `--gray-3`, border `--gray-5`, text `--gray-9`)
    - `ghost` (transparent, text `--gray-8`, hover `--gray-3`)
    - `danger` (ghost style with danger text; becomes `danger-solid` only inside a destructive confirm)
    - `link`
  - Sizes: `sm` 28px, `md` 32px (default in the app), `lg` 40px (auth, recipient, marketing).
  - Icon-only form is square, with an `aria-label` and a tooltip.
- **Input, Textarea, Select, Checkbox, Radio, Switch**
  - Fill `--gray-3` (`--gray-0` for read-only), border `--gray-5`, hover `--gray-6`, focus ring, error border and text in danger.
  - Height 32px (40px on auth and recipient screens), radius 6px.
  - **Real `<input type="checkbox">`**, custom-styled.
  - The select is a styled native `<select>`; a menu-select comes later.
- **Field**
  - Label (caption, `--gray-8`), control, helper or error (caption).
  - Replaces native validation bubbles (`noValidate` + inline errors).
- **SegmentedControl**
  - Neutral: selected is `--gray-3` + `--gray-10` text + border. Never coloured per option.
  - Used for user/public, email/username and table/grid.
- **Tabs and nav:** text tabs with a 2px `--gray-10` underline when active. On mobile, horizontal scroll with fade edges.
- **Card / Panel:** `--gray-2`, border `--gray-5`, radius 8, padding 20. Optional header row (title + actions) separated by `--gray-4`.
- **StatCard:** label (caption `--gray-8`), value (24/600, `tabular-nums`, `--gray-10`), optional delta or status dot. No icon tiles and no coloured numbers. A 2-column grid on mobile.
- **Table:** header row is caption `--gray-8` in sentence case on `--gray-2`; rows are 44px with body-sm text; dividers `--gray-4`; hover `--gray-3`; selected row `--gray-3` + checkbox; right-aligned numerics; sticky header; row actions in a `…` menu, with **Share** as the one visible secondary button.
- **Badge / StatusPill:** caption text, radius 4, semantic tinted background and border, with a leading 6px dot for status. Neutral variant for type labels ("Public", "Email", "Username", "PDF").
- **Dialog**
  - Base dialog: header (h2 + close), body, footer (secondary left of primary, right-aligned).
  - Sizes sm and md; a sheet on mobile.
  - **Built on top of it:** ConfirmDialog (no icon circle; title + consequence text + danger-solid confirm) and PromptDialog.
  - **No nested dialogs:** editing a grant happens inline in the share panel.
- **Menu / Dropdown:** level-1 elevation, 32px items, separators, and a danger item style.
- **Toast:** level-1, `--gray-3` background, semantic icon + text, optional action ("Undo", "Copy link"). Never a solid colour fill.
- **EmptyState:** a 20px lucide icon in a 40px `--gray-3` square, h3 title, body-sm text, and one primary or secondary action. Replaces the custom illustrations.
- **Skeleton:** `--gray-3` blocks with a subtle shimmer, matching final layout dimensions. This replaces the spinners inside cards. The **one** spinner is a 16px in-button loader.
- **Others:** PageHeader (h1 + description + right-aligned actions), Breadcrumb (text links with `/` separators, current item `--gray-10`, *not* buttons), Toolbar (search + filters + view toggle), Avatar (initial on `--gray-4`), Tooltip, Kbd, CopyField (mono value + copy button, with a "Copied" success state), Callout (neutral/warning/danger: icon + text, tinted background; replaces the green and amber boxes in the share dialog), DatePicker (neutral selected day: `--gray-10` fill, `--gray-1` text).
- **Logo:** a monochrome tile, `--gray-10` (`#f5f5f5`) rounded-square at radius ≈ 22%, with the gate+keyhole glyph **knocked out** in `--gray-1`. For light contexts (light email, README light mode), invert to a `#1a1a1a` tile with a white glyph. Drop the faint arch outline (it's illegible below 32px). Wordmark "Gatekeep" in Inter 600, -0.02em, `--gray-10`. Re-render `app/icon.svg`, `apple-icon.png`, `favicon.ico`, the OG/Twitter images, `social-preview.png`, the README banners and `logo-mark-512.png` from this. **OG and social cards:** flat `#1a1a1a` canvas, mono logo, headline in `#f5f5f5`, one line of `#a3a3a3` subtext, and optionally a flat product screenshot in a 1px `#3a3a3a` frame. No grid, glow or gradient.
- **Email:** a light template (white body `#ffffff`, `#1a1a1a` text, `#e5e5e5` borders, inverted mono logo), a solid `#1a1a1a` button with white text, and the password in a mono `#f5f5f5` box. No gradients.

### Public pages under this system
- **Landing.**
  - Solid canvas, a solid-colour headline, and section separators made of 1px borders.
  - Product screenshots go in flat 1px frames: the browser chrome is a `--gray-2` bar with no traffic-light colours.
  - The floating share card becomes a flat `--gray-2` card with a border.
  - Feature tiles are plain cards with lucide icons in `--gray-3` squares.
  - Remove the glows, grid, blur header (use a solid `--gray-1` header with a bottom border), gradient eyebrow, gradient code text, the `animate-ping` dot (`app/page.tsx:558`) and the coloured glow shadows.
- **Sign-in, unlock and preview.** A centred 400px `--gray-2` card on a `--gray-1` canvas, nothing behind it. Recipient error states get **distinct, non-retry layouts**:
  - **Expired:** an icon plus "This link has expired", "Ask {owner} for a new link", and no form.
  - **Download limit reached.**
  - **Revoked.**
  - **Wrong password** stays inline.
- **404 and error pages:** the same card pattern; drop the glows.
