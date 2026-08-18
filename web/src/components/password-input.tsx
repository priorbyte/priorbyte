'use client';

import { useState } from 'react';

/**
 * A password `<input>` with a show/hide toggle — plain HTML password fields
 * give no way to catch a typo before submitting, which matters more here
 * than most forms since a wrong password silently fails auth rather than
 * erroring on the field itself.
 */
export function PasswordInput({
  id,
  name,
  required,
  minLength,
  autoComplete,
  placeholder,
  onChange,
}: {
  id: string;
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-lg border border-line bg-background px-4 py-3 pr-11 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-cyan"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
