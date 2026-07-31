"use client";

import {
  motion as baseMotion,
  AnimatePresence as BaseAnimatePresence,
  useScroll as baseUseScroll,
  useTransform as baseUseTransform,
  useSpring as baseUseSpring,
  useReducedMotion as baseUseReducedMotion,
} from "motion/react";

import type {
  HTMLMotionProps,
  AnimatePresenceProps,
  MotionValue,
} from "motion/react";

// 1. Explicitly type the motion object mapping
export const motion: typeof baseMotion = baseMotion;

// 2. Explicitly type the React component
export const AnimatePresence: React.ComponentType<
  React.PropsWithChildren<AnimatePresenceProps>
> = BaseAnimatePresence;

// 3. Scroll / spring / transform hooks for parallax and scroll-driven effects
export const useScroll: typeof baseUseScroll = baseUseScroll;
export const useTransform: typeof baseUseTransform = baseUseTransform;
export const useSpring: typeof baseUseSpring = baseUseSpring;
export const useReducedMotion: typeof baseUseReducedMotion = baseUseReducedMotion;

export type { MotionValue };

// // 3. Your custom portable component
// export function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {
//     return (
//         <baseMotion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             className={className}
//         >
//             {children}
//         </baseMotion.div>
//     );
// }
