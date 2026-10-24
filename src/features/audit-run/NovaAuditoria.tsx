'use client';

import { useRef } from 'react';
import { ResumoDaAuditoria } from '@/features/report/ResumoDaAuditoria';
import { ZonaDeArquivos } from '@/features/upload/ZonaDeArquivos';
import { Botao } from '@/shared/ui/Botao';
import { Cartao } from '@/shared/ui/Cartao';
import { PainelProgresso } from './PainelProgresso';
import { useAuditoria } from './useAuditoria';

const ERRO: Record<'xsd-indisponivel' | 'falha-na-auditoria', string> = {
  'xsd-indisponivel': 'Não consegui carregar o esquema do eSocial. Recarregue a página.',
  'falha-na-auditoria': 'A auditoria parou no meio. Tente de novo; se repetir, divida o lote.',
};

/** HU-01: enviar o lote. Os arquivos ficam neste computador. */
export function NovaAuditoria() {
  const { estado, aviso, auditar, cancelar, recomecar } = useAuditoria();
  // Os arquivos ficam guardados só para auditar de novo com a competência escolhida.
  const ultimos = useRef<File[]>([]);

  const escolher = (arquivos: File[]) => {
    ultimos.current = arquivos;
    void auditar(arquivos);
  };

  if (estado.fase === 'auditando') {
    return (
      <PainelProgresso
        progresso={estado.progresso}
        arquivos={estado.arquivos}
        aoCancelar={cancelar}
      />
    );
  }
  if (estado.fase === 'concluida') {
    return (
      <ResumoDaAuditoria
        resumo={estado.resumo}
        aoEscolherCompetencia={(c) => void auditar(ultimos.current, c)}
        aoRecomecar={recomecar}
      />
    );
  }
  if (estado.fase === 'erro') {
    return (
      <Cartao className="space-y-4">
        <p role="alert">{ERRO[estado.codigo]}</p>
        <Botao onClick={recomecar}>Tentar de novo</Botao>
      </Cartao>
    );
  }

  const pronta = estado.fase === 'pronta-para-receber';
  return (
    <Cartao className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold">Nova auditoria</h1>
        <p>
          <span className="bg-grifo px-1 font-semibold">
            Os arquivos são lidos no seu computador.
          </span>{' '}
          Nenhum XML sai daqui.
        </p>
      </div>
      {aviso === 'cancelada' && (
        <p role="status" className="border-l-4 border-tinta pl-3">
          Auditoria cancelada. Nada foi salvo.
        </p>
      )}
      <ZonaDeArquivos habilitada={pronta} aoEscolher={escolher} />
      <p className="text-sm text-secundario" role="status" data-testid="estado-validador">
        {pronta
          ? `Validador pronto${estado.pacoteXsd ? ` (pacote XSD de ${estado.pacoteXsd})` : ''}.`
          : 'Preparando o validador do eSocial…'}
      </p>
    </Cartao>
  );
}
