import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  History,
  PackageSearch,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';

interface ReportTile {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  requiredPermission: 'reports.view' | 'audit.view';
}

const REPORT_TILES: readonly ReportTile[] = [
  {
    key: 'inventory',
    title: 'Inventory & valuation',
    description: 'Current on-hand, reserved, and available quantity with cost valuation, by product and warehouse.',
    href: '/apps/reports/inventory',
    icon: Warehouse,
    requiredPermission: 'reports.view',
  },
  {
    key: 'stock-movement',
    title: 'Stock movement',
    description: 'Every ledger transaction -- receipts, issues, returns, adjustments, transfers, reversals.',
    href: '/apps/reports/stock-movement',
    icon: History,
    requiredPermission: 'reports.view',
  },
  {
    key: 'purchases',
    title: 'Purchases & suppliers',
    description: 'Purchase orders, outstanding receipts, and spend by supplier.',
    href: '/apps/reports/purchases',
    icon: ShoppingCart,
    requiredPermission: 'reports.view',
  },
  {
    key: 'issues',
    title: 'Requests, issues & returns',
    description: 'Request and fulfillment activity, issued and returned quantities, by warehouse.',
    href: '/apps/reports/issues',
    icon: ClipboardList,
    requiredPermission: 'reports.view',
  },
  {
    key: 'low-stock',
    title: 'Low & out of stock',
    description: 'Products at or below their reorder level, or with zero available stock.',
    href: '/apps/reports/low-stock',
    icon: PackageSearch,
    requiredPermission: 'reports.view',
  },
  {
    key: 'expiry',
    title: 'Expiring & expired stock',
    description: 'Active lots nearing or past their expiry date, with remaining issuable quantity.',
    href: '/apps/reports/expiry',
    icon: CalendarClock,
    requiredPermission: 'reports.view',
  },
  {
    key: 'audit',
    title: 'Audit trail',
    description: 'Actor, action, resource, outcome, and reason for every sensitive action in the system.',
    href: '/apps/reports/audit',
    icon: AlertTriangle,
    requiredPermission: 'audit.view',
  },
];

export function ReportsHubPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();

  const visibleTiles = REPORT_TILES.filter((tile) => has(tile.requiredPermission));
  if (visibleTiles.length === 0) return <ForbiddenState module="reports" />;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Reports"
        description="Every report queries the ledger and source records directly -- nothing here is a stale copy."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.map((tile) => (
          <Card
            key={tile.key}
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
            onClick={() => void navigate(tile.href)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') void navigate(tile.href);
            }}
          >
            <CardHeader>
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <tile.icon className="size-5" />
              </div>
              <CardTitle className="pt-2 text-base">{tile.title}</CardTitle>
              <CardDescription>{tile.description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </main>
  );
}
