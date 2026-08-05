'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { readPdf, type PdfReaderState } from './actions';

const INITIAL: PdfReaderState = { status: 'idle' };
const MAX_FILE_BYTES = 6 * 1024 * 1024;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Reading…' : 'Summarize PDF'}
    </button>
  );
}

export function PdfReaderForm() {
  const [state, formAction] = useFormState(readPdf, INITIAL);
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setFileData('');

    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large (max 6MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:application/pdf;base64," prefix — Gemini wants raw base64.
      const base64 = result.split(',')[1] ?? '';
      setFileData(base64);
      setFileName(file.name);
      setMimeType(file.type);
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="fileData" value={fileData} />
        <input type="hidden" name="fileName" value={fileName} />
        <input type="hidden" name="mimeType" value={mimeType} />

        <label className="block cursor-pointer rounded-lg border border-dashed border-line bg-background p-8 text-center transition hover:border-cyan/40">
          <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          <p className="text-sm text-silver">
            {fileName || 'Click to choose a PDF (max 6MB)'}
          </p>
        </label>

        {error && (
          <p className="text-sm text-amber" role="alert">
            {error}
          </p>
        )}

        <SubmitButton disabled={!fileData} />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      <div className="pb-panel">
        <p className="pb-label">Summary</p>
        {state.status === 'ok' && state.summary ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-silver">{state.summary}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">The breakdown will appear here.</p>
        )}
      </div>
    </div>
  );
}
