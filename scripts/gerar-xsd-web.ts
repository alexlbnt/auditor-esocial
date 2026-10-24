// Junta cada pacote XSD de schemas/xsd/S-1.3/ num JSON servido pelo próprio site
// (public/xsd/S-1.3/, gitignored): o worker baixa um arquivo só por pacote.
// Roda antes do dev e do build (predev/prebuild).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carregarPacote, listarPacotes } from './lib/pacotes-xsd.ts';

const DESTINO = 'public/xsd/S-1.3';
const decodificador = new TextDecoder('utf-8');

mkdirSync(DESTINO, { recursive: true });
const pacotes = listarPacotes();
for (const data of pacotes) {
  const { arquivos } = carregarPacote(data);
  const conteudo = Object.fromEntries(
    [...arquivos].map(([nome, b]) => [nome, decodificador.decode(b)]),
  );
  writeFileSync(join(DESTINO, `${data}.json`), JSON.stringify({ data, arquivos: conteudo }));
}
writeFileSync(join(DESTINO, 'index.json'), JSON.stringify({ pacotes }));
console.log(`XSD para o navegador: ${pacotes.length} pacote(s) em ${DESTINO}/`);
