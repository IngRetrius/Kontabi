"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface PageTransitionOptions {
  ready?: boolean;
}

/**
 * Reusable GSAP page entrance animation hook.
 * Animates elements matching semantic CSS classes in a coordinated timeline.
 *
 * Classes:
 *  .anim-header  - Page title / header area
 *  .anim-kpi     - KPI / stat cards (staggered)
 *  .anim-banner  - Alert banners, summary strips
 *  .anim-filter  - Filter controls, search bars
 *  .anim-card    - Content cards (staggered)
 *  .anim-table   - Data tables
 *  .anim-item    - Generic staggered items
 *  .anim-fade    - Simple fade-in elements
 */
export function usePageTransition(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: PageTransitionOptions = {}
) {
  const { ready = true } = options;

  useGSAP(
    () => {
      if (!ready || !containerRef.current) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        const container = containerRef.current;
        if (!container) return;

        const targets: {
          sel: string;
          y: number;
          dur: number;
          stagger: number;
          at: number;
        }[] = [
          { sel: ".anim-header", y: 14, dur: 0.5, stagger: 0, at: 0 },
          { sel: ".anim-kpi", y: 20, dur: 0.5, stagger: 0.06, at: 0.06 },
          { sel: ".anim-banner", y: 12, dur: 0.5, stagger: 0, at: 0.08 },
          { sel: ".anim-filter", y: 10, dur: 0.4, stagger: 0.04, at: 0.1 },
          { sel: ".anim-card", y: 22, dur: 0.55, stagger: 0.07, at: 0.12 },
          { sel: ".anim-table", y: 14, dur: 0.5, stagger: 0, at: 0.18 },
          { sel: ".anim-item", y: 14, dur: 0.45, stagger: 0.05, at: 0.14 },
          { sel: ".anim-fade", y: 0, dur: 0.45, stagger: 0, at: 0.2 },
        ];

        targets.forEach(({ sel, y, dur, stagger, at }) => {
          const els = container.querySelectorAll(sel);
          if (els.length > 0) {
            tl.fromTo(
              els,
              { y, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: dur,
                ...(stagger > 0 && { stagger }),
              },
              at
            );
          }
        });
      });
    },
    { scope: containerRef, dependencies: [ready] }
  );
}
