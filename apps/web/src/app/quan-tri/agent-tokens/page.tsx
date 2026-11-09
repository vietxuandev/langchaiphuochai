import type { Metadata } from 'next';
import { AgentTokensPanel } from '@/components/admin/agent-tokens-panel';

export const metadata: Metadata = { title: 'Token cho AI agent' };

export default function AdminAgentTokensPage() {
  return <AgentTokensPanel />;
}
