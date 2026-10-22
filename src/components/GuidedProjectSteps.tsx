import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Circle, ExternalLink, FileImage, LoaderCircle, RefreshCw, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isCloudinaryConfigured, uploadToCloudinary } from '../lib/cloudinary';
import { AttachmentFile, Project, TaskSubmission, TesterProfile } from '../types';
import {
  fetchProjectStepProgress,
  ProjectStepProgress,
  ProjectStepReviewNotes,
  ProjectStepStatuses,
  ProjectStepStatus,
  saveProjectStepProgress,
  usesRemoteProjectStepProgress
} from '../lib/projectStepProgress';

const LANGUAGE_SETTINGS_FORM_URL = 'https://forms.monday.com/forms/108f5b47f91717382930502bd999303d?r=use1';
const LANGUAGE_SETTINGS_REFERENCE_VIDEO_EMBED_URL = 'https://drive.google.com/file/d/1WzraUOaatrefjtcW23H9YEZm77-6vG0S/preview';
const PROJECT_CONSENT_URL = 'https://prod-data-collection.cloud.utest.com/people/add_person_basics/3bd1eb19-fbf1-4f10-b354-0038bc016b5e/04e9d4c1-a615-4a85-b9fa-5b5b4ba7ff30';
const SELFIE_COLLECTION_URL = 'https://myaccount.google.com/video-verification/collect?source=42';
const COMPLETION_EVIDENCE_URL = 'https://wkf.ms/4i83vDd';
const SLACK_INVITE_URL = 'https://join.slack.com/t/connectfyops/shared_invite/zt-4cmuhc6av-4dwkrhonBEtgxVaHBW6tJQ';
const SLACK_SUPPORT_URL = 'https://app.slack.com/client/T0C8FU34030/C0C82GD0NMV';

const stepIds = ['slack', 'consent', 'languageSettings', 'recordings'] as const;
type StepId = typeof stepIds[number];
type StepStatus = ProjectStepStatus;
type StepStatuses = ProjectStepStatuses;
type EvidenceSlot = 'screenshot';

const defaultStatuses: StepStatuses = {
  slack: 'pending',
  consent: 'pending',
  languageSettings: 'pending',
  recordings: 'pending'
};

const hasSavedProgress = (progress: SavedProgress) =>
  progress.attachments.length > 0 || stepIds.some((id) => progress.statuses[id] !== 'pending');

interface SavedProgress {
  statuses: StepStatuses;
  attachments: AttachmentFile[];
  reviewNotes: ProjectStepReviewNotes;
}

interface GuidedProjectStepsProps {
  project: Project;
  testerProfile: TesterProfile;
  applicationEmail: string;
  applicationName: string;
  submission?: TaskSubmission;
}

const readSavedProgress = (key: string): SavedProgress => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return { statuses: defaultStatuses, attachments: [], reviewNotes: {} };

    const parsed = JSON.parse(saved) as Partial<SavedProgress>;
    const statuses = { ...defaultStatuses };
    if (parsed.statuses && typeof parsed.statuses === 'object') {
      stepIds.forEach((id) => {
        const status = parsed.statuses?.[id];
        if (status === 'pending' || status === 'submitted' || status === 'done' || status === 'failed') statuses[id] = status;
      });
    }

    return {
      statuses,
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((attachment: AttachmentFile) =>
          attachment.name.startsWith('screenshot:') || attachment.type.startsWith('image/'))
        : [],
      reviewNotes: parsed.reviewNotes && typeof parsed.reviewNotes === 'object' ? parsed.reviewNotes : {}
    };
  } catch {
    return { statuses: defaultStatuses, attachments: [], reviewNotes: {} };
  }
};

export const GuidedProjectSteps: React.FC<GuidedProjectStepsProps> = ({
  project,
  testerProfile,
  applicationEmail,
  applicationName,
  submission
}) => {
  const { submitTaskDeliverable } = useApp();
  const storageKey = `connectfy_project_steps_${project.id}_${testerProfile.id || testerProfile.email}`;
  const initialProgress = useMemo(() => {
    const saved = readSavedProgress(storageKey);
    if (hasSavedProgress(saved)) return saved;
    return readSavedProgress(`connectfy_google_selfies_steps_${project.id}_${testerProfile.id || testerProfile.email}`);
  }, [project.id, storageKey, testerProfile.email, testerProfile.id]);
  const [statuses, setStatuses] = useState<StepStatuses>(initialProgress.statuses);
  const [attachments, setAttachments] = useState<AttachmentFile[]>(initialProgress.attachments);
  const [reviewNotes, setReviewNotes] = useState<ProjectStepReviewNotes>(initialProgress.reviewNotes);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProgressLoading, setIsProgressLoading] = useState(true);
  const [isProgressSaving, setIsProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [remoteProgressReady, setRemoteProgressReady] = useState(false);
  const [reloadProgressKey, setReloadProgressKey] = useState(0);
  const usesRemoteProgress = usesRemoteProjectStepProgress(project.id);
  const saveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const lastLocalChangeAt = React.useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ statuses, attachments, reviewNotes }));
    } catch (saveError) {
      console.error('Unable to save project checklist progress:', saveError);
      setProgressError('Progress could not be saved on this device.');
    }
  }, [attachments, reviewNotes, statuses, storageKey]);

  useEffect(() => {
    let isCurrent = true;
    setIsProgressLoading(true);
    setRemoteProgressReady(false);

    if (!usesRemoteProgress) {
      setStatuses(defaultStatuses);
      setAttachments([]);
      setReviewNotes({});
      setProgressLoaded(true);
      setIsProgressLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setProgressLoaded(false);
    void fetchProjectStepProgress(project.id)
      .then((savedProgress) => {
        if (!isCurrent) return;
        if (savedProgress) {
          setStatuses(savedProgress.statuses);
          setAttachments(savedProgress.attachments);
          setReviewNotes(savedProgress.reviewNotes);
        } else {
          setStatuses(defaultStatuses);
          setAttachments([]);
          setReviewNotes({});
        }
        setProgressError('');
        setRemoteProgressReady(true);
        setProgressLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return;
        console.error('Unable to load project checklist progress:', loadError);
        setProgressError(loadError instanceof Error ? loadError.message : 'Unable to load saved project progress.');
        setProgressLoaded(true);
      })
      .finally(() => {
        if (isCurrent) setIsProgressLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [project.id, reloadProgressKey, usesRemoteProgress]);

  useEffect(() => {
    if (!usesRemoteProgress) return;

    const interval = window.setInterval(() => {
      if (Date.now() - lastLocalChangeAt.current < 3000) return;
      void fetchProjectStepProgress(project.id)
        .then((savedProgress) => {
          if (!savedProgress) return;
          setStatuses((current) => JSON.stringify(current) === JSON.stringify(savedProgress.statuses)
            ? current
            : savedProgress.statuses);
          setAttachments((current) => JSON.stringify(current) === JSON.stringify(savedProgress.attachments)
            ? current
            : savedProgress.attachments);
          setReviewNotes((current) => JSON.stringify(current) === JSON.stringify(savedProgress.reviewNotes)
            ? current
            : savedProgress.reviewNotes);
          setProgressError('');
        })
        .catch((refreshError: unknown) => {
          console.error('Unable to refresh project step approval status:', refreshError);
          setProgressError(refreshError instanceof Error
            ? refreshError.message
            : 'Unable to refresh project step approval status.');
        });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [project.id, usesRemoteProgress]);

  useEffect(() => {
    if (!usesRemoteProgress || !remoteProgressReady || !progressLoaded) return;

    const hasProgress = stepIds.some((id) => statuses[id] !== 'pending') || attachments.length > 0;
    if (!hasProgress) return;

    const snapshot: ProjectStepProgress = { statuses, attachments, reviewNotes };
    const timeout = window.setTimeout(() => {
      setIsProgressSaving(true);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => saveProjectStepProgress(project.id, snapshot))
        .then(() => setProgressError(''))
        .catch((saveError: unknown) => {
          console.error('Unable to save project checklist progress:', saveError);
          setProgressError(saveError instanceof Error ? saveError.message : 'Unable to save project progress.');
        })
        .finally(() => setIsProgressSaving(false));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [attachments, progressLoaded, project.id, remoteProgressReady, reviewNotes, statuses, usesRemoteProgress]);

  const screenshot = attachments.find((attachment) => attachment.name.startsWith('screenshot:'));
  const screenshotReady = Boolean(screenshot);
  const canStartConsent = statuses.slack === 'done';
  const canStartLanguageSettings = statuses.slack === 'done' && statuses.consent === 'done';
  const canStartCollection = canStartLanguageSettings && statuses.languageSettings === 'done';
  const completedCount = stepIds.filter((id) => statuses[id] === 'done').length;
  const awaitingApprovalCount = stepIds.filter((id) => statuses[id] === 'submitted').length;
  const isComplete = completedCount === stepIds.length;
  const updateStatus = (stepId: StepId, status: StepStatus) => {
    lastLocalChangeAt.current = Date.now();
    setStatuses((previous) => ({ ...previous, [stepId]: status }));
    setReviewNotes((previous) => ({ ...previous, [stepId]: undefined }));
    setError('');
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>, slot: EvidenceSlot) => {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('The completion evidence must be an image screenshot.');
      return;
    }
    if (!isCloudinaryConfigured) {
      setError('File uploads are not configured. Please contact the project administrator before uploading your screenshot.');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const result = await uploadToCloudinary(selectedFile);
      const uploadedFile: AttachmentFile = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${slot}:${selectedFile.name}`,
        size: selectedFile.size,
        type: selectedFile.type || 'application/octet-stream',
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        uploadedAt: new Date().toISOString()
      };
      setAttachments((previous) => [
        ...previous.filter((attachment) => !attachment.name.startsWith(`${slot}:`)),
        uploadedFile
      ]);
      lastLocalChangeAt.current = Date.now();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The screenshot could not be uploaded.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      setError('Wait until all four project steps are approved before submitting the project for review.');
      return;
    }
    if (!screenshotReady) {
      setError('Upload the final completion screenshot before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await submitTaskDeliverable({
        projectId: project.id,
        taskType: project.projectTrack || 'data_collection',
        title: 'Project Completion Checklist',
        details: `All four project steps are marked Done for "${project.title}". The final completion screenshot is attached. The language settings video was submitted through the linked Monday form, and Google Selfie Collection tasks were completed.`,
        metadata: {
          deviceUsed: testerProfile.devices[0] || 'Not specified',
          meetingUrlOrNotes: `Consent signed by ${applicationName}; language settings video submitted through the Monday form.`
        },
        attachments: screenshot ? [screenshot] : []
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the completed project for review.');
      setIsSubmitting(false);
    }
  };

  if (submission) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Project submitted for review</h3>
            <p className="mt-1 text-sm text-slate-600">
              Your project submission is {submission.status.replace('_', ' ')}.
            </p>
            <p className="mt-2 text-xs text-slate-500">Submitted {submission.submittedAt}</p>
            <div className="mt-4 space-y-2">
              {submission.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-sky-700 underline underline-offset-2"
                >
                  <FileImage className="h-4 w-4" />
                  {attachment.name.replace(/^screenshot:/, '')}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const stepCard = (
    step: StepId,
    number: number,
    title: string,
    children: React.ReactNode,
    canMarkDone = true
  ) => {
    const status = statuses[step];
    return (
      <article className={`rounded-2xl border bg-white p-5 shadow-sm ${status === 'done' ? 'border-emerald-200' : status === 'failed' ? 'border-rose-200' : status === 'submitted' ? 'border-amber-200' : 'border-slate-200'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${status === 'done' ? 'bg-emerald-100 text-emerald-700' : status === 'failed' ? 'bg-rose-100 text-rose-700' : status === 'submitted' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-700'}`}>
              {status === 'done' ? <Check className="h-4 w-4" /> : number}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900">{title}</h3>
                {status === 'done' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Done</span>}
                {status === 'submitted' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Awaiting approval</span>}
                {status === 'failed' && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Changes requested</span>}
              </div>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
              {reviewNotes[step] && status === 'failed' && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  Reviewer feedback: {reviewNotes[step]}
                </p>
              )}
              {status === 'submitted' && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Your step was submitted. The next step unlocks after a reviewer or project manager approves it.
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
            <button
              type="button"
              onClick={() => updateStatus(step, 'submitted')}
              disabled={!usesRemoteProgress || !remoteProgressReady || Boolean(progressError) || !canMarkDone || status === 'submitted' || status === 'done' || isSubmitting || isProgressLoading || isProgressSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {status === 'failed' ? 'Resubmit for approval' : status === 'submitted' ? 'Awaiting approval' : status === 'done' ? 'Approved' : 'Submit for approval'}
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Project completion checklist</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Submit each step and wait for approval</h2>
            <p className="mt-1 text-sm text-slate-600">A reviewer or project manager must approve each step before the next step unlocks. Only the final completion screenshot is required here.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700" aria-live="polite">
            {stepIds.map((step) => statuses[step] === 'done'
              ? <CheckCircle2 key={step} className="h-5 w-5 text-emerald-600" />
              : statuses[step] === 'submitted'
                ? <Circle key={step} className="h-5 w-5 text-amber-500" />
                : <Circle key={step} className={`h-5 w-5 ${statuses[step] === 'failed' ? 'text-rose-500' : 'text-slate-300'}`} />)}
            <span>{completedCount} of {stepIds.length} approved{awaitingApprovalCount > 0 ? ` · ${awaitingApprovalCount} awaiting review` : ''}</span>
          </div>
        </div>
      </section>

      <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${progressError ? 'border-rose-200 bg-rose-50 text-rose-800' : usesRemoteProgress ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <span aria-live="polite">
          {progressError
            ? progressError
            : isProgressLoading
              ? 'Loading saved progress…'
              : isProgressSaving
                ? 'Saving progress to your account…'
                : usesRemoteProgress
                  ? 'Progress syncs to your account across devices. Approval status refreshes every 15 seconds.'
                  : 'Step approval requires a signed-in account and a cloud-backed project. Contact project support if this message persists.'}
        </span>
        {usesRemoteProgress && progressError && (
          <button
            type="button"
            onClick={() => setReloadProgressKey((previous) => previous + 1)}
            disabled={isProgressLoading}
            className="shrink-0 font-bold underline underline-offset-2 disabled:opacity-50"
          >
            Retry
          </button>
        )}
        {usesRemoteProgress && (
          <button
            type="button"
            onClick={() => setReloadProgressKey((previous) => previous + 1)}
            disabled={isProgressLoading}
            className="inline-flex shrink-0 items-center gap-1 font-bold underline underline-offset-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isProgressLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {stepCard('slack', 1, 'Join the Connectfy Slack team and say hi', (
        <>
          <p>Use the invitation below to join Connectfy Slack with the same email address you use for your Connectfy account. Accepting the invitation is required; Slack does not add you automatically. After joining, say hi in the support channel. The testing team will create a project channel for your questions.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={SLACK_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              className="slack-team-join-link inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold shadow-sm transition sm:w-auto"
            >
              Accept Slack invitation <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={SLACK_SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              Open support channel <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </>
      ))}

      {stepCard('consent', 2, 'Sign the project consent', (
        <>
          <p>Open the consent email sent to <strong className="text-slate-800">{applicationEmail || testerProfile.email || 'the email address used for your project application'}</strong> and sign using your name exactly as it appears on your project application: <strong className="text-slate-800">{applicationName || testerProfile.name}</strong>.</p>
          <p>Do not sign with a different name or nickname.</p>
          <a
            href={PROJECT_CONSENT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
          >
            Open the project consent form <ExternalLink className="h-4 w-4" />
          </a>
        </>
      ), canStartConsent)}

      {stepCard('languageSettings', 3, 'Submit the language settings video', (
        <>
          <p>Prepare the assigned primary language on your mobile device, record the settings walkthrough, then submit the video through the project form.</p>
          <a
            href={LANGUAGE_SETTINGS_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-sky-700 underline underline-offset-2"
          >
            Open the language settings form <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-black">
            <iframe
              src={LANGUAGE_SETTINGS_REFERENCE_VIDEO_EMBED_URL}
              title="Language settings reference video"
              className="aspect-video w-full"
              allow="autoplay"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">The form asks for:</p>
            <p className="mt-1 text-xs">Name, uTest ID (if you have one), Participant Gmail, Date of Birth, and the required Settings Video upload.</p>
          </div>
        </>
      ), canStartLanguageSettings)}

      {!canStartCollection ? (
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 opacity-80">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">4</span>
            <div>
              <h3 className="font-bold text-slate-700">Complete the Google Selfie Collection tasks</h3>
              <p className="mt-1 text-sm text-slate-600">This step unlocks after Slack, consent, and language settings are approved.</p>
            </div>
          </div>
        </article>
      ) : stepCard('recordings', 4, 'Complete the Google Selfie Collection tasks', (
        <div className="space-y-4">
          <p className="font-semibold text-slate-800">Thank you for participating in Audio &amp; Video Data Collection 2026. Complete the assigned tasks within 48 hours of receiving access.</p>
          <a
            href={SELFIE_COLLECTION_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800"
          >
            Open Selfie Collection UI <ExternalLink className="h-4 w-4" />
          </a>

          <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <h4 className="font-bold text-slate-900">Before you start — mandatory requirements</h4>
            <ul className="mt-2 list-inside list-disc space-y-1.5">
              <li>Use a mobile device only (Android or iOS) and Google Chrome mobile only.</li>
              <li>Set your browser and Google Account language to your assigned primary language.</li>
              <li>In Chrome Settings → Language, keep only your assigned language.</li>
              <li>At <a href="https://myaccount.google.com/language" target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">Google Account language settings</a>, keep only your assigned language.</li>
              <li>After changing Chrome’s language, fully close Chrome from recent apps and reopen it.</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">Follow all instructions shown in the app</h4>
            <ol className="mt-2 list-inside list-decimal space-y-2">
              <li>Read and scroll through the consent page, then tap <strong className="text-slate-800">I Agree</strong> at the bottom.</li>
              <li>Verify your identity with a valid government-issued ID from your country.</li>
              <li>Complete the practice video and record the short video samples by reading the prompts on screen.</li>
              <li>When asked to choose a sample, select only the sample in the <strong className="text-slate-800">Primary Language</strong> section for your assigned language. Do not choose an Optional Language sample.</li>
              <li>Complete the required recordings in your primary language in both quiet and noisy environments. A noisy environment can include a TV or other people speaking.</li>
              <li>Finish every task assigned in the app.</li>
            </ol>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-bold text-slate-900">Submit completion evidence</h4>
            <p className="mt-1">When every task is complete, take a screenshot of the final completion screen and submit it using the evidence form:</p>
            <a
              href={COMPLETION_EVIDENCE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-bold text-sky-700 underline underline-offset-2"
            >
              Open the completion evidence form <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="mt-2 text-xs">Allow up to two weeks for customer review and payment processing; it may take longer. uTest participants are paid through uTest on the 15th and last day of the month (or the next working day if a payment date is a weekend or holiday). Third-party vendor participants are paid directly by their vendor after approval.</p>
            <p className="mt-2 text-xs font-semibold">Do not contact the customer directly. Send questions or issues through the uTest team.</p>
          </section>

          <div className="space-y-2">
            <p className="font-semibold text-slate-800">Upload the final completion screenshot here as well:</p>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${screenshot ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : screenshot ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {isUploading ? 'Uploading screenshot…' : screenshot ? `Screenshot uploaded: ${screenshot.name.slice('screenshot:'.length)}` : 'Upload final completion screenshot'}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFileSelection(event, 'screenshot')}
                disabled={isUploading || isSubmitting}
                className="sr-only"
              />
            </label>
            {screenshot && (
              <button
                type="button"
                onClick={() => setAttachments((previous) => previous.filter((item) => item.id !== screenshot.id))}
                disabled={isSubmitting}
                className="ml-3 text-xs font-semibold text-rose-700 underline disabled:opacity-50"
              >
                Remove screenshot
              </button>
            )}
          </div>
        </div>
      ), screenshotReady)}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Ready for review?</h3>
          <p className="mt-1 text-xs text-slate-600">Submit becomes available after all four steps are Done and the final completion screenshot is uploaded here.</p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete || !screenshotReady || isUploading || isSubmitting || isProgressLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isSubmitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </div>
  );
};
