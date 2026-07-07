# Adding Dependencies to Next.js Turborepo

## Adding Dependencies to `packages/ui`

### Add the modern independent `motion` package (which replaces `framer-motion` and uses the `motion/react` entry point), you need to configure your packages/ui workspace properly so your Next.js application compiles cleanly without SSR type mismatches or runtime errors

```zsh
pnpm --filter @repo/ui add motion
```
