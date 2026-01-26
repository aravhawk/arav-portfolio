# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server with Turbopack (runs on port 3000, or 3001 if occupied)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Architecture Overview

This is a Next.js 15 portfolio site with a **"Brutalist Tech Noir"** design aesthetic featuring dramatic typography, custom animations, and technical visual elements.

### Tech Stack
- **Framework:** Next.js 15.3.8 (App Router, React 19, Turbopack)
- **Styling:** Tailwind CSS 4 with custom CSS variables and utility classes
- **Animations:** Motion library (Framer Motion alternative) with custom variants
- **Icons:** Lucide React
- **Typography:** Google Fonts (Instrument Serif, DM Mono, Space Grotesk)
- **Package Manager:** pnpm

### Design System

**Color Palette:**
- Primary background: `#050505` (void black)
- Elevated surfaces: `#0C0C0C`, `#121212`, `#1A1A1A`
- Accent cyan: `#00F0FF` (GPU compute theme)
- Accent amber: `#FFB800` (energy/power)
- Accent magenta: `#FF00AA`
- Text hierarchy: `#FAFAFA` → `#888888` → `#555555` → `#333333`

**Typography:**
- Display: `Instrument Serif` (dramatic headlines)
- Body: `Space Grotesk` (clean geometric sans)
- Mono: `DM Mono` (technical labels, metadata)

**Key Visual Features:**
- Custom magnetic cursor with ring animation (disabled on touch devices)
- Animated noise texture overlay (`noise-overlay` class)
- Circuit grid backgrounds with fade/vignette options
- Brutalist boxes with shadow offsets
- Corner accents on card hover
- Magnetic button physics (subtle cursor following)

### Code Organization

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Home page (single-page app)
│   └── globals.css        # Global styles with CSS variables
├── components/
│   ├── cards/             # VentureCard
│   ├── layout/            # Navigation, Footer, Section wrapper
│   ├── sections/          # Hero, Ventures, About, Contact
│   └── ui/                # Reusable UI components
├── lib/
│   ├── animations.ts      # Motion variants and easing curves
│   └── data.ts            # Centralized content data
└── types/
    └── index.ts           # TypeScript interfaces
```

### Data Architecture

**All content is centralized in `/src/lib/data.ts`:**
- `ventures`: Array of venture/project objects
- `currentProjects`, `technicalExpertise`, `focusAreas`: About section lists
- `socialLinks`: Social media links with icon types
- `navItems`: Navigation items with external link flags
- `footerColumns`: Footer link columns
- `aboutHighlights`: Statistics cards

**To update content:** Modify `data.ts` and TypeScript types in `types/index.ts`.

### Animation System

**Motion library variants in `/src/lib/animations.ts`:**
- `fadeInUp`, `fadeIn`: Basic entry animations
- `slideRevealLeft`, `slideRevealRight`: Directional slides
- `scaleBlur`: Scale with blur effect
- `staggerContainer`, `staggerContainerFast`: Orchestrate child animations
- `letterStagger`, `letterFadeIn`: Character-by-character text reveals
- `lineReveal`: Horizontal line width animation
- `cardHover`: Card lift with glow effect
- `navEnter`, `pageTransition`: Page-level animations

**Easing curves:** Pre-defined as tuples (`easeOutExpo`, `easeOutQuint`, `easeInOutCubic`)

**Viewport settings:** `viewportSettings = { once: true, margin: '-100px' }`

### Component Patterns

**Section component:** Wrapper for all major sections with optional label, title, subtitle
```tsx
<Section id="ventures" label="01" title="Ventures" subtitle="...">
```

**Custom cursor:** Automatically hidden on touch devices, magnetic ring with hover expansion

**Button component:**
- Variants: `primary`, `secondary`, `ghost`, `outline`
- Sizes: `sm`, `md`, `lg`
- Icons: `arrow`, `external`
- Magnetic effect enabled by default (disable with `magnetic={false}`)

**Card component:**
- Variants: `default`, `elevated`, `bordered`
- Hover effects include corner accents and optional glow
- Uses Motion's `cardHover` variant

**GridBackground component:**
- Patterns: `circuit`, `dots`, `lines`
- Fade options: `none`, `top`, `bottom`, `both`, `radial`
- Intensity: `dim`, `subtle`, `visible`

### Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`)

Example: `import Button from '@/components/ui/Button'`

### Styling Conventions

**Custom utility classes in `globals.css`:**
- `.font-display`, `.font-mono`, `.font-sans`: Typography
- `.text-gradient-cyan`, `.text-gradient-warm`: Gradient text
- `.noise-overlay`: Fixed noise texture (with `.animate-grain`)
- `.scanlines`: Horizontal scanline effect
- `.circuit-pattern`, `.dot-grid`: Background patterns
- `.glow-border`: Animated gradient border on hover
- `.brutalist-box`: Shadow offset box effect
- `.hr-glow`: Horizontal rule with gradient
- `.tech-label`: Mono uppercase small labels

**Animation classes:**
- `.animate-marquee`: Infinite horizontal scroll
- `.text-reveal`: Clip-path text reveal
- `.animate-flicker`: Subtle opacity flicker
- `.animate-pulse-glow`: Pulsing cyan glow
- `.animate-float`: Vertical float
- `.animate-grain`: Noise texture animation

### Single-Page Architecture

This is a **single-page application** with smooth scroll navigation:
- All sections (`Hero`, `Ventures`, `About`, `Contact`) are rendered on the home page
- Navigation uses hash links (`#ventures`, `#about`, `#contact`)
- Smooth scroll behavior implemented in Navigation component
- Active section highlighting based on scroll position

### Motion Library Usage

Always import from `motion/react`, not `framer-motion`:
```tsx
import { motion } from 'motion/react';
```

Use pre-defined variants from `@/lib/animations` for consistency.

### Browser Considerations

- Custom cursor is disabled on touch devices (checked via `'ontouchstart' in window`)
- Noise overlay animation respects `prefers-reduced-motion`
- All animations respect reduced motion preference

### Content Updates

To add a new venture:
1. Add to `ventures` array in `src/lib/data.ts`
2. Ensure type matches `Venture` interface in `src/types/index.ts`
3. Add to footer `Ventures` column if needed

To modify hero text or taglines, edit `src/lib/data.ts` and section components directly.
