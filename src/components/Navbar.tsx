import React, { useState, useRef, useEffect } from 'react';
import {
  Bug,
  DollarSign,
  Bell,
  Users,
  ShieldCheck,
  ChevronDown,
  Layers,
  ArrowRightLeft,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Menu,
  X,
  Briefcase,
  FileCheck,
  CheckCircle2,
  Sliders,
  Wallet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationCenter } from './NotificationCenter';
import { UTestLogo } from './UTestLogo';

interface NavbarProps {
  onOpenWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWallet }) => {
  const {
    role,
    setRole,
    testerProfile,
    clientProfile,
    activeTab,
    setActiveTab,
    notifications,
    setActiveWorkspaceProjectId,
    resetToSampleData
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on escape key or resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unreadCount = notifications.filter(
    (n) => (n.targetRole === role || n.targetRole === 'tester') && !n.read
  ).length;

  const handleRoleToggle = () => {
    const nextRole = role === 'tester' ? 'client' : 'tester';
    setRole(nextRole);
    setActiveWorkspaceProjectId(null);
    if (nextRole === 'tester') {
      setActiveTab('projects');
    } else {
      setActiveTab('client_submissions');
    }
    setIsMobileMenuOpen(false);
  };

  const navigateTo = (tab: any) => {
    setActiveWorkspaceProjectId(null);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#1E2E4E] text-slate-100 w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-4">
            
            {/* Real uTest Brand Logo & Tag */}
            <div className="flex items-center space-x-2 shrink-0 min-w-0">
              <button
                onClick={() => navigateTo(role === 'tester' ? 'projects' : 'client_submissions')}
                className="text-left group shrink-0"
              >
                <UTestLogo size="sm" />
              </button>

              {/* Desktop Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold ml-2">
                {role === 'tester' ? (
                  <>
                    <button
                      onClick={() => navigateTo('projects')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'projects'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Browse Projects
                    </button>
                    <button
                      onClick={() => navigateTo('tasks')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'tasks'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      My Pipeline
                    </button>
                    <button
                      onClick={onOpenWallet}
                      className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#131E35] transition"
                    >
                      Wallet & Payouts
                    </button>
                    <button
                      onClick={() => navigateTo('profile_settings')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'profile_settings'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Profile & Fleet
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigateTo('client_submissions')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'client_submissions'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Review Submissions
                    </button>
                    <button
                      onClick={() => navigateTo('client_applicants')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'client_applicants'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Freelancer Fleet
                    </button>
                    <button
                      onClick={() => navigateTo('client_cycles')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'client_cycles'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Cycles & Budgets
                    </button>
                    <button
                      onClick={() => navigateTo('profile_settings')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeTab === 'profile_settings'
                          ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/25'
                          : 'text-slate-300 hover:text-white hover:bg-[#131E35]'
                      }`}
                    >
                      Organization
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
              
              {/* Role Switcher - shown on tablet/desktop */}
              <button
                onClick={handleRoleToggle}
                className="hidden sm:flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition bg-[#080D1A] border border-[#1E2E4E] text-slate-300 hover:text-white hover:border-[#00A3E0]/40"
                title="Toggle between Tester and Client view"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#00A3E0] shrink-0" />
                <span className="hidden lg:inline text-slate-400 font-normal">Role:</span>
                <span
                  className={
                    role === 'tester' ? 'text-amber-400 font-black' : 'text-[#00A3E0] font-black'
                  }
                >
                  {role === 'tester' ? 'Tester' : 'Client'}
                </span>
              </button>

              {/* Tester Wallet Pill */}
              {role === 'tester' && (
                <button
                  onClick={onOpenWallet}
                  className="flex items-center space-x-1 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition text-emerald-400 shrink-0"
                  title="Open Payout Wallet"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-black">
                    ${testerProfile.availableBalance.toFixed(0)}
                  </span>
                  <span className="hidden md:inline text-[10px] text-emerald-300/80 font-medium">
                    Payout
                  </span>
                </button>
              )}

              {/* Notification Bell Dropdown */}
              <div className="relative shrink-0" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-1.5 sm:p-2 rounded-xl bg-[#131E35] border border-[#1E2E4E] hover:bg-slate-700/80 text-slate-300 hover:text-white transition relative min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center shrink-0"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <NotificationCenter
                  isOpen={isNotifOpen}
                  onClose={() => setIsNotifOpen(false)}
                  onActionClick={() => setIsNotifOpen(false)}
                />
              </div>

              {/* Profile Avatar / Settings (Desktop) */}
              <button
                onClick={() => navigateTo('profile_settings')}
                className={`hidden md:flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-xl transition border text-left shrink-0 ${
                  activeTab === 'profile_settings'
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-xs'
                    : 'border-[#1E2E4E] hover:border-[#00A3E0]/40 bg-[#080D1A] text-slate-300'
                }`}
                title="Toggle Profile Settings"
              >
                <img
                  src={role === 'tester' ? testerProfile.avatar : clientProfile.avatar}
                  alt="Profile"
                  className="w-7 h-7 rounded-full object-cover border border-[#00A3E0]/40 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden lg:block">
                  <span className="text-xs font-bold text-white block leading-tight truncate max-w-[90px]">
                    {role === 'tester' ? testerProfile.name : clientProfile.name}
                  </span>
                  <span className="text-[10px] text-[#38BDF8] block leading-tight">
                    {activeTab === 'profile_settings' ? 'Settings' : (role === 'tester' ? `${testerProfile.tier}` : clientProfile.company)}
                  </span>
                </div>
              </button>

              {/* Reset sample data button (Desktop) */}
              <button
                onClick={() => {
                  if (confirm('Reset application state to initial sample data?')) {
                    resetToSampleData();
                  }
                }}
                className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-[#131E35] transition shrink-0"
                title="Reset state to sample data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 sm:p-2 rounded-xl bg-[#131E35] border border-[#1E2E4E] text-slate-300 hover:text-white transition min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center shrink-0"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Slide-down Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 sm:top-16 z-50 bg-[#0B132B] border-b border-[#1E2E4E] shadow-2xl animate-fade-in p-4 max-h-[calc(100vh-4rem)] overflow-y-auto space-y-4">
          
          {/* User Profile Card */}
          <div className="p-3 bg-[#111C33] rounded-xl border border-[#1E2E4E] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={role === 'tester' ? testerProfile.avatar : clientProfile.avatar}
                alt="Profile"
                className="w-10 h-10 rounded-xl object-cover border border-[#00A3E0]/40 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {role === 'tester' ? testerProfile.name : clientProfile.name}
                </h4>
                <p className="text-xs text-slate-400">
                  {role === 'tester' ? `${testerProfile.tier} QA Tester` : clientProfile.company}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('profile_settings')}
              className="px-3 py-1.5 bg-[#080D1A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition border border-[#1E2E4E]"
            >
              <Sliders className="w-3.5 h-3.5 text-[#00A3E0]" />
              <span>Settings</span>
            </button>
          </div>

          {/* Role Switcher Banner */}
          <div className="p-3 bg-gradient-to-r from-[#0B192C] via-[#111C33] to-[#0B192C] rounded-xl border border-[#00A3E0]/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Current Persona:</span>
              <strong className={role === 'tester' ? 'text-amber-400 text-xs' : 'text-[#00A3E0] text-xs'}>
                {role === 'tester' ? 'Freelance Tester View' : 'Enterprise Client Lead'}
              </strong>
            </div>
            <button
              onClick={handleRoleToggle}
              className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition shadow"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Switch to {role === 'tester' ? 'Client' : 'Tester'}</span>
            </button>
          </div>

          {/* Navigation Links for Mobile */}
          <div className="space-y-1 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
              Navigation
            </span>

            {role === 'tester' ? (
              <>
                <button
                  onClick={() => navigateTo('projects')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'projects'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Bug className="w-4 h-4 text-[#00A3E0]" />
                  <span>Browse Projects & Cycles</span>
                </button>

                <button
                  onClick={() => navigateTo('tasks')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'tasks'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Layers className="w-4 h-4 text-[#38BDF8]" />
                  <span>My Active Pipeline & Invites</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenWallet();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-between text-slate-300 hover:bg-[#111C33] transition"
                >
                  <div className="flex items-center space-x-2.5">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Payout Wallet & Earnings</span>
                  </div>
                  <span className="text-emerald-400 font-bold">
                    ${testerProfile.availableBalance.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => navigateTo('profile_settings')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'profile_settings'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#00A3E0]" />
                  <span>Tester Profile, Fleet & Toggles</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigateTo('client_submissions')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'client_submissions'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <FileCheck className="w-4 h-4 text-purple-400" />
                  <span>Review Submissions & Tasks</span>
                </button>

                <button
                  onClick={() => navigateTo('client_applicants')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'client_applicants'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Users className="w-4 h-4 text-[#00A3E0]" />
                  <span>Freelancer Applicant Fleet</span>
                </button>

                <button
                  onClick={() => navigateTo('client_cycles')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'client_cycles'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-[#38BDF8]" />
                  <span>Cycles, Escrow & Budgets</span>
                </button>

                <button
                  onClick={() => navigateTo('profile_settings')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2.5 transition ${
                    activeTab === 'profile_settings'
                      ? 'bg-[#007AFF] text-white font-bold'
                      : 'text-slate-300 hover:bg-[#111C33]'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#00A3E0]" />
                  <span>Organization & Matrix Settings</span>
                </button>
              </>
            )}
          </div>

          {/* Bottom Tools */}
          <div className="pt-3 border-t border-[#1E2E4E] flex items-center justify-between">
            <button
              onClick={() => {
                if (confirm('Reset application state to initial sample data?')) {
                  resetToSampleData();
                  setIsMobileMenuOpen(false);
                }
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 p-2 rounded-lg hover:bg-[#111C33] transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Sample Data</span>
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-xs text-slate-400 hover:text-white p-2"
            >
              Close Menu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
