"use client";

import Image from "next/image";
import { useMemo, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "@repo/ui/components/motion";

const WORD = "with motion/react";

interface FloatingLetterProps {
  letter: string;
  scrollYProgress: MotionValue<number>;
  targetY: number;
}

// Encapsulates the transform hook per character to respect React rules
function FloatingLetter({ letter, scrollYProgress, targetY }: FloatingLetterProps) {
  const y = useTransform(scrollYProgress, [0, 1], [0, targetY]);

  return (
    <motion.span style={{ top: y }} className="relative inline-block">
      {letter === " " ? "\u00A0" : letter}
    </motion.span>
  );
}

const IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80",
    alt: "Racks of designer clothing",
  },
  {
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80",
    alt: "Person shopping for clothing",
  },
  {
    src: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&q=80",
    alt: "Clothing rack with neutral tones",
  },
];

export function LayerParallax() {
  const container = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start end", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const sm = useTransform(smoothProgress, [0, 1], [0, -50]);
  const md = useTransform(smoothProgress, [0, 1], [0, -150]);
  const lg = useTransform(smoothProgress, [0, 1], [0, -250]);

  // Deterministic per-index offsets — identical on server & client (no hydration mismatch)
  const letterOffsets = useMemo(
    () => WORD.split("").map((_, i) => -25 - ((i * 37) % 75)),
    [],
  );

  const images = [
    { src: IMAGES[0]!.src, alt: IMAGES[0]!.alt, y: 0, styles: "h-[60vh] w-[50vh] z-[1]" },
    { src: IMAGES[1]!.src, alt: IMAGES[1]!.alt, y: lg, styles: "left-[55vw] top-[15vh] h-[40vh] w-[30vh] z-[2]" },
    { src: IMAGES[2]!.src, alt: IMAGES[2]!.alt, y: md, styles: "left-[27.5vw] top-[40vh] h-[25vh] w-[20vh] z-[3]" },
  ];

  return (
    <div ref={container} className="relative mt-[10vh] min-h-screen w-full">
      {/* Headings & Text Section */}
      <div className="ml-[10vw]">
        <motion.h1
          style={{ y: sm }}
          className="m-0 mt-[10px] text-[5vw] leading-[5vw] font-bold uppercase tracking-tight"
        >
          Parallax
        </motion.h1>

        <h1 className="m-0 mt-[10px] text-[5vw] leading-[5vw] font-bold uppercase tracking-tight">
          Scroll
        </h1>

        <div className="m-0 mt-[10px] text-[3vw] font-medium uppercase text-white">
          <p className="m-0">
            {WORD.split("").map((letter, i) => (
              <FloatingLetter
                key={`l_${i}`}
                letter={letter}
                scrollYProgress={smoothProgress}
                targetY={letterOffsets[i]!}
              />
            ))}
          </p>
        </div>
      </div>

      {/* Floating Image Parallax Stack */}
      <div className="relative mt-[5vh] flex w-full justify-center">
        {images.map(({ src, alt, y, styles }, i) => (
          <motion.div key={`i_${i}`} style={{ y }} className={`absolute ${styles}`}>
            <div className="relative h-full w-full overflow-hidden shadow-2xl">
              <Image
                src={src}
                fill
                sizes="(max-width: 640px) 100vw, 40vw"
                alt={alt}
                className="object-cover"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
