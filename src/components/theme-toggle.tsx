"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        className={compact ? "theme-toggle theme-toggle-compact" : "theme-toggle"}
        aria-hidden="true"
      />
    );
  }

  if (compact) {
    const activeIndex = options.findIndex((option) => option.value === theme);
    const active = options[activeIndex >= 0 ? activeIndex : 2];
    const next = options[(activeIndex >= 0 ? activeIndex + 1 : 0) % options.length];
    const ActiveIcon = active.Icon;
    return (
      <div className="theme-toggle theme-toggle-compact" aria-label="Color theme">
        <button
          aria-label={`Current theme: ${active.label}. Switch to ${next.label.toLowerCase()}.`}
          className="is-selected"
          onClick={() => setTheme(next.value)}
          title={`Theme: ${active.label}`}
          type="button"
        >
          <ActiveIcon aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <div className="theme-toggle" aria-label="Color theme">
      {options.map(({ value, label, Icon }) => (
        <button
          aria-label={`Use ${label.toLowerCase()} theme`}
          aria-pressed={theme === value}
          className={theme === value ? "is-selected" : ""}
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
