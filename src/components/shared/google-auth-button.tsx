"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GoogleAuthButtonProps {
  label?: string;
  nextPath?: string;
  disabled?: boolean;
  className?: string;
  onError?: (message: string | null) => void;
}

function mapGoogleAuthError(message: string): string {
  if (message.includes("provider is not enabled")) {
    return "Google Auth no esta habilitado en Supabase.";
  }
  return message;
}

export function GoogleAuthButton({
  label = "Continuar con Google",
  nextPath = "/dashboard/overview",
  disabled,
  className,
  onError,
}: GoogleAuthButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function handleGoogleSignIn() {
    setIsRedirecting(true);
    onError?.(null);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      onError?.(mapGoogleAuthError(error.message));
      setIsRedirecting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-10 w-full", className)}
      onClick={handleGoogleSignIn}
      disabled={disabled || isRedirecting}
    >
      {isRedirecting ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/70 border-t-transparent" />
          Redirigiendo...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              d="M22.5 12.24c0-.78-.07-1.53-.2-2.24H12v4.24h5.89a5.03 5.03 0 0 1-2.18 3.3v2.73h3.52c2.06-1.9 3.27-4.69 3.27-8.03z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.96 0 5.44-.98 7.25-2.67l-3.52-2.73c-.98.66-2.23 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.55H2.2v2.86A10.99 10.99 0 0 0 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.83 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.44.33-2.1V7.04H2.2A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.2 4.96l3.63-2.86z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.35c1.61 0 3.06.55 4.2 1.65l3.15-3.15C17.43 2.09 14.96 1 12 1 7.8 1 4.14 3.4 2.2 7.04l3.63 2.86c.87-2.61 3.3-4.55 6.17-4.55z"
              fill="#EA4335"
            />
          </svg>
          {label}
        </span>
      )}
    </Button>
  );
}