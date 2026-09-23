import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Bell,
  Briefcase,
  Bug,
  FileCheck,
  Layers,
  Menu,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Users,
  Wallet,
  X,
  LogOut
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationCenter } from './NotificationCenter';
import { ConnectfyLogo } from './UTestLogo';

interface NavbarProps {
  onOpenWallet: () => void;
  onLogout: () => void;
}

type NavItem = {
  label: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const Navbar: React.FC<NavbarProps> = ({ onOpenWallet, onLogout }) => {
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unreadCount = notifications.filter(
    notification => (notification.targetRole === role || notification.targetRole === 'tester') && !notification.read
  ).length;

  const navigateTo = (tab: string) => {
    setActiveWorkspaceProjectId(null);
    setActiveTab(tab as any);
    setIsMobileMenuOpen(false);
  };

  const handleRoleToggle = () => {
    const nextRole = role === 'tester' ? 'client' : 'tester';
    setRole(nextRole);
    setActiveWorkspaceProjectId(null);
    setActiveTab(nextRole === 'tester' ? 'projects' : 'client_submissions');
    setIsMobileMenuOpen(false);
  };

  const navItems: NavItem[] = role === 'tester'
    ? [
        { label: 'Browse Projects', tab: 'projects', icon: Bug },
        { label: 'My Pipeline', tab: 'tasks', icon: Layers },
        { label: 'Profile & Fleet', tab: 'profile_settings', icon: Sliders }
      ]
    : role === 'admin'
      ? [
          { label: 'PM Operations', tab: 'admin_manager', icon: ShieldCheck },
          { label: 'Project Listings', tab: 'projects', icon: Briefcase },
          { label: 'Submission Reviews', tab: 'client_submissions', icon: FileCheck },
          { label: 'Settings', tab: 'profile_settings', icon: Sliders }
        ]
      : [
          { label: 'Review Submissions', tab: 'client_submissions', icon: FileCheck },
          { label: 'Freelancer Fleet', tab: 'client_applicants', icon: Users },
          { label: 'Cycles & Budgets', tab: 'client_cycles', icon: Briefcase },
          { label: 'Organization', tab: 'profile_settings', icon: Sliders }
        ];

  const personName = role === 'tester' ? testerProfile.name : clientProfile.name;
  const personSubtitle = role === 'tester' ? `${testerProfile.tier} QA Tester` : role === 'admin' ? 'Operations & PM' : clientProfile.company;
  const personAvatar = role === 'tester' ? testerProfile.avatar : clientProfile.avatar;

  const renderNavItems = () => (
    <nav className="space-y-1" aria-label="Primary navigation">
      <span className="block px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</span>
      {navItems.map(({ label, tab, icon: Icon }) => (
        <button
          key={tab}
          onClick={() => navigateTo(tab)}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
            activeTab === tab ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/20' : 'text-slate-300 hover:bg-[#131E35] hover:text-white'
          }`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${activeTab === tab ? 'text-white' : 'text-[#38BDF8]'}`} />
          <span>{label}</span>
        </button>
      ))}
      {role === 'tester' && (
        <button
          onClick={() => { setIsMobileMenuOpen(false); onOpenWallet(); }}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition hover:bg-[#131E35] hover:text-white"
        >
          <span className="flex items-center gap-3"><Wallet className="h-4 w-4 text-emerald-400" />Wallet & Payouts</span>
          <span className="font-black text-emerald-400">${testerProfile.availableBalance.toFixed(0)}</span>
        </button>
      )}
    </nav>
  );

  return (
    <>
      <aside className="theme-sidebar fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-[#1E2E4E] bg-[#0B132B] px-4 py-5 md:flex">
        <button onClick={() => navigateTo(role === 'tester' ? 'projects' : role === 'admin' ? 'admin_manager' : 'client_submissions')} className="mb-8 text-left">
          <ConnectfyLogo size="sm" />
        </button>
        <div className="mb-6 rounded-2xl border border-[#1E2E4E] bg-[#111C33] p-3">
          <div className="flex items-center gap-3">
            <img src={personAvatar} alt="Profile" className="h-10 w-10 rounded-xl border border-[#00A3E0]/40 object-cover" referrerPolicy="no-referrer" />
            <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{personName}</p><p className="truncate text-[10px] text-slate-400">{personSubtitle}</p></div>
          </div>
          <button onClick={handleRoleToggle} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E2E4E] bg-[#080D1A] px-2 py-2 text-[10px] font-bold text-slate-300 transition hover:border-[#00A3E0]/50 hover:text-white">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[#00A3E0]" />Switch to {role === 'tester' ? 'Client' : 'Tester'}
          </button>
        </div>
        {renderNavItems()}
        <div className="mt-auto border-t border-[#1E2E4E] pt-4">
          <button onClick={() => navigateTo('profile_settings')} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-[#131E35] hover:text-white"><Sliders className="h-4 w-4 text-[#38BDF8]" />Account settings</button>
          <button onClick={() => { if (confirm('Reset application state to initial sample data?')) resetToSampleData(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-[#131E35] hover:text-slate-300"><RotateCcw className="h-4 w-4" />Reset sample data</button>
          <button onClick={onLogout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-[#131E35] hover:text-slate-300"><LogOut className="h-4 w-4" />Log out</button>
        </div>
      </aside>

      <header className="theme-topbar sticky top-0 z-40 w-full border-b border-[#1E2E4E] bg-[#0B132B]/95 text-slate-100 backdrop-blur-md md:ml-64 md:w-[calc(100%-16rem)]">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <div className="md:hidden"><ConnectfyLogo size="sm" showSubtitle={false} /></div>
            <div className="hidden min-w-0 sm:block"><p className="text-xs font-semibold text-slate-400">{role === 'tester' ? 'Tester workspace' : role === 'admin' ? 'Operations workspace' : 'Client workspace'}</p><p className="truncate text-sm font-bold text-white">{activeTab === 'profile_settings' ? 'Account settings' : 'Manage your testing workflow'}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role === 'tester' && <button onClick={onOpenWallet} className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-black text-emerald-400 transition hover:bg-emerald-500/20" title="Open payout wallet"><Wallet className="h-3.5 w-3.5" />${testerProfile.availableBalance.toFixed(0)}</button>}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#1E2E4E] bg-[#131E35] text-slate-300 transition hover:text-white" title="Notifications"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{unreadCount}</span>}</button>
              <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} onActionClick={() => setIsNotifOpen(false)} />
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1E2E4E] bg-[#131E35] text-slate-300 md:hidden" aria-label="Toggle navigation menu">{isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && <div className="fixed inset-x-0 top-14 z-50 space-y-4 border-b border-[#1E2E4E] bg-[#0B132B] p-4 shadow-2xl sm:top-16 md:hidden">
        <div className="flex items-center justify-between rounded-xl border border-[#1E2E4E] bg-[#111C33] p-3"><div className="flex min-w-0 items-center gap-3"><img src={personAvatar} alt="Profile" className="h-10 w-10 rounded-xl object-cover" referrerPolicy="no-referrer" /><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{personName}</p><p className="truncate text-xs text-slate-400">{personSubtitle}</p></div></div><button onClick={handleRoleToggle} className="ml-3 shrink-0 rounded-lg bg-[#007AFF] px-2.5 py-2 text-[10px] font-bold text-white"><ArrowRightLeft className="mr-1 inline h-3 w-3" />Switch role</button></div>
        {renderNavItems()}
        <button onClick={onLogout} className="mt-3 flex w-full items-center gap-3 rounded-xl border-t border-[#1E2E4E] px-3 pt-3 text-xs font-semibold text-slate-500"><LogOut className="h-4 w-4" />Log out</button>
      </div>}
    </>
  );
};
