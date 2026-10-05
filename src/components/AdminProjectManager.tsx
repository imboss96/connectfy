import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Briefcase,
  Layers,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Smartphone,
  Eye,
  Edit3
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { normalizeProjectStatus } from '../lib/projectStatus';
import { Project, ProjectTrack } from '../types';
import { fetchRegisteredTestersFromSupabase, RegisteredTester } from '../lib/projectRepository';
import { AddProjectModal } from './AddProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ProjectIcon } from './ProjectIcon';

export const AdminProjectManager: React.FC = () => {
  const { projects, updateProject, deleteProject, applications, bugReports, taskSubmissions, approveApplication, rejectApplication, resendInvite, requestUtestAccountUpdate, inviteTesterToProject, setActiveAdminProjectId, setActiveTab } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<'all' | ProjectTrack>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'paused' | 'closed' | 'ended' | 'hidden'>('all');
  const [editingSlotsId, setEditingSlotsId] = useState<string | null>(null);
  const [newSlotsInput, setNewSlotsInput] = useState<string>('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<'all' | 'pending' | 'approved' | 'invited' | 'accepted' | 'rejected' | 'needs_utest_update'>('all');
  const [applicationProjectFilter, setApplicationProjectFilter] = useState<string>('all');
  const [registeredTesters, setRegisteredTesters] = useState<RegisteredTester[]>([]);
  const [testerDirectoryError, setTesterDirectoryError] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [selectedInviteTesterIds, setSelectedInviteTesterIds] = useState<string[]>([]);
  const [inviteProjectId, setInviteProjectId] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [isLoadingTesters, setIsLoadingTesters] = useState(true);

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
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!inviteProjectId && projects.length > 0) setInviteProjectId(projects[0].id);
  }, [inviteProjectId, projects]);

  const matchingInviteTesters = useMemo(() => {
    const query = inviteSearch.trim().toLowerCase();
    return registeredTesters.filter((tester) =>
      !query || tester.name.toLowerCase().includes(query) || tester.email.toLowerCase().includes(query)
    );
  }, [inviteSearch, registeredTesters]);

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
      setInviteFeedback('Choose a project and tick at least one tester profile.');
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

  // Metrics
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'active').length;
  const totalEscrowBudget = projects.reduce((acc, p) => acc + (p.totalBudget || 0), 0);
  const totalSlotsCapacity = projects.reduce((acc, p) => acc + (p.slotsTotal || 0), 0);
  const totalSlotsFilled = projects.reduce((acc, p) => acc + (p.slotsFilled || 0), 0);

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const matchesTrack = selectedTrackFilter === 'all' || p.projectTrack === selectedTrackFilter;
    const matchesStatus = selectedStatusFilter === 'all' || normalizeProjectStatus(p.status) === selectedStatusFilter;
    const matchesSearch =
      searchQuery === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesStatus && matchesSearch;
  });

  const filteredApplications = applications.filter((app) => {
    const project = projects.find((p) => p.id === app.projectId);
    const matchesProject = applicationProjectFilter === 'all' || app.projectId === applicationProjectFilter;
    const matchesStatus =
      applicationStatusFilter === 'all' ||
      (applicationStatusFilter === 'pending' && app.status === 'pending') ||
      (applicationStatusFilter === 'approved' && app.status === 'approved' && app.inviteStatus !== 'accepted') ||
      (applicationStatusFilter === 'invited' && app.inviteStatus === 'invited') ||
      (applicationStatusFilter === 'accepted' && app.inviteStatus === 'accepted') ||
      (applicationStatusFilter === 'rejected' && app.status === 'rejected') ||
      (applicationStatusFilter === 'needs_utest_update' && app.status === 'needs_utest_update');
    const matchSearch =
      applicationSearch.trim() === '' ||
      app.testerName.toLowerCase().includes(applicationSearch.toLowerCase()) ||
      app.testerEmail.toLowerCase().includes(applicationSearch.toLowerCase()) ||
      (project?.title || '').toLowerCase().includes(applicationSearch.toLowerCase());

    return matchesProject && matchesStatus && matchSearch;
  });

  const applicationMetrics = {
    pending: applications.filter((app) => app.status === 'pending').length,
    invited: applications.filter((app) => app.status === 'approved' || app.inviteStatus === 'invited').length,
    accepted: applications.filter((app) => app.inviteStatus === 'accepted').length,
    rejected: applications.filter((app) => app.status === 'rejected').length
  };

  const handleSaveSlots = (projectId: string) => {
    const parsed = parseInt(newSlotsInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      updateProject(projectId, { slotsTotal: parsed });
    }
    setEditingSlotsId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-700">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00A3E0]/8 via-[#007AFF]/4 to-transparent pointer-events-none rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-2xl text-[#007AFF] shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Admin & Project Manager Operations</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#00A3E0]/10 text-[#0F7CC9] border border-[#00A3E0]/20">TTL / PM Studio</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">Add and curate freelance project listings, manage contractor slot quotas, inspect escrow budgets, and publish new QA & Data cycles.</p>
            </div>
          </div>

          <button onClick={() => setIsAddModalOpen(true)} className="px-5 py-3 bg-[#007AFF] hover:bg-[#0066EE] text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-[#007AFF]/20 flex items-center justify-center space-x-2 transition active:scale-95 shrink-0">
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New Project to Listings</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-200 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Active Marketplace Listings</span>
            <span className="text-lg font-bold text-slate-900">{activeProjectsCount} <span className="text-xs text-slate-500 font-normal">/ {totalProjectsCount} total</span></span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total Escrow Committed</span>
            <span className="text-lg font-bold text-emerald-600">${totalEscrowBudget.toLocaleString()}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Project Slots Filled</span>
            <span className="text-lg font-bold text-[#007AFF]">{totalSlotsFilled} <span className="text-xs text-slate-500 font-normal">/ {totalSlotsCapacity} filled</span></span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Incoming Applications</span>
            <span className="text-lg font-bold text-amber-600">{applications.length} candidates</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Users className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Mass invite registered testers</h2>
            <p className="mt-1 text-[11px] text-slate-600">Choose a project, then tick one or more registered tester profiles. They can accept from their email and complete any missing profile details.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="space-y-1.5 text-[11px] font-semibold text-slate-600">
            <span>Project</span>
            <select value={inviteProjectId} onChange={(event) => { setInviteProjectId(event.target.value); setSelectedInviteTesterIds([]); setInviteFeedback(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 focus:border-[#007AFF] focus:outline-none">
            <option value="">Choose a project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-[11px] font-semibold text-slate-600">
            <span>Search tester profiles</span>
            <input type="search" value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} placeholder="Search by name or email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#007AFF] focus:outline-none" />
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={selectableInviteTesters.length > 0 && selectableInviteTesters.every((tester) => selectedInviteTesterIds.includes(tester.id))}
                onChange={toggleAllVisibleInviteTesters}
                disabled={isSendingInvite || selectableInviteTesters.length === 0}
                className="h-4 w-4 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
              />
              Select all {selectableInviteTesters.length} visible profiles
            </label>
            <span className="text-xs text-slate-600">{selectedInviteTesterIds.length} selected</span>
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {isLoadingTesters ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Loading registered tester profiles…</p>
            ) : matchingInviteTesters.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">No tester profiles match your search.</p>
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
                    disabled={isSendingInvite || !inviteProjectId || alreadyAccepted}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">{tester.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{tester.email}</span>
                  </span>
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
          <button
            type="button"
            onClick={() => void handleSendProjectInvites()}
            disabled={isSendingInvite || !inviteProjectId || selectedInviteTesterIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0066EE] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />{isSendingInvite ? `Sending ${selectedInviteTesterIds.length} invite${selectedInviteTesterIds.length === 1 ? '' : 's'}…` : `Send ${selectedInviteTesterIds.length || ''} invite${selectedInviteTesterIds.length === 1 ? '' : 's'}`}
          </button>
          {inviteFeedback && <p role="status" className={`text-xs ${inviteFeedback.startsWith('Invitations sent') ? 'text-emerald-700' : 'text-amber-700'}`}>{inviteFeedback}</p>}
        </div>
        {testerDirectoryError ? (
          <p role="alert" className="text-xs text-rose-700">{testerDirectoryError}</p>
        ) : !isLoadingTesters && registeredTesters.length === 0 ? (
          <p className="text-xs text-slate-500">No registered tester accounts were found.</p>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Application Tracking Pipeline</h2>
            <p className="text-[11px] text-slate-600">Monitor every candidate from first application to final test invite and resend history.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-amber-700">Pending</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{applicationMetrics.pending}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-sky-700">Invited</p>
            <p className="mt-2 text-2xl font-black text-sky-700">{applicationMetrics.invited}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-700">Accepted</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{applicationMetrics.accepted}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-rose-700">Rejected</p>
            <p className="mt-2 text-2xl font-black text-rose-700">{applicationMetrics.rejected}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-orange-700">Needs new uTest account</p>
            <p className="mt-2 text-2xl font-black text-orange-700">{applications.filter((app) => app.status === 'needs_utest_update').length}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input type="text" value={applicationSearch} onChange={(e) => setApplicationSearch(e.target.value)} placeholder="Search by tester, email, or project..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]" />
          </div>

          <select value={applicationProjectFilter} onChange={(e) => setApplicationProjectFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#007AFF]">
            <option value="all">All projects</option>
            {projects.map((project) => (<option key={project.id} value={project.id}>{project.title}</option>))}
          </select>

          <select value={applicationStatusFilter} onChange={(e) => setApplicationStatusFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#007AFF]">
            <option value="all">All statuses</option>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="invited">Invited</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="needs_utest_update">Needs new uTest account</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No applicants match the current filters.</div>
          ) : (
            filteredApplications.map((app) => {
              const project = projects.find((p) => p.id === app.projectId);
              const inviteHistory = app.inviteHistory || [];
              const statusLabel = app.status === 'needs_utest_update' ? 'Needs new uTest account' : app.status === 'rejected' ? 'Rejected' : app.inviteStatus === 'accepted' ? 'Accepted' : app.status === 'approved' ? 'Approved' : 'Pending review';

              return (
                <div key={app.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#00A3E0] flex items-center justify-center text-sm font-black text-white">{app.testerName.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{app.testerName}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-slate-700 border-slate-200">{app.testerTier}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">Rating {app.testerRating}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">{app.testerEmail}</p>
                        <p className="text-[11px] text-slate-600 mt-1">Project: <span className="text-slate-900 font-medium">{project?.title || app.projectId}</span></p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${app.status === 'rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200' : app.status === 'needs_utest_update' ? 'bg-orange-100 text-orange-700 border border-orange-200' : app.inviteStatus === 'accepted' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : app.status === 'approved' || app.inviteStatus === 'invited' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{statusLabel}</span>
                      <span className="text-[10px] text-slate-500">Applied {app.appliedDate}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Experience note</p>
                      <p className="mt-2 text-xs text-slate-700 leading-5">{app.experienceNote || 'No experience summary provided.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(app.selectedDevices && app.selectedDevices.length > 0 ? app.selectedDevices : ['No device selected']).map((device, index) => (
                          <span key={`${device}-${index}`} className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[10px] text-slate-700">{device}</span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#00A3E0]/30 bg-[#e0f7ff] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#075985]">uTest payment details</p>
                      <div className="mt-2 space-y-1 text-[11px] text-[#164e63]">
                        <p><span className="font-semibold">uTest ID:</span> {app.uTestId || 'Not provided'}</p>
                        <p><span className="font-semibold">uTest email:</span> {app.uTestEmail || 'Not provided'}</p>
                      </div>
                      {app.uTestAccountScreenshotUrl ? (
                        <a href={app.uTestAccountScreenshotUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 underline underline-offset-2">
                          <Eye className="h-3.5 w-3.5" /> View uTest account screenshot
                        </a>
                      ) : (
                        <p className="mt-2 text-[10px] font-semibold text-rose-700">No uTest account screenshot submitted</p>
                      )}
                      <p className="mt-2 text-[10px] leading-relaxed text-[#075985]">Approved payments are processed through uTest. Connectfy does not collect participant payments directly.</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Invite history</p>
                      {inviteHistory.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-[11px] text-slate-700">
                          {inviteHistory.slice(-3).reverse().map((entry, index) => (
                            <li key={`${entry.sentAt}-${index}`} className="flex gap-2">
                              <span className={`mt-1 h-2 w-2 rounded-full ${entry.type === 'resend' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                              <span>
                                <span className="font-semibold text-slate-900">{entry.type === 'resend' ? 'Resend' : 'Initial invite'}</span>
                                <span className="text-slate-500"> · {entry.sentAt}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500">No invite was sent for this candidate yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button type="button" onClick={() => rejectApplication(app.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100">Reject</button>
                        <button type="button" onClick={() => approveApplication(app.id)} className="px-3 py-1.5 rounded-lg bg-[#007AFF] text-xs font-bold text-white hover:bg-[#0066EE]">Approve & Send Invite</button>
                        <button type="button" onClick={() => requestUtestAccountUpdate(app.id)} className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100">Request New uTest Account & Reapply</button>
                      </>
                    )}

                    {(app.status === 'approved' || app.inviteStatus === 'invited' || app.inviteStatus === 'accepted') && (
                      <button type="button" onClick={() => resendInvite(app.id)} className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:bg-sky-100">Resend Invite</button>
                    )}

                    {app.status === 'rejected' && <span className="text-[11px] text-slate-500">Rejected from this cycle.</span>}
                    {app.status === 'needs_utest_update' && <span className="text-[11px] text-amber-700">Waiting for the tester to create a new uTest account and reapply.</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search listings by title, company, or domain..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedTrackFilter} onChange={(e) => setSelectedTrackFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#007AFF]">
            <option value="all">All Tracks</option>
            <option value="qa_functional">Software QA Cycles</option>
            <option value="data_collection">Voice / Data Collection</option>
            <option value="ai_evaluation">AI Model Evaluation</option>
            <option value="special_field">Special In-Field Audits</option>
            <option value="ux_research">User Research Sessions</option>
            <option value="localization">Localization</option>
          </select>

          <select value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#007AFF]">
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="upcoming">Upcoming</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
            <option value="ended">Ended</option>
            <option value="hidden">Hidden</option>
          </select>

          <button onClick={() => setIsAddModalOpen(true)} className="px-3.5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow">
            <Plus className="w-3.5 h-3.5" />
            <span>New Listing</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Showing {filteredProjects.length} of {projects.length} project listings</span>
          <span>Set listing status, feature a project, or edit its slots</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No Project Listings Match Criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Try adjusting your search query or filters, or add a brand new project to the marketplace.</p>
            <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white font-bold text-xs rounded-xl transition">+ Add New Project Now</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredProjects.map((project) => {
              const projectApps = applications.filter((a) => a.projectId === project.id);
              const normalizedStatus = normalizeProjectStatus(project.status);
              const isActive = normalizedStatus === 'active';
              const isEditingThis = editingSlotsId === project.id;

              return (
                <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#007AFF]/40 transition shadow-sm">
                  <div className="flex items-start space-x-3.5">
                    <span className="text-3xl p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0"><ProjectIcon name={project.companyLogo} className="h-6 w-6 text-[#00A3E0]" /></span>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">{project.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{normalizedStatus}</span>
                        {project.isFeatured && <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">Featured</span>}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#007AFF]/10 text-[#0F7CC9] border border-[#007AFF]/20">{project.category}</span>
                      </div>

                      <p className="text-xs text-slate-600">Client: <strong className="text-slate-900">{project.company}</strong> • Track: <span className="text-slate-700 font-medium">{(project.projectTrack || 'qa_functional').replace('_', ' ')}</span> • Created: {project.createdAt}</p>

                      <p className="text-xs text-slate-700 line-clamp-1 max-w-2xl pt-0.5">{project.shortDescription}</p>

                      <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                        {project.requiredDevices.map((d, i) => (<span key={i} className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700">{d}</span>))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-col items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Total Budget</span>
                        <span className="font-bold text-emerald-600 text-sm">${project.totalBudget.toLocaleString()}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Project Slots</span>
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <input type="number" value={newSlotsInput} onChange={(e) => setNewSlotsInput(e.target.value)} className="w-16 bg-slate-50 border border-[#007AFF] rounded px-1.5 py-0.5 text-xs text-slate-900" autoFocus />
                            <button onClick={() => handleSaveSlots(project.id)} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">Save</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingSlotsId(project.id); setNewSlotsInput(String(project.slotsTotal)); }} className="font-bold text-slate-900 hover:text-[#007AFF] flex items-center gap-1 group text-sm" title="Click to edit slots">
                            <span>{project.slotsFilled}/{project.slotsTotal}</span>
                            <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-[#007AFF]" />
                          </button>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Applicants</span>
                        <span className="font-bold text-amber-600 text-sm">{projectApps.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAdminProjectId(project.id);
                          setActiveTab('project_operations');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#007AFF]/20 bg-[#007AFF]/5 px-2.5 py-1.5 text-[11px] font-bold text-[#007AFF] transition hover:bg-[#007AFF]/10"
                        title={`Open ${project.title} operations`}
                      >
                        <Briefcase className="h-3.5 w-3.5" />
                        Manage
                      </button>
                      <button onClick={() => setEditingProject(project)} className="p-1.5 rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-600 transition border border-slate-200" title="Edit project listing"><Edit3 className="w-4 h-4" /></button>
                      <select aria-label={`Set status for ${project.title}`} value={normalizedStatus} onChange={(event) => updateProject(project.id, { status: event.target.value as Project['status'] })} className="max-w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
                        <option value="active">Open</option>
                        <option value="upcoming">Coming soon</option>
                        <option value="paused">Paused</option>
                        <option value="closed">Closed</option>
                        <option value="ended">Ended</option>
                        <option value="hidden">Hidden</option>
                      </select>
                      <button onClick={() => updateProject(project.id, { isFeatured: !project.isFeatured })} className={`p-1.5 rounded-lg transition border ${project.isFeatured ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700'}`} title={project.isFeatured ? 'Remove featured promotion' : 'Feature project'} aria-label={project.isFeatured ? `Remove featured promotion for ${project.title}` : `Feature ${project.title}`}><Sparkles className="w-4 h-4" /></button>

                      <button onClick={() => { if (confirm(`Are you sure you want to remove "${project.title}" from the listings?`)) { deleteProject(project.id); } }} className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition border border-slate-200" title="Remove project listing"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddProjectModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} />
    </div>
  );
};
