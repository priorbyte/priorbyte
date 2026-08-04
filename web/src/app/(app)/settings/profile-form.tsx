'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { SUBJECT_GROUPS, YEAR_LEVEL_LABELS, YEAR_LEVELS } from '@priorbyte/shared/constants';
import type { ProfileRow } from '@priorbyte/shared/database';
import { createClient } from '@/lib/supabase/client';
import { updateProfileDetails, type ProfileFormState } from './profile-actions';

const INITIAL: ProfileFormState = { status: 'idle' };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  );
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function ProfileForm({ profile, userId }: { profile: ProfileRow; userId: string }) {
  const [state, formAction] = useFormState(updateProfileDetails, INITIAL);

  const [subjects, setSubjects] = useState<string[]>(profile.subjects);
  const [customSubject, setCustomSubject] = useState('');
  const [courses, setCourses] = useState<string[]>(profile.enrolled_courses);
  const [customCourse, setCustomCourse] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url ?? '');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  const removeCourse = (course: string) => setCourses((prev) => prev.filter((c) => c !== course));

  async function checkUsername(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === profile.username?.toLowerCase()) {
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

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      {subjects.map((s) => (
        <input key={s} type="hidden" name="subjects" value={s} />
      ))}
      {courses.map((c) => (
        <input key={c} type="hidden" name="enrolledCourses" value={c} />
      ))}
      <input type="hidden" name="avatarUrl" value={avatarUrl} />

      <section className="space-y-3">
        <h2 className="text-xl text-white">Basics</h2>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-background">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage/blob URL preview
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
                N/A
              </div>
            )}
          </div>
          <div>
            <label className="inline-block cursor-pointer rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40">
              {uploadingAvatar ? 'Uploading…' : 'Change photo'}
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
              defaultValue={profile.display_name ?? ''}
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
              defaultValue={profile.username ?? ''}
              onChange={() => setUsernameStatus('idle')}
              onBlur={(e) => void checkUsername(e.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
            />
            {usernameStatus === 'checking' && <p className="mt-1 text-xs text-muted">Checking…</p>}
            {usernameStatus === 'available' && <p className="mt-1 text-xs text-teal">Available</p>}
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
              defaultValue={profile.date_of_birth ?? ''}
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
              defaultValue={profile.phone_number ?? ''}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="goal" className="pb-label mb-1 block">
            Goal
          </label>
          <textarea
            id="goal"
            name="goal"
            rows={2}
            maxLength={500}
            defaultValue={profile.goal ?? ''}
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-white">Academic</h2>
        <p className="text-xs text-muted">
          Role ({profile.role}) was set during onboarding and can&apos;t be changed here.
        </p>
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
              defaultValue={profile.university_name ?? ''}
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
              defaultValue={profile.roll_number ?? ''}
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
              defaultValue={profile.department ?? ''}
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
              defaultValue={profile.year_level ?? ''}
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
          <div>
            <label htmlFor="alternateEmail" className="pb-label mb-1 block">
              Alternate email
            </label>
            <input
              id="alternateEmail"
              name="alternateEmail"
              type="email"
              maxLength={320}
              defaultValue={profile.alternate_email ?? ''}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
            />
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
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-white">Subjects</h2>
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
            placeholder="Not listed? Type your own"
            className="flex-1 rounded-lg border border-line bg-background px-4 py-2 text-sm text-white outline-none focus:border-cyan/60"
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
