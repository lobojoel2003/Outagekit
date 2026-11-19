import { useId, useState, type ReactNode } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  className?: string;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
}

/**
 * A number input that lets people type freely (including clearing the box)
 * and only reports valid numbers inside the range.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
  className,
  hideLabel,
}: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => String(value));
  const [previous, setPrevious] = useState(value);

  // Follow outside changes to the value without clobbering what is being typed.
  if (previous !== value) {
    setPrevious(value);
    if (Number(text) !== value) setText(String(value));
  }

  const commit = (next: string) => {
    setText(next);
    const parsed = Number(next);
    if (next.trim() === '' || !Number.isFinite(parsed)) return;
    if (min !== undefined && parsed < min) return;
    if (max !== undefined && parsed > max) return;
    onChange(parsed);
  };

  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <div className="input-with-unit">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step ?? 'any'}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setText(String(value))}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'tel' | 'email';
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  autoComplete?: string;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  multiline,
  hint,
  autoComplete,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
  hideLabel?: boolean;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  hideLabel,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive choices, shown as buttons. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div className="segmented-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

export function Section({
  title,
  action,
  children,
  id,
  description,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  description?: ReactNode;
}) {
  return (
    <section className="section" aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <header className="section-header">
        <div>
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          {description && <p className="section-description">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
