"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";

export function MarketingMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      duration: 0.9,
      smoothWheel: true,
      anchors: true,
    });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero-reveal]", {
          y: 28,
          opacity: 0,
          duration: 0.62,
          stagger: 0.09,
        })
        .from(
          ".source-fragment",
          {
            x: (index) => (index % 2 === 0 ? -22 : 22),
            opacity: 0,
            duration: 0.45,
            stagger: 0.06,
          },
          "-=0.28",
        )
        .from(
          ".normalization-row",
          { x: -12, opacity: 0, duration: 0.35, stagger: 0.07 },
          "-=0.2",
        )
        .from(
          ".ranking-stack .ranking-row",
          { y: 14, opacity: 0, duration: 0.38, stagger: 0.07 },
          "-=0.2",
        );

      gsap.utils.toArray<HTMLElement>("[data-scroll-reveal]").forEach((element) => {
        gsap.from(element, {
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
          y: 22,
          opacity: 0,
          duration: 0.58,
          ease: "power3.out",
        });
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      context.revert();
      lenis.destroy();
    };
  }, []);

  return null;
}
