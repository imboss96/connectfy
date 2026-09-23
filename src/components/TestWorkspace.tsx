import React, { useState } from 'react';
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  DollarSign,
  ShieldCheck,
  Smartphone,
  Info,
  Paperclip,
  Check,
  XCircle,
  HelpCircle,
  Star,
  Upload,
  Mic,
  Brain,
  Eye,
  MapPin,
  Play,
  Volume2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectIcon } from './ProjectIcon';
import { Project, BugReport, TaskSubmission, AttachmentFile } from '../types';
import { BugSubmissionModal } from './BugSubmissionModal';
import { TaskSubmissionModal } from './TaskSubmissionModal';
import { DocumentViewerModal } from './DocumentViewerModal';

interface TestWorkspaceProps {
  projectId: string;
  onBack: () => void;
}

export const TestWorkspace: React.FC<TestWorkspaceProps> = ({ projectId, onBack }) => {
  const { projects, bugReports, taskSubmissions, testerProfile } = useApp();
  
  const project = projects.find((p) => p.id === projectId);
  
  const isQA = !project || project.projectTrack === 'qa_functional';

  const [activeSubTab, setActiveSubTab] = useState<'bugs' | 'testcases' | 'deliverables' | 'scope'>(
    isQA ? 'bugs' : 'deliverables'
  );
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentFile | null>(null);

  // Predefined realistic test case execution list for QA cycles
  const [testCases, setTestCases] = useState([
    {
      id: 'tc-1',
      title: 'Verify 3DS OTP Authentication on Mobile Safari with SMS Auto-fill',
      bounty: 15.00,
      status: 'passed' as 'passed' | 'failed' | 'blocked' | 'untested',
      notes: 'Executed successfully on iPhone 15 Pro. Auto-fill triggered cleanly.'
    },
    {
      id: 'tc-2',
      title: 'Test Split Payment calculation between EUR and USD with 3 recipients',
      bounty: 15.00,
      status: 'failed' as 'passed' | 'failed' | 'blocked' | 'untested',
      notes: 'Failed: Rounding error results in split sum mismatch. Logged as Bug #102.'
    },
    {
      id: 'tc-3',
      title: 'Verify Network Dropout Recovery during Biometric Passkey Confirmation',
      bounty: 15.00,
      status: 'untested' as 'passed' | 'failed' | 'blocked' | 'untested',
      notes: ''
    },
    {
      id: 'tc-4',
      title: 'Validate Localized Currency Symbol placement in Cart Drawer',
      bounty: 10.00,
      status: 'untested' as 'passed' | 'failed' | 'blocked' | 'untested',
      notes: ''
    }
  ]);

  if (!project) return null;

  // Bugs & Deliverables logged in this project by this tester
  const projectBugs = bugReports.filter((b) => b.projectId === projectId);
  const approvedBugs = projectBugs.filter((b) => b.status === 'approved');
  const earnedFromBugs = approvedBugs.reduce((acc, b) => acc + b.bountyEarned, 0);

  const projectDeliverables = taskSubmissions.filter((s) => s.projectId === projectId);
  const approvedDeliverables = projectDeliverables.filter((s) => s.status === 'approved');
  const earnedFromDeliverables = approvedDeliverables.reduce((acc, s) => acc + s.bountyEarned, 0);

  const totalEarnedInProject = earnedFromBugs + earnedFromDeliverables;

  const handleUpdateTestCaseStatus = (id: string, newStatus: 'passed' | 'failed' | 'blocked') => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status: newStatus } : tc));
  };

  const getTrackBadge = () => {
    switch (project.projectTrack) {
      case 'data_collection':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Data Collection Track</span>;
      case 'ai_evaluation':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">AI Evaluation & Red Teaming</span>;
      case 'special_field':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Field Audit Track</span>;
      case 'ux_research':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">UX Research Track</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">QA Functional Cycle</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 relative overflow-hidden w-full max-w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-3 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Active Opportunities</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <ProjectIcon name={project.companyLogo} className="h-7 w-7 text-[#00A3E0]" />
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight break-words">
                {project.title}
              </h1>
              {getTrackBadge()}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              {project.shortDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isQA ? (
              <button
                onClick={() => setIsBugModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-rose-900/30"
              >
                <Bug className="w-4 h-4" />
                <span>Report New Defect</span>
              </button>
            ) : (
              <button
                onClick={() => setIsDeliverableModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-purple-900/30"
              >
                <Upload className="w-4 h-4" />
                <span>Submit Deliverable Batch</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Project KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Bounties Earned to Date</span>
            <span className="text-base sm:text-lg font-bold text-emerald-400">
              ${totalEarnedInProject.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">
              {isQA ? 'Defects Logged' : 'Deliverables Submitted'}
            </span>
            <span className="text-base sm:text-lg font-bold text-white">
              {isQA ? `${projectBugs.length} (${approvedBugs.length} approved)` : `${projectDeliverables.length} (${approvedDeliverables.length} approved)`}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">
              {isQA ? 'Max Critical Bounty' : 'Deliverable Rate'}
            </span>
            <span className="text-base sm:text-lg font-bold text-purple-400">
              {isQA ? `$${project.bountyStructure.critical.toFixed(2)}` : `$${(project.taskRate || 40).toFixed(2)} / batch`}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Project Deadline</span>
            <span className="text-base sm:text-lg font-bold text-slate-200">
              {project.deadline}
            </span>
          </div>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-800 space-x-4 sm:space-x-6 text-xs sm:text-sm overflow-x-auto scrollbar-none pb-0.5">
        {isQA ? (
          <>
            <button
              onClick={() => setActiveSubTab('bugs')}
              className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
                activeSubTab === 'bugs'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bug className="w-4 h-4" />
              <span>Reported Defects ({projectBugs.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('testcases')}
              className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
                activeSubTab === 'testcases'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Test Runs & Scenarios ({testCases.length})</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveSubTab('deliverables')}
            className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeSubTab === 'deliverables'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Task Deliverables & Submissions ({projectDeliverables.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('scope')}
          className={`pb-3 font-semibold flex items-center space-x-2 border-b-2 transition shrink-0 whitespace-nowrap ${
            activeSubTab === 'scope'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isQA ? 'Cycle Guidelines & Credentials' : 'Deliverable Specs & Acceptance Rules'}</span>
        </button>
      </div>

      {/* Non-QA Deliverables View */}
      {!isQA && activeSubTab === 'deliverables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Your Deliverable Submissions</h3>
              <p className="text-xs text-slate-400">
                Track verification progress, review feedback, and automatic payout crediting
              </p>
            </div>
            <button
              onClick={() => setIsDeliverableModalOpen(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Submit Deliverable</span>
            </button>
          </div>

          {projectDeliverables.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <Upload className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Deliverables Submitted Yet</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Review the deliverable instructions in the Scope tab, record or assemble your data batch, and submit for client validation.
              </p>
              <button
                onClick={() => setIsDeliverableModalOpen(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow"
              >
                Submit First Batch
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projectDeliverables.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 transition hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-purple-400">
                          #{sub.id.toUpperCase().slice(-6)}
                        </span>
                        <h4 className="text-sm font-bold text-white">{sub.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Submitted on {sub.submittedAt}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      {sub.status === 'approved' ? (
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                          <p className="text-[11px] font-bold text-emerald-400 mt-0.5">
                            +${sub.bountyEarned.toFixed(2)} Credited
                          </p>
                        </div>
                      ) : sub.status === 'under_review' ? (
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Under Client Review
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Pending ${sub.bountyEarned.toFixed(2)}
                          </p>
                        </div>
                      ) : sub.status === 'changes_requested' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Changes Requested
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {sub.details}
                  </p>

                  {/* Metadata Chips */}
                  {sub.metadata && Object.keys(sub.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {sub.metadata.sampleCount && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                          Samples: <strong className="text-white">{sub.metadata.sampleCount}</strong>
                        </span>
                      )}
                      {sub.metadata.languageOrDialect && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-purple-300">
                          Language: <strong className="text-white">{sub.metadata.languageOrDialect}</strong>
                        </span>
                      )}
                      {sub.metadata.audioEnvironment && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                          Room: <strong className="text-white">{sub.metadata.audioEnvironment}</strong>
                        </span>
                      )}
                      {sub.metadata.storeLocationOrMerchant && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                          Location: <strong className="text-white">{sub.metadata.storeLocationOrMerchant}</strong>
                        </span>
                      )}
                      {sub.metadata.deviceUsed && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          Device: {sub.metadata.deviceUsed}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attachments & Previews */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> Attached Files ({sub.attachments.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {sub.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs hover:border-slate-700 transition"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {att.type.startsWith('audio/') ? (
                              <Volume2 className="w-4 h-4 text-purple-400 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className="truncate text-slate-300 text-[11px] font-medium">{att.name}</span>
                          </div>
                          <button
                            onClick={() => setSelectedAttachment(att)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline font-semibold ml-2 shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Client Feedback & Rating */}
                  {sub.clientFeedback && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Client Verification Feedback:
                        </span>
                        {sub.clientRating && (
                          <div className="flex items-center text-amber-400">
                            {Array.from({ length: sub.clientRating }).map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-current" />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-slate-300 italic text-[11px] leading-relaxed">
                        "{sub.clientFeedback}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QA Defects Tab */}
      {isQA && activeSubTab === 'bugs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Your Defect Submissions</h3>
              <p className="text-xs text-slate-400">
                Track status, inspection logs, and client bounty approval
              </p>
            </div>
            <button
              onClick={() => setIsBugModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Log Bug</span>
            </button>
          </div>

          {projectBugs.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <Bug className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Defects Logged Yet</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Begin exploratory testing on your registered hardware. When you discover unexpected behavior or a crash, log it with reproducible steps.
              </p>
              <button
                onClick={() => setIsBugModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow"
              >
                Log First Defect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projectBugs.map((bug) => (
                <div
                  key={bug.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 transition hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-blue-400">
                          #{bug.id.toUpperCase().slice(-6)}
                        </span>
                        <h4 className="text-sm font-bold text-white">{bug.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {bug.device} • {bug.osVersion} • {bug.featureArea}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          bug.severity === 'Critical'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : bug.severity === 'High'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {bug.severity}
                      </span>

                      {bug.status === 'approved' ? (
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                          <p className="text-[11px] font-bold text-emerald-400 mt-0.5">
                            +${bug.bountyEarned.toFixed(2)} Credited
                          </p>
                        </div>
                      ) : bug.status === 'under_review' ? (
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Under Review
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Est. ${bug.bountyEarned.toFixed(2)}
                          </p>
                        </div>
                      ) : bug.status === 'changes_requested' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Changes Requested
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs space-y-1.5">
                    <span className="font-semibold text-slate-300 block">Steps to Reproduce:</span>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      {bug.stepsToReproduce.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Actual & Expected */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="font-semibold text-emerald-400 block mb-0.5">Expected Result:</span>
                      <p className="text-slate-300">{bug.expectedResult}</p>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="font-semibold text-rose-400 block mb-0.5">Actual Result:</span>
                      <p className="text-slate-300">{bug.actualResult}</p>
                    </div>
                  </div>

                  {/* Attachments */}
                  {bug.attachments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" /> Proofs & Logs:
                      </span>
                      {bug.attachments.map((att) => (
                        <button
                          key={att.id}
                          onClick={() => setSelectedAttachment(att)}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs flex items-center space-x-1 transition"
                        >
                          <FileText className="w-3 h-3 text-blue-400" />
                          <span>{att.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Client Feedback */}
                  {bug.clientFeedback && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Client Review Note:
                        </span>
                      </div>
                      <p className="text-slate-300 italic text-[11px]">
                        "{bug.clientFeedback}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QA Test Runs Tab */}
      {isQA && activeSubTab === 'testcases' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Curated Test Scenarios</h3>
            <p className="text-xs text-slate-400">
              Execute prioritized test cases and submit your run verdicts for direct run bounty crediting
            </p>
          </div>

          <div className="space-y-3">
            {testCases.map((tc) => (
              <div
                key={tc.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">
                      {tc.id}
                    </span>
                    <h4 className="text-sm font-bold text-white">{tc.title}</h4>
                  </div>
                  {tc.notes && (
                    <p className="text-xs text-slate-400 italic">
                      Note: {tc.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-emerald-400">
                    +${tc.bounty.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleUpdateTestCaseStatus(tc.id, 'passed')}
                    className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                      tc.status === 'passed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Pass</span>
                  </button>
                  <button
                    onClick={() => handleUpdateTestCaseStatus(tc.id, 'failed')}
                    className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                      tc.status === 'failed'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Fail</span>
                  </button>
                  <button
                    onClick={() => handleUpdateTestCaseStatus(tc.id, 'blocked')}
                    className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                      tc.status === 'blocked'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Block</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Scope & Guidelines / Specifications */}
      {activeSubTab === 'scope' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Deliverables Guide if non-QA */}
          {!isQA && project.deliverablesGuide ? (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 md:col-span-2">
              <div className="flex items-center space-x-2 text-purple-400 font-semibold text-sm">
                <Info className="w-4 h-4" />
                <span>Deliverable Specifications & Quality Gates</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {project.deliverablesGuide.instructions}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Expected File Format</span>
                  <span className="text-sm font-bold text-white">{project.deliverablesGuide.fileFormat}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Sample Batch Size</span>
                  <span className="text-sm font-bold text-white">{project.deliverablesGuide.sampleCountRequired} items</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Payment Model</span>
                  <span className="text-sm font-bold text-emerald-400">${project.taskRate?.toFixed(2)} per validated batch</span>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-semibold text-white text-xs mb-2">Acceptance & Validation Criteria:</h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {project.deliverablesGuide.acceptanceCriteria.map((crit, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{crit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>In-Scope Target Areas</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              {project.inScope.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Out-of-Scope (Non-Billable)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                {project.outOfScope.map((item, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Sandbox Access & Test Environment</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 font-mono">
                <div className="text-slate-400 text-[11px]">Primary Test Account:</div>
                <div className="text-white">user: <span className="text-emerald-400">marketplace_contractor@connectfy.sandbox</span></div>
                <div className="text-white">pass: <span className="text-emerald-400">Freelance#2026!Key</span></div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                <span className="font-semibold text-white block mb-1">Quality Standards:</span>
                <p className="text-[11px] text-slate-400">
                  Submissions undergo automated format verification followed by manual client sign-off. Approved items disburse directly into your wallet.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isQA && (
        <BugSubmissionModal
          project={project}
          isOpen={isBugModalOpen}
          onClose={() => setIsBugModalOpen(false)}
          onSuccess={() => setIsBugModalOpen(false)}
        />
      )}

      {!isQA && isDeliverableModalOpen && (
        <TaskSubmissionModal
          project={project}
          onClose={() => setIsDeliverableModalOpen(false)}
          onSuccess={() => setIsDeliverableModalOpen(false)}
        />
      )}

      <DocumentViewerModal
        attachment={selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />
    </div>
  );
};
