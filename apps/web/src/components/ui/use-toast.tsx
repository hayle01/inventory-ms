import * as React from 'react';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(({ title, description, variant = 'default' }) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, description, variant }]);
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastContextProvider');
  return context;
}
