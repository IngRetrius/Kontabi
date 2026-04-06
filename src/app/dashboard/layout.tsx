"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Breadcrumbs, getPageTitle } from "@/components/layout/breadcrumbs";
import { UserMenu } from "@/components/layout/user-menu";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Building2,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(pathname);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.fromTo(
          ".shell-brand",
          { x: -12, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.5 }
        )
          .fromTo(
            ".shell-nav-section",
            { x: -16, opacity: 0 },
            { x: 0, opacity: 1, stagger: 0.04, duration: 0.4 },
            0.08
          )
          .fromTo(
            ".shell-collapse",
            { opacity: 0 },
            { opacity: 1, duration: 0.35 },
            0.3
          )
          .fromTo(
            ".shell-header",
            { y: -8, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            0.05
          )
          .fromTo(
            ".shell-breadcrumbs",
            { y: -6, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.35 },
            0.12
          )
          .fromTo(
            ".shell-main",
            { opacity: 0 },
            { opacity: 1, duration: 0.5 },
            0.15
          );
      });
    },
    { scope: shellRef }
  );

  return (
    <div ref={shellRef} className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden relative flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out lg:flex overflow-hidden",
          collapsed ? "w-[52px]" : "w-[220px]"
        )}
      >
        {/* Architectural grid background */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: 0.03 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="sidebar-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sidebar-grid)" />
        </svg>
        {/* Diagonal accent */}
        <div className="pointer-events-none absolute -right-8 top-10 h-px w-40 rotate-[35deg] bg-gradient-to-r from-transparent via-sidebar-foreground/10 to-transparent" />

        {/* Brand */}
        <div
          className={cn(
            "shell-brand relative z-10 flex h-12 shrink-0 items-center border-b border-sidebar-border px-3",
            collapsed && "justify-center px-0"
          )}
        >
          <Link
            href="/dashboard/overview"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
              K
            </div>
            {!collapsed && (
              <span className="font-display text-[15px] tracking-tight text-sidebar-foreground">
                Kontabi
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <div className="relative z-10 flex-1 min-h-0">
          <SidebarNav collapsed={collapsed} />
        </div>

        {/* Collapse toggle */}
        <div className="shell-collapse relative z-10 shrink-0 border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "w-full text-muted-foreground hover:text-sidebar-foreground",
              collapsed && "mx-auto"
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu de navegacion</SheetTitle>
          <div className="flex h-12 items-center border-b border-sidebar-border px-3">
            <Link
              href="/dashboard/overview"
              className="flex items-center gap-2.5"
              onClick={() => setMobileOpen(false)}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
                K
              </div>
              <span className="font-display text-[15px] tracking-tight">
                Kontabi
              </span>
            </Link>
          </div>
          <div onClick={() => setMobileOpen(false)}>
            <SidebarNav collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <header className="shell-header flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <h1 className="font-display text-base tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Tenant badge */}
            <div className="mr-1 hidden items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
              <Building2 className="h-3 w-3" />
              <span>Mi Conjunto</span>
            </div>

            {/* User menu */}
            <UserMenu />
          </div>
        </header>

        {/* Breadcrumbs */}
        <div className="shell-breadcrumbs shrink-0 border-b border-border/50 bg-muted/30 px-4 py-1.5 lg:px-6">
          <Breadcrumbs />
        </div>

        {/* Page content */}
        <main className="shell-main flex-1 overflow-y-auto bg-muted/20 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
