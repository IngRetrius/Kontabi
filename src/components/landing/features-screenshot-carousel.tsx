"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ScreenshotSlide {
  src: string;
  title: string;
  path: string;
}

const SCREENSHOT_SLIDES: ScreenshotSlide[] = [
  {
    src: "/images/landing-showcase/dashboard-kontabi.png",
    title: "Dashboard principal",
    path: "/dashboard",
  },
  {
    src: "/images/landing-showcase/transacciones-kontabi.png",
    title: "Libro de transacciones",
    path: "/dashboard/financials/transactions",
  },
  {
    src: "/images/landing-showcase/presupuesto-anual-kontabi.png",
    title: "Planeacion presupuestal anual",
    path: "/dashboard/budget",
  },
  {
    src: "/images/landing-showcase/dashboard-cartera-kontabi.png",
    title: "Dashboard de cartera",
    path: "/dashboard/overview",
  },
  {
    src: "/images/landing-showcase/cobros-kontabi.png",
    title: "Gestion de cobros",
    path: "/dashboard/payments",
  },
  {
    src: "/images/landing-showcase/registrar-pago-kontabi.png",
    title: "Registro de pagos",
    path: "/dashboard/payments/new",
  },
  {
    src: "/images/landing-showcase/indicadores-kontabi.png",
    title: "Indicadores",
    path: "/dashboard/indicators",
  },
  {
    src: "/images/landing-showcase/reportes-kontabi.png",
    title: "Centro de reportes",
    path: "/dashboard/reports",
  },
];

function getNextIndex(index: number): number {
  return (index + 1) % SCREENSHOT_SLIDES.length;
}

function getPrevIndex(index: number): number {
  return (index - 1 + SCREENSHOT_SLIDES.length) % SCREENSHOT_SLIDES.length;
}

export function FeaturesScreenshotCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      setActive((current) => getNextIndex(current));
    }, 4500);

    return () => window.clearInterval(timer);
  }, [paused]);

  const current = useMemo(() => SCREENSHOT_SLIDES[active], [active]);

  useGSAP(
    () => {
      if (!rootRef.current) return;

      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0, y: 32 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 85%",
            once: true,
          },
        }
      );
    },
    { scope: rootRef }
  );

  useEffect(() => {
    if (!frameRef.current || !titleRef.current || !pathRef.current || !dotsRef.current) {
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    tl.fromTo(
      frameRef.current,
      { autoAlpha: 0.6, scale: 0.985 },
      { autoAlpha: 1, scale: 1, duration: 0.45 }
    )
      .fromTo(
        [pathRef.current, titleRef.current],
        { y: 8, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.05 },
        0.05
      )
      .fromTo(
        dotsRef.current.children,
        { scale: 0.8, autoAlpha: 0.5 },
        { scale: 1, autoAlpha: 1, duration: 0.25, stagger: 0.03 },
        0.1
      );

    return () => {
      tl.kill();
    };
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        </div>
        <div className="flex-1 flex justify-center">
          <div ref={pathRef} className="max-w-full truncate rounded bg-muted px-3 py-0.5 text-[10px] text-muted-foreground">
            {`kontabi.app${current.path}`}
          </div>
        </div>
      </div>

      <div className="p-3 lg:p-4">
        <div ref={frameRef} className="relative aspect-video rounded-xl border border-border bg-muted/25">
          <Image
            src={current.src}
            alt={current.title}
            fill
            className="rounded-xl object-contain object-center"
            sizes="(max-width: 1920px) 100vw, 1920px"
            quality={100}
            unoptimized
            priority={active === 0}
          />

          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Vista anterior"
              onClick={() => setActive((index) => getPrevIndex(index))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/95 text-foreground transition-colors hover:bg-background"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Vista siguiente"
              onClick={() => setActive((index) => getNextIndex(index))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/95 text-foreground transition-colors hover:bg-background"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <p
            ref={titleRef}
            className="font-display text-[15px] tracking-tight text-foreground"
          >
            {current.title}
          </p>
          <div ref={dotsRef} className="flex gap-1.5">
            {SCREENSHOT_SLIDES.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Ir a ${slide.title}`}
                className={`h-1.5 rounded-full transition-all ${
                  active === index
                    ? "w-6 bg-foreground"
                    : "w-2 bg-foreground/25 hover:bg-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
