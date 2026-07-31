import { Lock } from 'lucide-react';
import { EmptyState } from '@/components/data/EmptyState';

export function ForbiddenState({ module }: { module: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Access restricted"
      description={`You don't have permission to view ${module}. Contact an administrator if you need access.`}
    />
  );
}
