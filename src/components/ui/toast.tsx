"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icon";

export type ToastVariant = "success" | "danger" | "accent";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  icon: IconName;
  leaving: boolean;
}

type ShowToast = (message: string, variant?: ToastVariant, icon?: IconName) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Design timings: toast stays 2.6 s, exit animation 200 ms. */
const TOAST_VISIBLE_MS = 2600;
const TOAST_EXIT_MS = 200;

export function Toast({
  message,
  variant = "success",
  icon = "check",
  leaving,
  isStatic,
}: {
  message: string;
  variant?: ToastVariant;
  icon?: IconName;
  leaving?: boolean;
  isStatic?: boolean;
}) {
  return (
    <div
      className={isStatic ? "toast toast--static" : "toast"}
      data-component="Toast"
      data-variant={variant}
      data-leaving={leaving ? "true" : undefined}
      role="status"
    >
      <Icon name={icon} className="toast__icon" />
      <span>{message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const show = useCallback<ShowToast>((message, variant = "success", icon = "check") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, variant, icon, leaving: false }]);
    timers.current.push(
      setTimeout(() => {
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        timers.current.push(
          setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), TOAST_EXIT_MS),
        );
      }, TOAST_VISIBLE_MS),
    );
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            variant={t.variant}
            icon={t.icon}
            leaving={t.leaving}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** No-op outside the provider so leaf components stay testable in isolation. */
export function useToast(): ShowToast {
  return useContext(ToastContext) ?? (() => undefined);
}
