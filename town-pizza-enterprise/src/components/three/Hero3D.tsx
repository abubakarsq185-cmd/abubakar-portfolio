"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PizzaScene } from "./PizzaScene";

/**
 * WebGL hero. Mount-guarded so the Canvas never renders on the server
 * (avoids hydration/WebGL errors). Falls back to a warm gradient until ready
 * and if the user prefers reduced motion we render a static frame.
 */
export function Hero3D() {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    const hero = document.getElementById("home");
    const onScroll = () => {
      if (!hero) return;
      const h = hero.offsetHeight || window.innerHeight;
      scrollRef.current = Math.min(1, Math.max(0, window.scrollY / h));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {mounted && (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          camera={{ position: [0, 2.6, 8.2], fov: 42 }}
        >
          <PizzaScene scrollRef={scrollRef} />
        </Canvas>
      )}
    </div>
  );
}
