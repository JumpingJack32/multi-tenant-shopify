"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "@repo/ui/components/motion";

const IMAGES = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
  "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
  "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&q=80",
  "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&q=80",
  "https://images.unsplash.com/photo-1450297350677-623de575f31c?w=800&q=80",
  "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=800&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
  "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=800&q=80",
];

interface ColumnProps {
  images: string[];
  y: MotionValue<number>;
  topOffset: string;
}

function Column({ images, y, topOffset }: ColumnProps) {
  return (
    <motion.div
      style={{ y }}
      className={`relative flex min-w-[250px] w-1/4 flex-col gap-[2vw] ${topOffset}`}
    >
      {images.map((src, i) => (
        <div
          key={i}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-[1vw]"
        >
          <Image
            src={src}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            alt={`Gallery item ${i + 1}`}
            className="object-cover"
          />
        </div>
      ))}
    </motion.div>
  );
}

export function ParallaxGallery() {
  const gallery = useRef<HTMLDivElement>(null);
  const [dimension, setDimension] = useState({ width: 0, height: 0 });

  const { scrollYProgress } = useScroll({
    target: gallery,
    offset: ["start end", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimension({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { height } = dimension;

  const y1 = useTransform(smoothProgress, [0, 1], [0, height * 2]);
  const y2 = useTransform(smoothProgress, [0, 1], [0, height * 3.3]);
  const y3 = useTransform(smoothProgress, [0, 1], [0, height * 1.25]);
  const y4 = useTransform(smoothProgress, [0, 1], [0, height * 3]);

  const columns = [
    { images: [IMAGES[0]!, IMAGES[1]!, IMAGES[2]!], y: y1, top: "top-[-45%]" },
    { images: [IMAGES[3]!, IMAGES[4]!, IMAGES[5]!], y: y2, top: "top-[-95%]" },
    { images: [IMAGES[6]!, IMAGES[7]!, IMAGES[8]!], y: y3, top: "top-[-45%]" },
    { images: [IMAGES[9]!, IMAGES[10]!, IMAGES[11]!], y: y4, top: "top-[-75%]" },
  ];

  return (
    <section className="relative bg-background">
      {/* Top spacer */}
      <div className="h-screen w-full" />

      {/* Gallery container */}
      <div
        ref={gallery}
        className="relative flex h-[175vh] w-full gap-[2vw] overflow-hidden bg-background p-[2vw]"
      >
        {columns.map((col, index) => (
          <Column
            key={index}
            images={col.images}
            y={col.y}
            topOffset={col.top}
          />
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-screen w-full" />
    </section>
  );
}
