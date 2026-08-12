import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'default' | 'destructive' | 'warning' | 'success';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            tone === 'default' && 'bg-primary/10 text-primary',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            tone === 'warning' && 'bg-amber-500/10 text-amber-600',
            tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
