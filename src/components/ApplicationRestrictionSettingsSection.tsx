import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  fetchProjectApplicationRestrictionEnabled,
  saveProjectApplicationRestriction
} from '../lib/projectApplicationEligibility';

export const ApplicationRestrictionSettingsSection: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    setError('');
    setNotice('');
    void fetchProjectApplicationRestrictionEnabled()
      .then((enabled) => {
        if (!active) return;
        setIsEnabled(enabled);
        setIsLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error('Unable to load project application restriction:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the project application restriction.');
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const updateRestriction = async () => {
    const nextEnabled = !isEnabled;
    if (!nextEnabled
      && !window.confirm('Turn off the project application restriction for all testers? They will be able to apply to another project before their current submissions are approved.')) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await saveProjectApplicationRestriction(nextEnabled);
      setIsEnabled(nextEnabled);
      setNotice(nextEnabled
        ? 'The application restriction is on. Testers must finish their current project before applying to another.'
        : 'The application restriction is off. Testers can apply to another project while current submissions are unresolved.');
    } catch (saveError) {
      console.error('Unable to update project application restriction:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the project application restriction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">Global tester policy</p>
        <h2 className="mt-1 text-base font-bold text-slate-900">Project application restriction</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          When on, testers must submit at least one deliverable for their active project and have every current submission approved before applying to another. This setting applies globally to all projects and is enforced by the database as well as the application interface.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={isSaving} className="inline-flex shrink-0 items-center gap-1 font-semibold underline disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {isEnabled
            ? <ShieldCheck className="h-7 w-7 text-emerald-600" />
            : <ShieldOff className="h-7 w-7 text-amber-600" />}
          <div>
            <p className="text-sm font-bold text-slate-900">
              Restriction is {isEnabled ? 'ON' : 'OFF'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isEnabled
                ? 'Unresolved or unapproved submissions prevent applying to another project.'
                : 'The current-project approval requirement is bypassed for new applications.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void updateRestriction()}
          disabled={!isLoaded || isSaving || Boolean(error)}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${isEnabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
        >
          {isSaving
            ? <LoaderCircle className="h-4 w-4 animate-spin" />
            : isEnabled
              ? <ShieldOff className="h-4 w-4" />
              : <ShieldCheck className="h-4 w-4" />}
          {isSaving ? 'Saving…' : isEnabled ? 'Turn restriction off' : 'Turn restriction on'}
        </button>
      </div>
    </section>
  );
};
