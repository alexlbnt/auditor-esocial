/** Lê a declaração `<?xml ... encoding="..."?>` dos primeiros bytes (ASCII). */
export function encodingDeclarado(bytes: Uint8Array): string | undefined {
  const inicio = String.fromCharCode(...bytes.subarray(0, 200));
  return /^(?:﻿|\xEF\xBB\xBF)?<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(
    inicio,
  )?.[1];
}

/**
 * Converte bytes em texto pelo encoding declarado (UTF-8 se não houver).
 * Devolve undefined se o encoding for desconhecido ou os bytes não baterem com ele.
 */
export function decodificar(bytes: Uint8Array): string | undefined {
  const encoding = encodingDeclarado(bytes) ?? 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
