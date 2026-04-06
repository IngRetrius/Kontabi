"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Check,
  Menu,
  Receipt,
  Shield,
  TrendingUp,
  X,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: BookOpen,
    title: "Motor de Lenguaje Simple",
    description:
      "Cada operacion contable se traduce automaticamente a espanol claro. Sin debitos ni creditos, solo narrativas que cualquiera entiende.",
  },
  {
    icon: BarChart3,
    title: "T-Accounts Visuales",
    description:
      "La partida doble representada visualmente. Ve como se mueve cada peso entre cuentas con diagramas interactivos.",
  },
  {
    icon: TrendingUp,
    title: "Presupuesto Inteligente",
    description:
      "Proyecta ingresos y gastos con incrementos automaticos. Compara presupuesto vs ejecucion en tiempo real.",
  },
  {
    icon: Receipt,
    title: "Control de Cartera",
    description:
      "Estado de cuenta por unidad, calculo automatico de intereses de mora, y clasificacion por antiguedad.",
  },
  {
    icon: ArrowRightLeft,
    title: "Conciliacion Bancaria",
    description:
      "Importa el extracto CSV y cruza automaticamente con los pagos registrados. Sin digitacion manual.",
  },
  {
    icon: Shield,
    title: "Cumplimiento Ley 675",
    description:
      "Fondo de reserva, cuotas extraordinarias, coeficientes de copropiedad. Todo integrado con alertas automaticas.",
  },
];

const SIDEBAR_ITEMS = [
  "Resumen",
  "Transacciones",
  "Presupuesto",
  "Cartera",
  "Conciliacion",
  "Reportes",
];

const CHART_BARS = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88];

const MOCK_TRANSACTIONS = [
  { label: "Cuota Apto 301", amount: "+$850,000", positive: true },
  { label: "Mantenimiento ascensor", amount: "-$320,000", positive: false },
  { label: "Cuota Apto 502", amount: "+$850,000", positive: true },
  { label: "Servicios publicos", amount: "-$180,000", positive: false },
];

/* ------------------------------------------------------------------ */
/*  Grid background (reusable SVG)                                     */
/* ------------------------------------------------------------------ */

function GridBackground({
  id,
  opacity = "0.04",
}: {
  id: string;
  opacity?: string;
}) {
  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={id}
          width="60"
          height="60"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  /* ---- GSAP Animations ---- */
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions!;

          if (reduceMotion) return;

          // Hero entrance
          const heroTl = gsap.timeline({
            defaults: { ease: "power3.out" },
          });
          heroTl
            .fromTo(
              ".nav-animate",
              { y: -20, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6 }
            )
            .fromTo(
              ".hero-badge",
              { y: 20, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6 },
              0.2
            )
            .fromTo(
              ".hero-title-1",
              { y: 50, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.9 },
              0.3
            )
            .fromTo(
              ".hero-title-2",
              { y: 50, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.9 },
              0.45
            )
            .fromTo(
              ".hero-desc",
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7 },
              0.65
            )
            .fromTo(
              ".hero-cta-btn",
              { y: 20, opacity: 0 },
              { y: 0, opacity: 1, stagger: 0.1, duration: 0.6 },
              0.8
            )
            .fromTo(
              ".hero-stat",
              { y: 15, opacity: 0 },
              { y: 0, opacity: 1, stagger: 0.08, duration: 0.5 },
              0.95
            )
            .fromTo(
              ".hero-mockup",
              { y: 80, opacity: 0 },
              { y: 0, opacity: 1, duration: 1.2, ease: "power2.out" },
              0.5
            );

          // Diagonal accent lines draw-in
          heroTl.fromTo(
            ".accent-line",
            { scaleX: 0, opacity: 0 },
            {
              scaleX: 1,
              opacity: 1,
              stagger: 0.2,
              duration: 1,
              ease: "power2.inOut",
            },
            0.3
          );

          // Nav scroll effect
          ScrollTrigger.create({
            start: 100,
            end: "max",
            toggleClass: {
              targets: ".main-nav",
              className: "nav-scrolled",
            },
          });

          // Trust bar
          gsap.fromTo(
            ".trust-item",
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.1,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: ".trust-section",
                start: "top 85%",
              },
            }
          );

          // Features heading
          gsap.fromTo(
            ".features-heading",
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              scrollTrigger: {
                trigger: ".features-section",
                start: "top 80%",
              },
            }
          );

          // Feature cards -- slide up with opacity, no autoAlpha
          gsap.fromTo(
            ".feature-card",
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.08,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: ".features-grid",
                start: "top 85%",
              },
            }
          );

          // NLS section
          const nlsTl = gsap.timeline({
            scrollTrigger: {
              trigger: ".nls-section",
              start: "top 75%",
            },
            defaults: { ease: "power2.out" },
          });
          nlsTl
            .fromTo(
              ".nls-heading",
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8 }
            )
            .fromTo(
              ".nls-before",
              {
                x: isDesktop ? -40 : 0,
                y: isDesktop ? 0 : 30,
                opacity: 0,
              },
              { x: 0, y: 0, opacity: 1, duration: 0.8 },
              0.2
            )
            .fromTo(
              ".nls-arrow",
              { scale: 0, opacity: 0 },
              {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: "back.out(1.7)",
              },
              0.5
            )
            .fromTo(
              ".nls-after",
              {
                x: isDesktop ? 40 : 0,
                y: isDesktop ? 0 : 30,
                opacity: 0,
              },
              { x: 0, y: 0, opacity: 1, duration: 0.8 },
              0.4
            );

          // CTA section
          gsap.fromTo(
            ".cta-inner > *",
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.15,
              duration: 0.8,
              scrollTrigger: {
                trigger: ".cta-section",
                start: "top 80%",
              },
            }
          );
        }
      );
    },
    { scope: containerRef }
  );

  /* ---- Render ---- */
  return (
    <div ref={containerRef} className="font-body overflow-x-hidden">
      {/* ===== NAVIGATION ===== */}
      <nav className="main-nav fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="nav-animate flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
              K
            </div>
            <span className="font-display text-lg tracking-tight text-foreground">
              Kontabi
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 nav-animate">
            <a
              href="#funcionalidades"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Funcionalidades
            </a>
            <a
              href="#ventajas"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Ventajas
            </a>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg border border-foreground/20 bg-background px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Iniciar sesion
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Registrarse
            </Link>
          </div>

          <button
            className="md:hidden nav-animate p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border py-4 px-6 shadow-lg">
            <div className="flex flex-col gap-3">
              <a
                href="#funcionalidades"
                className="text-sm text-foreground/70 py-1.5"
                onClick={() => setMenuOpen(false)}
              >
                Funcionalidades
              </a>
              <a
                href="#ventajas"
                className="text-sm text-foreground/70 py-1.5"
                onClick={() => setMenuOpen(false)}
              >
                Ventajas
              </a>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-foreground/20 text-foreground text-sm font-medium px-4 mt-1"
              >
                Iniciar sesion
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground text-background text-sm font-medium px-4"
              >
                Registrarse
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero-section relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Architectural grid */}
        <GridBackground id="hero-grid" opacity="0.03" />

        {/* Diagonal accent lines */}
        <div className="accent-line absolute -right-32 top-1/4 h-px w-[600px] rotate-[35deg] bg-gradient-to-r from-transparent via-foreground/15 to-transparent origin-left" />
        <div className="accent-line absolute -left-16 bottom-1/3 h-px w-[400px] rotate-[35deg] bg-gradient-to-r from-transparent via-foreground/8 to-transparent origin-left" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-0 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Text content */}
            <div className="flex-1 text-center lg:text-left max-w-xl lg:max-w-none">
              <div className="hero-badge inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-medium text-foreground mb-8">
                Plataforma financiera para propiedad horizontal
              </div>

              <h1>
                <span className="hero-title-1 block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-display text-foreground leading-[1.08] tracking-tight">
                  La contabilidad de tu conjunto,
                </span>
                <span className="hero-title-2 block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-display italic text-foreground leading-[1.08] tracking-tight mt-2">
                  por fin clara.
                </span>
              </h1>

              <p className="hero-desc mt-6 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Kontabi traduce cada operacion contable a espanol simple.
                Gestiona presupuestos, cartera y cumplimiento de la Ley 675
                sin necesidad de ser contador.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="hero-cta-btn inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
                >
                  Comenzar gratis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <a
                  href="#funcionalidades"
                  className="hero-cta-btn inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Explorar funcionalidades
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3 mt-10 justify-center lg:justify-start">
                {[
                  "Ley 675 integrada",
                  "NIIF Grupo 3",
                  "6 KPIs en tiempo real",
                ].map((text) => (
                  <div
                    key={text}
                    className="hero-stat flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-background" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hero-mockup flex-1 w-full max-w-xl lg:max-w-[580px]">
              <div className="relative rounded-2xl border border-border bg-background shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="text-[10px] text-muted-foreground bg-muted rounded px-3 py-0.5">
                      kontabi.app/dashboard
                    </div>
                  </div>
                </div>

                <div className="flex">
                  {/* Sidebar */}
                  <div className="hidden sm:block w-40 border-r border-border bg-muted/30 py-4 px-3">
                    <div className="font-display text-sm text-foreground px-2 mb-4">
                      Kontabi
                    </div>
                    <div className="space-y-0.5">
                      {SIDEBAR_ITEMS.map((item, i) => (
                        <div
                          key={item}
                          className={`text-[11px] px-2 py-1.5 rounded-md ${
                            i === 0
                              ? "bg-foreground text-background font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          Resumen Financiero
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Marzo 2026
                        </div>
                      </div>
                      <div className="text-[10px] bg-muted text-foreground px-2 py-0.5 rounded-full font-medium">
                        Al dia
                      </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        {
                          label: "Ingresos",
                          value: "$24.5M",
                          sub: "+12%",
                        },
                        {
                          label: "Gastos",
                          value: "$18.2M",
                          sub: "-3%",
                        },
                        {
                          label: "Balance",
                          value: "$6.3M",
                          sub: "Saludable",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="bg-muted/60 rounded-lg p-2.5"
                        >
                          <div className="text-[9px] text-muted-foreground mb-0.5">
                            {stat.label}
                          </div>
                          <div className="text-sm font-bold text-foreground">
                            {stat.value}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {stat.sub}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chart */}
                    <div className="bg-muted/40 rounded-lg p-3 mb-4">
                      <div className="text-[10px] text-muted-foreground mb-2">
                        Ingresos vs Gastos (12 meses)
                      </div>
                      <div className="flex items-end gap-[3px] h-14">
                        {CHART_BARS.map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 flex flex-col gap-[2px] justify-end"
                          >
                            <div
                              className="w-full rounded-sm bg-foreground/60"
                              style={{ height: `${h * 0.55}%` }}
                            />
                            <div
                              className="w-full rounded-sm bg-foreground/15"
                              style={{ height: `${h * 0.35}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Transactions */}
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-2">
                        Ultimos movimientos
                      </div>
                      <div className="space-y-1.5">
                        {MOCK_TRANSACTIONS.map((tx, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center"
                          >
                            <span className="text-[10px] text-muted-foreground">
                              {tx.label}
                            </span>
                            <span
                              className={`text-[10px] font-medium ${
                                tx.positive
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {tx.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <section className="trust-section py-8 border-y border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <span className="trust-item text-sm text-muted-foreground">
            Disenado para cumplir con
          </span>
          <div className="flex flex-wrap justify-center gap-3">
            {["Ley 675 de 2001", "NIIF Grupo 3", "Decreto 2420 de 2015"].map(
              (badge) => (
                <span
                  key={badge}
                  className="trust-item text-xs font-medium text-foreground bg-muted border border-border rounded-full px-4 py-1.5"
                >
                  {badge}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section
        id="funcionalidades"
        className="features-section py-20 sm:py-28 bg-muted/40"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="features-heading text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-display text-foreground tracking-tight">
              Todo lo que necesitas para administrar con confianza
            </h2>
            <p className="mt-4 text-muted-foreground text-base sm:text-lg">
              Desde la contabilidad hasta el cumplimiento legal, cada modulo
              esta disenado para simplificar tu trabajo diario.
            </p>
          </div>

          <div className="features-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="feature-card rounded-xl border border-border bg-background p-6 shadow-sm hover:shadow-lg hover:border-foreground/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center text-background mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== NLS SHOWCASE ===== */}
      <section
        id="ventajas"
        className="nls-section py-20 sm:py-28 bg-muted/40"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="nls-heading text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground mb-4">
              Diferenciador clave
            </div>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground tracking-tight">
              Contabilidad en tu idioma, no en jeroglificos
            </h2>
            <p className="mt-4 text-muted-foreground text-base sm:text-lg">
              El motor NLS traduce cada asiento contable a espanol claro. Tus
              copropietarios entenderan cada peso.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-4 max-w-5xl mx-auto">
            {/* Before -- dark panel */}
            <div className="nls-before flex-1 rounded-xl bg-foreground p-6 text-background overflow-hidden relative">
              {/* Grid overlay */}
              <GridBackground id="nls-grid" opacity="0.06" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-background/40" />
                  <span className="text-[11px] font-medium text-background/50 uppercase tracking-wider">
                    Contabilidad tradicional
                  </span>
                </div>
                <pre className="font-mono text-background/80 whitespace-pre-wrap text-[11px] sm:text-xs leading-relaxed">
{`COMPROBANTE DE INGRESO #0142
Fecha: Enero 15, 2026

CUENTA              DEBITO       CREDITO
1105 Caja          $1,500,000
1305 CxC Ordinaria              $1,500,000
  Subcta: Unidad 301
  Concepto: Cuota Ord. Enero

Total              $1,500,000   $1,500,000`}
                </pre>
              </div>
            </div>

            {/* Arrow */}
            <div className="nls-arrow flex items-center justify-center py-2 lg:py-0 lg:px-2">
              <div className="w-11 h-11 rounded-full bg-foreground flex items-center justify-center text-background lg:rotate-0 rotate-90">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* After -- light panel */}
            <div className="nls-after flex-1 rounded-xl border border-border bg-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Motor NLS de Kontabi
                </span>
              </div>
              <div className="space-y-4">
                <p className="text-base font-semibold text-foreground">
                  El apartamento 301 pago su cuota de enero
                </p>
                <div className="space-y-2.5 text-sm text-muted-foreground">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Que paso
                  </p>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span>Recibimos $1,500,000 en caja</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span>El apto 301 ya no debe la cuota de enero</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-2.5 text-sm text-muted-foreground">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Impacto
                  </p>
                  <div className="flex items-start gap-2.5">
                    <TrendingUp className="w-4 h-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span>La cartera morosa bajo un 2.3%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="cta-section relative py-24 sm:py-32 overflow-hidden bg-foreground text-background">
        <GridBackground id="cta-grid" opacity="0.05" />
        {/* Diagonal accents */}
        <div className="absolute -right-32 top-1/3 h-px w-[600px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/15 to-transparent" />
        <div className="absolute -left-16 bottom-1/4 h-px w-[400px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/8 to-transparent" />

        <div className="cta-inner relative max-w-2xl mx-auto text-center px-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display text-background tracking-tight leading-tight">
            Empieza a administrar con claridad
          </h2>
          <p className="mt-6 text-background/50 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Sin tarjeta de credito. Configura tu conjunto en minutos y
            descubre una nueva forma de gestionar las finanzas.
          </p>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-background px-8 text-sm font-semibold text-foreground hover:bg-background/90 transition-colors mt-10"
          >
            Crear cuenta gratis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-foreground border-t border-background/10 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2.5 justify-center md:justify-start">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-background/20 bg-background/10 text-xs font-bold text-background">
                K
              </div>
              <span className="font-display text-lg text-background">
                Kontabi
              </span>
            </div>
            <p className="text-xs text-background/40 mt-2">
              Gestion financiera para propiedad horizontal
            </p>
          </div>
          <div className="flex gap-8 text-sm text-background/40">
            <a
              href="#funcionalidades"
              className="hover:text-background transition-colors"
            >
              Funcionalidades
            </a>
            <a
              href="#ventajas"
              className="hover:text-background transition-colors"
            >
              Ventajas
            </a>
            <Link
              href="/login"
              className="hover:text-background transition-colors"
            >
              Iniciar sesion
            </Link>
          </div>
          <p className="text-xs text-background/25">
            &copy; 2026 Kontabi. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
