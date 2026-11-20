"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { IconButton } from "./icon-button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom sheet on mobile, centred dialog ≥768 px (design.css). Esc / backdrop close; focus is trapped and restored. */
export function Modal({ open, onClose, title, description, children, id = "modal" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("input, textarea, select") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const head = nodes[0];
      const tail = nodes[nodes.length - 1];
      if (!head || !tail) return;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const titleId = `${id}-title`;
  return (
    <div
      className="modal"
      data-component="Modal"
      data-state="open"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      id={id}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__panel" ref={panelRef}>
        <div className="modal__head">
          <div className="stack stack--sm">
            <h2 className="t-display t-2xl" id={titleId}>
              {title}
            </h2>
            {description ? <p className="t-sm t-muted">{description}</p> : null}
          </div>
          <IconButton icon="x" label={t.common.close} variant="ghost" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
