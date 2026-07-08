# The prompt you see is a typical Node/npm message when running npx for a package that hasn't been locally cached in your current global environment or when a newer version (4.13.0) is available. [1]

When you press y to proceed, the shadcn CLI will spin up, read your custom parameters, and put the block exactly where you want it.
The configuration requires alignment on two critical adjustments for this to complete seamlessly without ignoring the --path setting or throwing an alias error:

## 1. The Real Command to Execute

Press y at that prompt. The proper CLI pattern to force files exactly into packages/ui/src/components/blocks is:

```zsh
npx shadcn@latest add login-03 --cwd packages/ui --path src/components/blocks

npx shadcn@latest add login-03 --cwd packages/ui --path src/components/blocks                                                                  ─╯

Need to install the following packages:
shadcn@4.13.0
Ok to proceed? (y) Y
Shadcn is already installed



```

## 2. Verify Your tsconfig.json Configuration (Crucial)

The CLI uses your path aliases to process block sub-dependencies (like the input fields, buttons, or cards used inside login-03). Because your components.json lists "blocks": "@repo/ui/components/blocks", your packages/ui/tsconfig.json must tell the system that @repo/ui/_translates physically to ./src/_: [2, 3]

{
"compilerOptions": {
"baseUrl": ".",
"paths": {
"@repo/ui/_": ["./src/_"]
}
}
}

## What happens behind the scenes after you hit y

1.  The CLI downloads the login-03 block file directly into your explicitly requested folder path: packages/ui/src/components/blocks/login-03.tsx.
2.  If login-03 relies on base components (like Button or Input) that you don't have yet, the CLI will auto-install those base primitives into the fallback directory defined in your components.json (packages/ui/src/components/ui/) so your repository layout stays perfectly clean. [2, 3]

---

To make sure everything builds cleanly after installation, let me know:

- Did hitting y safely drop the login-03.tsx file inside src/components/blocks?
- Are you intending to bundle this block through your main index.ts file, or do you want to keep your block paths dynamically tree-shaken?

[1] [https://ui.shadcn.com](https://ui.shadcn.com/docs/cli)
[2] [https://ui.shadcn.com](https://ui.shadcn.com/docs/monorepo)
[3] [https://github.com](https://github.com/shadcn-ui/ui/discussions/10484)
