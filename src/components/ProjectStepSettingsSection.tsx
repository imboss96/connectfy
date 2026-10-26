import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import {
  defaultProjectStepRequirements,
  fetchProjectStepRequirements,
  ProjectStepId,
  ProjectStepRequirements,
  saveProjectStepRequirements
} from '../lib/projectStepProgress';

interface ProjectStepSettingsSectionProps {
  projectId: string;
  projectTitle: string;
}

const stepOptions: { id: ProjectStepId; label: string; description: string }[] = [
  { id: 'slack', label: 'Join the Connectfy Slack team and say hi', description: 'Join the team and contact project support.' },
  { id: 'consent', label: 'Sign the project consent', description: 'Complete the project consent form.' },
  { id: 'languageSettings', label: 'Submit the language settings video', description: 'Submit the assigned language walkthrough.' },
  { id: 'recordings', label: 'Complete the Google Selfie Collection tasks', description: 'Complete and provide evidence for assigned tasks.' }
];

export const ProjectStepSettingsSection: React.FC<ProjectStepSettingsSectionProps> = ({
  projectId,
  projectTitle
}) => {
  const [requirements, setRequirements] = useState<ProjectStepRequirements>(defaultProjectStepRequirements);
  const [savedRequirements, setSavedRequirements] = useState<ProjectStepRequirements>(defaultProjectStepRequirements);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setIsLoaded(false);
    setError('');
    setNotice('');
    void fetchProjectStepRequirements(projectId)
      .then((loaded) => {
        if (!active) return;
        setRequirements(loaded);
        setSavedRequirements(loaded);
        setIsLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error('Unable to load project step settings:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load project step settings.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  const hasChanges = stepOptions.some(({ id }) => requirements[id] !== savedRequirements[id]);

  const save = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await saveProjectStepRequirements(projectId, requirements);
      setSavedRequirements(requirements);
      setNotice('Project step requirements saved.');
    } catch (saveError) {
      console.error('Unable to save project step settings:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save project step settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">Project checklist</p>
        <h2 className="mt-1 text-base font-bold text-slate-900">Required and optional steps</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Configure which checklist steps testers must complete for {projectTitle}. New and existing projects default to all steps required. Changes take effect immediately for all testers in this project, including people already in progress. Optional steps can be skipped and will not block later required steps or project completion.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={isLoading} className="inline-flex shrink-0 items-center gap-1 font-semibold underline disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {stepOptions.map(({ id, label, description }, index) => (
          <label key={id} className="flex cursor-pointer items-center justify-between gap-4 p-4">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{index + 1}. {label}</span>
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`text-xs font-semibold ${requirements[id] ? 'text-slate-700' : 'text-slate-500'}`}>
                {requirements[id] ? 'Required' : 'Optional'}
              </span>
              <input
                type="checkbox"
                checked={requirements[id]}
                onChange={(event) => {
                  setRequirements((current) => ({ ...current, [id]: event.target.checked }));
                  setNotice('');
                }}
                disabled={isLoading || isSaving || !isLoaded}
                className="h-5 w-5 accent-[#007AFF] disabled:opacity-50"
                aria-label={`${label} required`}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">A step submitted for review still uses the normal approval process, even when it is optional.</p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={isLoading || isSaving || !isLoaded || !hasChanges}
          className="inline-flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isSaving ? 'Saving…' : 'Save step settings'}
        </button>
      </div>
    </section>
  );
};
