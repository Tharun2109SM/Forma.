"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";

export function ScoreValue({ score }: { score: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (valueRef.current) valueRef.current.textContent = score.toFixed(1);
      return;
    }

    const counter = { value: 0 };
    const animation = animate(counter, {
      value: score,
      duration: 640,
      ease: "outExpo",
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = counter.value.toFixed(1);
        }
      },
    });

    return () => {
      animation.cancel();
    };
  }, [score]);

  return <span ref={valueRef}>0.0</span>;
}
