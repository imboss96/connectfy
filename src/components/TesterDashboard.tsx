import React from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Star,
  Smartphone,
  Award,
  Layers,
  FileText,
  AlertCircle,
  Sliders
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectIcon } from './ProjectIcon';

interface TesterDashboardProps {
  onOpenWorkspace: (projectId: string) => void;
  onOpenWallet: () => void;
  onBrowseProjects: () => void;
}

export const TesterDashboard: React.FC<TesterDashboardProps> = ({
  onOpenWorkspace,
  onOpenWallet,
  onBrowseProjects
}) => {
  const {
    testerProfile,
    applications,
    projects,
    bugReports,
    acceptInvite,
    setActiveTab
  } = useApp();

  // Active invitations awaiting acceptance
  const pendingInvites = applications.filter(
    (a) => a.testerId === testerProfile.id && a.inviteStatus === 'invited'
  );

  // My active/applied cycles
  const myApplications = applications.filter(
    (a) => a.testerId === testerProfile.id
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Tester Profile Summary */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            <img
              src={testerProfile.avatar}
              alt={testerProfile.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-500/40 shadow-md shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  {testerProfile.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Award className="w-3 h-3" /> {testerProfile.tier}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {testerProfile.email} • {testerProfile.country}
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs">
                <div className="flex items-center space-x-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{testerProfile.rating}</span>
                  <span className="text-slate-500 font-normal">({testerProfile.totalReviews})</span>
                </div>
                <span className="text-slate-600 hidden xs:inline">•</span>
                <span className="text-emerald-400 font-medium text-[11px] sm:text-xs">
                  {testerProfile.acceptanceRate}% Bug Acceptance
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1E2E4E]">
            <button
              onClick={() => setActiveTab('profile_settings')}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-[#111C33] hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 sm:space-x-1.5 transition border border-[#1E2E4E] shadow-sm"
              title="View and toggle profile & hardware fleet settings"
            >
              <Sliders className="w-3.5 h-3.5 text-[#00A3E0] shrink-0" />
              <span className="truncate">Fleet</span>
            </button>
            <button
              onClick={onOpenWallet}
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 sm:space-x-2 transition shadow-lg shadow-emerald-950/40"
            >
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">${testerProfile.availableBalance.toFixed(0)}</span>
            </button>
            <button
              onClick={onBrowseProjects}
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 sm:space-x-1.5 transition shadow shadow-[#007AFF]/30"
            >
              <span className="truncate">Cycles</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#1E2E4E] text-xs">
          <div className="bg-[#080D1A] p-3 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Available Payout</span>
            <span className="text-lg font-bold text-emerald-400">
              ${testerProfile.availableBalance.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#080D1A] p-3 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">In Review Escrow</span>
            <span className="text-lg font-bold text-amber-400">
              ${testerProfile.pendingEscrow.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#080D1A] p-3 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Approved Defects</span>
            <span className="text-lg font-bold text-white">
              {testerProfile.approvedBugsCount} bugs
            </span>
          </div>
          <div className="bg-[#080D1A] p-3 rounded-xl border border-[#1E2E4E]">
            <span className="text-slate-400 block text-[11px]">Lifetime Earnings</span>
            <span className="text-lg font-bold text-[#00A3E0]">
              ${testerProfile.lifetimeEarnings.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Invites Alert Card */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Test Cycle Invitations Ready ({pendingInvites.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingInvites.map((inv) => {
              const project = projects.find((p) => p.id === inv.projectId);
              if (!project) return null;

              return (
                <div
                  key={inv.id}
                  className="bg-gradient-to-r from-amber-950/30 via-[#0B132B] to-[#0B132B] border border-amber-500/40 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Application Approved
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5">
                        {project.title}
                      </h4>
                      <p className="text-xs text-slate-400">{project.company}</p>
                    </div>
                    <ProjectIcon name={project.companyLogo || 'movie'} className="h-5 w-5 text-[#00A3E0]" />
                  </div>

                  <p className="text-xs text-slate-300">
                    You have been granted a reserved test slot! Accept the invite to enter the active workspace and start reporting defects.
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1E2E4E]">
                    <span className="text-xs text-emerald-400 font-bold">
                      Critical Bounty: ${project.bountyStructure.critical}
                    </span>
                    <button
                      onClick={() => acceptInvite(inv.id)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg flex items-center space-x-1.5 transition shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Accept Invite & Start</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Applied Cycles & Progress Stepper */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">My Test Cycles & Pipeline</h3>
            <p className="text-xs text-slate-400">
              Track project applications, cycle invites, and defect reviews
            </p>
          </div>
        </div>

        {myApplications.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No active applications yet. Browse the project board to apply!
          </div>
        ) : (
          <div className="space-y-4">
            {myApplications.map((app) => {
              const project = projects.find((p) => p.id === app.projectId);
              if (!project) return null;

              const isAccepted = app.inviteStatus === 'accepted';
              const isInvited = app.inviteStatus === 'invited';
              const isPending = app.status === 'pending';
              const isRejected = app.status === 'rejected';

              const projectBugs = bugReports.filter((b) => b.projectId === project.id);
              const approvedBugs = projectBugs.filter((b) => b.status === 'approved');

              return (
                <div
                  key={app.id}
                  className="p-4 bg-[#080D1A] border border-[#1E2E4E] rounded-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <ProjectIcon name={project.companyLogo || 'card'} className="h-7 w-7 text-[#00A3E0]" />
                      <div>
                        <h4 className="text-sm font-bold text-white">{project.title}</h4>
                        <p className="text-xs text-slate-400">
                          Applied on {app.appliedDate} • {app.selectedDevices.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isAccepted ? (
                        <button
                          onClick={() => onOpenWorkspace(project.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition shadow"
                        >
                          <span>Go to Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : isInvited ? (
                        <button
                          onClick={() => acceptInvite(app.id)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition"
                        >
                          Accept Invite
                        </button>
                      ) : isPending ? (
                        <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Awaiting Client Review
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not Selected</span>
                      )}
                    </div>
                  </div>

                  {/* Visual Lifecycle Stepper */}
                  <div className="pt-2 border-t border-[#1E2E4E]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
                      {/* Step 1: Applied */}
                      <div className="p-1.5 rounded bg-[#111C33] border border-[#1E2E4E] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Applied</span>
                      </div>

                      {/* Step 2: Approved / Invited */}
                      <div
                        className={`p-1.5 rounded border text-center font-semibold flex items-center justify-center gap-1 ${
                          app.status === 'approved'
                            ? 'bg-[#111C33] border-[#1E2E4E] text-emerald-400'
                            : isRejected
                            ? 'bg-[#111C33] border-[#1E2E4E] text-rose-400'
                            : 'bg-[#111C33]/40 border-[#1E2E4E]/50 text-slate-500'
                        }`}
                      >
                        {app.status === 'approved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                        )}
                        <span>Approved & Invited</span>
                      </div>

                      {/* Step 3: In Testing */}
                      <div
                        className={`p-1.5 rounded border text-center font-semibold flex items-center justify-center gap-1 ${
                          isAccepted
                            ? 'bg-[#111C33] border-[#1E2E4E] text-emerald-400'
                            : 'bg-[#111C33]/40 border-[#1E2E4E]/50 text-slate-500'
                        }`}
                      >
                        {isAccepted ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                        )}
                        <span>Active Testing</span>
                      </div>

                      {/* Step 4: Bounty Credited */}
                      <div
                        className={`p-1.5 rounded border text-center font-semibold flex items-center justify-center gap-1 ${
                          approvedBugs.length > 0
                            ? 'bg-[#111C33] border-[#1E2E4E] text-emerald-400'
                            : 'bg-[#111C33]/40 border-[#1E2E4E]/50 text-slate-500'
                        }`}
                      >
                        {approvedBugs.length > 0 ? (
                          <DollarSign className="w-3 h-3" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                        )}
                        <span>
                          {approvedBugs.length > 0
                            ? `${approvedBugs.length} Paid`
                            : 'Bounties Credited'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Badges & Hardware Fleet Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-5 space-y-3 shadow-md">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-[#00A3E0]" />
            <span>Registered Hardware Fleet</span>
          </h4>
          <p className="text-xs text-slate-400">
            Verified testing devices available for client cycle matching
          </p>
          <div className="space-y-1.5">
            {testerProfile.devices.map((dev, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-[#080D1A] border border-[#1E2E4E] text-xs text-slate-200 flex items-center justify-between"
              >
                <span>{dev}</span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-5 space-y-3 shadow-md">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Earned QA Accreditations & Badges</span>
          </h4>
          <p className="text-xs text-slate-400">
            Reputation boosts invitation rate and priority slot reservations
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {testerProfile.badges.map((b, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 flex items-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
