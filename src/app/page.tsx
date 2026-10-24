import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-3xl font-extrabold tracking-tight">
        pente fino<span className="text-erro">.</span>
      </p>
      <h1 className="mt-6 text-xl font-semibold">Auditoria de XML do eSocial</h1>
      <p className="mt-2 text-secundario">
        Passe o pente-fino no eSocial antes que o fiscal passe. Os arquivos são lidos no seu
        computador e nunca saem dele.
      </p>
      <Link
        href="/auditorias/nova"
        className="mt-8 inline-flex min-h-11 items-center rounded-sm border border-tinta bg-tinta px-5 font-semibold text-papel"
      >
        Nova auditoria
      </Link>
    </main>
  );
}
