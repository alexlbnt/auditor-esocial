import type { ReactNode } from 'react';

/** Cartão da direção B: borda de 1 px na cor da tinta e sombra sólida 4px 4px 0. */
export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-sm border border-tinta bg-papel p-6 shadow-[4px_4px_0_var(--color-tinta)] ${className}`}
    >
      {children}
    </section>
  );
}
