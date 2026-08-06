'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  ACCENT_COLORS,
  REFRESH_INTERVALS,
  type AccentColor,
  type DashboardPreferences,
  type DashboardWidget,
} from '@priorbyte/shared/constants';
import { updateDashboardSettings, type SettingsState } from './actions';

const INITIAL: SettingsState = { status: 'idle' };

const WIDGET_LABELS: Record<DashboardWidget, string> = {
  streak: 'Streak & consistency',
  upcoming_inoculations: 'Upcoming inoculations',
  weekly_snapshot: 'This week snapshot',
  weak_strong_topics: 'Weak / strong topics',
  knowledge_map: 'Top subjects (knowledge map)',
  mini_timeline: 'Recent activity',
  integration_status: 'Integration status',
};

const ACCENT_SWATCH_CLASS: Record<AccentColor, string> = {
  cyan: 'bg-[#00E5FF]',
  teal: 'bg-[#00BFA5]',
  purple: 'bg-[#A855F7]',
  amber: 'bg-[#FFAB00]',
};

const REFRESH_LABELS: Record<number, string> = {
  0: 'Off',
  30: 'Every 30s',
  60: 'Every minute',
  300: 'Every 5 minutes',
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  );
}

export function SettingsForm({
  nickname,
  preferences,
  availableSubjects,
}: {
  nickname: string;
  preferences: DashboardPreferences;
  availableSubjects: string[];
}) {
  const [state, formAction] = useFormState(updateDashboardSettings, INITIAL);

  const [order, setOrder] = useState<DashboardWidget[]>(preferences.widgetOrder);
  const [hidden, setHidden] = useState<Set<DashboardWidget>>(
    new Set(preferences.hiddenWidgets),
  );
  const [theme, setTheme] = useState(preferences.theme);
  const [accent, setAccent] = useState(preferences.accentColor);
  const [mapSubjects, setMapSubjects] = useState<string[]>(preferences.knowledgeMapSubjects);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const toggleHidden = (widget: DashboardWidget) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(widget)) next.delete(widget);
      else next.add(widget);
      return next;
    });

  const toggleMapSubject = (subject: string) =>
    setMapSubjects((prev) => {
      if (prev.includes(subject)) return prev.filter((s) => s !== subject);
      if (prev.length >= 3) return prev;
      return [...prev, subject];
    });

  function reorder(from: number, to: number) {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-10">
      {order.map((w) => (
        <input key={w} type="hidden" name="widgetOrder" value={w} />
      ))}
      {[...hidden].map((w) => (
        <input key={w} type="hidden" name="hiddenWidgets" value={w} />
      ))}
      {mapSubjects.map((s) => (
        <input key={s} type="hidden" name="knowledgeMapSubjects" value={s} />
      ))}

      <section className="space-y-3">
        <h2 className="text-xl text-white">Greeting</h2>
        <label htmlFor="nickname" className="pb-label mb-1 block">
          Nickname (used instead of your name on the dashboard)
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          maxLength={50}
          defaultValue={nickname}
          placeholder="Leave blank to use your name"
          className="w-full max-w-sm rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-white">Appearance</h2>
        <div>
          <p className="pb-label mb-2">Theme</p>
          <div className="flex gap-3">
            {(['dark', 'light'] as const).map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-silver has-[:checked]:border-cyan has-[:checked]:text-cyan"
              >
                <input
                  type="radio"
                  name="theme"
                  value={t}
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                  className="accent-cyan"
                />
                {t === 'dark' ? 'Dark' : 'Light'}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="pb-label mb-2">Accent color</p>
          <div className="flex gap-3">
            {ACCENT_COLORS.map((c) => (
              <label key={c} className="flex flex-col items-center gap-1">
                <input
                  type="radio"
                  name="accentColor"
                  value={c}
                  checked={accent === c}
                  onChange={() => setAccent(c)}
                  className="sr-only"
                />
                <span
                  className={`h-8 w-8 cursor-pointer rounded-full ${ACCENT_SWATCH_CLASS[c]} ${
                    accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : ''
                  }`}
                  onClick={() => setAccent(c)}
                />
                <span className="text-xs capitalize text-muted">{c}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-white">Dashboard widgets</h2>
        <p className="text-sm text-muted">
          Drag to reorder. Uncheck to hide a card entirely.
        </p>
        <ul className="space-y-2">
          {order.map((widget, i) => (
            <li
              key={widget}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i);
                setDragIndex(null);
              }}
              className="flex cursor-move items-center gap-3 rounded-lg border border-line bg-background px-4 py-3"
            >
              <span className="font-mono text-xs text-muted" aria-hidden>
                ⠿
              </span>
              <label className="flex flex-1 items-center gap-2 text-sm text-silver">
                <input
                  type="checkbox"
                  checked={!hidden.has(widget)}
                  onChange={() => toggleHidden(widget)}
                  className="accent-cyan"
                />
                {WIDGET_LABELS[widget]}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {availableSubjects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl text-white">Knowledge map subjects</h2>
          <p className="text-sm text-muted">
            Pick up to 3 to always show. Leave empty to auto-pick your most-active subjects.
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSubjects.map((subject) => {
              const active = mapSubjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => toggleMapSubject(subject)}
                  disabled={!active && mapSubjects.length >= 3}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-40 ${
                    active
                      ? 'border-cyan bg-cyan/10 text-cyan'
                      : 'border-line text-silver hover:border-cyan/40'
                  }`}
                >
                  {subject}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl text-white">Other</h2>
        <label className="flex items-center gap-2 text-sm text-silver">
          <input
            type="checkbox"
            name="showProBanner"
            defaultChecked={!preferences.proBannerDismissed}
            className="accent-cyan"
          />
          Show the Pro upgrade banner
        </label>

        <div>
          <label htmlFor="refreshIntervalSeconds" className="pb-label mb-1 block">
            Auto-refresh dashboard
          </label>
          <select
            id="refreshIntervalSeconds"
            name="refreshIntervalSeconds"
            defaultValue={preferences.refreshIntervalSeconds}
            className="w-full max-w-xs rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          >
            {REFRESH_INTERVALS.map((secs) => (
              <option key={secs} value={secs}>
                {REFRESH_LABELS[secs]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <SaveButton />
        {state.status === 'saved' && <span className="text-sm text-teal">Saved.</span>}
        {state.status === 'error' && (
          <span className="text-sm text-amber" role="alert">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
