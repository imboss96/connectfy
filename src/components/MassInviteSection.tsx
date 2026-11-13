import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { sendProjectEmail } from '../lib/emailService';
import {
  fetchApplicationTesterIdsFromSupabase,
  fetchRegisteredTestersFromSupabase,
  RegisteredTester
} from '../lib/projectRepository';

type InviteAudienceFilter = 'all' | 'never_applied' | 'has_applied';

export const MassInviteSection: React.FC = () => {
  const { projects, applications, inviteTesterToProject } = useApp();
  const [registeredTesters, setRegisteredTesters] = useState<RegisteredTester[]>([]);
  const [applicationTesterIds, setApplicationTesterIds] = useState<Set<string> | null>(null);
  const [testerDirectoryError, setTesterDirectoryError] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteAudienceFilter, setInviteAudienceFilter] = useState<InviteAudienceFilter>('all');
  const [selectedInviteTesterIds, setSelectedInviteTesterIds] = useState<string[]>([]);
  const [inviteProjectId, setInviteProjectId] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSendingApplicationRequests, setIsSendingApplicationRequests] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [isLoadingTesters, setIsLoadingTesters] = useState(true);
  const [isLoadingApplicationHistory, setIsLoadingApplicationHistory] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetchRegisteredTestersFromSupabase()
      .then((testers) => {
        if (isMounted) {
          setRegisteredTesters(testers);
          setIsLoadingTesters(false);
        }
      })
      .catch((error) => {
        console.error('Unable to load registered testers for project invitations:', error);
        if (isMounted) {
          setTesterDirectoryError(error instanceof Error ? error.message : 'Unable to load the registered tester directory.');
          setIsLoadingTesters(false);
        }
      });
    void fetchApplicationTesterIdsFromSupabase()
      .then((testerIds) => {
        if (isMounted) {
          setApplicationTesterIds(testerIds);
          setIsLoadingApplicationHistory(false);
        }
      })
      .catch((error) => {
        console.error('Unable to load application history for project invitations:', error);
        if (isMounted) {
          setTesterDirectoryError(error instanceof Error ? error.message : 'Unable to load application history.');
          setIsLoadingApplicationHistory(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!inviteProjectId && projects.length > 0) setInviteProjectId(projects[0].id);
  }, [inviteProjectId, projects]);

  const matchingInviteTesters = useMemo(() => {
    const query = inviteSearch.trim().toLowerCase();
    return registeredTesters.filter((tester) => {
      const matchesSearch = !query || tester.name.toLowerCase().includes(query) || tester.email.toLowerCase().includes(query);
      const hasApplied = applicationTesterIds?.has(tester.id) ?? false;
      const matchesAudience = inviteAudienceFilter === 'all'
        || (applicationTesterIds !== null
          && (inviteAudienceFilter === 'never_applied' ? !hasApplied : hasApplied));
      return matchesSearch && matchesAudience;
    });
  }, [applicationTesterIds, inviteAudienceFilter, inviteSearch, registeredTesters]);

  const selectableInviteTesters = useMemo(() => matchingInviteTesters.filter((tester) =>
    !applications.some((application) =>
      application.projectId === inviteProjectId
      && application.testerId === tester.id
      && application.inviteStatus === 'accepted'
    )
  ), [applications, inviteProjectId, matchingInviteTesters]);

  const toggleInviteTester = (testerId: string) => {
    setSelectedInviteTesterIds((selected) => selected.includes(testerId)
      ? selected.filter((id) => id !== testerId)
      : [...selected, testerId]);
  };

  const toggleAllVisibleInviteTesters = () => {
    const visibleIds = selectableInviteTesters.map((tester) => tester.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedInviteTesterIds.includes(id));
    setSelectedInviteTesterIds((selected) => allVisibleSelected
      ? selected.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...selected, ...visibleIds])));
  };

  const handleSendProjectInvites = async () => {
    const selectedTesters = registeredTesters.filter((tester) => selectedInviteTesterIds.includes(tester.id));
    if (selectedTesters.length === 0 || !inviteProjectId) {
      setInviteFeedback('Choose a project and select at least one tester profile.');
      return;
    }

    setIsSendingInvite(true);
    setInviteFeedback('');
    const failedInvites: RegisteredTester[] = [];
    let sentCount = 0;
    for (const tester of selectedTesters) {
      try {
        await inviteTesterToProject(inviteProjectId, tester.id, tester.name, tester.email);
        sentCount += 1;
      } catch (error) {
        console.error(`Unable to invite tester ${tester.id} to project ${inviteProjectId}:`, error);
        failedInvites.push(tester);
      }
    }

    const successfulIds = selectedTesters
      .filter((tester) => !failedInvites.some((failedTester) => failedTester.id === tester.id))
      .map((tester) => tester.id);
    setSelectedInviteTesterIds((selected) => selected.filter((id) => !successfulIds.includes(id)));
    setInviteFeedback(failedInvites.length
      ? `${sentCount} invite${sentCount === 1 ? '' : 's'} sent. Failed: ${failedInvites.map((tester) => tester.name).join(', ')}. You can retry the selected profiles.`
      : `Invitations sent to ${sentCount} tester${sentCount === 1 ? '' : 's'}.`);
    setIsSendingInvite(false);
  };

  const handleSendApplicationRequests = async () => {
    const project = projects.find((item) => item.id === inviteProjectId);
    const selectedTesters = registeredTesters.filter((tester) => selectedInviteTesterIds.includes(tester.id));
    if (!project || selectedTesters.length === 0 || inviteAudienceFilter !== 'never_applied' || applicationTesterIds === null) {
      setInviteFeedback('Choose a project, select Never applied anywhere, and select at least one tester.');
      return;
    }

    const applicationUrl = new URL(window.location.href);
    applicationUrl.search = '';
    applicationUrl.searchParams.set('project', project.id);
    applicationUrl.searchParams.set('apply', '1');
    applicationUrl.hash = '';

    setIsSendingApplicationRequests(true);
    setInviteFeedback('');
    const failedRequests: RegisteredTester[] = [];
    let sentCount = 0;
    for (const tester of selectedTesters) {
      try {
        await sendProjectEmail({
          type: 'application_request',
          toEmail: tester.email,
          toName: tester.name,
          projectTitle: project.title,
          projectCompany: project.company,
          projectDescription: project.shortDescription,
          projectDeadline: project.deadline,
          projectCategory: project.category,
          projectId: project.id,
          testerId: tester.id,
          actionUrl: applicationUrl.toString(),
          projectLink: applicationUrl.toString()
        });
        sentCount += 1;
      } catch (error) {
        console.error(`Unable to send application request to tester ${tester.id}:`, error);
        failedRequests.push(tester);
      }
    }

    const successfulIds = selectedTesters
      .filter((tester) => !failedRequests.some((failedTester) => failedTester.id === tester.id))
      .map((tester) => tester.id);
    setSelectedInviteTesterIds((selected) => selected.filter((id) => !successfulIds.includes(id)));
    setInviteFeedback(failedRequests.length
      ? `${sentCount} application request${sentCount === 1 ? '' : 's'} sent. Failed: ${failedRequests.map((tester) => tester.name).join(', ')}. You can retry the selected profiles.`
      : `Application requests sent to ${sentCount} tester${sentCount === 1 ? '' : 's'}.`);
    setIsSendingApplicationRequests(false);
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-700">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Mass invite registered testers</h1>
            <p className="mt-1 text-sm text-slate-600">Choose a project and select registered tester profiles to invite. Testers can accept from their email and complete any missing project application details.</p>
          </div>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            <span>Project</span>
            <select value={inviteProjectId} onChange={(event) => { setInviteProjectId(event.target.value); setSelectedInviteTesterIds([]); setInviteFeedback(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-[#007AFF] focus:outline-none">
              <option value="">Choose a project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            <span>Search tester profiles</span>
            <input type="search" value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} placeholder="Search by name or email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#007AFF] focus:outline-none" />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            <span>Application history</span>
            <select
              value={inviteAudienceFilter}
              onChange={(event) => {
                setInviteAudienceFilter(event.target.value as InviteAudienceFilter);
                setSelectedInviteTesterIds([]);
              }}
              disabled={isLoadingApplicationHistory || applicationTesterIds === null}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="all">All testers</option>
              <option value="never_applied">Never applied anywhere</option>
              <option value="has_applied">Has applied</option>
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={selectableInviteTesters.length > 0 && selectableInviteTesters.every((tester) => selectedInviteTesterIds.includes(tester.id))}
                onChange={toggleAllVisibleInviteTesters}
                disabled={isSendingInvite || isSendingApplicationRequests || selectableInviteTesters.length === 0}
                className="h-4 w-4 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
              />
              Select all {selectableInviteTesters.length} visible profiles
            </label>
            <span className="text-xs text-slate-600">{selectedInviteTesterIds.length} selected</span>
          </div>
          <div className="max-h-[min(60vh,32rem)] divide-y divide-slate-100 overflow-y-auto">
            {isLoadingTesters ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Loading registered tester profiles…</p>
            ) : isLoadingApplicationHistory && inviteAudienceFilter !== 'all' ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Loading complete application history…</p>
            ) : matchingInviteTesters.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">No tester profiles match these filters.</p>
            ) : matchingInviteTesters.map((tester) => {
              const alreadyAccepted = applications.some((application) =>
                application.projectId === inviteProjectId
                && application.testerId === tester.id
                && application.inviteStatus === 'accepted'
              );
              const alreadyInvited = applications.some((application) =>
                application.projectId === inviteProjectId
                && application.testerId === tester.id
                && application.inviteStatus === 'invited'
              );
              return (
                <label key={tester.id} className={`flex items-center gap-3 px-3 py-2.5 ${alreadyAccepted ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer hover:bg-sky-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedInviteTesterIds.includes(tester.id)}
                    onChange={() => toggleInviteTester(tester.id)}
                    disabled={isSendingInvite || isSendingApplicationRequests || !inviteProjectId || alreadyAccepted}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">{tester.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{tester.email}</span>
                  </span>
                  {applicationTesterIds && !applicationTesterIds.has(tester.id) && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Never applied</span>
                  )}
                  {alreadyAccepted ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Accepted</span>
                  ) : alreadyInvited ? (
                    <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">Invited · resend</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSendProjectInvites()}
              disabled={isSendingInvite || isSendingApplicationRequests || !inviteProjectId || selectedInviteTesterIds.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />{isSendingInvite ? `Sending ${selectedInviteTesterIds.length} invite${selectedInviteTesterIds.length === 1 ? '' : 's'}…` : `Send ${selectedInviteTesterIds.length || ''} invite${selectedInviteTesterIds.length === 1 ? '' : 's'}`}
            </button>
            {inviteAudienceFilter === 'never_applied' && <button
                type="button"
                onClick={() => void handleSendApplicationRequests()}
                disabled={isSendingInvite || isSendingApplicationRequests || !inviteProjectId || selectedInviteTesterIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0066EE] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Users className="h-4 w-4" />{isSendingApplicationRequests ? `Sending ${selectedInviteTesterIds.length} requests…` : `Request applications (${selectedInviteTesterIds.length})`}
              </button>}
          </div>
          {inviteFeedback && <p role="status" className={`text-xs ${inviteFeedback.startsWith('Invitations sent') || inviteFeedback.startsWith('Application requests sent') ? 'text-emerald-700' : 'text-amber-700'}`}>{inviteFeedback}</p>}
        </div>
        {testerDirectoryError ? (
          <p role="alert" className="text-xs text-rose-700">{testerDirectoryError}</p>
        ) : !isLoadingTesters && registeredTesters.length === 0 ? (
          <p className="text-xs text-slate-500">No registered tester accounts were found.</p>
        ) : null}
      </section>
    </div>
  );
};
