import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Kontabi</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Plataforma de gestion financiera para propiedad horizontal en Colombia
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Iniciar sesion
        </Link>
        <Link
          href="/register"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Registrarse
        </Link>
      </div>
    </main>
  );
}
