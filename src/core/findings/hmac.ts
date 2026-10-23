// SHA-256 (FIPS 180-4) e HMAC (RFC 2104) síncronos e puros. O motor de regras é
// síncrono e o core não usa node:crypto nem crypto.subtle (assíncrono).
// Conferido com os vetores da RFC 4231 em hmac.test.ts.

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(dados: Uint8Array): Uint8Array {
  const bits = dados.length * 8;
  const tamanho = Math.ceil((dados.length + 9) / 64) * 64;
  const bloco = new Uint8Array(tamanho);
  bloco.set(dados);
  bloco[dados.length] = 0x80;
  const visao = new DataView(bloco.buffer);
  visao.setUint32(tamanho - 8, Math.floor(bits / 0x100000000));
  visao.setUint32(tamanho - 4, bits >>> 0);

  const h = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let inicio = 0; inicio < tamanho; inicio += 64) {
    for (let t = 0; t < 16; t++) w[t] = visao.getUint32(inicio + t * 4);
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] ?? 0;
      const w2 = w[t - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }
    let a = h[0] ?? 0;
    let b = h[1] ?? 0;
    let c = h[2] ?? 0;
    let d = h[3] ?? 0;
    let e = h[4] ?? 0;
    let f = h[5] ?? 0;
    let g = h[6] ?? 0;
    let hh = h[7] ?? 0;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = ((h[i] ?? 0) + v) >>> 0;
    });
  }
  const saida = new Uint8Array(32);
  const visaoSaida = new DataView(saida.buffer);
  h.forEach((v, i) => visaoSaida.setUint32(i * 4, v));
  return saida;
}

const BLOCO = 64;

export function hmacSha256(chave: Uint8Array, mensagem: Uint8Array): Uint8Array {
  const k = new Uint8Array(BLOCO);
  k.set(chave.length > BLOCO ? sha256(chave) : chave);
  const interno = new Uint8Array(BLOCO + mensagem.length);
  const externo = new Uint8Array(BLOCO + 32);
  for (let i = 0; i < BLOCO; i++) {
    interno[i] = (k[i] ?? 0) ^ 0x36;
    externo[i] = (k[i] ?? 0) ^ 0x5c;
  }
  interno.set(mensagem, BLOCO);
  externo.set(sha256(interno), BLOCO);
  return sha256(externo);
}

export const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// 32 letras, nenhum dígito: a chave do achado nunca pode ter 11 dígitos seguidos
// (o servidor recusa esse padrão; em hex isso aconteceria em ~11% das chaves).
const LETRAS = 'abcdefghijklmnopqrstuvwxyzABCDEF';

/** Base32 só com letras, sem preenchimento: 32 bytes -> 52 caracteres. */
export function base32Letras(bytes: Uint8Array): string {
  let saida = '';
  let acumulado = 0;
  let bits = 0;
  for (const byte of bytes) {
    acumulado = ((acumulado << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      saida += LETRAS[(acumulado >> bits) & 31] ?? '';
    }
  }
  if (bits > 0) saida += LETRAS[(acumulado << (5 - bits)) & 31] ?? '';
  return saida;
}
