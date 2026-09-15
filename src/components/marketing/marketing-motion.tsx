"use client";

import { animate, stagger } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";

export function MarketingMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      duration: 0.82,
      smoothWheel: true,
      anchors: true,
      autoRaf: false,
    });
    const updateScrollTrigger = () => ScrollTrigger.update();
    const driveLenis = (time: number) => lenis.raf(time * 1_000);
    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(driveLenis);
    gsap.ticker.lagSmoothing(0);

    const termAnimation = animate("[data-lock-term]", {
      opacity: [0, 1],
      translateX: [-10, 0],
      delay: stagger(54, { start: 360 }),
      duration: 420,
      ease: "outExpo",
    });

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero-line]", {
          yPercent: 18,
          opacity: 0,
          duration: 0.72,
        })
        .from("[data-hero-support]", { y: 24, opacity: 0, duration: 0.55 }, "-=0.36")
        .from(
          ".noise-fragment",
          {
            x: (index) => (index % 2 === 0 ? -34 : 28),
            y: (index) => (index % 3 - 1) * 18,
            opacity: 0,
            duration: 0.42,
            stagger: 0.055,
          },
          "-=0.18",
        )
        .from(
          ".measurement-cluster b",
          { scaleX: 0, transformOrigin: "left center", duration: 0.5, stagger: 0.08 },
          "-=0.24",
        )
        .from(
          "[data-rank-row]",
          { y: 16, opacity: 0, duration: 0.4, stagger: 0.06 },
          "-=0.28",
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

      gsap.to(".continuous-story-rail i", {
        scaleY: 1,
        transformOrigin: "top center",
        ease: "none",
        scrollTrigger: {
          trigger: ".input-story",
          endTrigger: ".ask-story",
          start: "top 70%",
          end: "bottom 35%",
          scrub: 0.35,
        },
      });

      gsap.utils.toArray<HTMLElement>("[data-story-section]").forEach((section) => {
        const heading = section.querySelector(".story-heading, .product-story-copy");
        if (!heading) return;
        gsap.from(heading, {
          x: -18,
          opacity: 0,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: section, start: "top 76%", once: true },
        });
      });

      gsap.from("[data-formula-part]", {
        y: 26,
        opacity: 0,
        duration: 0.46,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-formula-board]", start: "top 74%", once: true },
      });
    });

    return () => {
      termAnimation.cancel();
      context.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      lenis.off("scroll", updateScrollTrigger);
      gsap.ticker.remove(driveLenis);
      lenis.destroy();
    };
  }, []);

  return null;
}
