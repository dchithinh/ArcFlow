import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type FieldProps = {
  label: ReactNode;
  hint?: string;
  children: ReactNode;
};

export const Field = ({ label, hint, children }: FieldProps) => (
  <div className="block space-y-2 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
    <div className="block text-sm font-semibold text-ink">{label}</div>
    {hint ? <span className="block text-xs text-slate">{hint}</span> : null}
    {children}
  </div>
);

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const AutoTextarea = ({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="w-full resize-none overflow-hidden rounded-xl border border-slate/20 bg-white px-3 py-1.5 text-sm leading-5 text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
};

export const TextInput = ({ value, onChange, placeholder }: TextInputProps) => (
  <input
    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
    type="text"
    value={value}
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

export const TextArea = ({ value, onChange, placeholder, rows = 1 }: TextAreaProps) => (
  <AutoTextarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
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

const selectClassName =
  "w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20";

type SelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: T[];
};

export const Select = <T extends string>({ value, onChange, options }: SelectProps<T>) => (
  <select className={selectClassName} value={value} onChange={(event) => onChange(event.target.value as T)}>
    {options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
);

type SelectWithOtherProps<T extends string> = {
  value: string;
  onChange: (value: string) => void;
  options: T[];
  otherValue?: T;
  customPlaceholder?: string;
  customOptions?: string[];
  onAddCustomOption?: (value: string) => void;
  onRemoveCustomOption?: (value: string) => void;
};

const customOptionValue = "__custom_other_option__";

export const SelectWithOther = <T extends string>({
  value,
  onChange,
  options,
  otherValue = "other" as T,
  customPlaceholder = "Enter custom label",
  customOptions = [],
  onAddCustomOption,
  onRemoveCustomOption,
}: SelectWithOtherProps<T>) => {
  const hasOther = options.includes(otherValue);
  const uniqueCustomOptions = Array.from(
    new Set(
      customOptions
        .map((option) => option.trim())
        .filter((option) => option && !options.includes(option as T)),
    ),
  );
  const isListedCustomValue = uniqueCustomOptions.includes(value);
  const isCustomValue =
    hasOther &&
    value.trim() !== "" &&
    value !== otherValue &&
    !options.includes(value as T);
  const showCustomField = hasOther && (value === otherValue || (isCustomValue && !isListedCustomValue));
  const selectValue = isListedCustomValue
    ? value
    : isCustomValue
      ? customOptionValue
      : value;
  const [customDraft, setCustomDraft] = useState("");

  useEffect(() => {
    if (value === otherValue) {
      setCustomDraft("");
      return;
    }

    if (isCustomValue && !isListedCustomValue) {
      setCustomDraft(value);
      return;
    }

    setCustomDraft("");
  }, [isCustomValue, isListedCustomValue, otherValue, value]);

  const submitCustomOption = () => {
    const nextValue = customDraft.trim();
    if (!nextValue) {
      return;
    }

    onAddCustomOption?.(nextValue);
    onChange(nextValue);
    setCustomDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[220px] flex-1">
          <select
            className={selectClassName}
            value={selectValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (nextValue === customOptionValue) {
                return;
              }
              onChange(nextValue);
            }}
          >
            {options
              .filter((option) => option !== otherValue)
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            {uniqueCustomOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {options.includes(otherValue) ? (
              <option value={otherValue}>{otherValue}</option>
            ) : null}
            {isCustomValue && !isListedCustomValue ? (
              <option value={customOptionValue}>other (custom)</option>
            ) : null}
          </select>
        </div>
        {isListedCustomValue ? (
          <Button
            onClick={() => {
              onRemoveCustomOption?.(value);
              onChange(otherValue);
            }}
            tone="ghost"
            size="compact"
          >
            Remove Option
          </Button>
        ) : null}
      </div>
      {showCustomField ? (
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[220px] flex-1">
            <TextInput
              value={customDraft}
              onChange={(nextValue) => setCustomDraft(nextValue)}
              placeholder={customPlaceholder}
            />
          </div>
          <Button onClick={submitCustomOption} size="compact">
            Add Option
          </Button>
          <Button
            onClick={() => {
              setCustomDraft("");
              onChange(otherValue);
            }}
            tone="ghost"
            size="compact"
          >
            Clear
          </Button>
        </div>
      ) : null}
    </div>
  );
};

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "compact";
  className?: string;
  disabled?: boolean;
};

export const Button = ({
  children,
  onClick,
  tone = "secondary",
  size = "default",
  className = "",
  disabled = false,
}: ButtonProps) => {
  const toneClass =
    tone === "primary"
      ? "border border-ink bg-ink text-white shadow-sm hover:border-pine hover:bg-pine"
      : tone === "danger"
        ? "border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
      : tone === "ghost"
        ? "border border-slate/20 bg-white/80 text-slate shadow-sm hover:bg-white"
        : "border border-slate/20 bg-white text-ink shadow-sm hover:border-copper/35 hover:bg-sand";
  const sizeClass =
    size === "compact" ? "rounded-lg px-2.5 py-1.5 text-xs" : "rounded-xl px-4 py-2 text-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClass} ${className} font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/30 disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`.trim()}
    >
      {children}
    </button>
  );
};
