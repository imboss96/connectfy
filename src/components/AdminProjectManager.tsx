import React, { useState } from 'react';
import {
  Plus,
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
import { AddProjectModal } from './AddProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ProjectIcon } from './ProjectIcon';

export const AdminProjectManager: React.FC = () => {
  const { projects, updateProject, deleteProject, applications, bugReports, taskSubmissions, approveApplication, rejectApplication, resendInvite } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<'all' | ProjectTrack>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'paused' | 'closed'>('all');
  const [editingSlotsId, setEditingSlotsId] = useState<string | null>(null);
  const [newSlotsInput, setNewSlotsInput] = useState<string>('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<'all' | 'pending' | 'approved' | 'invited' | 'accepted' | 'rejected'>('all');
  const [applicationProjectFilter, setApplicationProjectFilter] = useState<string>('all');

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
      (applicationStatusFilter === 'rejected' && app.status === 'rejected');
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

  const toggleProjectStatus = (proj: Project) => {
    const currentStatus = normalizeProjectStatus(proj.status);
    const nextStatus =
      currentStatus === 'active' ? 'paused' :
      currentStatus === 'paused' ? 'closed' :
      'active';

    updateProject(proj.id, { status: nextStatus as Project['status'] });
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
            <span className="text-slate-500 block text-[11px]">Contractor Slots Allocation</span>
            <span className="text-lg font-bold text-[#007AFF]">{totalSlotsFilled} <span className="text-xs text-slate-500 font-normal">/ {totalSlotsCapacity} filled</span></span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Incoming Applications</span>
            <span className="text-lg font-bold text-amber-600">{applications.length} candidates</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Application Tracking Pipeline</h2>
            <p className="text-[11px] text-slate-600">Monitor every candidate from first application to final test invite and resend history.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </select>
        </div>

        <div className="space-y-3">
          {filteredApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No applicants match the current filters.</div>
          ) : (
            filteredApplications.map((app) => {
              const project = projects.find((p) => p.id === app.projectId);
              const inviteHistory = app.inviteHistory || [];
              const statusLabel = app.status === 'rejected' ? 'Rejected' : app.inviteStatus === 'accepted' ? 'Accepted' : app.inviteStatus === 'invited' || app.status === 'approved' ? 'Invite sent' : 'Pending review';

              return (
                <div key={app.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#00A3E0] flex items-center justify-center text-sm font-black text-white">{app.testerName.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{app.testerName}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-slate-700 border-slate-200">{app.testerTier}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">{app.testerRating}★</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">{app.testerEmail}</p>
                        <p className="text-[11px] text-slate-600 mt-1">Project: <span className="text-slate-900 font-medium">{project?.title || app.projectId}</span></p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${app.status === 'rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200' : app.inviteStatus === 'accepted' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : app.status === 'approved' || app.inviteStatus === 'invited' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{statusLabel}</span>
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
                      </>
                    )}

                    {(app.status === 'approved' || app.inviteStatus === 'invited' || app.inviteStatus === 'accepted') && (
                      <button type="button" onClick={() => resendInvite(app.id)} className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:bg-sky-100">Resend Invite</button>
                    )}

                    {app.status === 'rejected' && <span className="text-[11px] text-slate-500">Rejected from this cycle.</span>}
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
          <span>Click any project to toggle active status or edit slots</span>
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
                        <span className="text-[10px] text-slate-500 block">Slots Capacity</span>
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
                      <button onClick={() => setEditingProject(project)} className="p-1.5 rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-600 transition border border-slate-200" title="Edit project listing"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => toggleProjectStatus(project)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {normalizeProjectStatus(project.status) === 'active' ? 'Pause' : normalizeProjectStatus(project.status) === 'paused' ? 'Close' : 'Activate'}
                      </button>

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
