import React, { useEffect, useState } from 'react';
import { AppProvider, InviteProfileDetails, useApp } from './context/AppContext';
import { isCloudinaryConfigured, uploadToCloudinary } from './lib/cloudinary';
import { Navbar } from './components/Navbar';
import { ProjectBoard } from './components/ProjectBoard';
import { TesterDashboard } from './components/TesterDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { TestWorkspace } from './components/TestWorkspace';
import { WalletModal } from './components/WalletModal';
import { ProfileSettings } from './components/ProfileSettings';
import { AdminProjectManager } from './components/AdminProjectManager';
import { MassInviteSection } from './components/MassInviteSection';
import { CRMSection } from './components/CRMSection';
import { ProjectOperationsSection } from './components/ProjectOperationsSection';
import { PayoutOperationsSection } from './components/PayoutOperationsSection';
import { PaymentsSection } from './components/PaymentsSection';
import { ApprovalEmailLogSection } from './components/ApprovalEmailLogSection';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { AdminAuthModal } from './components/AdminAuthModal';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  Route,
  Bug,
  DollarSign,
  Smartphone,
  Layers,
  Sliders,
  FileCheck,
  Users,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  Plus,
  CalendarClock,
  MailCheck
} from 'lucide-react';

interface MainContentProps {
  onLogout: () => void;
  onRequestAdminAccess: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ onLogout, onRequestAdminAccess }) => {
  const {
    role,
    activeTab,
    setActiveTab,
    activeWorkspaceProjectId,
    setActiveWorkspaceProjectId,
    pendingInviteAcceptanceId,
    dismissInviteAcceptance,
    testerProfile,
    clientProfile
  } = useApp();

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const handleMobileNav = (tab: any) => {
    setActiveWorkspaceProjectId(null);
    setActiveTab(tab);
  };

  return (
    <div className="theme-shell min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#f3f4f6] text-slate-900 flex flex-col font-sans selection:bg-[#007AFF] selection:text-white">
      {/* Top Navigation */}
      <Navbar onOpenWallet={() => setIsWalletOpen(true)} onLogout={onLogout} onRequestAdminAccess={onRequestAdminAccess} />

      {/* Freelance Scope Quick Bar - shown on tablet/desktop to avoid mobile horizontal blowout */}
      <div className="theme-flowbar hidden sm:block w-full max-w-full overflow-hidden bg-[#edf7fb] border-b border-[#dfe7eb] px-3 sm:px-4 py-2 text-xs text-slate-500 md:ml-64 md:w-[calc(100%-16rem)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
              <Route className="w-3.5 h-3.5 text-[#00A3E0]" />
              <span>Marketplace Flow:</span>
            </span>
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 shrink-0">
              <span className="text-slate-300">1. Commission & Post</span>
              <span>→</span>
              <span className="text-slate-300">2. Apply & Invite</span>
              <span>→</span>
              <span className="text-slate-300">3. Task / Defect</span>
              <span>→</span>
              <span className="text-emerald-400 font-semibold">4. Approved & Credited</span>
              <span>→</span>
              <span className="text-[#00A3E0] font-semibold">5. Payout</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] shrink-0">
            <span className="text-slate-400">Active Persona:</span>
            <span className="px-2 py-0.5 rounded bg-[#111C33] text-slate-200 font-semibold border border-[#1E2E4E]">
              {role === 'tester'
                ? `Tester: ${testerProfile.name || 'New Tester'} (${testerProfile.tier || 'Unrated'} Freelancer)`
                : role === 'admin'
                ? `Admin & PM: ${clientProfile.name || 'Admin User'} (${clientProfile.company || 'Operations'})`
                : `Client: ${clientProfile.company || 'New Client'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container with responsive padding and mobile bottom nav space */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8 min-w-0 overflow-x-hidden bg-[#f3f4f6] text-slate-800 md:ml-64 md:w-[calc(100%-16rem)]">
        {/* If Active Workspace is open */}
        {activeWorkspaceProjectId ? (
          <TestWorkspace
            projectId={activeWorkspaceProjectId}
            onBack={() => setActiveWorkspaceProjectId(null)}
          />
        ) : activeTab === 'profile_settings' ? (
          <ProfileSettings
            onBack={() => {
              if (role === 'tester') setActiveTab('projects');
              else if (role === 'admin') setActiveTab('admin_manager');
              else setActiveTab('client_submissions');
            }}
          />
        ) : activeTab === 'admin_manager' || role === 'admin' ? (
          activeTab === 'crm' ? (
            <CRMSection />
          ) : activeTab === 'project_operations' ? (
            <ProjectOperationsSection />
          ) : activeTab === 'mass_invites' ? (
            <MassInviteSection />
          ) : activeTab === 'payout_operations' ? (
            <PayoutOperationsSection />
          ) : activeTab === 'payments' ? (
            <PaymentsSection />
          ) : activeTab === 'approval_emails' ? (
            <ApprovalEmailLogSection />
          ) : activeTab === 'service_listings' ? (
            <AdminProjectManager />
          ) : activeTab === 'projects' ? (
            <ProjectBoard
              onOpenWorkspace={(projId) => setActiveWorkspaceProjectId(projId)}
            />
          ) : activeTab === 'client_applicants' ||
            activeTab === 'client_submissions' ||
            activeTab === 'client_cycles' ? (
            <ClientDashboard />
          ) : (
            <AdminProjectManager />
          )
        ) : role === 'tester' ? (
          activeTab === 'tasks' ? (
            <TesterDashboard
              onOpenWorkspace={(projId) => setActiveWorkspaceProjectId(projId)}
              onOpenWallet={() => setIsWalletOpen(true)}
              onBrowseProjects={() => setActiveTab('projects')}
            />
          ) : (
            <ProjectBoard
              onOpenWorkspace={(projId) => setActiveWorkspaceProjectId(projId)}
            />
          )
        ) : (
          <ClientDashboard />
        )}
      </main>

      {/* Dedicated Mobile Bottom Navigation Bar (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B132B]/95 backdrop-blur-lg border-t border-[#1E2E4E] px-2 py-1 shadow-2xl">
        <div className={role === 'admin'
          ? 'flex items-center justify-start gap-1 overflow-x-auto [&>button]:min-w-[4.5rem] [&>button]:shrink-0'
          : 'flex items-center justify-around'}>
          {role === 'tester' ? (
            <>
              {/* Projects Tab */}
              <button
                onClick={() => handleMobileNav('projects')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'projects' && !activeWorkspaceProjectId
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bug className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Projects</span>
              </button>

              {/* My Tasks / Pipeline Tab */}
              <button
                onClick={() => handleMobileNav('tasks')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'tasks' && !activeWorkspaceProjectId
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Pipeline</span>
              </button>

              {/* Wallet Tab */}
              <button
                onClick={() => setIsWalletOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] text-emerald-400 hover:text-emerald-300 rounded-xl transition"
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-bold">
                  ${testerProfile.availableBalance.toFixed(0)}
                </span>
              </button>

              {/* Profile & Fleet Tab */}
              <button
                onClick={() => handleMobileNav('profile_settings')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'profile_settings'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Profile</span>
              </button>
            </>
          ) : role === 'admin' ? (
            <>
              {/* Admin PM Portal */}
              <button
                onClick={() => handleMobileNav('admin_manager')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'admin_manager'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">PM Ops</span>
              </button>

              <button
                onClick={() => handleMobileNav('crm')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'crm'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">CRM</span>
              </button>

              <button
                onClick={() => handleMobileNav('mass_invites')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'mass_invites'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Invites</span>
              </button>

              <button
                onClick={() => handleMobileNav('project_operations')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'project_operations'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Project Ops</span>
              </button>

              <button
                onClick={() => handleMobileNav('payments')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'payments'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarClock className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Payments</span>
              </button>

              <button
                onClick={() => handleMobileNav('approval_emails')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'approval_emails'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MailCheck className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Email Log</span>
              </button>

              <button
                onClick={() => handleMobileNav('payout_operations')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'payout_operations'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Payouts</span>
              </button>

              {/* Listings */}
              <button
                onClick={() => handleMobileNav('service_listings')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'service_listings'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Listings</span>
              </button>

              {/* Submissions */}
              <button
                onClick={() => handleMobileNav('client_submissions')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'client_submissions'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Reviews</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => handleMobileNav('profile_settings')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'profile_settings'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Settings</span>
              </button>
            </>
          ) : (
            <>
              {/* Submissions Tab */}
              <button
                onClick={() => handleMobileNav('client_submissions')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'client_submissions'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Reviews</span>
              </button>

              {/* Applicants Tab */}
              <button
                onClick={() => handleMobileNav('client_applicants')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'client_applicants'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Applicants</span>
              </button>

              {/* Cycles Tab */}
              <button
                onClick={() => handleMobileNav('client_cycles')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'client_cycles'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Cycles</span>
              </button>

              {/* Settings Tab */}
              <button
                onClick={() => handleMobileNav('profile_settings')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'profile_settings'
                    ? 'text-[#00A3E0] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Org</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Wallet and Payout Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />
      {pendingInviteAcceptanceId && (
        <InviteAcceptanceDialog
          applicationId={pendingInviteAcceptanceId}
          onDismiss={dismissInviteAcceptance}
        />
      )}

      {/* Footer (hidden or compact on mobile) */}
      <footer className="theme-footer hidden md:block border-t border-[#1E2E4E] bg-[#0B132B]/80 py-6 text-center text-xs text-slate-500 mt-12 md:ml-64 md:w-[calc(100%-16rem)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[#00A3E0] font-black text-sm">Connectfy</span>
            <span className="font-semibold text-slate-300">Freelance QA Marketplace</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Project Slots</span>
            <span>•</span>
            <span>Slot Payouts for Approved Work</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const InviteAcceptanceDialog: React.FC<{ applicationId: string; onDismiss: () => void }> = ({ applicationId, onDismiss }) => {
  const { applications, projects, testerProfile, completeInviteAcceptance, setActiveTab } = useApp();
  const application = applications.find((item) => item.id === applicationId);
  const project = application && projects.find((item) => item.id === application.projectId);
  const [details, setDetails] = useState<InviteProfileDetails>({
    uTestId: testerProfile.uTestId || '',
    legalName: testerProfile.legalName || '',
    dateOfBirth: testerProfile.dateOfBirth || '',
    uTestEmail: testerProfile.uTestEmail || testerProfile.email || '',
    phone: testerProfile.phone || '',
    ageRange: testerProfile.ageRange || '18-24',
    country: testerProfile.country || '',
    smartphone: testerProfile.smartphone || '',
    hasValidId: Boolean(testerProfile.hasValidId),
    willingVoiceRecording: Boolean(testerProfile.willingVoiceRecording),
    uTestAccountScreenshotUrl: testerProfile.uTestAccountScreenshotUrl || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDetails({
      uTestId: testerProfile.uTestId || '',
      legalName: testerProfile.legalName || '',
      dateOfBirth: testerProfile.dateOfBirth || '',
      uTestEmail: testerProfile.uTestEmail || testerProfile.email || '',
      phone: testerProfile.phone || '',
      ageRange: testerProfile.ageRange || '18-24',
      country: testerProfile.country || '',
      smartphone: testerProfile.smartphone || '',
      hasValidId: Boolean(testerProfile.hasValidId),
      willingVoiceRecording: Boolean(testerProfile.willingVoiceRecording),
      uTestAccountScreenshotUrl: testerProfile.uTestAccountScreenshotUrl || ''
    });
  }, [applicationId, testerProfile]);

  if (!application || !project) return null;

  const dismiss = () => {
    onDismiss();
    setActiveTab('tasks');
    const params = new URLSearchParams(window.location.search);
    params.delete('application');
    params.delete('accept');
    const query = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      await completeInviteAcceptance(applicationId, details);
      const params = new URLSearchParams(window.location.search);
      params.delete('application');
      params.delete('accept');
      const query = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save your details and accept the invitation.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof InviteProfileDetails) =>
    (event: React.ChangeEvent<HTMLInputElement>) => setDetails((previous) => ({ ...previous, [field]: event.target.value }));

  const handleScreenshotUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Choose an image file showing your uTest account.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('The screenshot must be 8 MB or smaller.');
      return;
    }
    if (!isCloudinaryConfigured) {
      setErrorMessage('Screenshot upload is unavailable right now. Please contact support.');
      return;
    }

    setIsUploadingScreenshot(true);
    setErrorMessage('');
    try {
      const uploaded = await uploadToCloudinary(file);
      setDetails((previous) => ({ ...previous, uTestAccountScreenshotUrl: uploaded.secure_url }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload the uTest account screenshot.');
    } finally {
      setIsUploadingScreenshot(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4">
      <div className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#007AFF]">Project invitation</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Complete your tester details</h2>
          <p className="mt-2 text-sm text-slate-600">
            To accept <strong>{project.title}</strong>, confirm the information below. Your profile details are prefilled where available.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>uTest ID</span>
              <input required value={details.uTestId} onChange={updateField('uTestId')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Full name as shown on your ID</span>
              <input required value={details.legalName} onChange={updateField('legalName')} autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Date of birth</span>
              <input required type="date" max={new Date().toISOString().slice(0, 10)} value={details.dateOfBirth} onChange={updateField('dateOfBirth')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Email address</span>
              <input required type="email" autoComplete="email" value={details.uTestEmail} onChange={updateField('uTestEmail')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Age range</span>
              <select required value={details.ageRange} onChange={(event) => setDetails((previous) => ({ ...previous, ageRange: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]">
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45+">45+</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Country</span>
              <input required value={details.country} onChange={updateField('country')} autoComplete="country-name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
              <span>Smartphone / device used for this project</span>
              <input required value={details.smartphone} onChange={updateField('smartphone')} placeholder="e.g. iPhone 15 Pro (iOS 17.5)" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
              <span>Phone number where we can reach you</span>
              <input required type="tel" autoComplete="tel" value={details.phone} onChange={updateField('phone')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]" />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
              <span>uTest account screenshot <span className="text-rose-600">*</span></span>
              <span className="block font-normal text-slate-500">Show your uTest profile or account ID. Crop out passwords, recovery codes, and payment details. Image files up to 8 MB.</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void handleScreenshotUpload(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
                disabled={isUploadingScreenshot || isSaving}
                className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-700 file:ring-1 file:ring-slate-300 disabled:opacity-60"
              />
            </label>
            {isUploadingScreenshot && <p className="text-xs font-medium text-sky-700">Uploading screenshot…</p>}
            {details.uTestAccountScreenshotUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-2">
                <img src={details.uTestAccountScreenshotUrl} alt="Uploaded uTest account screenshot preview" className="h-14 w-20 rounded border border-slate-200 object-cover" />
                <span className="min-w-0 flex-1 text-xs font-semibold text-emerald-800">Screenshot uploaded</span>
                <a href={details.uTestAccountScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">View</a>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <label className="flex items-start gap-2">
              <input required type="checkbox" checked={details.hasValidId} onChange={(event) => setDetails((previous) => ({ ...previous, hasValidId: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#007AFF]" />
              I have a valid government-issued ID available and understand that ID verification is required to participate.
            </label>
            <label className="flex items-start gap-2">
              <input required type="checkbox" checked={details.willingVoiceRecording} onChange={(event) => setDetails((previous) => ({ ...previous, willingVoiceRecording: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#007AFF]" />
              I am willing to complete short voice recordings, including recordings in quiet and normal/noisy environments.
            </label>
          </div>

          {errorMessage && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={dismiss} disabled={isSaving || isUploadingScreenshot} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Not now
            </button>
            <button type="submit" disabled={isSaving || isUploadingScreenshot || !details.uTestAccountScreenshotUrl} className="rounded-lg bg-[#007AFF] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0066EE] disabled:opacity-50">
              {isUploadingScreenshot ? 'Uploading screenshot…' : isSaving ? 'Saving…' : 'Save details & accept invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppExperience />
    </AppProvider>
  );
}

const AppExperience: React.FC = () => {
  const { setRole, applications, acceptInvite, testerProfile, setActiveTab, setActiveWorkspaceProjectId, pendingInviteAcceptanceId } = useApp();
  const [screen, setScreen] = useState<'landing' | 'login' | 'reset' | 'app'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin || 'http://localhost:5173').replace(/\/$/, '');

  const isRecoveryUrl = () => {
    const currentUrl = window.location.href;
    const hrefLower = currentUrl.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const hasRecoveryToken = /(?:[?#].*|^).*?(?:type=recovery|access_token=|refresh_token=)/i.test(currentUrl);

    return path.startsWith('/reset-password')
      || hrefLower.includes('reset=true')
      || hrefLower.includes('type=recovery')
      || hasRecoveryToken;
  };

  const syncScreenFromUrl = () => {
    if (isRecoveryUrl()) {
      setScreen('reset');
      return;
    }

    if (screen === 'reset') {
      setScreen('login');
    }
  };

  useEffect(() => {
    syncScreenFromUrl();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const applicationId = params.get('application');
    const shouldAccept = params.get('accept') === '1';
    if (!applicationId || !shouldAccept) return;
    if (!isAuthLoading && screen === 'landing') {
      setAuthMode('login');
      setScreen('login');
      return;
    }
    if (screen !== 'app' || !testerProfile.id || pendingInviteAcceptanceId === applicationId) return;

    const application = applications.find((item) => item.id === applicationId);
    if (!application || application.testerId !== testerProfile.id) return;

    void acceptInvite(application.id).then((accepted) => {
      if (!accepted) return;
      params.delete('application');
      params.delete('accept');
      const query = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    });
  }, [applications, acceptInvite, testerProfile.id, screen, isAuthLoading, pendingInviteAcceptanceId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSettingsTab = params.get('settings');
    if (requestedSettingsTab === 'utest') {
      setActiveTab('profile_settings');
      params.delete('settings');
      const query = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  }, [setActiveTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('project') && (params.get('reapply') === '1' || params.get('apply') === '1')) {
      setActiveTab('projects');
    }
  }, [setActiveTab]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false);
      return;
    }
    const client = supabase;
    const syncSession = async (session: { user: { id: string } } | null) => {
      if (isRecoveryUrl()) {
        setScreen('reset');
        setIsAuthLoading(false);
        return;
      }

      if (!session) {
        setScreen(current => current === 'app' ? 'landing' : current);
        setIsAuthLoading(false);
        return;
      }

      setScreen('app');
      if (session) {
        const { data: profile } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setRole(profile?.role === 'admin' ? 'admin' : 'tester');
      }
      setIsAuthLoading(false);
    };
    client.auth.getSession().then(({ data }) => void syncSession(data.session));
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' && isRecoveryUrl()) {
        setScreen('reset');
        setIsAuthLoading(false);
        return;
      }
      void syncSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const resetLocalUserState = () => {
    localStorage.removeItem('utest_crowdqa_role');
    localStorage.removeItem('utest_crowdqa_testerProfile');
    localStorage.removeItem('utest_crowdqa_clientProfile');
    localStorage.removeItem('utest_crowdqa_projects');
    localStorage.removeItem('utest_crowdqa_applications');
    localStorage.removeItem('utest_crowdqa_bugReports');
    localStorage.removeItem('utest_crowdqa_taskSubmissions');
    localStorage.removeItem('utest_crowdqa_notifications');
    localStorage.removeItem('utest_crowdqa_walletTransactions');
    localStorage.removeItem('utest_crowdqa_activeTab');
  };

  const handleLandingApply = (projectId?: string) => {
    if (projectId) {
      const params = new URLSearchParams(window.location.search);
      params.set('project', projectId);
      params.set('apply', '1');
      window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    }
    setAuthMode('signup');
    setScreen('login');
  };

  const handleLogin = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Authentication is not configured. Add your Supabase URL and anon key to .env.local.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    resetLocalUserState();
    setActiveTab('projects');
    setScreen('app');
  };

  const handleResetPassword = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase authentication is not configured.');
    const redirectUrl = `${appUrl}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (error) throw error;
  };

  const handleResetPasswordSubmit = async (newPassword: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase authentication is not configured.');

    const url = new URL(window.location.href);
    const recoveryCode = url.searchParams.get('code');

    if (recoveryCode) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recoveryCode);
      if (exchangeError) throw exchangeError;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    await supabase.auth.signOut();
    setScreen('login');
    setAuthMode('login');
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Account registration is not configured. Add your Supabase URL and anon key to .env.local.');
    resetLocalUserState();
    const returnUrl = new URL(appUrl);
    const currentParams = new URLSearchParams(window.location.search);
    const projectId = currentParams.get('project');
    if (projectId) {
      returnUrl.searchParams.set('project', projectId);
      if (currentParams.get('apply') === '1') returnUrl.searchParams.set('apply', '1');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: returnUrl.toString()
      }
    });
    if (error) throw error;
    if (!data.session) throw new Error('Account created. Check your email to confirm your account, then sign in.');
    setActiveTab('projects');
    setScreen('app');
  };

  const handleLogout = () => {
    if (supabase) void supabase.auth.signOut();
    resetLocalUserState();
    setActiveWorkspaceProjectId(null);
    setScreen('landing');
    setActiveTab('projects');
    setRole('tester');
  };

  const handleAdminAuth = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase authentication is not configured.');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id || '').maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('This account does not have admin access.');
    }
    setScreen('app');
    setRole('admin');
    setIsAdminAuthOpen(false);
  };

  if (isAuthLoading) return <div className="login-loading">Connecting securely to Connectfy...</div>;
  if (screen === 'landing') return <LandingPage onGetStarted={handleLandingApply} onLogin={() => { setAuthMode('login'); setScreen('login'); }} />;
  if (screen === 'login') return <LoginPage initialMode={authMode} onLogin={handleLogin} onSignUp={handleSignUp} onResetPassword={handleResetPassword} onBackToLanding={() => { setScreen('landing'); }} />;
  if (screen === 'reset') return <ResetPasswordPage onSubmit={handleResetPasswordSubmit} onBackToLogin={() => { setScreen('login'); setAuthMode('login'); }} />;

  return (
    <>
      <MainContent onLogout={handleLogout} onRequestAdminAccess={() => setIsAdminAuthOpen(true)} />
      <AdminAuthModal isOpen={isAdminAuthOpen} onClose={() => setIsAdminAuthOpen(false)} onSubmit={handleAdminAuth} />
    </>
  );
};
