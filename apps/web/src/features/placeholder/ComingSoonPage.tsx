import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-16 text-center sm:px-6">
      <span className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Construction className="size-6" />
      </span>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This module&rsquo;s screens are still being built. The backend API is ready; this page is
        next.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link to="/apps">
          <ArrowLeft />
          Back to apps
        </Link>
      </Button>
    </main>
  );
}
