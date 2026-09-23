import React, { useState } from 'react';
import {
  Layers,
  Users,
  CheckCircle2,
  DollarSign,
  Plus,
  Bug,
  Clock,
  Sparkles,
  Paperclip,
  Star,
  X,
  AlertTriangle,
  FileText,
  ClipboardCheck,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Send,
  ThumbsUp,
  RotateCcw,
  Upload,
  Mic,
  Brain,
  MapPin,
  Eye,
  Filter,
  Volume2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectIcon } from './ProjectIcon';
import {
  BugReport,
  TaskSubmission,
  ProjectApplication,
  Project,
  AttachmentFile,
  BugSeverity,
  DeviceType,
  ProjectCategory,
  ProjectTrack,
  PaymentModel
} from '../types';
import { DocumentViewerModal } from './DocumentViewerModal';

export const ClientDashboard: React.FC = () => {
  const {
    clientProfile,
    projects,
    applications,
    bugReports,
    taskSubmissions,
    approveApplication,
    rejectApplication,
    resendInvite,
    approveBugReport,
    rejectBugReport,
    requestBugRevision,
    approveTaskSubmission,
    rejectTaskSubmission,
    requestTaskRevision,
    createProject
  } = useApp();

  const [activeTab, setActiveTab] = useState<'submissions' | 'applicants' | 'cycles'>('submissions');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'tasks' | 'bugs'>('all');
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentFile | null>(null);

  // Bug Approval modal state
  const [approvingBug, setApprovingBug] = useState<BugReport | null>(null);
  const [customBounty, setCustomBounty] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('Approved. Clear reproduction steps and accurate logs.');
  const [rating, setRating] = useState<number>(5);

  // Bug Reject / Revision modal state
  const [actionBug, setActionBug] = useState<{ bug: BugReport; type: 'revision' | 'reject' } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Task Deliverable Approval modal state
  const [approvingTask, setApprovingTask] = useState<TaskSubmission | null>(null);
  const [taskBounty, setTaskBounty] = useState<string>('');
  const [taskFeedback, setTaskFeedback] = useState<string>('Approved. Pristine dataset meeting all format and quality guidelines.');
  const [taskRating, setTaskRating] = useState<number>(5);

  // Task Deliverable Reject / Revision modal state
  const [actionTask, setActionTask] = useState<{ task: TaskSubmission; type: 'revision' | 'reject' } | null>(null);
  const [actionTaskReason, setActionTaskReason] = useState('');

  // Create Project modal
  const [isCreateCycleOpen, setIsCreateCycleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState(clientProfile.company);
  const [newCategory, setNewCategory] = useState<ProjectCategory>('Functional');
  const [newTrack, setNewTrack] = useState<ProjectTrack>('qa_functional');
  const [newPaymentModel, setNewPaymentModel] = useState<PaymentModel>('per_approved_bug');
  const [newOverview, setNewOverview] = useState('');
  const [newTaskRate, setNewTaskRate] = useState('45');
  const [newDeliverableFormat, setNewDeliverableFormat] = useState('44.1kHz 16-bit WAV');
  const [newDeliverableCount, setNewDeliverableCount] = useState('30');
  const [newCritBounty, setNewCritBounty] = useState('75');
  const [newHighBounty, setNewHighBounty] = useState('40');
  const [newMedBounty, setNewMedBounty] = useState('20');
  const [newLowBounty, setNewLowBounty] = useState('10');
  const [newBudget, setNewBudget] = useState('4000');
  const [newSlots, setNewSlots] = useState('25');
  const [newDeadline, setNewDeadline] = useState('2026-10-30');

  // Review counts
  const pendingBugs = bugReports.filter((b) => b.status === 'under_review');
  const pendingTasks = taskSubmissions.filter((t) => t.status === 'under_review');
  const totalPendingSubmissions = pendingBugs.length + pendingTasks.length;
  const pendingApplicants = applications.filter((a) => a.status === 'pending');

  const handleOpenApproveModal = (bug: BugReport) => {
    setApprovingBug(bug);
    setCustomBounty(bug.bountyEarned.toString());
    setFeedback('Approved. Excellent documentation and clean reproduction steps.');
    setRating(5);
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingBug) return;
    const bounty = parseFloat(customBounty) || approvingBug.bountyEarned;
    approveBugReport(approvingBug.id, bounty, feedback, rating);
    setApprovingBug(null);
  };

  const handleConfirmAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionBug) return;
    if (actionBug.type === 'revision') {
      requestBugRevision(actionBug.bug.id, actionReason || 'Please provide additional device log details.');
    } else {
      rejectBugReport(actionBug.bug.id, actionReason || 'Defect does not match in-scope criteria.');
    }
    setActionBug(null);
    setActionReason('');
  };

  const handleOpenApproveTaskModal = (task: TaskSubmission) => {
    setApprovingTask(task);
    setTaskBounty(task.bountyEarned.toString());
    setTaskFeedback('Approved. Dataset ingested and validated successfully.');
    setTaskRating(5);
  };

  const handleConfirmTaskApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingTask) return;
    const bounty = parseFloat(taskBounty) || approvingTask.bountyEarned;
    approveTaskSubmission(approvingTask.id, bounty, taskFeedback, taskRating);
    setApprovingTask(null);
  };

  const handleConfirmTaskAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTask) return;
    if (actionTask.type === 'revision') {
      requestTaskRevision(actionTask.task.id, actionTaskReason || 'Please re-upload recording with lowered noise floor.');
    } else {
      rejectTaskSubmission(actionTask.task.id, actionTaskReason || 'Deliverable does not meet project requirements.');
    }
    setActionTask(null);
    setActionTaskReason('');
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createProject({
      title: newTitle,
      company: newCompany || 'Enterprise Client',
      companyLogo: newTrack === 'data_collection' ? 'voice' : newTrack === 'ai_evaluation' ? 'ai' : newTrack === 'special_field' ? 'location' : 'speed',
      category: newCategory,
      projectTrack: newTrack,
      paymentModel: newTrack === 'qa_functional' ? 'per_approved_bug' : newPaymentModel,
      taskRate: parseFloat(newTaskRate) || 45,
      shortDescription: newOverview.substring(0, 120) || 'Active marketplace opportunity.',
      fullOverview: newOverview || 'Full freelance campaign scope.',
      deliverablesGuide: newTrack !== 'qa_functional' ? {
        instructions: `Collect and submit verified data deliverables according to standard quality gates.`,
        fileFormat: newDeliverableFormat,
        sampleCountRequired: parseInt(newDeliverableCount) || 20,
        acceptanceCriteria: [
          'High acoustic/visual fidelity',
          'Strict adherence to format guidelines',
          'Zero synthetic artifacts'
        ]
      } : undefined,
      inScope: [
        'Core functional execution flows',
        'Device state recovery',
        'High quality verified submissions'
      ],
      outOfScope: ['Off-spec data submissions', 'Third-party OS glitches'],
      requiredDevices: ['iOS Mobile', 'Android Mobile'],
      supportedCountries: ['Global'],
      slotsTotal: parseInt(newSlots) || 20,
      deadline: newDeadline,
      status: 'active',
      bountyStructure: {
        critical: parseFloat(newCritBounty) || 75,
        high: parseFloat(newHighBounty) || 40,
        medium: parseFloat(newMedBounty) || 20,
        low: parseFloat(newLowBounty) || 10,
        testCaseBounty: 15
      },
      totalBudget: parseFloat(newBudget) || 3000,
      clientId: clientProfile.id
    });

    setIsCreateCycleOpen(false);
    setActiveTab('cycles');
  };

  return (
    <div className="theme-client space-y-6">
      {/* Top Banner / Client KPI */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <ProjectIcon name={clientProfile.companyLogo} className="h-8 w-8 text-[#00A3E0]" />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {clientProfile.company}
                </h1>
                <p className="text-xs text-slate-400">
                  Freelance Marketplace & QA Cycle Control Hub • {clientProfile.contactPerson}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreateCycleOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Launch New Project / Track</span>
            </button>
          </div>
        </div>

        {/* Client KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Protected Escrow Pool</span>
            <span className="text-base sm:text-lg font-black text-white">
              ${clientProfile.escrowBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Disbursed Payouts</span>
            <span className="text-base sm:text-lg font-black text-emerald-400">
              ${clientProfile.totalPaidOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Pending Submissions Queue</span>
            <span className="text-base sm:text-lg font-black text-amber-400">
              {totalPendingSubmissions} to Review
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Active Opportunities</span>
            <span className="text-base sm:text-lg font-black text-blue-400">
              {projects.length} Campaigns
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 sm:space-x-6 text-xs sm:text-sm overflow-x-auto scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
            activeTab === 'submissions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Submissions & Approvals ({totalPendingSubmissions})</span>
          {totalPendingSubmissions > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-bold">
              {totalPendingSubmissions}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('applicants')}
          className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
            activeTab === 'applicants'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Applicant Vetting ({applications.length})</span>
          {pendingApplicants.length > 0 && (
            <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-bold">
              {pendingApplicants.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cycles')}
          className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
            activeTab === 'cycles'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Projects & Escrow Budgets ({projects.length})</span>
        </button>
      </div>

      {/* Tab 1: Submissions Review */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-white">Freelancer Work & Defect Review Queue</h3>
              <p className="text-xs text-slate-400">
                Inspect deliverable files and bug proofs. Approving immediately credits earnings into the freelancer's wallet account.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> View:
              </span>
              <button
                onClick={() => setSubmissionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  submissionFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                All ({bugReports.length + taskSubmissions.length})
              </button>
              <button
                onClick={() => setSubmissionFilter('tasks')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  submissionFilter === 'tasks'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Task Deliverables ({taskSubmissions.length})
              </button>
              <button
                onClick={() => setSubmissionFilter('bugs')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  submissionFilter === 'bugs'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Bug Defects ({bugReports.length})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Task Deliverables List */}
            {(submissionFilter === 'all' || submissionFilter === 'tasks') &&
              taskSubmissions.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const isApproved = task.status === 'approved';
                const isReview = task.status === 'under_review';
                const isChanges = task.status === 'changes_requested';
                const isRejected = task.status === 'rejected';

                return (
                  <div
                    key={task.id}
                    className={`p-5 rounded-2xl border transition space-y-4 ${
                      isReview
                        ? 'bg-slate-900 border-purple-500/40 shadow-md'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="p-2.5 rounded-xl shrink-0 mt-1 bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {task.taskType === 'data_collection' && <Mic className="w-5 h-5" />}
                          {task.taskType === 'ai_evaluation' && <Brain className="w-5 h-5" />}
                          {task.taskType === 'special_field' && <MapPin className="w-5 h-5" />}
                          {task.taskType === 'ux_research' && <Eye className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-white">
                              {task.title}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                              {task.taskType.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-purple-400">
                              Freelancer: {task.testerName}
                            </span>
                            <span>•</span>
                            <span>Project: {project?.title || task.projectId}</span>
                            <span>•</span>
                            <span>Submitted: {task.submittedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-start">
                        <div className="text-right">
                          <div className="text-base font-black text-emerald-400">
                            ${task.bountyEarned.toFixed(2)}
                          </div>
                          <span
                            className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                              isApproved
                                ? 'text-emerald-400'
                                : isReview
                                ? 'text-amber-400'
                                : isChanges
                                ? 'text-purple-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isReview && <Clock className="w-3.5 h-3.5" />}
                            {isApproved
                              ? 'Approved & Paid'
                              : isReview
                              ? 'Needs Client Review'
                              : isChanges
                              ? 'Revision Requested'
                              : 'Rejected'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deliverable Details & Metadata */}
                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                      <div className="font-semibold text-slate-300">Methodology & Submission Notes:</div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {task.details}
                      </p>

                      {task.metadata && Object.keys(task.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                          {task.metadata.sampleCount && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              Sample Count: <strong className="text-white">{task.metadata.sampleCount}</strong>
                            </span>
                          )}
                          {task.metadata.languageOrDialect && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
                              Dialect: <strong className="text-white">{task.metadata.languageOrDialect}</strong>
                            </span>
                          )}
                          {task.metadata.audioEnvironment && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              Acoustics: <strong className="text-white">{task.metadata.audioEnvironment}</strong>
                            </span>
                          )}
                          {task.metadata.storeLocationOrMerchant && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                              Store: <strong className="text-white">{task.metadata.storeLocationOrMerchant}</strong>
                            </span>
                          )}
                          {task.metadata.deviceUsed && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              Hardware: {task.metadata.deviceUsed}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attached files */}
                    {task.attachments.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5" /> Deliverable Files ({task.attachments.length}):
                        </span>
                        {task.attachments.map((att) => (
                          <button
                            key={att.id}
                            onClick={() => setSelectedAttachment(att)}
                            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition"
                          >
                            {att.type.startsWith('audio/') ? (
                              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span className="text-[11px] font-medium">{att.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action Bar for Client */}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">
                        {isApproved && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Bounty of ${task.bountyEarned.toFixed(2)} disbursed into {task.testerName}'s balance.
                          </span>
                        )}
                        {isChanges && (
                          <span className="text-purple-400 font-semibold">
                            Revision requested from freelancer.
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-rose-400 font-semibold">
                            Deliverable rejected.
                          </span>
                        )}
                      </div>

                      {isReview && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setActionTask({ task, type: 'reject' })}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/30 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-lg transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setActionTask({ task, type: 'revision' })}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200 text-xs font-semibold rounded-lg transition"
                          >
                            Request Revision
                          </button>
                          <button
                            onClick={() => handleOpenApproveTaskModal(task)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1.5 transition"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Approve Deliverable & Credit (${task.bountyEarned.toFixed(2)})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Bug Reports List */}
            {(submissionFilter === 'all' || submissionFilter === 'bugs') &&
              bugReports.map((bug) => {
                const project = projects.find((p) => p.id === bug.projectId);
                const isApproved = bug.status === 'approved';
                const isReview = bug.status === 'under_review';
                const isChanges = bug.status === 'changes_requested';
                const isRejected = bug.status === 'rejected';

                return (
                  <div
                    key={bug.id}
                    className={`p-5 rounded-2xl border transition space-y-4 ${
                      isReview
                        ? 'bg-slate-900 border-rose-500/40 shadow-md'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 mt-1 ${
                            bug.severity === 'Critical'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : bug.severity === 'High'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          <Bug className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-white">
                              {bug.title}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-rose-300 border border-slate-700">
                              {bug.severity}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {bug.bugType}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-blue-400">
                              Tester: {bug.testerName}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                              {bug.device}
                            </span>
                            <span>•</span>
                            <span>{project?.title || bug.featureArea}</span>
                            <span>•</span>
                            <span>Submitted: {bug.submittedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-start">
                        <div className="text-right">
                          <div className="text-base font-black text-emerald-400">
                            ${bug.bountyEarned.toFixed(2)}
                          </div>
                          <span
                            className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                              isApproved
                                ? 'text-emerald-400'
                                : isReview
                                ? 'text-amber-400'
                                : isChanges
                                ? 'text-purple-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isReview && <Clock className="w-3.5 h-3.5" />}
                            {isApproved
                              ? 'Approved & Credited'
                              : isReview
                              ? 'Needs Client Review'
                              : isChanges
                              ? 'Clarification Requested'
                              : 'Rejected'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reproduction Steps & Results */}
                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                      <div className="font-semibold text-slate-300">Reproduction Sequence:</div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                        {bug.stepsToReproduce.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                        <div className="p-2 bg-slate-900 rounded-lg">
                          <span className="text-slate-400 font-semibold block mb-0.5">
                            Expected Result:
                          </span>
                          <span className="text-slate-200">{bug.expectedResult}</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg">
                          <span className="text-rose-400 font-semibold block mb-0.5">
                            Actual Defect Result:
                          </span>
                          <span className="text-slate-200">{bug.actualResult}</span>
                        </div>
                      </div>
                    </div>

                    {/* Attachments */}
                    {bug.attachments.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5" /> Uploaded Proofs ({bug.attachments.length}):
                        </span>
                        {bug.attachments.map((att) => (
                          <button
                            key={att.id}
                            onClick={() => setSelectedAttachment(att)}
                            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[11px] font-medium">{att.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action Bar for Client */}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">
                        {isApproved && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Bounty of ${bug.bountyEarned.toFixed(2)} credited into {bug.testerName}'s wallet account.
                          </span>
                        )}
                        {isChanges && (
                          <span className="text-purple-400 font-semibold">
                            Clarification requested from tester.
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-rose-400 font-semibold">
                            Defect rejected.
                          </span>
                        )}
                      </div>

                      {isReview && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setActionBug({ bug, type: 'reject' })}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/30 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-lg transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setActionBug({ bug, type: 'revision' })}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200 text-xs font-semibold rounded-lg transition"
                          >
                            Request Revision
                          </button>
                          <button
                            onClick={() => handleOpenApproveModal(bug)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1.5 transition"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Approve Defect & Credit Bounty</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 2: Applicants Vetting */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Freelancer & Tester Applications</h3>
              <p className="text-xs text-slate-400">
                Review candidate fleet hardware, vetting ratings, and qualifications before approving cycle invites
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {applications.map((app) => {
              const project = projects.find((p) => p.id === app.projectId);
              const isPending = app.status === 'pending';
              const isApproved = app.status === 'approved';
              const isRejected = app.status === 'rejected';

              return (
                <div
                  key={app.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {app.testerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-white text-sm">
                            {app.testerName}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 text-[10px] font-bold border border-slate-700 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current" /> {app.testerRating}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 text-[10px] font-semibold border border-slate-700">
                            {app.testerTier} Tier
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{app.testerEmail}</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                      "{app.experienceNote}"
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">Applying For:</span>
                      <span className="text-blue-400 font-medium">{project?.title || app.projectId}</span>
                      <span>•</span>
                      <span>Devices:</span>
                      <div className="flex flex-wrap gap-1">
                        {app.selectedDevices.map((d, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end md:self-center">
                    {isPending ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => rejectApplication(app.id)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => approveApplication(app.id)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1.5 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Send Invite</span>
                        </button>
                      </div>
                    ) : isApproved ? (
                      <div className="text-right space-y-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved / Invited
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Invite Status: {app.inviteStatus || 'Sent'}
                        </p>
                        <button
                          type="button"
                          onClick={() => resendInvite(app.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded-lg border border-slate-700"
                        >
                          Resend Invite
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">
                        Application Declined
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Projects & Escrow Budgets */}
      {activeTab === 'cycles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Your Commissioned Projects & Track Budgets</h3>
              <p className="text-xs text-slate-400">
                Track slot fill ratios, disburse escrow bounties, and inspect real-time progress
              </p>
            </div>
            <button
              onClick={() => setIsCreateCycleOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Launch Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => {
              const disbursedPercent = Math.round((proj.budgetDisbursed / proj.totalBudget) * 100);

              return (
                <div
                  key={proj.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-2xl p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                          <ProjectIcon name={proj.companyLogo} className="h-7 w-7 text-[#00A3E0]" />
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-sm">{proj.title}</h4>
                          <span className="text-[11px] text-blue-400 font-medium">{proj.category}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {proj.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {proj.shortDescription}
                    </p>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Escrow Budget Disbursed:</span>
                        <span className="font-bold text-emerald-400">
                          ${proj.budgetDisbursed.toLocaleString()} / ${proj.totalBudget.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${disbursedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Slots: {proj.slotsFilled}/{proj.slotsTotal} filled</span>
                    <span>Closes: {proj.deadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approve Bug Modal */}
      {approvingBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ThumbsUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Approve Defect & Credit Wallet</h3>
              </div>
              <button
                onClick={() => setApprovingBug(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 block">Target Bug:</span>
                <p className="font-semibold text-white">{approvingBug.title}</p>
                <p className="text-blue-400">Tester: {approvingBug.testerName}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Approved Bounty Amount ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={customBounty}
                    onChange={(e) => setCustomBounty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Tester Quality Rating for this Report:
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1 transition ${
                        star <= rating ? 'text-amber-400' : 'text-slate-600'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-2">({rating} of 5 Stars)</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Review Feedback & Commendation Note:
                </label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  Confirming will instantly deduct from your Escrow balance and credit ${parseFloat(customBounty || '0').toFixed(2)} directly into {approvingBug.testerName}'s account for payout processing.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingBug(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow"
                >
                  Confirm & Credit Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Task Deliverable Modal */}
      {approvingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ThumbsUp className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">Approve Task Deliverable</h3>
              </div>
              <button
                onClick={() => setApprovingTask(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTaskApproval} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 block">Deliverable Batch:</span>
                <p className="font-semibold text-white">{approvingTask.title}</p>
                <p className="text-purple-400">Freelancer: {approvingTask.testerName}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Approved Deliverable Bounty ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={taskBounty}
                    onChange={(e) => setTaskBounty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Deliverable Quality Rating:
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setTaskRating(star)}
                      className={`p-1 transition ${
                        star <= taskRating ? 'text-amber-400' : 'text-slate-600'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-2">({taskRating} of 5 Stars)</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Client Verification Feedback:
                </label>
                <textarea
                  rows={3}
                  value={taskFeedback}
                  onChange={(e) => setTaskFeedback(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl text-purple-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400" />
                <span>
                  Confirming will disburse ${parseFloat(taskBounty || '0').toFixed(2)} into {approvingTask.testerName}'s wallet immediately.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingTask(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow"
                >
                  Confirm & Disburse Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Revision Bug Modal */}
      {actionBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">
                {actionBug.type === 'revision' ? 'Request Defect Clarification' : 'Reject Defect Report'}
              </h3>
              <button
                onClick={() => setActionBug(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAction} className="space-y-4 text-xs">
              <p className="text-slate-300">
                {actionBug.type === 'revision'
                  ? 'Ask the tester for additional logs, screen recordings, or clarified reproduction steps:'
                  : 'Please state the reason for rejecting this defect (e.g. works as designed, out of scope, duplicate):'}
              </p>

              <textarea
                rows={4}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter feedback rationale..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                required
              />

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionBug(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg shadow ${
                    actionBug.type === 'revision'
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {actionBug.type === 'revision' ? 'Send Request' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Revision Task Modal */}
      {actionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">
                {actionTask.type === 'revision' ? 'Request Deliverable Revision' : 'Reject Task Deliverable'}
              </h3>
              <button
                onClick={() => setActionTask(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTaskAction} className="space-y-4 text-xs">
              <p className="text-slate-300">
                {actionTask.type === 'revision'
                  ? 'Specify what modifications or acoustic/format corrections are required from the freelancer:'
                  : 'Specify the reason this deliverable does not satisfy project standards:'}
              </p>

              <textarea
                rows={4}
                value={actionTaskReason}
                onChange={(e) => setActionTaskReason(e.target.value)}
                placeholder="Enter feedback for the freelancer..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                required
              />

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionTask(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg shadow ${
                    actionTask.type === 'revision'
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {actionTask.type === 'revision' ? 'Request Revision' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateCycleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Launch Marketplace Project / Track</h3>
              </div>
              <button
                onClick={() => setIsCreateCycleOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Project Track / Category Type *</label>
                <select
                  value={newTrack}
                  onChange={(e) => {
                    const tr = e.target.value as ProjectTrack;
                    setNewTrack(tr);
                    if (tr === 'qa_functional') {
                      setNewPaymentModel('per_approved_bug');
                    } else {
                      setNewPaymentModel('per_task');
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold"
                >
                  <option value="qa_functional">Software QA & Defect Bounty Cycle</option>
                  <option value="data_collection">Voice / Speech & Multimodal Data Collection</option>
                  <option value="ai_evaluation">AI Red Teaming & Prompt Alignment Eval</option>
                  <option value="special_field">Mystery Shopping & Physical POS Audits</option>
                  <option value="ux_research">User Research & Usability Video Sessions</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Project Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Conversational Voice Utterance Collection - Swahili Dialect"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Domain Focus</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Payment & Checkout">Payment & Checkout</option>
                    <option value="Functional">Functional</option>
                    <option value="Usability">Usability</option>
                    <option value="Localization">Localization</option>
                    <option value="Security">Security</option>
                    <option value="Exploratory">Exploratory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Campaign Scope Description</label>
                <textarea
                  rows={3}
                  value={newOverview}
                  onChange={(e) => setNewOverview(e.target.value)}
                  placeholder="Detail the target demographics, technical requirements, and acceptance guidelines..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              {/* Conditional: QA Bounty vs Non-QA Task Rate */}
              {newTrack === 'qa_functional' ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 block">Bounty Payout Structure ($ USD)</span>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <label className="text-[10px] text-rose-400 block mb-0.5 font-bold">Critical</label>
                      <input
                        type="number"
                        value={newCritBounty}
                        onChange={(e) => setNewCritBounty(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-400 block mb-0.5 font-bold">High</label>
                      <input
                        type="number"
                        value={newHighBounty}
                        onChange={(e) => setNewHighBounty(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-400 block mb-0.5 font-bold">Medium</label>
                      <input
                        type="number"
                        value={newMedBounty}
                        onChange={(e) => setNewMedBounty(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-bold">Low</label>
                      <input
                        type="number"
                        value={newLowBounty}
                        onChange={(e) => setNewLowBounty(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-purple-950/20 rounded-xl border border-purple-800/40 space-y-3">
                  <span className="font-semibold text-purple-300 block">Deliverables & Contractor Rate</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-bold">Rate per Validated Batch ($)</label>
                      <input
                        type="number"
                        value={newTaskRate}
                        onChange={(e) => setNewTaskRate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-bold">File Format</label>
                      <input
                        type="text"
                        value={newDeliverableFormat}
                        onChange={(e) => setNewDeliverableFormat(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-bold">Sample Count</label>
                      <input
                        type="number"
                        value={newDeliverableCount}
                        onChange={(e) => setNewDeliverableCount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Total Budget ($)</label>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Freelancer Slots</label>
                  <input
                    type="number"
                    value={newSlots}
                    onChange={(e) => setNewSlots(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateCycleOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow"
                >
                  Launch Project & Open Applications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document & Screenshot Viewer */}
      <DocumentViewerModal
        attachment={selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />
    </div>
  );
};
