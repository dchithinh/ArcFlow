import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export const Field = ({ label, hint, children }: FieldProps) => (
  <label className="block space-y-2 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
    <span className="block text-sm font-semibold text-ink">{label}</span>
    {hint ? <span className="block text-xs text-slate">{hint}</span> : null}
    {children}
  </label>
);

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export const TextInput = ({ value, onChange, placeholder, rows = 2 }: TextInputProps) => (
  <textarea
    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
    value={value}
    rows={rows}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
  />
);

type TextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export const TextArea = ({ value, onChange, placeholder, rows = 4 }: TextAreaProps) => (
  <textarea
    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
    value={value}
    rows={rows}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
  />
);

type ToggleProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
};

export const Toggle = ({ checked, onChange, label }: ToggleProps) => (
  <label className="flex items-center gap-3 rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
);

type SelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: T[];
};

export const Select = <T extends string>({ value, onChange, options }: SelectProps<T>) => (
  <select
    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
    value={value}
    onChange={(event) => onChange(event.target.value as T)}
  >
    {options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
);

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export const Button = ({
  children,
  onClick,
  tone = "secondary",
  disabled = false,
}: ButtonProps) => {
  const toneClass =
    tone === "primary"
      ? "bg-ink text-white hover:bg-pine"
      : tone === "ghost"
        ? "bg-transparent text-slate hover:bg-white/60"
        : "bg-white text-ink hover:bg-sand";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
};
