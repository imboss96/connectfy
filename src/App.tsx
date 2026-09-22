import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { ProjectBoard } from './components/ProjectBoard';
import { TesterDashboard } from './components/TesterDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { TestWorkspace } from './components/TestWorkspace';
import { WalletModal } from './components/WalletModal';
import { ProfileSettings } from './components/ProfileSettings';
import { AdminProjectManager } from './components/AdminProjectManager';
import {
  Sparkles,
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
  Plus
} from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    role,
    activeTab,
    setActiveTab,
    activeWorkspaceProjectId,
    setActiveWorkspaceProjectId,
    testerProfile
  } = useApp();

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const handleMobileNav = (tab: any) => {
    setActiveWorkspaceProjectId(null);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#0B1120] text-slate-100 flex flex-col font-sans selection:bg-[#007AFF] selection:text-white">
      {/* Top Navigation */}
      <Navbar onOpenWallet={() => setIsWalletOpen(true)} />

      {/* Freelance Scope Quick Bar - shown on tablet/desktop to avoid mobile horizontal blowout */}
      <div className="hidden sm:block w-full max-w-full overflow-hidden bg-[#0B132B]/80 border-b border-[#1E2E4E] px-3 sm:px-4 py-2 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#00A3E0]" />
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
                ? 'Tester: Ezra Bosire (Gold Freelancer)'
                : role === 'admin'
                ? 'Admin & PM: Alex Vance (TTL Operations)'
                : 'Client: FinFlow Enterprise'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container with responsive padding and mobile bottom nav space */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8 min-w-0 overflow-x-hidden">
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
          activeTab === 'projects' ? (
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
        <div className="flex items-center justify-around">
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

              {/* Listings */}
              <button
                onClick={() => handleMobileNav('projects')}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-xl transition ${
                  activeTab === 'projects'
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

      {/* Footer (hidden or compact on mobile) */}
      <footer className="hidden md:block border-t border-[#1E2E4E] bg-[#0B132B]/80 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[#00A3E0] font-black text-sm">uTest</span>
            <span className="font-semibold text-slate-300">CrowdQA Platform by <strong className="text-[#007AFF]">Applause</strong></span>
            <span>•</span>
            <span>Automated Bounty Escrow & Multi-Rail Payout Gateway</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>256-Bit Encrypted Log Storage</span>
            <span>•</span>
            <span>Automated Status Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
