---
**Chic Sartorialist**: refers to the iconic street style aesthetic pioneered by Scott Schuman’s legendary blog, The Sartorialist. This style merges timeless, high-quality tailoring with effortless everyday elegance, celebrating unique, localized personal expression.
---
# Chic Sartorialist

name: Modern Sartorialist

```code
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5e5f5c'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0dc'
  on-secondary-container: '#626360'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#221a0e'
  on-tertiary-container: '#8e8271'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e3e2df'
  secondary-fixed-dim: '#c7c7c3'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#464744'
  tertiary-fixed: '#f0e0cc'
  tertiary-fixed-dim: '#d3c4b1'
  on-tertiary-fixed: '#221a0e'
  on-tertiary-fixed-variant: '#4f4537'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
typography:
  display-xl:
    fontFamily: Playfair Display
    fontSize: 72px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
spacing:
  container-max: 1440px
  gutter: 24px
  margin-desktop: 80px
  margin-mobile: 20px
  section-gap: 120px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
```

---

## Brand & Style

This design system embodies a high-end, editorial fashion aesthetic. It is built for a target audience that values sophistication, timelessness, and premium craftsmanship. The brand personality is poised, confident, and curated.

The visual style is a blend of **Minimalism** and **Editorial Design**. It relies on high-contrast typography, generous whitespace (negative space), and a structured grid that allows photography to breathe. The emotional response is one of effortless elegance and aspirational luxury. Every element is intentional, avoiding decorative clutter to ensure the focus remains on the product and the "lifestyle" narrative.

## Colors

The palette is anchored in a monochromatic foundation with warm, organic undertones.

- **Primary (Rich Black):** Used for primary text, iconography, and high-impact structural elements. It provides the "ink" on the page.
- **Secondary (Off-White/Bone):** The primary background color. It is softer than pure white, reducing eye strain and providing a premium, paper-like feel.
- **Tertiary (Warm Sand):** A subtle accent used for secondary backgrounds, image overlays, or highlighting specific text blocks to add warmth.
- **Accent (Muted Gold):** Reserved for micro-interactions, specific icons (like the star ratings), and brand-specific flourishes.

## Typography

The typography strategy uses a high-contrast pairing between a sophisticated serif and a modern geometric sans-serif.

- **Headlines:** Use the serif font to evoke a sense of heritage and editorial authority. Tracking should be slightly tightened for large displays.
- **Body & UI:** The sans-serif font is used for readability and a contemporary feel. It handles all functional UI elements, product descriptions, and metadata.
- **Hierarchy:** Dramatic scale shifts between headlines and body text are essential to maintain the editorial look. All labels and functional buttons should use the sans-serif with increased letter spacing for clarity.

## Layout & Spacing

The design system utilizes a **Fixed Grid** model for desktop, transitioning to a fluid model for mobile.

- **Desktop:** 12-column grid with a 1440px max-width. Columns are used to create asymmetric compositions, often leaving 1-2 columns empty to create "white space lungs" within the layout.
- **Sectioning:** Large vertical gaps (120px+) separate distinct content narratives, ensuring the user is never overwhelmed.
- **Asymmetry:** Images should vary in aspect ratio (portrait vs. square) and alignment to the grid to avoid a rigid, "template" look.
- **Mobile:** Elements reflow to a single or dual-column stack with significantly reduced margins, maintaining the serif headline impact.

## Elevation & Depth

This design system prioritizes a flat, architectural depth rather than physical shadows.

- **Tonal Layering:** Depth is achieved through color blocks. A primary surface might sit on a secondary color background to define a zone.
- **Low-Contrast Outlines:** Buttons and input fields use crisp, 1px solid borders in primary black or soft grey. Shadows are almost entirely avoided to maintain the clean, minimalist aesthetic.
- **Image Overlays:** Images may slightly overlap color blocks or other images to create a layered "scrapbook" editorial feel, but without drop shadows.

## Shapes

The shape language is strictly **Sharp (0px roundedness)**.

This decision reinforces the architectural, high-fashion feeling of the brand. Rectangular frames for images, buttons, and input fields provide a sense of structure and precision. Exceptions are only made for strictly circular elements (like iconography or specific badge "stamps") to create a focal point against the rigid grid.

## Components

### Buttons

- **Primary:** Black background, white sans-serif text, 1px black border. Rectangular with no radius. Includes an arrow icon (e.g., ↗) for "Shop" or "Explore" actions.
- **Secondary/Ghost:** Transparent background, 1px black border, black text. Used for secondary actions like "Show All".

### Product Cards

- **Structure:** Large portrait-oriented image on top. Minimalist metadata below.
- **Details:** Product name in semi-bold sans-serif, price in regular sans-serif.
- **Interaction:** A subtle "+" or "Add to Cart" icon appears in the bottom right corner of the image or immediately below.

### Inputs & Forms

- **Style:** 1px black bottom border or full box border. No fill.
- **Typography:** Labels are small, uppercase sans-serif. Placeholders are light grey.

### Chips & Tags

- **Style:** Small, rectangular tags with thin borders. Used for categories or status (e.g., "New Arrival").

### Navigation

- **Header:** Centered logo, thin 1px bottom divider. Icon-based utility navigation (Search, Wishlist, Cart) on the right, localized settings on the left.
