import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
import styles from './Confirm.module.css';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (itemName: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

const icons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
};

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'warning',
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'warning',
        resolve,
      });
    });
  }, []);

  const confirmDelete = useCallback(
    (itemName: string): Promise<boolean> => {
      return confirm({
        title: 'Delete Confirmation',
        message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      });
    },
    [confirm]
  );

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const Icon = icons[state.variant || 'warning'];

  return (
    <ConfirmContext.Provider value={{ confirm, confirmDelete }}>
      {children}
      <AnimatePresence>
        {state.isOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
            />
            <motion.div
              className={styles.dialogContainer}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <div className={`${styles.dialog} ${styles[state.variant || 'warning']}`}>
                <div className={styles.iconWrapper}>
                  <Icon size={28} />
                </div>
                <div className={styles.content}>
                  <h3 className={styles.title}>{state.title}</h3>
                  <p className={styles.message}>{state.message}</p>
                </div>
                <div className={styles.actions}>
                  <button className={styles.cancelButton} onClick={handleCancel}>
                    {state.cancelText}
                  </button>
                  <button
                    className={`${styles.confirmButton} ${styles[state.variant || 'warning']}`}
                    onClick={handleConfirm}
                  >
                    {state.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
