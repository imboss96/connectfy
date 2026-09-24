import React, { useState } from 'react';
import {
  Search,
  Filter,
  DollarSign,
  Smartphone,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  X,
  AlertCircle,
  Mic,
  Brain,
  MapPin,
  Eye,
  Bug,
  Info,
  Layers,
  FileCheck,
  Plus,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isProjectOpenForApplications } from '../lib/projectStatus';
import { Project, DeviceType, ProjectCategory, ProjectTrack } from '../types';
import { AddProjectModal } from './AddProjectModal';
import { ProjectIcon } from './ProjectIcon';

interface ProjectBoardProps {
  onOpenWorkspace: (projectId: string) => void;
}

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ onOpenWorkspace }) => {
  const {
    projects,
    applications,
    testerProfile,
    applyToProject,
    acceptInvite,
    addTesterDevice,
    role
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  
  // Project detail modal
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  
  // Apply modal
  const [applyingProject, setApplyingProject] = useState<Project | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [experienceNote, setExperienceNote] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(false);
  const [deviceDraft, setDeviceDraft] = useState({
    category: 'Smartphone' as 'Smartphone' | 'Tablet' | 'Computer' | 'Smart TV' | 'Wearable' | 'Console',
    brand: '',
    model: '',
    os: 'iOS',
    osVersion: '',
    isJailbroken: false,
    isPrimary: false,
    isActive: true,
    carrier: '',
    isp: ''
  });
  const [deviceFormError, setDeviceFormError] = useState('');

  const tracks: { id: string; label: string; icon: any }[] = [
    { id: 'all', label: 'All Opportunities', icon: Layers },
    { id: 'data_collection', label: 'AI Data Collection', icon: Mic },
    { id: 'ai_evaluation', label: 'AI Red Teaming & Eval', icon: Brain },
    { id: 'qa_functional', label: 'Functional QA & Bug Bounty', icon: Bug },
    { id: 'special_field', label: 'In-Field & Mystery Audits', icon: MapPin },
    { id: 'ux_research', label: 'UX Research Sessions', icon: Eye }
  ];

  const categories: ProjectCategory[] = [
    'Payment & Checkout',
    'Functional',
    'Usability',
    'Localization',
    'Security',
    'Exploratory'
  ];

  const devicesList: DeviceType[] = [
    'iOS Mobile',
    'Android Mobile',
    'macOS',
    'Windows',
    'iPad / Tablet',
    'Smart TV',
    'Wearable'
  ];

  // Filtering
  const filteredProjects = projects.filter((proj) => {
    if (!isProjectOpenForApplications(proj)) return false;

    const matchesSearch =
      proj.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proj.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proj.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTrack =
      selectedTrack === 'all' || proj.projectTrack === selectedTrack;

    const matchesCategory =
      selectedCategory === 'all' || proj.category === selectedCategory;

    const matchesDevice =
      selectedDevice === 'all' ||
      proj.requiredDevices.includes(selectedDevice as DeviceType);

    return matchesSearch && matchesTrack && matchesCategory && matchesDevice;
  });

  const getApplicationForProject = (projectId: string) => {
    return applications.find(
      (a) => a.projectId === projectId && a.testerId === testerProfile.id
    );
  };

  const handleOpenApplyModal = (project: Project) => {
    if (!isProjectOpenForApplications(project)) {
      setApplyError('This project is no longer accepting applications.');
      return;
    }

    setApplyingProject(project);
    setSelectedDevices(testerProfile.devices.slice(0, 2));

    if (project.projectTrack === 'data_collection') {
      setExperienceNote('Native speaker with quiet recording studio (<25dB) & directional mic setup.');
    } else if (project.projectTrack === 'ai_evaluation') {
      setExperienceNote('Experienced prompt red teamer with expertise in safety boundaries & compliance stress testing.');
    } else if (project.projectTrack === 'special_field') {
      setExperienceNote('Equipped with active contactless payment cards and within reach of target retail merchants.');
    } else {
      setExperienceNote(`Experienced QA tester specializing in ${project.category} verification.`);
    }

    setApplyError('');
    setApplySuccess(false);
  };

  const handleToggleDevice = (d: string) => {
    if (selectedDevices.includes(d)) {
      if (selectedDevices.length === 1) return;
      setSelectedDevices(selectedDevices.filter((item) => item !== d));
    } else {
      setSelectedDevices([...selectedDevices, d]);
    }
  };

  const handleAddInlineDevice = () => {
    const brand = deviceDraft.brand.trim();
    const model = deviceDraft.model.trim();
    const osVersion = deviceDraft.osVersion.trim();

    if (!brand || !model || !osVersion) {
      setDeviceFormError('Please fill in the brand, model, and OS version for the device.');
      return;
    }

    const newDeviceLabel = `${brand} ${model} (${deviceDraft.os} ${osVersion})`;
    addTesterDevice({
      category: deviceDraft.category,
      brand,
      model,
      os: deviceDraft.os,
      osVersion,
      carrier: deviceDraft.carrier.trim(),
      isp: deviceDraft.isp.trim(),
      isJailbroken: deviceDraft.isJailbroken,
      isPrimary: deviceDraft.isPrimary,
      isActive: deviceDraft.isActive
    });

    setSelectedDevices(prev => (prev.includes(newDeviceLabel) ? prev : [...prev, newDeviceLabel]));
    setDeviceDraft({
      category: 'Smartphone',
      brand: '',
      model: '',
      os: 'iOS',
      osVersion: '',
      isJailbroken: false,
      isPrimary: false,
      isActive: true,
      carrier: '',
      isp: ''
    });
    setDeviceFormError('');
    setShowAddDeviceForm(false);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingProject) return;

    if (selectedDevices.length === 0) {
      setApplyError('Please choose at least one device you will use.');
      return;
    }

    const ok = await applyToProject(applyingProject.id, selectedDevices, experienceNote);
    if (ok) {
      setApplySuccess(true);
      setTimeout(() => {
        setApplyingProject(null);
        setApplySuccess(false);
      }, 1400);
    } else {
      setApplyError('You have already applied for this campaign.');
    }
  };

  const getTrackBadge = (track?: ProjectTrack) => {
    switch (track) {
      case 'data_collection':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Data Collection
          </span>
        );
      case 'ai_evaluation':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <Brain className="w-3 h-3" /> AI Red Teaming
          </span>
        );
      case 'special_field':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Field Audit
          </span>
        );
      case 'ux_research':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Eye className="w-3 h-3" /> UX Research
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00A3E0]/15 text-[#00A3E0] border border-[#00A3E0]/30 flex items-center gap-1">
            <Bug className="w-3 h-3 text-[#00A3E0]" /> Functional QA
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 relative overflow-hidden w-full max-w-full shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight break-words">
                Freelance Opportunities & Test Cycles
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00A3E0]/15 text-[#00A3E0] border border-[#00A3E0]/30 shrink-0">
                {projects.length} Active Cycles
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Browse freelance testing, AI prompt evaluation, voice data recording, and mystery shopping audits. Apply, get invited, submit deliverables, and get credited.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#00A3E0] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects, companies..."
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
              />
            </div>

            <button
              onClick={() => setIsAddProjectModalOpen(true)}
              className="px-3.5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-md shadow-[#007AFF]/25 shrink-0 whitespace-nowrap active:scale-95"
              title="Add a new project to listings (Admins, PMs, and Clients)"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Post Project</span>
            </button>
          </div>
        </div>

        {/* Track Category Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#1E2E4E] w-full max-w-full overflow-hidden">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none w-full min-w-0">
            {tracks.map((t) => {
              const Icon = t.icon;
              const isSelected = selectedTrack === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrack(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shrink-0 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/30'
                      : 'bg-[#080D1A] text-slate-300 border border-[#1E2E4E] hover:text-white hover:border-[#00A3E0]/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#00A3E0]'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs w-full min-w-0">
          <span className="text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#00A3E0]" /> Filter by:
          </span>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#080D1A] border border-[#1E2E4E] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A3E0] flex-1 sm:flex-none min-w-[130px]"
          >
            <option value="all">All Specialties</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="bg-[#080D1A] border border-[#1E2E4E] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A3E0] flex-1 sm:flex-none min-w-[130px]"
          >
            <option value="all">All Hardware</option>
            {devicesList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {(selectedTrack !== 'all' || selectedCategory !== 'all' || selectedDevice !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedTrack('all');
                setSelectedCategory('all');
                setSelectedDevice('all');
                setSearchTerm('');
              }}
              className="text-xs text-[#00A3E0] hover:text-[#38BDF8] underline ml-1 shrink-0 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0">
        {filteredProjects.map((project) => {
          const app = getApplicationForProject(project.id);
          const hasApplied = !!app;
          const isApproved = app?.status === 'approved';
          const isInvited = app?.inviteStatus === 'invited';
          const isAccepted = app?.inviteStatus === 'accepted';
          const isRejected = app?.status === 'rejected';

          const isQA = !project.projectTrack || project.projectTrack === 'qa_functional';

          const slotPercentage = Math.round(
            (project.slotsFilled / project.slotsTotal) * 100
          );

          return (
            <div
              key={project.id}
              className="bg-[#0B132B] border border-[#1E2E4E] hover:border-[#00A3E0]/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition group shadow-md hover:shadow-xl min-w-0 overflow-hidden"
            >
              <div>
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl p-2 bg-[#080D1A] rounded-xl border border-[#1E2E4E] shrink-0">
                      <ProjectIcon name={project.companyLogo} className="h-6 w-6 text-[#00A3E0]" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        {getTrackBadge(project.projectTrack)}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {project.category}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-base group-hover:text-[#00A3E0] transition leading-snug">
                        {project.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {project.company} • {project.supportedCountries.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-4">
                  {project.shortDescription}
                </p>

                {/* Device tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {project.requiredDevices.map((d) => (
                    <span
                      key={d}
                      className="px-2 py-0.5 rounded-md bg-[#080D1A] border border-[#1E2E4E] text-[11px] text-slate-300 flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3 text-[#00A3E0]" />
                      {d}
                    </span>
                  ))}
                </div>

                {/* Bounty / Rate Card Display */}
                {isQA ? (
                  <div className="bg-[#080D1A] p-3 rounded-xl border border-[#1E2E4E] mb-4 text-xs">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex justify-between">
                      <span>Approved Defect Bounty Structure:</span>
                      <span className="text-emerald-400 font-bold">
                        Up to ${project.bountyStructure.critical}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                      <div className="bg-[#111C33] p-1 rounded border border-[#1E2E4E]">
                        <span className="text-rose-400 block font-bold">Crit</span>
                        <span className="text-white font-semibold">${project.bountyStructure.critical}</span>
                      </div>
                      <div className="bg-[#111C33] p-1 rounded border border-[#1E2E4E]">
                        <span className="text-amber-400 block font-bold">High</span>
                        <span className="text-white font-semibold">${project.bountyStructure.high}</span>
                      </div>
                      <div className="bg-[#111C33] p-1 rounded border border-[#1E2E4E]">
                        <span className="text-[#00A3E0] block font-bold">Med</span>
                        <span className="text-white font-semibold">${project.bountyStructure.medium}</span>
                      </div>
                      <div className="bg-[#111C33] p-1 rounded border border-[#1E2E4E]">
                        <span className="text-emerald-400 block font-bold">Run</span>
                        <span className="text-white font-semibold">${project.bountyStructure.testCaseBounty}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#f3ebff] p-3.5 rounded-xl border border-[#d8c8ff] mb-4 text-xs space-y-1.5 shadow-inner shadow-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-violet-900">
                        Test Case / Bundle Amount:
                      </span>
                      <span className="text-sm font-black text-emerald-800">
                        ${project.bountyStructure.testCaseBounty || project.taskRate?.toFixed(2) || '45.00'} / bundle
                      </span>
                    </div>
                    {project.deliverablesGuide && (
                      <p className="text-[11px] text-slate-800 line-clamp-1">
                        Format: <strong className="text-slate-900">{project.deliverablesGuide.fileFormat}</strong> • Min Samples: <strong className="text-slate-900">{project.deliverablesGuide.sampleCountRequired} items</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Slot Capacity & Deadline */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#00A3E0]" />
                    <span>Closes: {project.deadline}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-300">
                      {project.slotsFilled}/{project.slotsTotal} slots
                    </span>
                    <div className="w-16 bg-[#080D1A] rounded-full h-1.5 overflow-hidden border border-[#1E2E4E]">
                      <div
                        className="bg-[#007AFF] h-full rounded-full"
                        style={{ width: `${slotPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions based on Freelance Scope */}
              <div className="pt-3 border-t border-[#1E2E4E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  onClick={() => setViewingProject(project)}
                  className="text-xs text-[#00A3E0] hover:text-[#38BDF8] transition font-medium text-center sm:text-left py-1"
                >
                  View Scope & Guide
                </button>

                {/* Status-adaptive action button */}
                {isAccepted ? (
                  <button
                    onClick={() => onOpenWorkspace(project.id)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : isInvited ? (
                  <button
                    onClick={() => acceptInvite(app.id)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center justify-center space-x-1.5 transition shadow animate-pulse"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Invite Ready! Accept & Start</span>
                  </button>
                ) : hasApplied && isApproved ? (
                  <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                ) : hasApplied && isRejected ? (
                  <span className="text-xs font-semibold text-slate-500 text-center sm:text-left py-1">
                    Not Selected
                  </span>
                ) : hasApplied ? (
                  <span className="inline-flex items-center justify-center sm:justify-start gap-1 text-xs font-semibold text-amber-400/90 py-1">
                    <Clock className="w-3.5 h-3.5" /> Application Pending
                  </span>
                ) : (
                  <button
                    onClick={() => handleOpenApplyModal(project)}
                    className="px-4 py-2.5 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm shadow-[#007AFF]/30"
                  >
                    <span>Apply for Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Details Modal */}
      {viewingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ProjectIcon name={viewingProject.companyLogo} className="h-7 w-7 text-[#00A3E0]" />
                <div>
                  <div className="flex items-center gap-2">
                    {getTrackBadge(viewingProject.projectTrack)}
                    <span className="text-xs text-slate-500">{viewingProject.company}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {viewingProject.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setViewingProject(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs bg-white">
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Campaign Overview</h4>
                <p className="text-slate-600 leading-relaxed">
                  {viewingProject.fullOverview}
                </p>
              </div>

              {viewingProject.resources && viewingProject.resources.length > 0 && (
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                  <h4 className="font-semibold text-sky-800 mb-2">Project Resources</h4>
                  <div className="space-y-1.5">
                    {viewingProject.resources.map((resource) => (
                      <a key={`${resource.label}-${resource.url}`} href={resource.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sky-700 hover:text-sky-900 underline underline-offset-2">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>{resource.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliverables Guide if non-QA */}
              {viewingProject.deliverablesGuide && (
                <div className="p-4 bg-[#f3ebff] border border-[#d8c8ff] rounded-xl space-y-3 text-slate-800">
                  <div className="flex items-center space-x-2 text-violet-700 font-semibold">
                    <Info className="w-4 h-4" />
                    <span>Deliverable Specifications & Quality Gates</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-700">
                    {viewingProject.deliverablesGuide.instructions}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Format:</span>
                      <strong className="text-slate-900">{viewingProject.deliverablesGuide.fileFormat}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Required Samples:</span>
                      <strong className="text-slate-900">{viewingProject.deliverablesGuide.sampleCountRequired} items</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Settlement Rate:</span>
                      <strong className="text-emerald-700">${viewingProject.taskRate?.toFixed(2)} / batch</strong>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="font-semibold text-violet-700 block mb-1 text-[11px]">Acceptance Criteria:</span>
                    <ul className="space-y-1 text-slate-700 text-[11px]">
                      {viewingProject.deliverablesGuide.acceptanceCriteria.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-emerald-600 block mb-1.5">
                    In-Scope Requirements:
                  </span>
                  <ul className="space-y-1 text-slate-700 list-disc list-inside">
                    {viewingProject.inScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-rose-600 block mb-1.5">
                    Out of Scope:
                  </span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside">
                    {viewingProject.outOfScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Payment breakdown */}
              {viewingProject.projectTrack === 'qa_functional' ? (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Bounty Structure</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Critical Defect</span>
                      <span className="text-rose-500 font-bold text-sm">
                        ${viewingProject.bountyStructure.critical}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">High Defect</span>
                      <span className="text-amber-500 font-bold text-sm">
                        ${viewingProject.bountyStructure.high}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Medium Defect</span>
                      <span className="text-blue-500 font-bold text-sm">
                        ${viewingProject.bountyStructure.medium}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Test Run Bounty</span>
                      <span className="text-emerald-600 font-bold text-sm">
                        ${viewingProject.bountyStructure.testCaseBounty}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-violet-50 rounded-xl border border-violet-200">
                  <h4 className="font-semibold text-violet-700 mb-1">Bundle / Slot Payout</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Test Case / Bundle Amount</span>
                    <span className="font-black text-emerald-700">
                      ${viewingProject.bountyStructure.testCaseBounty || viewingProject.taskRate?.toFixed(2) || '45.00'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-600">
                Total Campaign Budget: ${viewingProject.totalBudget.toLocaleString()}
              </span>
              <button
                onClick={() => {
                  const proj = viewingProject;
                  setViewingProject(null);
                  handleOpenApplyModal(proj);
                }}
                className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl transition shadow-sm shadow-[#007AFF]/30"
              >
                Apply for Opportunity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Project Modal */}
      {applyingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#00A3E0]" />
                <h3 className="font-bold text-slate-900 text-base">Submit Application</h3>
              </div>
              <button
                onClick={() => setApplyingProject(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Application Submitted!</h4>
                <p className="text-xs text-slate-600">
                  {applyingProject.company} will review your profile & fleet hardware. You will receive an invite notification once approved.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitApplication} className="space-y-4 text-xs">
                {applyError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{applyError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Opportunity:</span>
                  <p className="font-semibold text-slate-900">{applyingProject.title}</p>
                  <p className="text-[#00A3E0]">{applyingProject.company} • {applyingProject.category}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Select Your Hardware / Fleet for this Project:
                  </label>

                  {testerProfile.devices.length === 0 && !showAddDeviceForm ? (
                    <div className="p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-600">
                      <p className="font-medium text-slate-700 mb-2">No devices saved yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddDeviceForm(true)}
                        className="px-3 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-[11px] font-bold rounded-lg"
                      >
                        Add Device
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {testerProfile.devices.map((device) => {
                          const isChecked = selectedDevices.includes(device);
                          return (
                            <button
                              key={device}
                              type="button"
                              onClick={() => handleToggleDevice(device)}
                              className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition ${
                                isChecked
                                  ? 'bg-[#007AFF]/10 border-[#00A3E0] text-[#0066EE]'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <Smartphone className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{device}</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDeviceFormError('');
                          setShowAddDeviceForm(prev => !prev);
                        }}
                        className="text-[11px] font-semibold text-[#00A3E0] hover:text-[#38BDF8]"
                      >
                        {showAddDeviceForm ? 'Cancel device form' : '+ Add another device'}
                      </button>
                    </div>
                  )}

                  {showAddDeviceForm && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                      {deviceFormError && (
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px]">
                          {deviceFormError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={deviceDraft.category}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, category: e.target.value as any }))}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#00A3E0]"
                        >
                          <option value="Smartphone">Smartphone</option>
                          <option value="Tablet">Tablet</option>
                          <option value="Computer">Computer</option>
                          <option value="Smart TV">Smart TV</option>
                          <option value="Wearable">Wearable</option>
                          <option value="Console">Console</option>
                        </select>

                        <select
                          value={deviceDraft.os}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, os: e.target.value }))}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#00A3E0]"
                        >
                          <option value="iOS">iOS</option>
                          <option value="Android">Android</option>
                          <option value="macOS">macOS</option>
                          <option value="Windows">Windows</option>
                          <option value="tvOS">tvOS</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={deviceDraft.brand}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="Brand"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                        <input
                          type="text"
                          value={deviceDraft.model}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="Model"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={deviceDraft.osVersion}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, osVersion: e.target.value }))}
                          placeholder="OS version"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                        <input
                          type="text"
                          value={deviceDraft.carrier}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, carrier: e.target.value }))}
                          placeholder="Carrier (optional)"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={deviceDraft.isJailbroken}
                            onChange={(e) => setDeviceDraft(prev => ({ ...prev, isJailbroken: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          Jailbroken / rooted
                        </label>

                        <button
                          type="button"
                          onClick={handleAddInlineDevice}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg"
                        >
                          Save Device
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qualifications & Relevant Experience Note:
                  </label>
                  <textarea
                    rows={3}
                    value={experienceNote}
                    onChange={(e) => setExperienceNote(e.target.value)}
                    placeholder="Describe your testing experience or data collection capabilities..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-[#00A3E0]"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Freelancer Scope & Payout Commitment</span>
                  </div>
                  <p>
                    Once approved and your task deliverable or defect is validated, your bounty will automatically credit to your wallet balance for direct payout transfer.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingProject(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white font-bold rounded-xl shadow transition shadow-[#007AFF]/30"
                  >
                    Confirm & Send Application
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal for Admins & PMs */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
      />
    </div>
  );
};
