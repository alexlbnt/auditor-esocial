import type { Metadata } from 'next';
import { NovaAuditoria } from '@/features/audit-run/NovaAuditoria';

export const metadata: Metadata = { title: 'Nova auditoria · Pente Fino' };

export default function PaginaNovaAuditoria() {
  return <NovaAuditoria />;
}
