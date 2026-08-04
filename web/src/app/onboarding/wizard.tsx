'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  ONBOARDING_DIAGNOSTIC_QUESTIONS,
  SELF_SERVICE_ROLES,
  YEAR_LEVELS,
} from '@priorbyte/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { GitHubConnect } from './github-connect';
import { completeOnboarding, skipOnboarding, type OnboardingState } from './actions';

const INITIAL: OnboardingState = { status: 'idle' };

/**
 * Priorbyte is "the operating system for every student's mind," not a STEM
 * tutor — the list has to reflect that, with an escape hatch for anything
 * still missing.
 */
const SUBJECT_GROUPS: Record<string, readonly string[]> = {
  'Math & Statistics': ['Calculus', 'Linear Algebra', 'Statistics', 'Discrete Math'],
  'Computer Science': [
    'Computer Science',
    'Data Structures',
    'Algorithms',
    'Machine Learning',
    'Web Development',
    'Databases',
  ],
  'Natural Sciences': ['Physics', 'Chemistry', 'Biology', 'Earth Science'],
  Engineering: ['Electronics', 'Mechanical Engineering', 'Civil Engineering'],
  'Business & Economics': ['Economics', 'Accounting', 'Finance', 'Marketing'],
  'Humanities & Social Sciences': [
    'History',
    'Philosophy',
    'Psychology',
    'Political Science',
    'Sociology',
  ],
  'Languages & Writing': ['English & Literature', 'Foreign Languages', 'Writing & Composition'],
  'Health & Medicine': ['Biology (Pre-Med)', 'Anatomy & Physiology', 'Nursing'],
  Law: ['Law & Legal Studies'],
} as const;

const YEAR_LEVEL_LABELS: Record<(typeof YEAR_LEVELS)[number], string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
  graduate: 'Graduate',
  other: 'Other',
};

const LANGUAGES = [
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['hi', 'Hindi'],
  ['zh', 'Chinese'],
  ['ar', 'Arabic'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['ja', 'Japanese'],
] as const;

const COMMON_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

const STEPS = [
  'Goal',
  'Basic Info',
  'Academic',
  'Extension',
  'Connect Accounts',
  'Subjects',
  'Preferences',
  'Diagnostic',
] as const;

function Dots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1 w-6 rounded-full transition ${i <= current ? 'bg-cyan' : 'bg-line'}`}
        />
      ))}
    </div>
  );
}

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Finish setup'}
    </button>
  );
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function OnboardingWizard({
  displayName,
  userId,
}: {
  displayName: string;
  userId: string;
}) {
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [customCourse, setCustomCourse] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [detectedTimeZone, setDetectedTimeZone] = useState('');
  const [state, formAction] = useFormState(completeOnboarding, INITIAL);

  useEffect(() => {
    try {
      setDetectedTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Intl.DateTimeFormat is universally available in evergreen browsers;
      // if it throws, the curated list below still works fine without it.
    }
  }, []);

  const allListedSubjects = Object.values(SUBJECT_GROUPS).flat();
  const customSubjects = subjects.filter((s) => !allListedSubjects.includes(s));

  const toggleSubject = (subject: string) =>
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed || subjects.includes(trimmed)) return;
    setSubjects((prev) => [...prev, trimmed]);
    setCustomSubject('');
  };

  const addCourse = () => {
    const trimmed = customCourse.trim();
    if (!trimmed || courses.includes(trimmed)) return;
    setCourses((prev) => [...prev, trimmed]);
    setCustomCourse('');
  };

  const removeCourse = (course: string) =>
    setCourses((prev) => prev.filter((c) => c !== course));

  async function checkUsername(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('is_username_available', { candidate: trimmed });
    if (error) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus(data ? 'available' : 'taken');
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Images must be under 5MB.');
      return;
    }

    setUploadingAvatar(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setAvatarError(uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setAvatarPreview(URL.createObjectURL(file));
    setUploadingAvatar(false);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <form action={formAction} className="w-full max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <Dots current={step} />
        <span className="pb-label">
          Step {step + 1} / {STEPS.length}
        </span>
      </div>

      {/* Hidden inputs carry controlled/uploaded state through to submit. */}
      {subjects.map((s) => (
        <input key={s} type="hidden" name="subjects" value={s} />
      ))}
      {courses.map((c) => (
        <input key={c} type="hidden" name="enrolledCourses" value={c} />
      ))}
      <input type="hidden" name="avatarUrl" value={avatarUrl} />

      {/*
        Every step stays mounted the whole time and is toggled with `hidden`
        rather than conditionally rendered. Uncontrolled inputs (goal, name,
        username, …) live in the DOM and lose their value the moment their
        parent unmounts — conditional rendering here would silently drop
        everything typed in an earlier step by the time Finish is clicked.
      */}
      <div className="pb-panel min-h-[22rem]">
        <div hidden={step !== 0} className="space-y-4">
          <h1 className="text-3xl">Welcome, {displayName}.</h1>
          <p className="text-silver">
            What are you working toward? One sentence is plenty — it shapes what Priorbyte
            watches for.
          </p>
          <textarea
            name="goal"
            rows={3}
            maxLength={500}
            placeholder="Pass my calculus final without losing marks to careless algebra."
            className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
          />
        </div>

        <div hidden={step !== 1} className="space-y-4">
          <h1 className="text-3xl">Tell us about you</h1>
          <p className="text-silver">All optional. Skip anything you&apos;d rather not share.</p>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-background">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- data/blob URL preview, not an optimizable remote asset
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
                  N/A
                </div>
              )}
            </div>
            <div>
              <label className="inline-block cursor-pointer rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40">
                {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
              {avatarError && <p className="mt-1 text-xs text-amber">{avatarError}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="pb-label mb-1 block">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="username" className="pb-label mb-1 block">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                maxLength={30}
                onChange={() => setUsernameStatus('idle')}
                onBlur={(e) => void checkUsername(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
              {usernameStatus === 'checking' && (
                <p className="mt-1 text-xs text-muted">Checking…</p>
              )}
              {usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-teal">Available</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="mt-1 text-xs text-amber">Already taken</p>
              )}
              {usernameStatus === 'invalid' && (
                <p className="mt-1 text-xs text-amber">
                  3-30 characters: letters, numbers, underscores only
                </p>
              )}
            </div>
            <div>
              <label htmlFor="dateOfBirth" className="pb-label mb-1 block">
                Date of birth
              </label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="pb-label mb-1 block">
                Phone number
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                maxLength={30}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
          </div>
        </div>

        <div hidden={step !== 2} className="space-y-4">
          <h1 className="text-3xl">Academic details</h1>
          <p className="text-silver">Helps Priorbyte match you to the right course context.</p>

          <div>
            <p className="pb-label mb-2">I am a</p>
            <div className="flex gap-3">
              {SELF_SERVICE_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-silver has-[:checked]:border-cyan has-[:checked]:text-cyan"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    defaultChecked={role === 'student'}
                    className="accent-cyan"
                  />
                  {role === 'student' ? 'Student' : 'Faculty'}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              This can only be set once, during setup — it can&apos;t be changed later without an
              admin.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="universityName" className="pb-label mb-1 block">
                University / College
              </label>
              <input
                id="universityName"
                name="universityName"
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="rollNumber" className="pb-label mb-1 block">
                Registration / Roll number
              </label>
              <input
                id="rollNumber"
                name="rollNumber"
                type="text"
                maxLength={100}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="department" className="pb-label mb-1 block">
                Department / Major
              </label>
              <input
                id="department"
                name="department"
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="yearLevel" className="pb-label mb-1 block">
                Year
              </label>
              <select
                id="yearLevel"
                name="yearLevel"
                defaultValue=""
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              >
                <option value="" disabled>
                  Select…
                </option>
                {YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>
                    {YEAR_LEVEL_LABELS[y]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="courseInput" className="pb-label mb-1 block">
              Enrolled courses
            </label>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => (
                <button
                  key={course}
                  type="button"
                  onClick={() => removeCourse(course)}
                  className="rounded-full border border-cyan bg-cyan/10 px-3 py-1.5 text-sm text-cyan"
                >
                  {course} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                id="courseInput"
                type="text"
                value={customCourse}
                onChange={(e) => setCustomCourse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCourse();
                  }
                }}
                maxLength={100}
                placeholder="e.g. CS 201 — Data Structures"
                className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
              <button
                type="button"
                onClick={addCourse}
                disabled={!customCourse.trim()}
                className="rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div hidden={step !== 3} className="space-y-4">
          <h1 className="text-3xl">Install the capture extension</h1>
          <p className="text-silver">
            Priorbyte learns from real work, not quizzes about your work. The Chrome extension
            quietly records learning events as you study — no page content leaves your account.
          </p>
          <div className="rounded-lg border border-line bg-background p-4">
            <p className="pb-label">Chrome Web Store</p>
            <p className="mt-2 text-sm text-muted">
              Not published yet. Load it unpacked from{' '}
              <code className="font-mono text-cyan">/extension</code> during development.
            </p>
          </div>
          <p className="text-sm text-muted">You can install it later from Settings.</p>
        </div>

        <div hidden={step !== 4} className="space-y-4">
          <h1 className="text-3xl">Connect your accounts</h1>
          <p className="text-silver">
            Optional. These add more signal for the vulnerability model — nothing here is
            required to use Priorbyte.
          </p>
          <div className="space-y-3">
            <GitHubConnect />
            <div className="rounded-lg border border-line bg-background p-4 opacity-60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white">Google Drive</p>
                  <p className="mt-1 text-xs text-muted">Coming soon.</p>
                </div>
                <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                  Not available
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-background p-4 opacity-60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white">OneDrive</p>
                  <p className="mt-1 text-xs text-muted">Coming soon.</p>
                </div>
                <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                  Not available
                </span>
              </div>
            </div>
          </div>
        </div>

        <div hidden={step !== 5} className="space-y-4">
          <h1 className="text-3xl">What are you studying?</h1>
          <p className="text-silver">Pick any that apply. This seeds your knowledge graph.</p>

          <div className="max-h-64 space-y-4 overflow-y-auto pr-2">
            {Object.entries(SUBJECT_GROUPS).map(([group, subjectsInGroup]) => (
              <div key={group}>
                <p className="pb-label mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {subjectsInGroup.map((subject) => {
                    const active = subjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        aria-pressed={active}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
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
              </div>
            ))}

            {customSubjects.length > 0 && (
              <div>
                <p className="pb-label mb-2">Added by you</p>
                <div className="flex flex-wrap gap-2">
                  {customSubjects.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className="rounded-full border border-cyan bg-cyan/10 px-4 py-2 text-sm text-cyan transition"
                    >
                      {subject} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-line pt-4">
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomSubject();
                }
              }}
              maxLength={100}
              placeholder="Not listed? Type your own — e.g. Music Theory"
              className="flex-1 rounded-lg border border-line bg-background px-4 py-2 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
            />
            <button
              type="button"
              onClick={addCustomSubject}
              disabled={!customSubject.trim()}
              className="rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        <div hidden={step !== 6} className="space-y-4">
          <h1 className="text-3xl">Preferences</h1>
          <p className="text-silver">All optional, all changeable later in Settings.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="alternateEmail" className="pb-label mb-1 block">
                Alternate email
              </label>
              <input
                id="alternateEmail"
                name="alternateEmail"
                type="email"
                maxLength={320}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="timeZone" className="pb-label mb-1 block">
                Time zone
              </label>
              <select
                id="timeZone"
                name="timeZone"
                defaultValue={detectedTimeZone || 'UTC'}
                key={detectedTimeZone}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              >
                {detectedTimeZone && !COMMON_TIME_ZONES.includes(detectedTimeZone as never) && (
                  <option value={detectedTimeZone}>{detectedTimeZone} (detected)</option>
                )}
                {COMMON_TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="languagePreference" className="pb-label mb-1 block">
                Language
              </label>
              <select
                id="languagePreference"
                name="languagePreference"
                defaultValue="en"
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              >
                {LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="pb-label mb-2">Notifications</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-silver">
                <input
                  type="checkbox"
                  name="notif_email"
                  defaultChecked={DEFAULT_NOTIFICATION_PREFERENCES.email}
                  className="accent-cyan"
                />
                Email me about important account activity
              </label>
              <label className="flex items-center gap-2 text-sm text-silver">
                <input
                  type="checkbox"
                  name="notif_productUpdates"
                  defaultChecked={DEFAULT_NOTIFICATION_PREFERENCES.productUpdates}
                  className="accent-cyan"
                />
                Product updates
              </label>
              <label className="flex items-center gap-2 text-sm text-silver">
                <input
                  type="checkbox"
                  name="notif_weeklyDigest"
                  defaultChecked={DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest}
                  className="accent-cyan"
                />
                Weekly progress digest
              </label>
            </div>
          </div>
        </div>

        <div hidden={step !== 7} className="space-y-4">
          <h1 className="text-3xl">Five quick questions</h1>
          <p className="text-silver">
            Optional, and each one is skippable on its own — leave any blank you don&apos;t want
            to answer.
          </p>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
            {ONBOARDING_DIAGNOSTIC_QUESTIONS.map(({ id, question }, i) => (
              <div key={id} className="rounded-lg border border-line bg-background p-3">
                <label htmlFor={id} className="block">
                  <span className="font-mono text-xs text-cyan">
                    Q{String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-1 text-sm text-silver">{question}</p>
                </label>
                <textarea
                  id={id}
                  name={`diagnostic_${id}`}
                  rows={2}
                  maxLength={2000}
                  placeholder="Optional"
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {state.status === 'error' && (
        <p className="text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted transition hover:text-silver disabled:invisible"
        >
          ← Back
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void skipOnboarding()}
            className="font-mono text-xs uppercase tracking-[0.2em] text-muted transition hover:text-silver"
          >
            Skip all
          </button>

          {isLast ? (
            <FinishButton />
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-lg border border-cyan/40 px-6 py-3 font-display text-cyan transition hover:bg-cyan/10"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
