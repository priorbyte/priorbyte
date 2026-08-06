'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  ONBOARDING_DIAGNOSTIC_QUESTIONS,
  YEAR_LEVEL_LABELS,
  YEAR_LEVELS,
  type SelfServiceRole,
} from '@priorbyte/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { GitHubConnect } from './github-connect';
import { completeOnboarding, type OnboardingState } from './actions';

const INITIAL: OnboardingState = { status: 'idle' };

const STEPS = ['Profile', 'Academic Identity', 'Connect & Seed'] as const;

function Dots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1 w-10 rounded-full transition ${i <= current ? 'bg-cyan' : 'bg-line'}`}
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

export function OnboardingWizard({
  displayName,
  userId,
  role,
}: {
  displayName: string;
  userId: string;
  role: SelfServiceRole;
}) {
  const [step, setStep] = useState(0);
  const [courses, setCourses] = useState<string[]>([]);
  const [customCourse, setCustomCourse] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [state, formAction] = useFormState(completeOnboarding, INITIAL);

  // Controlled, not uncontrolled-via-hidden-attribute like the optional
  // fields — these three are required, and validating a value only the DOM
  // holds (invisible behind `hidden`, which excludes it from constraint
  // validation) would mean checking it by reaching into refs. Plain state
  // is simpler and works identically whether the step is visible or not.
  const [fullName, setFullName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const addCourse = () => {
    const trimmed = customCourse.trim();
    if (!trimmed || courses.includes(trimmed)) return;
    setCourses((prev) => [...prev, trimmed]);
    setCustomCourse('');
  };

  const removeCourse = (course: string) => setCourses((prev) => prev.filter((c) => c !== course));

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

  /** Required fields live on steps 0 and 1 — validated whenever leaving either. */
  function validateStep(target: number): string | null {
    if (target > 0 && !fullName.trim()) return 'Full name is required.';
    if (target > 1) {
      if (!universityName.trim()) return 'University / College name is required.';
      if (!rollNumber.trim()) return 'Registration / roll number is required.';
    }
    return null;
  }

  function goToStep(target: number) {
    const error = validateStep(target);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setStep(target);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const error = validateStep(STEPS.length);
        if (error) {
          e.preventDefault();
          setValidationError(error);
        }
      }}
      className="w-full max-w-2xl space-y-8"
    >
      <div className="flex items-center justify-between">
        <Dots current={step} />
        <span className="pb-label">
          Step {step + 1} / {STEPS.length}: {STEPS[step]}
        </span>
      </div>

      {/* Hidden inputs carry controlled/uploaded state through to submit. */}
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="universityName" value={universityName} />
      <input type="hidden" name="rollNumber" value={rollNumber} />
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      {courses.map((c) => (
        <input key={c} type="hidden" name="enrolledCourses" value={c} />
      ))}

      {/*
        Every step stays mounted the whole time and is toggled with `hidden`
        rather than conditionally rendered — conditional rendering would
        unmount and lose the value of every uncontrolled input (date of
        birth, phone, department, …) the moment its step wasn't current.
      */}
      <div className="pb-panel min-h-[22rem]">
        <div hidden={step !== 0} className="space-y-4">
          <h1 className="text-3xl">Welcome, {displayName}.</h1>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-background">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob URL preview
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
                  N/A
                </div>
              )}
            </div>
            <div>
              <label className="inline-block cursor-pointer rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40">
                {uploadingAvatar ? 'Uploading…' : 'Upload photo (optional)'}
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
              <label htmlFor="fullNameInput" className="pb-label mb-1 block">
                Full name <span className="text-amber">*</span>
              </label>
              <input
                id="fullNameInput"
                type="text"
                required
                maxLength={200}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
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
            <div>
              <p className="pb-label mb-1">Role</p>
              <input type="hidden" name="role" value={role} />
              <div className="rounded-lg border border-line bg-background px-4 py-2.5 text-sm text-white">
                {role === 'student' ? 'Student' : 'Faculty'}
              </div>
              <p className="mt-1 text-xs text-muted">
                Set automatically from your @{role === 'student' ? 'karunya.edu.in' : 'karunya.edu'}{' '}
                email — locked afterward without an admin.
              </p>
            </div>
          </div>
        </div>

        <div hidden={step !== 1} className="space-y-4">
          <h1 className="text-3xl">Academic identity</h1>
          <p className="text-silver">Helps Priorbyte match you to the right course context.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="universityNameInput" className="pb-label mb-1 block">
                University / College <span className="text-amber">*</span>
              </label>
              <input
                id="universityNameInput"
                type="text"
                required
                maxLength={200}
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
            </div>
            <div>
              <label htmlFor="rollNumberInput" className="pb-label mb-1 block">
                Registration / Roll number <span className="text-amber">*</span>
              </label>
              <input
                id="rollNumberInput"
                type="text"
                required
                maxLength={100}
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
              />
              <p className="mt-1 text-xs text-muted">Required for pilot cohorts.</p>
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
                <option value="">Not set</option>
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

        <div hidden={step !== 2} className="space-y-6">
          <div>
            <h1 className="text-3xl">Connect & seed</h1>
            <p className="text-silver">Everything below is optional.</p>
          </div>

          <div className="space-y-3">
            <p className="pb-label">Capture extension</p>
            <div className="rounded-lg border border-line bg-background p-4">
              <p className="text-sm text-white">Chrome Web Store</p>
              <p className="mt-2 text-sm text-muted">
                Not published yet. Load it unpacked from{' '}
                <code className="font-mono text-cyan">/extension</code> during development. You
                can install it later from Settings.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="pb-label">Connect accounts</p>
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

          <div className="space-y-3">
            <p className="pb-label">Quick diagnostic quiz</p>
            <p className="text-sm text-silver">
              Skippable, and each question is skippable on its own.
            </p>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-2">
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
      </div>

      {(validationError || state.status === 'error') && (
        <p className="text-sm text-amber" role="alert">
          {validationError ?? state.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setValidationError(null);
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0}
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted transition hover:text-silver disabled:invisible"
        >
          ← Back
        </button>

        {isLast ? (
          <FinishButton />
        ) : (
          <button
            type="button"
            onClick={() => goToStep(step + 1)}
            className="rounded-lg border border-cyan/40 px-6 py-3 font-display text-cyan transition hover:bg-cyan/10"
          >
            Continue
          </button>
        )}
      </div>
    </form>
  );
}
