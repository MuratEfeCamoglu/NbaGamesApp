"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "lg";
  /** Tab ids are `${idBase}-tab-${value}`; every tab controls `${idBase}-panel`. */
  idBase: string;
}

/** WAI-ARIA tabs with roving tabindex (←/→/Home/End). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  size = "md",
  idBase,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = items.findIndex((t) => t.value === value);

  // Sliding indicator (globals.css .tabs[data-indicator]). Written straight to CSS variables so a
  // resize or tab change never re-renders the list; measured so it follows any label width.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tab = refs.current[selectedIndex];
      if (!tab) return;
      list.style.setProperty("--tab-x", `${tab.offsetLeft}px`);
      list.style.setProperty("--tab-w", `${tab.offsetWidth}px`);
      list.dataset.indicator = "true";
    };
    measure();
    // Web fonts swap in after first paint and change label widths.
    void document.fonts?.ready.then(measure);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [selectedIndex]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = items.findIndex((t) => t.value === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    const item = items[next];
    if (!item) return;
    e.preventDefault();
    onChange(item.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      className="tabs"
      data-component="Tabs"
      data-size={size === "lg" ? "lg" : undefined}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {items.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="tabs__tab"
          role="tab"
          type="button"
          id={`${idBase}-tab-${t.value}`}
          aria-selected={t.value === value}
          aria-controls={`${idBase}-panel`}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
