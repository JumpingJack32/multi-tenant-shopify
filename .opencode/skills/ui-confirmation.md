---
name: ui-confirmation
description: Generates visual confirmation UI cards for verifying Clerk, Supabase, and Python backend stacks using shadcn/ui, base-ui, and motion/react.
license: MIT
compatibility: opencode
metadata:
  framework: Next.js 16.2
  styling: Tailwind CSS v4
  animation: motion/react (React 19)
---

## What I Do

- Generate interactive UI confirmation blocks inside `apps/web/src/components/`.
- Scaffolds clean form integrations leveraging React 19 `SubmitEvent` instead of deprecated event types.
- Orchestrates animations using the modern `motion/react` package instead of the legacy `framer-motion` entry point.
- Hardcodes safe frontend authorization patterns that request standard Clerk Supabase JWTs to proxy requests directly to local FastAPI backends running on OrbStack.

## Core Directives & Styling Rules

### 1. React 19 & TypeScript Type Standards

- ALWAYS utilize `SubmitEvent` for handling form submissions (`e: SubmitEvent`). Do not use `FormEvent`.
- Components are built using `"use client"` where state management or animation runtimes require it.

### 2. Styling (Tailwind CSS v4)

- Use standard, atomic Tailwind classes. Avoid legacy v3 config patterns.
- Stick to standard utility classes (`size-16` instead of `w-16 h-16`, native alpha modifiers like `bg-green-500/20`).

### 3. Shadcn ui (base-ui/react)

- Use standard, shadcn block where possible

  ```typescript
  import { card, ... } from "@base-ui/react";
  ```

### 4. Animation (`motion/react`)

- DO NOT import from `framer-motion`. Import from `motion/react`:
  
  ```typescript
  import { motion, AnimatePresence } from "motion/react";
  ```
