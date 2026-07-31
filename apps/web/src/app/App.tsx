import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '../lib/queryClient';
import { router } from '../routes/router';
import { ToastContextProvider } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContextProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ToastContextProvider>
    </QueryClientProvider>
  );
}
