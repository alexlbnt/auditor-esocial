import type { ButtonHTMLAttributes } from 'react';

type Variante = 'principal' | 'secundario';

const ESTILO: Record<Variante, string> = {
  principal: 'bg-tinta text-papel hover:bg-tinta/90',
  secundario: 'bg-papel text-tinta hover:bg-linha',
};

/** Alvo de 44 px (WCAG), foco visível e <button> de verdade. */
export function Botao({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-tinta px-5 font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta disabled:cursor-not-allowed disabled:opacity-50 ${ESTILO[variante]} ${className}`}
      {...props}
    />
  );
}
