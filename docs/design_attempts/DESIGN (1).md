# Amoa & Agou Design System

This design system provides a comprehensive, high-fidelity guidelines, built for a target audience that values sophistication, timelessness, and premium craftsmanship. The brand personality is poised, confident, and curated. The design system embodies a high-end, editorial fashion aesthetic specifications, and UI tokens derived directly from the Amoa&Agou Fashion eCommerce UI. It is structured specifically for automated or manual UI generation to ensure pixel-perfect fidelity with the source layout.

---

## 1. Design Principles & Brand Tone

* **polyglot** High-end, editorial fashion aesthetic characterized by spacious layouts, delicate typography, and a balanced mix of warm neutral and dark tones.
* **Structured Yet Fluid:** Employs crisp grid alignments and overlapping decorative elements (e.g., tilted ambient images, absolute positioned graphic badges).
* **Typographic Hierarchy:** Heavy reliance on elegant, high-contrast Serif headers paired with clean, geometric Sans-Serif supporting text.

---

## 2. Color Palette & Typography Tokens

You are an expert Frontend Architect. I want you to write three specific sections for my `DESIGN.md` file in the `opencode` project:

1. Color Palette & Typography Tokens
2. Typography Specification
3. Color Tokens

CRITICAL CONTEXT:

* We are using Tailwind CSS v4 and shadcn/ui for our design tokens and components.
* In Tailwind v4, config files are gone. Our source of truth for the theme lives entirely in standard CSS variables and the `@theme inline` or `@theme` directive.
* Please inspect, parse, and use the structural token definitions inside: `packages/ui/src/styles/globals.css`

Your Task:

1. Locate (mentally simulate) the structure of a standard Tailwind v4 + shadcn setup in `packages/ui/src/styles/globals.css`. Look for the `:root` and `.dark` selectors containing raw color tokens (usually wrapped in `hsl()` or native OKLCH in v4) and the `@theme inline` block mapping those CSS variables to Tailwind utility prefixes (like `--color-background: var(--background);`).
2. Generate the **Color Palette & Typography Tokens** section showing how these tokens bridge the gap between CSS variables and Tailwind utilities.
3. Generate the **Typography Specification** detailing the font families (e.g., `--font-sans`, `--font-mono`), sizes, and weights configured via `@theme`.
4. Generate the **Color Tokens** section providing a comprehensive table/list of the semantic mappings used by shadcn/ui components (e.g., `background`, `foreground`, `primary`, `muted`, `accent`, `destructive`, `border`, `ring`) for both Light and Dark modes.

Please present the output in clean, scannable Markdown formats using tables and blockquotes, optimized to match a professional `DESIGN.md`.

```css
/* Core Font Families */
--font-serif: "Playfair Display", "Didot", "Georgia", serif;
--font-sans: "Inter", "Helvetica Neue", Arial, sans-serif;

/* Typography Scale */
--text-h1: normal 400 42pt/1.15 var(--font-serif);      /* Main hero headings */
--text-h2: normal 400 24pt/1.25 var(--font-serif);      /* Section headings */
--text-h3: normal 500 14pt/1.3 var(--font-serif);       /* Small group headers */
--text-body-lg: normal 400 12pt/1.6 var(--font-serif);  /* Large editorial quotes */
--text-body: normal 400 10pt/1.5 var(--font-sans);      /* Component copy, reviews */
--text-nav: normal 500 9pt/1.2 var(--font-sans);        /* Navigation links, buttons */
--text-caption: normal 400 8pt/1.2 var(--font-sans);    /* Small metrics, labels */
```

---

## 3. Structural Layout & Spacing

### 3.1 Page Configuration
* **Max Width:** `1440px` (standard desktop container)
* **Page Margins:** Left and right fluid padding (`clamp(24px, 5vw, 80px)`)
* **Section Spacing:** Generous vertical padding (`80px` to `120px`) between content blocks to support editorial pacing.

### 3.2 Layout System

* **Grid:** Standard 12-column system for product grids and layout sections.
* **Asymmetrical Hero Layout:**
  * Left Column (~40% width): Captions, primary headers, primary CTA, reviews badge.
  * Center Column (~35% width): Large vertically oriented image showcasing the flagship look.
  * Right Column (~25% width): Secondary look image, metric callouts (`20k+`, `147+`), floating interactive badges.

---

## 4. Component Component Specifications

### 4.1 Global Navigation Header

* **Structure:** Three distinct alignment groups spaced across full-width container.
  * *Left:* Hamburger icon menu.
  * *Center:* Monospace/geometric clean brand logotype (`ZELORA`).
  * *Right:* Interactive utility grouping: Search icon, Wishlist (heart) icon, Cart icon, and Country/Currency picker dropdown (`🇬🇧 UK, 🇫🇷 Fr, 🇷🇺 Ru`).
* **Border:** Clean, subtle `1px solid var(--color-border-light)` underneath the header.

### 4.2 Buttons & CTAs

* **Primary Action Button:**
  * *Style:* Rectangular, no border radius, explicit padding (`12px 24px`).
  * *Theme:* Clean white background with black text/border, or inverse solid black background with white text (`var(--color-brand-dark)`).
  * *Iconography:* Accompanied by a clean structural arrow pointing up-right (`↗`).
* **Secondary Action Button:**
  * *Style:* Inline text string, fully uppercase, small font size (`var(--text-caption)`), paired with an underlying minimal border or arrow element.

### 4.3 Infinite Ticker / Marquee

* **Visuals:** Full-bleed solid block utilizing `var(--color-brand-dark)`.
* **Content:** Continuously scrolling uppercase text strings (e.g., product lines, collection highlights) interspersed with geometric/sunburst divider symbols (`✴`).
* **Typography:** White text, medium weight, small tracking/letter-spacing.

### 4.4 Product / Collection Cards

* **Image Ratio:** Vertically oriented portrait format (`3:4` or `4:5` aspect ratio).
* **Metadata Placement:** Text positioned directly underneath the product card image.
  * *Title:* Small serif typography (`var(--text-h3)`).
  * *Price:* Muted text color, sans-serif typography.
* **Interactive Controls:** Minimalist circular overlay buttons or bottom-right action triggers containing directional or expansion indicators.

### 4.5 Testimonial / Review Cards

* **Layout:** Two column system within a tinted block section (`var(--color-bg-tint)`).
  * *Left Element:* Main vertical portrait editorial image.
  * *Right Element:* Stacked array of structured text boxes.
* **Card Styling:** White backgrounds, thin structural grey borders, zero border-radius.
* **Card Composition:**
  * 5-star rating line using sharp geometric star vectors.
  * Review paragraph text.
  * User profile footer consisting of a circular avatar thumbnail image, user name (`bold`), and user profession/title (`muted`).

---

## 5. Micro-Interactions & UI Elements

* **Ambient Elements:** Small floating profile images angled at slight orientations (`transform: rotate(-12deg)`) used to embellish clean text sections.
* **Circular Badge Text:** Rotating structural text loops (e.g., *"Explore New Collection"*) wrapped around central play buttons or directional indicators.
* **Highlighted Text:** Target keywords within long copy lines wrapped in highlighted background tags using `var(--color-accent-gold)` with comfortable padding overlays.


---

## 6. Implementation Architecture & Tech Stack Implementation

### 6.1 Tailwind CSS 4.x Configuration & Setup

Tailwind 4.x uses CSS-first configuration rather than a `tailwind.config.js` file. Inject these configuration variables directly into your main CSS input layer (e.g., `app/globals.css`):

```css
@theme {
  /* Color Palette mapping to Design System Tokens */
  --color-bg-main: #FFFFFF;
  --color-bg-tint: #FAF8F5;
  --color-text-primary: #1A1A1A;
  --color-text-muted: #666666;
  --color-accent-gold: #D9B48F;
  --color-border-light: #E5E5E5;
  --color-brand-dark: #0A0A0A;

  /* Typography / Font Pairings */
  --font-serif: "Playfair Display", "Didot", "Georgia", serif;
  --font-sans: "Inter", "Helvetica Neue", Arial, sans-serif;

  /* Custom Animations for Marquee & Badges */
  --animate-marquee: marquee 30s linear infinite;
  --animate-spin-slow: spin 12s linear infinite;

  @keyframes marquee {
    from { transform: translateX(0%); }
    to { transform: translateX(-50%); }
  }
}
```

### 6.2 Component Framework Integration (`@base-ui/react` + `shadcn/ui` layout approach)

When orchestrating structural primitives, adhere to the updated component mechanics:

* **No `asChild` prop support:** Do not pass an `asChild` attribute to `@base-ui/react` components. Instead, style components directly utilizing utility combinations or explicitly nest native subcomponents without wrapping structural elements unnecessarily.
* **Component Styling Conventions:** Use unstyled primitives from `@base-ui/react` (e.g., Select, Dropdown, Tabs) and wrap or extend them using explicit Tailwind 4 classes to form a custom `shadcn`-style layer matching the aesthetics of `image_eb9780.jpg`.
* **Layout Structure:** Keep structural interfaces tidy by positioning target layouts inside standard view directories (e.g., components inside `apps/web/src/app/` layout flows) utilizing zero-border-radius design implementations.

### 6.3 Animation Specs (`motion/react`)

Use `motion/react` to orchestrate smooth, elegant, high-end editorial motions without disrupting layout geometries:

* **Tilted Ambient Image Loading:**
  
  ```tsx
  // Target style matching ambient image layouts skewed in image_eb9780.jpg
  <motion.div
    initial={{ opacity: 0, y: 15, rotate: -12 }}
    animate={{ opacity: 1, y: 0, rotate: -12 }}
    transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
    className="absolute -left-12 top-1/4 w-24 h-32 rotate-[-12deg] overflow-hidden shadow-md"
  >
    <img src="..." alt="Ambient Look" className="object-cover w-full h-full" />
  </motion.div>
  ```

* **Infinite Marquee Continuous Flow:**
  Duplicate the string array twice horizontally in a flex row and utilize direct linear configurations on the container:

  ```tsx
  <motion.div 
    animate={{ x: [0, "-50%"] }}
    transition={{ ease: "linear", duration: 25, repeat: Infinity }}
    className="flex whitespace-nowrap gap-12"
  >
    {/* Text nodes with ✴ separator elements */}
  </motion.div>
  ```

* **Hero Content Stagger Fade:**
  Apply clean ease-out structural paths (`[0.16, 1, 0.3, 1]`) to text groups and button elements to give a premium fashion show transition on view load.
