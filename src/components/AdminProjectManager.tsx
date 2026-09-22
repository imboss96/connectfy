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
import { Project, ProjectTrack } from '../types';
import { AddProjectModal } from './AddProjectModal';

export const AdminProjectManager: React.FC = () => {
  const { projects, updateProject, deleteProject, applications, bugReports, taskSubmissions } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<'all' | ProjectTrack>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');
  const [editingSlotsId, setEditingSlotsId] = useState<string | null>(null);
  const [newSlotsInput, setNewSlotsInput] = useState<string>('');

  // Metrics
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const totalEscrowBudget = projects.reduce((acc, p) => acc + (p.totalBudget || 0), 0);
  const totalSlotsCapacity = projects.reduce((acc, p) => acc + (p.slotsTotal || 0), 0);
  const totalSlotsFilled = projects.reduce((acc, p) => acc + (p.slotsFilled || 0), 0);

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const matchesTrack = selectedTrackFilter === 'all' || p.projectTrack === selectedTrackFilter;
    const matchesStatus = selectedStatusFilter === 'all' || p.status === selectedStatusFilter;
    const matchesSearch =
      searchQuery === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTrack && matchesStatus && matchesSearch;
  });

  const toggleProjectStatus = (proj: Project) => {
    const nextStatus = proj.status === 'active' ? 'completed' : 'active';
    updateProject(proj.id, { status: nextStatus });
  };

  const handleSaveSlots = (projectId: string) => {
    const parsed = parseInt(newSlotsInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      updateProject(projectId, { slotsTotal: parsed });
    }
    setEditingSlotsId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      
      {/* Top Banner: Admin & Project Manager Portal */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00A3E0]/10 via-[#007AFF]/5 to-transparent pointer-events-none rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-[#007AFF]/10 border border-[#007AFF]/30 rounded-2xl text-[#00A3E0] shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Admin & Project Manager Operations
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#00A3E0]/20 text-[#38BDF8] border border-[#00A3E0]/30">
                  TTL / PM Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Add and curate freelance project listings, manage contractor slot quotas, inspect escrow budgets, and publish new QA & Data cycles.
              </p>
            </div>
          </div>

          {/* Primary Action Button: Add New Project */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 bg-[#007AFF] hover:bg-[#0066EE] text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-[#007AFF]/30 flex items-center justify-center space-x-2 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New Project to Listings</span>
          </button>
        </div>

        {/* Global Operational Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#1E2E4E] text-xs">
          <div className="bg-[#080D1A] p-3.5 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Active Marketplace Listings</span>
            <span className="text-lg font-bold text-white">
              {activeProjectsCount} <span className="text-xs text-slate-500 font-normal">/ {totalProjectsCount} total</span>
            </span>
          </div>

          <div className="bg-[#080D1A] p-3.5 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Total Escrow Committed</span>
            <span className="text-lg font-bold text-emerald-400">
              ${totalEscrowBudget.toLocaleString()}
            </span>
          </div>

          <div className="bg-[#080D1A] p-3.5 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Contractor Slots Allocation</span>
            <span className="text-lg font-bold text-[#00A3E0]">
              {totalSlotsFilled} <span className="text-xs text-slate-500 font-normal">/ {totalSlotsCapacity} filled</span>
            </span>
          </div>

          <div className="bg-[#080D1A] p-3.5 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Incoming Applications</span>
            <span className="text-lg font-bold text-amber-400">
              {applications.length} candidates
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listings by title, company, or domain..."
            className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#007AFF]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Track Filter */}
          <select
            value={selectedTrackFilter}
            onChange={(e) => setSelectedTrackFilter(e.target.value as any)}
            className="bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#007AFF]"
          >
            <option value="all">All Tracks</option>
            <option value="qa_functional">Software QA Cycles</option>
            <option value="data_collection">Voice / Data Collection</option>
            <option value="ai_evaluation">AI Model Evaluation</option>
            <option value="special_field">Special In-Field Audits</option>
            <option value="ux_research">User Research Sessions</option>
            <option value="localization">Localization</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#007AFF]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed / Closed</option>
          </select>

          {/* Launch Modal Trigger in Toolbar */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Listing</span>
          </button>
        </div>
      </div>

      {/* Projects Listings Table / Card Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing {filteredProjects.length} of {projects.length} project listings</span>
          <span>Click any project to toggle active status or edit slots</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center bg-[#0B132B] border border-[#1E2E4E] rounded-2xl space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Project Listings Match Criteria</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search query or filters, or add a brand new project to the marketplace.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white font-bold text-xs rounded-xl transition"
            >
              + Add New Project Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredProjects.map((project) => {
              const projectApps = applications.filter((a) => a.projectId === project.id);
              const projectBugs = bugReports.filter((b) => b.projectId === project.id);
              const projectTasks = taskSubmissions.filter((t) => t.projectId === project.id);
              const isActive = project.status === 'active';
              const isEditingThis = editingSlotsId === project.id;

              return (
                <div
                  key={project.id}
                  className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#007AFF]/50 transition shadow-sm"
                >
                  {/* Left: Info */}
                  <div className="flex items-start space-x-3.5">
                    <span className="text-3xl p-2.5 rounded-xl bg-[#080D1A] border border-[#1E2E4E] shrink-0">
                      {project.companyLogo || '🧪'}
                    </span>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          {project.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {project.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#007AFF]/10 text-[#38BDF8] border border-[#007AFF]/20">
                          {project.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">
                        Client: <strong className="text-slate-200">{project.company}</strong> • Track: <span className="text-slate-300 font-medium">{(project.projectTrack || 'qa_functional').replace('_', ' ')}</span> • Created: {project.createdAt}
                      </p>

                      <p className="text-xs text-slate-300 line-clamp-1 max-w-2xl pt-0.5">
                        {project.shortDescription}
                      </p>

                      {/* Device Badges */}
                      <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                        {project.requiredDevices.map((d, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-[#080D1A] border border-[#1E2E4E] text-slate-300"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex flex-wrap md:flex-col items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#1E2E4E]">
                    {/* Numbers */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Total Budget</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          ${project.totalBudget.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Slots Capacity</span>
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              value={newSlotsInput}
                              onChange={(e) => setNewSlotsInput(e.target.value)}
                              className="w-16 bg-[#080D1A] border border-[#007AFF] rounded px-1.5 py-0.5 text-xs text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveSlots(project.id)}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingSlotsId(project.id);
                              setNewSlotsInput(String(project.slotsTotal));
                            }}
                            className="font-bold text-white hover:text-[#00A3E0] flex items-center gap-1 group text-sm"
                            title="Click to edit slots"
                          >
                            <span>{project.slotsFilled}/{project.slotsTotal}</span>
                            <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-[#00A3E0]" />
                          </button>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Applicants</span>
                        <span className="font-bold text-amber-400 text-sm">
                          {projectApps.length}
                        </span>
                      </div>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleProjectStatus(project)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          isActive
                            ? 'bg-[#111C33] hover:bg-amber-950/30 text-amber-300 border-amber-500/30'
                            : 'bg-[#111C33] hover:bg-emerald-950/30 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isActive ? 'Pause / Close' : 'Activate'}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${project.title}" from the listings?`)) {
                            deleteProject(project.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#111C33] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition border border-[#1E2E4E]"
                        title="Remove project listing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
