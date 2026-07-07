# The Tailwind extension often gets lost in monorepos. You need to configure the tailwindCSS.experimental.configFile setting to map your projects

## `Setting.json`

```json
{
    
    "files.associations": {
        "*.css": "tailwindcss"
    },
    "tailwindCSS.includeLanguages": {
        "plaintext": "{ts,tsx,js,jsx,css}"
    },
    "tailwindCSS.classFunctions": [ "tw", "clsx", "tw\\.[a-z-]+" ],

    "tailwindCSS.experimental.configFile": {
        // "packages/ui/src/styles/globals.css": "**/*.{ts,tsx,js,jsx,css}",
        "packages/ui/src/styles/globals.css": [
            "apps/frontend/**/*",
            "apps/admin/**/*",
            "packages/ui/**/*"
        ]
    },
    "editor.quickSuggestions": {
        "strings": true
    }

    ...
}
```

## `packages/ui/src/styles/globals.css`

```css
@import "tailwindcss";
@plugin "tailwindcss-animate";

@custom-variant dark (&:is(.dark *));
@source "../../../apps/**/*.{ts,tsx}";
@source "../../../components/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";

/* 1. Scan components inside your UI package */
@source "../**/*.{ts,tsx,js,jsx}";

/* 2. Scan components inside your app(s), adjusting the path if needed */
@source "../../../../apps/frontend/src/**/*.{ts,tsx,js,jsx}";
@source "../../../../apps/admin/src/**/*.{ts,tsx,js,jsx}";

:root {
  --background: oklch(0.985 0.002 250);
  --foreground: oklch(0.140 0.010 250);
  --card: oklch(0.995 0.001 250);
  ...
}
  ...
```
