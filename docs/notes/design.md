# DESIGN.md

# Arden House Design System
Version: 1.0

> A premium editorial luxury fashion design system inspired by modern European resort brands.
>
> Keywords:
> Luxury • Editorial • Quiet Luxury • High-end Ecommerce • Resort Wear • Minimalism • Air • White Space • Sophisticated Typography • Architectural Layout

---

# Design Philosophy

This interface should never feel like an ecommerce template.

It should feel like an editorial fashion magazine that happens to sell clothing.

Everything should communicate:

- confidence
- calmness
- expensive taste
- breathing room
- timelessness

Avoid:

- loud colors
- heavy shadows
- gradients
- playful interactions
- rounded modern startup UI
- oversized buttons
- bright accents

Think:

- Ralph Lauren Purple Label
- The Row
- Loro Piana
- Toteme
- COS editorial
- Aesop architecture
- Jacquemus campaigns

---

# Core Design Principles

## 1. Space is the primary design element

Every section has generous whitespace.

Whitespace is never "empty."

Whitespace creates luxury.

Preferred spacing:

XS = 8px
S = 16px
M = 32px
L = 64px
XL = 96px
XXL = 160px

Most sections should have:

padding-top: 96–160px
padding-bottom: 96–160px

---

## 2. Typography is the brand

Typography carries almost all visual identity.

There are only two font families.

### Serif

Use for:

- hero titles
- section titles
- quotes
- campaign messaging

Recommended:

- Cormorant Garamond
- Canela
- Ivar
- Editorial New
- Libre Baskerville (fallback)

Style:

font-weight:300
letter-spacing:0.02em

---

### Sans

Use for everything else.

Recommended:

- Inter
- Suisse International
- Neue Haas Grotesk
- Helvetica Neue

Weight:

300
400
500

Never bold.

---

# Color System

## Primary

Background

White
#FFFFFF

Warm White
#FAF9F7

Soft Beige
#F4F1EC

---

## Text

Primary
#222222

Secondary
#666666

Muted
#999999

Hairline
#DDDDDD

---

## Accent

Very rarely used.

Warm Sand

#C8B28B

Never use saturated brand colors.

---

# Typography Scale

Hero Display

72–100px

Desktop

weight:300

line-height:1

Example:

ARDEN HOUSE

---

Section Heading

42–56px

weight:300

line-height:1.1

---

Subheading

18px

weight:300

letter-spacing:0.08em

uppercase

---

Body

16px

line-height:1.8

weight:400

---

Small

13px

uppercase

letter spacing:

0.12em

---

Micro Labels

11px

uppercase

letter spacing:

0.18em

---

# Layout

Maximum width

1600px

Centered.

---

Content width

1200–1400px

---

Editorial width

900px

Used for text blocks.

---

Grid

12-column grid

Desktop

Gap:

32px

---

Cards

Never have visible borders.

Products float on whitespace.

---

Section Rhythm

Typical flow:

Hero

↓

Collection Split

↓

Editorial

↓

Product Grid

↓

Lifestyle Banner

↓

Brand Story

↓

Footer

---

# Header

Height

72px

Transparent over hero.

Becomes white after scrolling.

---

Navigation

Minimal.

Only essential links.

Example

Women

Men

Accessories

Journal

Archive

---

Icons

Thin outline

18px

Never filled.

---

Announcement Bar

28px tall

Dark charcoal

White text

Very subtle.

---

# Hero Section

Height

90–100vh

Large campaign image.

Text aligned asymmetrically.

Never centered vertically.

---

Title

Very large serif.

Uppercase.

Thin weight.

---

Subtitle

Uppercase.

Tiny.

Wide tracking.

---

CTA

Minimal outline button.

Not filled.

---

# Buttons

Primary

White background

1px border

Padding

14px 28px

Hover

Background:

#222

Text:

white

Transition:

250ms

---

Secondary

Text only.

Underline appears on hover.

---

# Product Cards

Very minimal.

Image first.

No border.

No shadow.

---

Spacing

Image

↓

20px

↓

Product Name

↓

8px

↓

Price

---

Typography

Name

13px

uppercase

Price

13px

#666

---

Hover

Image zoom

scale(1.02)

Duration

400ms

---

# Editorial Sections

Large photography.

Architecture.

Concrete.

Ocean.

Natural light.

Strong geometry.

Minimal props.

Never cluttered.

---

Text

Always offset.

Never centered over image.

---

# Imagery Direction

Photography should use:

Mediterranean architecture

White walls

Concrete

Stone

Natural linen

Ocean

Yachts

Warm sunlight

Blue skies

Soft shadows

Minimal styling

Luxury resort environments

---

Models

Relaxed.

Never smiling excessively.

Natural poses.

Editorial.

---

# Product Photography

Neutral backgrounds.

Soft lighting.

No dramatic contrast.

No filters.

Consistent color temperature.

---

# Cards

No elevation.

No shadows.

No rounded corners.

Border radius:

0

---

# Borders

Hairline only.

1px

#E6E6E6

Used sparingly.

---

# Forms

Minimal.

Large inputs.

48px height.

Underline or thin border.

---

Focus

Dark underline.

Never blue browser glow.

---

# Inputs

Background

Transparent

Border

1px solid #DDD

Padding

16px

---

# Footer

Very spacious.

Large brand wordmark.

Thin separators.

Four-column layout.

Newsletter on right.

---

Typography

Small uppercase.

Muted.

---

# Motion

Everything is subtle.

Animations should never attract attention.

---

Duration

200–400ms

---

Easing

ease-out

or

cubic-bezier(.2,.8,.2,1)

---

Hover

Opacity

TranslateY(-2px)

Scale(1.01)

Never bounce.

Never elastic.

---

Page Transitions

Fade

+20px vertical movement

300ms

---

# Shadows

Avoid.

If needed:

0 8px 30px rgba(0,0,0,.05)

Maximum.

---

# Border Radius

Almost none.

Images

0

Cards

0

Buttons

0–2px

Inputs

0

---

# Responsive Rules

Desktop

1400+

Very open.

Large margins.

---

Laptop

1200px

Same layout.

Slightly reduced spacing.

---

Tablet

768px

Two-column product grid.

Hero scales down.

---

Mobile

Single column.

Generous vertical spacing remains.

Typography scales proportionally.

Hero title:

48px

Section titles:

34px

---

# Component Library

## Hero

- Fullscreen image
- Serif title
- Small label
- Outline button

---

## Collection Split

50/50 images

Editorial layout

Large photography

Minimal copy

---

## Editorial Text Block

Heading

Paragraph

No button required

---

## Product Grid

2–4 columns

Consistent spacing

Minimal captions

---

## Lifestyle Banner

Full-width campaign image

No overlays unless necessary

---

## Brand Story

Centered serif headline

Supporting paragraph

Large whitespace

---

## Footer

Newsletter

Navigation

Policies

Social icons

Large watermark logo

---

# Iconography

Use:

Lucide

or

Heroicons

Stroke:

1.5px

Never filled.

---

# Accessibility

Contrast ratio AA minimum.

Minimum tap target:

44px

Visible keyboard focus.

Alt text for imagery.

Semantic HTML.

---

# CSS Tokens

```css
:root{

--bg:#ffffff;
--bg-soft:#faf9f7;
--bg-beige:#f4f1ec;

--text:#222222;
--text-light:#666666;
--muted:#999999;

--border:#e6e6e6;

--space-xs:8px;
--space-s:16px;
--space-m:32px;
--space-l:64px;
--space-xl:96px;
--space-xxl:160px;

--radius:0px;

--shadow-soft:0 8px 30px rgba(0,0,0,.05);

--transition:300ms cubic-bezier(.2,.8,.2,1);

}
```

# Tone of Voice

Copy should be:

Elegant

Confident

Restrained

Timeless

Editorial

Never salesy.

Avoid:

"Best Seller"

"Hot Deal"

"Limited Time"

Instead:

"The Summer Edit"

"Crafted for coastal escapes"

"Designed for timeless elegance"

"Resort Collection"

"Made to be lived in"

# Engineering Notes

- Favor CSS Grid over Masonry libraries.
- Use intrinsic image ratios to avoid layout shift.
- Use lazy loading for all imagery except the hero.
- Preserve generous whitespace across all breakpoints.
- Keep DOM structure shallow and semantic.
- Use container queries where appropriate.
- Prefer subtle opacity and transform animations over complex motion.
- Maintain a consistent vertical rhythm based on the spacing scale.
- Avoid visual clutter—every component should justify its presence.
```
