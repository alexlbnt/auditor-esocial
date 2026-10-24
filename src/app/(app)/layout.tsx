import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LayoutDoApp({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-tinta">
        <nav
          className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
          aria-label="Principal"
        >
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            pente fino<span className="text-erro">.</span>
          </Link>
          <Link
            href="/auditorias/nova"
            className="min-h-11 content-center font-semibold underline-offset-4 hover:underline"
          >
            Nova auditoria
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </>
  );
}
