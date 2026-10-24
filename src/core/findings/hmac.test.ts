import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hex, hmacSha256, sha256 } from './hmac';

const texto = (s: string) => new TextEncoder().encode(s);
const deHex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (b) => parseInt(b, 16));

describe('sha256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('vetor FIPS 180-4: "%s"', (entrada, esperado) => {
    expect(hex(sha256(texto(entrada)))).toBe(esperado);
  });

  it('bate com o node:crypto em tamanhos de borda (55, 56, 63, 64, 65 bytes...)', () => {
    for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 1000]) {
      const dados = randomBytes(n);
      expect(hex(sha256(dados)), `${n} bytes`).toBe(
        createHash('sha256').update(dados).digest('hex'),
      );
    }
  });
});

describe('hmacSha256 (RFC 4231)', () => {
  it('caso 1', () => {
    const chave = deHex('0b'.repeat(20));
    expect(hex(hmacSha256(chave, texto('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('caso 2', () => {
    expect(hex(hmacSha256(texto('Jefe'), texto('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('caso 6: chave maior que o bloco', () => {
    const chave = deHex('aa'.repeat(131));
    const msg = texto('Test Using Larger Than Block-Size Key - Hash Key First');
    expect(hex(hmacSha256(chave, msg))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    );
  });

  it('bate com o node:crypto para chaves e mensagens aleatórias', () => {
    for (let i = 0; i < 20; i++) {
      const chave = randomBytes(i * 7);
      const msg = randomBytes(i * 13);
      expect(hex(hmacSha256(chave, msg))).toBe(
        createHmac('sha256', chave).update(msg).digest('hex'),
      );
    }
  });
});
