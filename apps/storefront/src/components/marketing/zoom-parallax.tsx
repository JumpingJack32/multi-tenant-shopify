"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "@repo/ui/components/motion";

interface PictureItem {
  src: string;
  scale: MotionValue<number>;
  styleContainer: string;
  alt: string;
}

const IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
    alt: "Minimal fashion boutique interior",
  },
  {
    src: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80",
    alt: "Racks of designer clothing in a store",
  },
  {
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80",
    alt: "Person shopping for clothing",
  },
  {
    src: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
    alt: "Fashion items on a hanger",
  },
  {
    src: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&q=80",
    alt: "Tailored clothing on display",
  },
  {
    src: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&q=80",
    alt: "Clothing rack with neutral tones",
  },
  {
    src: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&q=80",
    alt: "Mannequins in a minimalist storefront",
  },
];

export function ZoomParallax() {
  const container = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const scale4 = useTransform(smoothProgress, [0, 1], [1, 4]);
  const scale5 = useTransform(smoothProgress, [0, 1], [1, 5]);
  const scale6 = useTransform(smoothProgress, [0, 1], [1, 6]);
  const scale8 = useTransform(smoothProgress, [0, 1], [1, 8]);
  const scale9 = useTransform(smoothProgress, [0, 1], [1, 9]);

  const pictures: PictureItem[] = [
    {
      src: IMAGES[0]!.src,
      alt: IMAGES[0]!.alt,
      scale: scale4,
      styleContainer: "w-[25vw] h-[25vh]",
    },
    {
      src: IMAGES[1]!.src,
      alt: IMAGES[1]!.alt,
      scale: scale5,
      styleContainer: "top-[-30vh] left-[5vw] w-[35vw] h-[30vh]",
    },
    {
      src: IMAGES[2]!.src,
      alt: IMAGES[2]!.alt,
      scale: scale6,
      styleContainer: "top-[-10vh] left-[-25vw] w-[20vw] h-[45vh]",
    },
    {
      src: IMAGES[3]!.src,
      alt: IMAGES[3]!.alt,
      scale: scale5,
      styleContainer: "left-[27.5vw] w-[25vw] h-[25vh]",
    },
    {
      src: IMAGES[4]!.src,
      alt: IMAGES[4]!.alt,
      scale: scale6,
      styleContainer: "top-[27.5vh] left-[5vw] w-[20vw] h-[25vh]",
    },
    {
      src: IMAGES[5]!.src,
      alt: IMAGES[5]!.alt,
      scale: scale8,
      styleContainer: "top-[27.5vh] left-[-22.5vw] w-[30vw] h-[25vh]",
    },
    {
      src: IMAGES[6]!.src,
      alt: IMAGES[6]!.alt,
      scale: scale9,
      styleContainer: "top-[22.5vh] left-[25vw] w-[15vw] h-[15vh]",
    },
  ];

  return (
    <section ref={container} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-background">
        {pictures.map(({ src, alt, scale, styleContainer }, index) => (
          <motion.div
            key={index}
            style={{ scale }}
            className="absolute top-0 flex h-full w-full items-center justify-center"
          >
            <div className={`relative ${styleContainer}`}>
              <Image
                src={src}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                alt={alt}
                className="object-cover"
              />
            </div>
          </motion.div>
        ))}

        {/* Overlay headline + CTAs */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            The e-commerce platform for independent brands
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
            Multi-warehouse inventory, subscriptions, global payments, and
            analytics — all in one platform.
          </p>
          <div className="pointer-events-auto mt-2 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start Your 14-Day Free Trial
            </Link>
            <Link
              href="/showcase"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border px-8 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              View Showcase Store
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
