import type { ReactNode } from 'react';

/**
 * Title and description are intentionally not rendered -- the page's own
 * content (table, form, etc.) makes its purpose clear without a redundant
 * heading. `title`/`description` are still accepted so call sites don't
 * need to change and can restore them later if needed.
 */
export function PageHeader({
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!actions) return null;
  return <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>;
}
