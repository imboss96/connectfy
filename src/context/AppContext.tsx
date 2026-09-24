import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  UserRole,
  Project,
  ProjectApplication,
  BugReport,
  NotificationItem,
  WalletTransaction,
  TesterProfile,
  ClientProfile,
  PayoutRequest,
  DeviceFleetItem,
  TaskSubmission,
  InviteHistoryEntry
} from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createProjectInSupabase, deleteProjectFromSupabase, fetchApplicationsFromSupabase, fetchProjectsFromSupabase, updateApplicationInSupabase, upsertApplicationInSupabase, updateProjectInSupabase } from '../lib/projectRepository';
import { formatProjectEmailType, sendProjectEmail } from '../lib/emailService';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  projects: Project[];
  applications: ProjectApplication[];
  bugReports: BugReport[];
  taskSubmissions: TaskSubmission[];
  notifications: NotificationItem[];
  walletTransactions: WalletTransaction[];
  testerProfile: TesterProfile;
  clientProfile: ClientProfile;
  activeWorkspaceProjectId: string | null;
  setActiveWorkspaceProjectId: (id: string | null) => void;
  
  // Navigation tabs
  activeTab: 'projects' | 'tasks' | 'wallet' | 'client_cycles' | 'client_applicants' | 'client_submissions' | 'profile_settings' | 'admin_manager' | 'crm';
  setActiveTab: (tab: any) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;

  // Profile actions
  updateTesterProfile: (updates: Partial<TesterProfile>) => void;
  updateClientProfile: (updates: Partial<ClientProfile>) => void;
  addTesterDevice: (device: Omit<DeviceFleetItem, 'id'>) => void;
  removeTesterDevice: (deviceId: string) => void;
  toggleTesterDeviceActive: (deviceId: string) => void;
  setTesterPrimaryDevice: (deviceId: string) => void;

  // Actions
  applyToProject: (projectId: string, devices: string[], experienceNote: string) => Promise<boolean>;
  approveApplication: (appId: string) => void;
  resendInvite: (appId: string) => void;
  rejectApplication: (appId: string) => void;
  acceptInvite: (appId: string) => void;
  declineInvite: (appId: string) => void;
  submitBugReport: (bugData: Omit<BugReport, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>) => BugReport;
  approveBugReport: (bugId: string, customBounty?: number, feedback?: string, rating?: number) => void;
  rejectBugReport: (bugId: string, feedback: string) => void;
  requestBugRevision: (bugId: string, feedback: string) => void;
  submitTaskDeliverable: (data: Omit<TaskSubmission, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>) => TaskSubmission;
  approveTaskSubmission: (submissionId: string, customBounty?: number, feedback?: string, rating?: number) => void;
  rejectTaskSubmission: (submissionId: string, feedback: string) => void;
  requestTaskRevision: (submissionId: string, feedback: string) => void;
  requestPayout: (amount: number, method: 'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise', destination: string) => Promise<PayoutRequest>;
  createProject: (newProject: Omit<Project, 'id' | 'createdAt' | 'budgetDisbursed' | 'slotsFilled'>) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'utest_crowdqa_';

const createApplicationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'app-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
};

const getInitials = (name?: string, email?: string) => {
  const source = (name || email || 'User').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const createLetterAvatar = (name?: string, email?: string) => {
  const initials = getInitials(name, email);
  const palette = ['0F766E', '2563EB', '7C3AED', 'F59E0B', 'DC2626', '0EA5E9'];
  const color = palette[Math.abs(initials.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="32" fill="#${color}"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48" font-weight="700" font-family="Arial, sans-serif">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const normalizeInviteHistory = (value: unknown): InviteHistoryEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      sentAt: String(entry.sentAt || ''),
      type: (entry.type === 'resend' ? 'resend' : 'invite') as 'invite' | 'resend',
      note: String(entry.note || 'Invite sent')
    }))
    .filter((entry) => entry.sentAt);
};

const emptyTesterProfile: TesterProfile = {
  id: '',
  name: '',
  email: '',
  phone: '',
  avatar: createLetterAvatar('', ''),
  country: '',
  city: '',
  stateOrProvince: '',
  postalCode: '',
  timezone: '',
  headline: '',
  bio: '',
  languages: [],
  tier: 'Bronze',
  rating: 0,
  totalReviews: 0,
  acceptanceRate: 0,
  availableBalance: 0,
  pendingEscrow: 0,
  lifetimeEarnings: 0,
  approvedBugsCount: 0,
  completedCyclesCount: 0,
  devices: [],
  deviceFleet: [],
  badges: [],
  academyBadges: [],
  skills: [],
  paymentSettings: {
    preferredMethod: 'PayPal',
    paypalEmail: '',
    payoneerId: '',
    wiseEmail: '',
    bankDetails: {
      bankName: '',
      accountHolder: '',
      ibanOrAccount: '',
      swiftBic: ''
    },
    autoWithdraw: false,
    autoWithdrawThreshold: 50,
    taxFormType: 'W-8BEN',
    taxStatus: 'Pending Review',
    taxIdMasked: '',
    taxCountry: ''
  },
  preferences: {
    availableForCycles: true,
    maxWeeklyHours: 20,
    weekendTesting: false,
    ndaAgreed: false,
    instantEmailAlerts: true,
    instantSmsAlerts: false,
    highBountyOnly: false,
    realMoneyTesting: true,
    apkSideloadingAllowed: false,
    interestedCategories: []
  }
};

const emptyClientProfile: ClientProfile = {
  id: '',
  name: '',
  company: '',
  companyLogo: '',
  contactPerson: '',
  email: '',
  phone: '',
  avatar: createLetterAvatar('', ''),
  industry: '',
  website: '',
  billingAddress: '',
  totalProjects: 0,
  activeCycles: 0,
  testersEngaged: 0,
  totalPaidOut: 0,
  escrowBalance: 0,
  defaultBountyMatrix: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  },
  ndaRequired: false
};

const isDemoWalletTransaction = (tx: Partial<WalletTransaction>) => {
  if (!tx) return false;
  return (
    tx.testerId === 'tester-ezra-01' ||
    tx.referenceId === 'REF-BTY-89421' ||
    tx.referenceId === 'REF-BTY-77312' ||
    tx.referenceId === 'PAY-OUT-66109' ||
    tx.description?.includes('Ezra') ||
    tx.description?.includes('FinFlow') ||
    tx.description?.includes('HealthPulse')
  );
};

const isDemoProject = (project: Partial<Project>) => {
  if (!project) return false;
  return (
    project.id === 'proj-fintech-01' ||
    project.id === 'proj-ai-voice-05' ||
    project.id === 'proj-ai-redteam-06' ||
    project.id === 'proj-field-pos-07' ||
    project.company === 'Connectfy' ||
    project.title?.includes('Demo') ||
    project.title?.includes('Sample') ||
    project.title?.includes('FinFlow') ||
    project.title?.includes('HealthPulse')
  );
};

const isDemoApplication = (application: Partial<ProjectApplication>) => {
  if (!application) return false;
  return (
    application.testerId === 'tester-ezra-01' ||
    application.testerName === 'Ezra Bosire' ||
    application.testerEmail === 'ezrahbosire1@gmail.com' ||
    application.projectId === 'proj-fintech-01' ||
    application.projectId === 'proj-ai-voice-05' ||
    application.projectId === 'proj-ai-redteam-06' ||
    application.projectId === 'proj-field-pos-07'
  );
};

const isDemoSubmission = (submission: Partial<BugReport | TaskSubmission>) => {
  if (!submission) return false;
  return (
    submission.testerId === 'tester-ezra-01' ||
    submission.testerName === 'Ezra Bosire' ||
    submission.projectId === 'proj-fintech-01' ||
    submission.projectId === 'proj-ai-voice-05' ||
    submission.projectId === 'proj-ai-redteam-06' ||
    submission.projectId === 'proj-field-pos-07' ||
    submission.title?.includes('3DS') ||
    submission.title?.includes('Currency conversion') ||
    submission.title?.includes('Voice Utterances') ||
    submission.title?.includes('Jailbreak Prompt') ||
    submission.title?.includes('Store Audit')
  );
};

const sanitizeSavedState = () => {
  const savedWallet = localStorage.getItem(STORAGE_PREFIX + 'walletTransactions');
  if (savedWallet) {
    try {
      const parsed = JSON.parse(savedWallet);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(tx => !isDemoWalletTransaction(tx));
        localStorage.setItem(STORAGE_PREFIX + 'walletTransactions', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'walletTransactions');
    }
  }

  const savedBugReports = localStorage.getItem(STORAGE_PREFIX + 'bugReports');
  if (savedBugReports) {
    try {
      const parsed = JSON.parse(savedBugReports);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(item => !isDemoSubmission(item));
        localStorage.setItem(STORAGE_PREFIX + 'bugReports', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'bugReports');
    }
  }

  const savedTaskSubmissions = localStorage.getItem(STORAGE_PREFIX + 'taskSubmissions');
  if (savedTaskSubmissions) {
    try {
      const parsed = JSON.parse(savedTaskSubmissions);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(item => !isDemoSubmission(item));
        localStorage.setItem(STORAGE_PREFIX + 'taskSubmissions', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'taskSubmissions');
    }
  }

  const savedNotifications = localStorage.getItem(STORAGE_PREFIX + 'notifications');
  if (savedNotifications) {
    try {
      const parsed = JSON.parse(savedNotifications);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(item => item.userId !== 'tester-ezra-01');
        localStorage.setItem(STORAGE_PREFIX + 'notifications', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'notifications');
    }
  }

  const savedProjects = localStorage.getItem(STORAGE_PREFIX + 'projects');
  if (savedProjects) {
    try {
      const parsed = JSON.parse(savedProjects);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(project => !isDemoProject(project));
        localStorage.setItem(STORAGE_PREFIX + 'projects', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'projects');
    }
  }

  const savedApplications = localStorage.getItem(STORAGE_PREFIX + 'applications');
  if (savedApplications) {
    try {
      const parsed = JSON.parse(savedApplications);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(app => !isDemoApplication(app));
        localStorage.setItem(STORAGE_PREFIX + 'applications', JSON.stringify(clean));
      }
    } catch {
      localStorage.removeItem(STORAGE_PREFIX + 'applications');
    }
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  sanitizeSavedState();
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'role');
    return (saved === 'client' || saved === 'tester' || saved === 'admin') ? (saved as UserRole) : 'tester';
  });

  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'wallet' | 'client_cycles' | 'client_applicants' | 'client_submissions' | 'profile_settings' | 'admin_manager' | 'crm'>('projects');
  const [activeWorkspaceProjectId, setActiveWorkspaceProjectId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'projects');
    return saved ? JSON.parse(saved) : [];
  });

  const [applications, setApplications] = useState<ProjectApplication[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'applications');
    return saved ? JSON.parse(saved) : [];
  });

  const [bugReports, setBugReports] = useState<BugReport[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'bugReports');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => !isDemoSubmission(item));
    } catch {
      return [];
    }
  });

  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'taskSubmissions');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => !isDemoSubmission(item));
    } catch {
      return [];
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>('');

  const getActiveUserContext = async () => {
    if (!isSupabaseConfigured || !supabase) return { userId: testerProfile.id || '', email: testerProfile.email || '' };

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { userId: testerProfile.id || '', email: testerProfile.email || '' };
    }

    return {
      userId: user.id,
      email: user.email || testerProfile.email || ''
    };
  };

  const resolveTesterEmail = async (testerId: string, fallbackEmail = ''): Promise<string> => {
    const normalizedFallback = fallbackEmail || testerProfile.email || '';
    if (!testerId) return normalizedFallback;

    if (normalizedFallback && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedFallback)) {
      return normalizedFallback;
    }

    if (!isSupabaseConfigured || !supabase) return normalizedFallback;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', testerId)
        .maybeSingle();

      if (!error && data?.email) {
        return data.email;
      }
    } catch (error) {
      console.error('Unable to resolve tester email from profile:', error);
    }

    return normalizedFallback;
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'notifications');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item.userId !== 'tester-ezra-01');
    } catch {
      return [];
    }
  });

  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'walletTransactions');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(tx => !isDemoWalletTransaction(tx));
    } catch {
      return [];
    }
  });

  const [testerProfile, setTesterProfile] = useState<TesterProfile>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'testerProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...emptyTesterProfile,
          ...parsed,
          deviceFleet: parsed.deviceFleet && parsed.deviceFleet.length > 0 ? parsed.deviceFleet : emptyTesterProfile.deviceFleet,
          skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : emptyTesterProfile.skills,
          academyBadges: parsed.academyBadges && parsed.academyBadges.length > 0 ? parsed.academyBadges : emptyTesterProfile.academyBadges,
          paymentSettings: {
            ...emptyTesterProfile.paymentSettings,
            ...(parsed.paymentSettings || {})
          },
          preferences: {
            ...emptyTesterProfile.preferences,
            ...(parsed.preferences || {})
          },
          languages: parsed.languages && parsed.languages.length > 0 ? parsed.languages : emptyTesterProfile.languages
        };
      } catch {
        return emptyTesterProfile;
      }
    }
    return emptyTesterProfile;
  });

  const [clientProfile, setClientProfile] = useState<ClientProfile>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'clientProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...emptyClientProfile,
          ...parsed,
          defaultBountyMatrix: {
            ...emptyClientProfile.defaultBountyMatrix,
            ...(parsed.defaultBountyMatrix || {})
          }
        };
      } catch {
        return emptyClientProfile;
      }
    }
    return emptyClientProfile;
  });

  const persistProfileToSupabase = async (profileData: Record<string, any>) => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const testerSnapshot = profileData.testerProfile || testerProfile;
      const clientSnapshot = profileData.clientProfile || clientProfile;

      const fullProfileData = {
        testerProfile: {
          ...emptyTesterProfile,
          ...testerSnapshot,
          paymentSettings: {
            ...emptyTesterProfile.paymentSettings,
            ...(testerSnapshot.paymentSettings || {})
          },
          preferences: {
            ...emptyTesterProfile.preferences,
            ...(testerSnapshot.preferences || {})
          },
          deviceFleet: testerSnapshot.deviceFleet || emptyTesterProfile.deviceFleet,
          devices: testerSnapshot.devices || emptyTesterProfile.devices,
          skills: testerSnapshot.skills || emptyTesterProfile.skills,
          languages: testerSnapshot.languages || emptyTesterProfile.languages,
          academyBadges: testerSnapshot.academyBadges || emptyTesterProfile.academyBadges
        },
        clientProfile: {
          ...emptyClientProfile,
          ...clientSnapshot,
          defaultBountyMatrix: {
            ...emptyClientProfile.defaultBountyMatrix,
            ...(clientSnapshot.defaultBountyMatrix || {})
          }
        }
      };

      await supabase.from('profiles').upsert({
        id: user.id,
        email: profileData.email || testerSnapshot.email || clientSnapshot.email || user.email || '',
        name: profileData.name || testerSnapshot.name || clientSnapshot.name || '',
        company: profileData.company || clientSnapshot.company || '',
        avatar_url: profileData.avatar || testerSnapshot.avatar || clientSnapshot.avatar || null,
        country: profileData.country || testerSnapshot.country || '',
        city: profileData.city || testerSnapshot.city || '',
        role: profileData.role || role || 'tester',
        profile_data: fullProfileData
      }, { onConflict: 'id' });
    } catch (error) {
      console.error('Unable to save profile to Supabase:', error);
    }
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'role', role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'applications', JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'bugReports', JSON.stringify(bugReports));
  }, [bugReports]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'taskSubmissions', JSON.stringify(taskSubmissions));
  }, [taskSubmissions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'walletTransactions', JSON.stringify(walletTransactions));
  }, [walletTransactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'testerProfile', JSON.stringify(testerProfile));
  }, [testerProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + 'clientProfile', JSON.stringify(clientProfile));
  }, [clientProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let mounted = true;

    const loadNotifications = async (userId: string) => {
      if (!userId) {
        setNotifications([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          targetRole: item.target_role || 'tester',
          title: item.title,
          message: item.message,
          type: item.type,
          read: Boolean(item.read),
          createdAt: item.created_at ? new Date(item.created_at).toISOString().replace('T', ' ').substring(0, 16) : '',
          relatedProjectId: item.project_id || undefined,
          relatedSubmissionId: item.submission_id || undefined,
          amount: item.amount ?? undefined
        } as NotificationItem));

        setNotifications(mapped);
      } catch (error) {
        console.error('Unable to load notifications from Supabase:', error);
      }
    };

    const syncAuthProfile = async (userId: string) => {
      setCurrentUserId(userId);
      try {
        const savedTester = localStorage.getItem(STORAGE_PREFIX + 'testerProfile');
        const savedClient = localStorage.getItem(STORAGE_PREFIX + 'clientProfile');
        const persistedTesterProfile = savedTester ? JSON.parse(savedTester) : null;
        const persistedClientProfile = savedClient ? JSON.parse(savedClient) : null;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, name, email, role, company, avatar_url, country, city, profile_data')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        if (!profile || !mounted) return;

        const displayName = profile.name || profile.email?.split('@')[0] || 'User';
        const displayEmail = profile.email || '';
        const displayAvatar = profile.avatar_url || createLetterAvatar(displayName, displayEmail);
        const savedProfileData = (profile.profile_data && typeof profile.profile_data === 'object' && Object.keys(profile.profile_data as Record<string, any>).length > 0)
          ? profile.profile_data as Record<string, any>
          : {};
        const savedTesterProfile = savedProfileData.testerProfile || persistedTesterProfile || {};
        const savedClientProfile = savedProfileData.clientProfile || persistedClientProfile || {};

        setTesterProfile({
          ...emptyTesterProfile,
          ...(persistedTesterProfile || {}),
          ...savedTesterProfile,
          id: userId,
          name: savedTesterProfile.name || displayName,
          email: savedTesterProfile.email || displayEmail,
          avatar: savedTesterProfile.avatar || displayAvatar,
          country: savedTesterProfile.country || profile.country || '',
          city: savedTesterProfile.city || profile.city || '',
          tier: 'Unrated',
          rating: 0,
          totalReviews: 0,
          acceptanceRate: 0,
          availableBalance: 0,
          pendingEscrow: 0,
          lifetimeEarnings: 0,
          approvedBugsCount: 0,
          completedCyclesCount: 0,
          badges: [],
          skills: Array.isArray(savedTesterProfile.skills) && savedTesterProfile.skills.length > 0 ? savedTesterProfile.skills : emptyTesterProfile.skills,
          deviceFleet: Array.isArray(savedTesterProfile.deviceFleet) && savedTesterProfile.deviceFleet.length > 0 ? savedTesterProfile.deviceFleet : emptyTesterProfile.deviceFleet,
          devices: Array.isArray(savedTesterProfile.devices) && savedTesterProfile.devices.length > 0 ? savedTesterProfile.devices : emptyTesterProfile.devices,
          paymentSettings: {
            ...emptyTesterProfile.paymentSettings,
            ...(savedTesterProfile.paymentSettings || {})
          },
          preferences: {
            ...emptyTesterProfile.preferences,
            ...(savedTesterProfile.preferences || {})
          },
          languages: Array.isArray(savedTesterProfile.languages) && savedTesterProfile.languages.length > 0 ? savedTesterProfile.languages : emptyTesterProfile.languages
        });

        setClientProfile({
          ...emptyClientProfile,
          ...(persistedClientProfile || {}),
          ...savedClientProfile,
          id: userId,
          name: savedClientProfile.name || (profile.role === 'client' || profile.role === 'admin' ? displayName : ''),
          company: savedClientProfile.company || profile.company || '',
          email: savedClientProfile.email || displayEmail,
          avatar: savedClientProfile.avatar || displayAvatar,
          totalProjects: 0,
          activeCycles: 0,
          testersEngaged: 0,
          totalPaidOut: 0,
          escrowBalance: 0,
          defaultBountyMatrix: {
            ...emptyClientProfile.defaultBountyMatrix,
            ...(savedClientProfile.defaultBountyMatrix || {})
          }
        });
      } catch (error) {
        console.error('Unable to sync user profile from Supabase:', error);
      }
    };

    const loadProjects = async () => {
      try {
        const serverProjects = await fetchProjectsFromSupabase();
        if (mounted && serverProjects.length > 0) setProjects(serverProjects);
      } catch (error) {
        console.error('Unable to load projects from Supabase:', error);
      }
    };

    const loadApplications = async () => {
      try {
        const serverApplications = await fetchApplicationsFromSupabase();
        if (!mounted) return;

        const mapped = serverApplications.map((app: any) => ({
          id: app.id,
          projectId: app.project_id,
          testerId: app.tester_id,
          testerName: app.profiles?.name || app.tester_name || 'Tester',
          testerEmail: app.profiles?.email || app.tester_email || '',
          testerRating: Number(app.profiles?.profile_data?.testerProfile?.rating || app.tester_rating || 0),
          testerTier: app.profiles?.profile_data?.testerProfile?.tier || app.tester_tier || 'Bronze',
          appliedDate: app.applied_at ? new Date(app.applied_at).toISOString().replace('T', ' ').substring(0, 16) : '',
          selectedDevices: Array.isArray(app.selected_devices) ? app.selected_devices : [],
          experienceNote: app.experience_note || '',
          status: app.status || 'pending',
          inviteStatus: app.invite_status || undefined,
          acceptedInviteAt: app.accepted_invite_at ? new Date(app.accepted_invite_at).toISOString().replace('T', ' ').substring(0, 16) : undefined,
          lastInviteSentAt: app.last_invite_sent_at ? new Date(app.last_invite_sent_at).toISOString().replace('T', ' ').substring(0, 16) : undefined,
          inviteHistory: normalizeInviteHistory(app.invite_history),
          projectTitle: app.project?.title || undefined,
          projectCompany: app.project?.company || undefined
        }));

        setApplications(mapped);
      } catch (error) {
        console.error('Unable to load applications from Supabase:', error);
      }
    };

    void loadProjects();
    void loadApplications();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setCurrentUserId(session.user.id);
        await syncAuthProfile(session.user.id);
        await loadNotifications(session.user.id);
        void loadProjects();
        void loadApplications();
      } else {
        setCurrentUserId('');
        setNotifications([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCurrentUserId(data.session.user.id);
        void syncAuthProfile(data.session.user.id);
        void loadNotifications(data.session.user.id);
      }
    });

    const realtimeChannel = supabase.channel('live-notifications');
    realtimeChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications'
      },
      (payload: any) => {
        if (!currentUserId) return;

        const row = payload.new || payload.old;
        if (!row || row.user_id !== currentUserId) return;

        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [{
            id: row.id,
            userId: row.user_id,
            targetRole: row.target_role || 'tester',
            title: row.title,
            message: row.message,
            type: row.type,
            read: Boolean(row.read),
            createdAt: row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 16) : '',
            relatedProjectId: row.project_id || undefined,
            relatedSubmissionId: row.submission_id || undefined,
            amount: row.amount ?? undefined
          }, ...prev.filter(n => n.id !== row.id)]);
        }

        if (payload.eventType === 'UPDATE') {
          setNotifications(prev => prev.map(n => n.id === row.id ? { ...n, read: Boolean(row.read) } : n));
        }
      }
    );

    realtimeChannel.subscribe();

    return () => {
      mounted = false;
      realtimeChannel.unsubscribe();
      listener.subscription.unsubscribe();
    };
  }, [currentUserId]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'client') {
      setActiveTab('client_cycles');
    } else {
      setActiveTab('projects');
    }
  };

  const addNotification = (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    const recipientId = item.userId || currentUserId || testerProfile.id || clientProfile.id;
    const normalizedTargetRole = item.targetRole || role;
    const newNotif: NotificationItem = {
      ...item,
      userId: recipientId,
      targetRole: normalizedTargetRole,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      read: false,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)]);

    if (isSupabaseConfigured && supabase && recipientId) {
      void supabase.from('notifications').insert({
        user_id: recipientId,
        target_role: normalizedTargetRole,
        title: newNotif.title,
        message: newNotif.message,
        type: newNotif.type,
        read: false,
        project_id: newNotif.relatedProjectId || null,
        submission_id: newNotif.relatedSubmissionId || null,
        amount: newNotif.amount ?? null,
        created_at: new Date().toISOString()
      });
    }
  };

  const triggerProjectEmail = async (type: 'application' | 'invite' | 'accepted' | 'rejected' | 'declined', projectId: string, testerId: string, testerName: string, testerEmail: string, applicationId?: string) => {
    const resolvedTesterEmail = await resolveTesterEmail(testerId, testerEmail);

    if (!resolvedTesterEmail) {
      console.warn('Project email blocked: missing tester email in profile.', { projectId, testerId, testerName });
      return;
    }

    let project = projects.find(p => p.id === projectId);

    if (!project && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*, project_resources(label,url,sort_order)')
          .eq('id', projectId)
          .maybeSingle();

        if (!error && data) {
          project = {
            id: data.id,
            title: data.title || 'Project Opportunity',
            company: data.company || 'Connectfy',
            category: data.category || 'Functional',
            projectTrack: data.project_track || undefined,
            paymentModel: data.payment_model || undefined,
            status: data.status || 'active',
            deadline: data.deadline || '',
            slotsTotal: Number(data.slots_total || 0),
            slotsFilled: Number(data.slots_filled || 0),
            totalBudget: Number(data.total_budget || 0),
            budgetDisbursed: Number(data.budget_disbursed || 0),
            clientId: data.client_id || '',
            createdAt: data.created_at || new Date().toISOString(),
            taskUnitName: data.project_data?.taskUnitName,
            taskRate: data.project_data?.taskRate,
            deliverablesGuide: data.project_data?.deliverablesGuide,
            companyLogo: data.project_data?.companyLogo,
            resources: Array.isArray(data.project_data?.resources) ? data.project_data.resources : [],
            fullOverview: data.full_overview || data.project_data?.fullOverview || '',
            shortDescription: data.short_description || data.project_data?.shortDescription || '',
            requiredDevices: Array.isArray(data.project_data?.requiredDevices) ? data.project_data.requiredDevices : [],
            supportedCountries: Array.isArray(data.project_data?.supportedCountries) ? data.project_data.supportedCountries : [],
            inScope: Array.isArray(data.project_data?.inScope) ? data.project_data.inScope : [],
            outOfScope: Array.isArray(data.project_data?.outOfScope) ? data.project_data.outOfScope : [],
            bountyStructure: data.project_data?.bountyStructure || { critical: 0, high: 0, medium: 0, low: 0, testCaseBounty: 0 }
          } as Project;
          project.resources = Array.isArray(data.project_resources)
            ? data.project_resources.sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((resource: any) => ({ label: resource.label, url: resource.url }))
            : project.resources;
        }
      } catch (fetchError) {
        console.error('Project email trigger failed while fetching project details:', fetchError);
      }
    }

    const resolvedProjectTitle = project?.title || 'Project Opportunity';
    const resolvedProjectCompany = project?.company || 'Connectfy';
    const resolvedProjectDescription = project?.shortDescription || project?.fullOverview || 'A project opportunity is ready for review.';
    const actionUrl = type === 'invite' && applicationId
      ? `${window.location.origin}?project=${projectId}&application=${applicationId}&accept=1`
      : `${window.location.origin}?project=${projectId}`;
    const normalizedType = formatProjectEmailType(type);
    let emailSent = false;

    try {
      emailSent = await sendProjectEmail({
        type: normalizedType,
        toEmail: resolvedTesterEmail,
        toName: testerName || 'Tester',
        projectTitle: resolvedProjectTitle,
        projectCompany: resolvedProjectCompany,
        projectDescription: resolvedProjectDescription,
        projectDeadline: project?.deadline,
        projectCategory: project?.category || 'Functional',
        reason: project?.shortDescription || '',
        actionUrl,
        projectLink: actionUrl,
        projectResources: project?.resources || []
      });

    } catch (error) {
      console.error('Project email trigger failed:', error);
      const message = error instanceof Error ? error.message : 'Email backend request failed.';
      if (typeof window !== 'undefined') {
        window.alert(`Project email failed: ${message}`);
      }
    }

    addNotification({
      userId: testerId,
      targetRole: 'tester',
      title: !emailSent
        ? 'Project Email Failed'
        : normalizedType === 'application' ? 'Application Received' : normalizedType === 'invite' ? 'Project Invite Sent' : normalizedType === 'accepted' ? 'Invite Accepted' : normalizedType === 'rejected' ? 'Application Update' : 'Invite Declined',
      message: !emailSent
        ? `The project email could not be sent. Please contact support or try again.`
        : normalizedType === 'application'
        ? `Your application for "${resolvedProjectTitle}" has been received and the client has been notified.`
        : normalizedType === 'invite'
          ? `A project invite for "${resolvedProjectTitle}" was sent to your email.`
          : normalizedType === 'accepted'
            ? `You accepted the invite for "${resolvedProjectTitle}".`
            : normalizedType === 'rejected'
              ? `Your application for "${resolvedProjectTitle}" was not selected for this cycle.`
              : `You declined the invite for "${resolvedProjectTitle}".`,
      type: normalizedType === 'application' ? 'status_update' : normalizedType === 'invite' ? 'invite' : 'status_update',
      relatedProjectId: projectId
    });
  };

  // 1. Tester applies to project
  const applyToProject = async (projectId: string, devices: string[], experienceNote: string) => {
    const userContext = await getActiveUserContext();
    let liveEmail = '';

    if (isSupabaseConfigured && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user?.email) {
        liveEmail = user.email;
      }
    }

    const effectiveTesterId = testerProfile.id || userContext.userId || currentUserId;
    const effectiveTesterName = testerProfile.name || 'Tester';
    const effectiveTesterEmail = await resolveTesterEmail(effectiveTesterId, liveEmail || testerProfile.email || userContext.email || '');

    const existing = applications.find(a => a.projectId === projectId && a.testerId === effectiveTesterId);
    if (existing) return false;

    const project = projects.find(p => p.id === projectId);
    const newAppId = createApplicationId();
    const newApp: ProjectApplication = {
      id: newAppId,
      projectId,
      testerId: effectiveTesterId,
      testerName: effectiveTesterName,
      testerEmail: effectiveTesterEmail,
      testerRating: testerProfile.rating,
      testerTier: testerProfile.tier,
      appliedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      selectedDevices: devices,
      experienceNote,
      status: 'pending',
      inviteHistory: []
    };

    setApplications(prev => [newApp, ...prev]);

    if (isSupabaseConfigured && supabase && effectiveTesterId) {
      void upsertApplicationInSupabase({
        id: newAppId,
        project_id: projectId,
        tester_id: effectiveTesterId,
        status: 'pending',
        invite_status: null,
        selected_devices: devices,
        experience_note: experienceNote,
        applied_at: new Date().toISOString(),
        invite_history: [],
        last_invite_sent_at: null
      }).catch(error => console.error('Unable to save application to Supabase:', error));
    }

    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'New Tester Application',
      message: `${effectiveTesterName} (${testerProfile.tier} Tier, ${testerProfile.rating} rating) applied for "${project?.title || 'Project'}".`,
      type: 'status_update',
      relatedProjectId: projectId
    });

    if (effectiveTesterEmail) {
      void triggerProjectEmail('application', projectId, effectiveTesterId, effectiveTesterName, effectiveTesterEmail);
    } else {
      console.warn('Application submitted without tester email; email trigger skipped.', {
        projectId,
        effectiveTesterId,
        effectiveTesterName,
        testerProfileEmail: testerProfile.email,
        authEmail: userContext.email
      });
    }

    return true;
  };

  // 2. Client approves application -> Sends test cycle invitation
  const approveApplication = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);
    const inviteSentAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const nextHistory = [
      ...(app.inviteHistory || []),
      { sentAt: inviteSentAt, type: 'invite' as const, note: 'Approved and invite sent' }
    ];

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return {
          ...a,
          status: 'approved',
          inviteStatus: 'invited',
          lastInviteSentAt: inviteSentAt,
          inviteHistory: nextHistory
        };
      }
      return a;
    }));

    // Update project slot count
    if (project) {
      setProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return { ...p, slotsFilled: Math.min(p.slotsTotal, p.slotsFilled + 1) };
        }
        return p;
      }));
    }

    if (isSupabaseConfigured && supabase) {
      void updateApplicationInSupabase(app.id, {
        status: 'approved',
        invite_status: 'invited',
        last_invite_sent_at: new Date().toISOString(),
        invite_history: nextHistory,
        updated_at: new Date().toISOString()
      }).catch(error => console.error('Unable to update application in Supabase:', error));
    }

    // Notify tester
    addNotification({
      userId: app.testerId,
      targetRole: 'tester',
      title: 'Application Approved: Test Invite Received',
      message: `Congratulations! You've been approved and invited to test "${project?.title}". Accept the invite to begin testing!`,
      type: 'invite',
      relatedProjectId: app.projectId
    });

    if (project && app.testerEmail) {
      void triggerProjectEmail('invite', app.projectId, app.testerId, app.testerName, app.testerEmail, app.id);
    }
  };

  const resendInvite = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);
    const inviteSentAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const nextHistory = [
      ...(app.inviteHistory || []),
      { sentAt: inviteSentAt, type: 'resend' as const, note: 'Invite resent to tester' }
    ];

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return {
          ...a,
          status: 'approved',
          inviteStatus: 'invited',
          lastInviteSentAt: inviteSentAt,
          inviteHistory: nextHistory
        };
      }
      return a;
    }));

    if (isSupabaseConfigured && supabase) {
      void updateApplicationInSupabase(app.id, {
        status: 'approved',
        invite_status: 'invited',
        last_invite_sent_at: new Date().toISOString(),
        invite_history: nextHistory,
        updated_at: new Date().toISOString()
      }).catch(error => console.error('Unable to resend invite in Supabase:', error));
    }

    addNotification({
      userId: app.testerId,
      targetRole: 'tester',
      title: 'Invite Resent',
      message: `The invite for "${project?.title || 'your project'}" has been sent again. Please review and act on it.` ,
      type: 'invite',
      relatedProjectId: app.projectId
    });

    if (project && app.testerEmail) {
      void triggerProjectEmail('invite', app.projectId, app.testerId, app.testerName, app.testerEmail, app.id);
    }
  };

  // Client rejects application
  const rejectApplication = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return { ...a, status: 'rejected' };
      }
      return a;
    }));

    addNotification({
      userId: app.testerId,
      targetRole: 'tester',
      title: 'Application Status Update',
      message: `Your application for "${project?.title}" was not selected for this cycle. Keep applying to other available slots!`,
      type: 'status_update',
      relatedProjectId: app.projectId
    });

    if (project && app.testerEmail) {
      void triggerProjectEmail('rejected', app.projectId, app.testerId, app.testerName, app.testerEmail);
    }
  };

  // 3. Tester accepts invite & starts task
  const acceptInvite = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);
    const acceptedAt = new Date().toISOString();

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return {
          ...a,
          inviteStatus: 'accepted',
          acceptedInviteAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
      }
      return a;
    }));

    if (isSupabaseConfigured && supabase) {
      void updateApplicationInSupabase(app.id, {
        invite_status: 'accepted',
        accepted_invite_at: acceptedAt,
        updated_at: acceptedAt
      }).catch(error => console.error('Unable to persist accepted invite:', error));
    }

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'Tester Accepted Invite',
      message: `${app.testerName} has accepted the invitation and started testing for "${project?.title}".`,
      type: 'status_update',
      relatedProjectId: app.projectId
    });

    if (project && app.testerEmail) {
      void triggerProjectEmail('accepted', app.projectId, app.testerId, app.testerName, app.testerEmail);
    }

    // Auto open workspace
    setActiveWorkspaceProjectId(app.projectId);
    setActiveTab('tasks');
  };

  const declineInvite = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return { ...a, inviteStatus: 'declined' };
      }
      return a;
    }));

    if (project && app.testerEmail) {
      void triggerProjectEmail('declined', app.projectId, app.testerId, app.testerName, app.testerEmail);
    }
  };

  // 4. Tester submits bug report with attachments
  const submitBugReport = (bugData: Omit<BugReport, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>): BugReport => {
    const project = projects.find(p => p.id === bugData.projectId);
    let calculatedBounty = 20;
    if (project) {
      if (bugData.severity === 'Critical') calculatedBounty = project.bountyStructure.critical;
      else if (bugData.severity === 'High') calculatedBounty = project.bountyStructure.high;
      else if (bugData.severity === 'Medium') calculatedBounty = project.bountyStructure.medium;
      else calculatedBounty = project.bountyStructure.low;
    }

    const newBug: BugReport = {
      ...bugData,
      id: 'bug-' + Date.now(),
      testerId: testerProfile.id,
      testerName: testerProfile.name,
      status: 'under_review',
      bountyEarned: calculatedBounty,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setBugReports(prev => [newBug, ...prev]);

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: `New ${bugData.severity} Defect Logged`,
      message: `${testerProfile.name} submitted "${bugData.title}" on ${bugData.device} for review.`,
      type: 'status_update',
      relatedProjectId: bugData.projectId,
      relatedSubmissionId: newBug.id
    });

    return newBug;
  };

  // 5. Client approves bug -> CREDITS EARNINGS INTO ONE ACCOUNT AUTOMATICALLY!
  const approveBugReport = (bugId: string, customBounty?: number, feedback?: string, rating: number = 5) => {
    const bug = bugReports.find(b => b.id === bugId);
    if (!bug) return;

    const finalBounty = customBounty !== undefined ? customBounty : bug.bountyEarned;
    const project = projects.find(p => p.id === bug.projectId);

    // Update bug status
    setBugReports(prev => prev.map(b => {
      if (b.id === bugId) {
        return {
          ...b,
          status: 'approved',
          bountyEarned: finalBounty,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          clientFeedback: feedback || 'Approved. Great reproduction steps and clear documentation.',
          clientRating: rating
        };
      }
      return b;
    }));

    // Credit bounty into Tester's Account immediately
    setTesterProfile(prev => {
      const newRating = Number(((prev.rating * prev.totalReviews + rating) / (prev.totalReviews + 1)).toFixed(2));
      return {
        ...prev,
        availableBalance: Number((prev.availableBalance + finalBounty).toFixed(2)),
        lifetimeEarnings: Number((prev.lifetimeEarnings + finalBounty).toFixed(2)),
        approvedBugsCount: prev.approvedBugsCount + 1,
        totalReviews: prev.totalReviews + 1,
        rating: newRating
      };
    });

    // Create wallet transaction record
    const newTx: WalletTransaction = {
      id: 'tx-' + Date.now(),
      testerId: bug.testerId,
      type: 'credit_bounty',
      amount: finalBounty,
      description: `Bounty Approved: "${bug.title.substring(0, 38)}..." (${bug.severity})`,
      relatedProjectId: bug.projectId,
      status: 'completed',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      referenceId: 'REF-BTY-' + Math.floor(10000 + Math.random() * 90000)
    };

    setWalletTransactions(prev => [newTx, ...prev]);

    // Update Client disbursed budget
    setClientProfile(prev => ({
      ...prev,
      totalPaidOut: Number((prev.totalPaidOut + finalBounty).toFixed(2))
    }));

    if (project) {
      setProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return {
            ...p,
            budgetDisbursed: Number((p.budgetDisbursed + finalBounty).toFixed(2))
          };
        }
        return p;
      }));
    }

    // Push notification to tester
    addNotification({
      userId: bug.testerId,
      targetRole: 'tester',
      title: `Bounty Credited: +$${finalBounty.toFixed(2)}`,
      message: `Your defect report "${bug.title}" was approved by the client! $${finalBounty.toFixed(2)} has been credited to your available balance.`,
      type: 'earning',
      amount: finalBounty,
      relatedProjectId: bug.projectId,
      relatedSubmissionId: bug.id
    });

    // Confetti burst for satisfaction!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
  };

  const rejectBugReport = (bugId: string, feedback: string) => {
    const bug = bugReports.find(b => b.id === bugId);
    if (!bug) return;

    setBugReports(prev => prev.map(b => {
      if (b.id === bugId) {
        return {
          ...b,
          status: 'rejected',
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          clientFeedback: feedback || 'Rejected: Does not meet in-scope reproduction criteria.'
        };
      }
      return b;
    }));

    addNotification({
      userId: bug.testerId,
      targetRole: 'tester',
      title: `Bug Report Rejected`,
      message: `Defect "${bug.title}" was rejected by client: ${feedback || 'Does not match cycle guidelines.'}`,
      type: 'status_update',
      relatedProjectId: bug.projectId,
      relatedSubmissionId: bug.id
    });
  };

  const requestBugRevision = (bugId: string, feedback: string) => {
    const bug = bugReports.find(b => b.id === bugId);
    if (!bug) return;

    setBugReports(prev => prev.map(b => {
      if (b.id === bugId) {
        return {
          ...b,
          status: 'changes_requested',
          clientFeedback: feedback
        };
      }
      return b;
    }));

      addNotification({
        userId: bug.testerId,
        targetRole: 'tester',
        title: 'Action Required: Changes Requested',
        message: `The client requested clarification on "${bug.title}": ${feedback}`,
        type: 'revision',
        relatedProjectId: bug.projectId,
        relatedSubmissionId: bug.id
      });
    };

  // 5b. Task Deliverable Submissions (Data Collection, AI Prompt Eval, UX Studies, In-Field Mystery Shopping)
  const submitTaskDeliverable = (data: Omit<TaskSubmission, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>): TaskSubmission => {
    const project = projects.find(p => p.id === data.projectId);
    const rate = project?.taskRate || 40.00;

    const newSubmission: TaskSubmission = {
      ...data,
      id: 'task-sub-' + Date.now(),
      testerId: testerProfile.id,
      testerName: testerProfile.name,
      testerAvatar: testerProfile.avatar,
      status: 'under_review',
      bountyEarned: rate,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setTaskSubmissions(prev => [newSubmission, ...prev]);

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'New Deliverable Submitted',
      message: `${testerProfile.name} submitted "${data.title}" for "${project?.title || 'Project'}" ($${rate.toFixed(2)} bounty).`,
      type: 'status_update',
      relatedProjectId: data.projectId,
      relatedSubmissionId: newSubmission.id
    });

    return newSubmission;
  };

  const approveTaskSubmission = (submissionId: string, customBounty?: number, feedback?: string, rating: number = 5) => {
    const sub = taskSubmissions.find(s => s.id === submissionId);
    if (!sub) return;

    const finalBounty = customBounty !== undefined ? customBounty : sub.bountyEarned;
    const project = projects.find(p => p.id === sub.projectId);

    // 1. Update task submission status
    setTaskSubmissions(prev => prev.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'approved',
          bountyEarned: finalBounty,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          clientFeedback: feedback || 'Deliverable accepted and verified. High-quality submission!',
          clientRating: rating
        };
      }
      return s;
    }));

    // 2. CREDIT EARNINGS DIRECTLY INTO TESTER'S WALLET ACCOUNT
    setTesterProfile(prev => ({
      ...prev,
      availableBalance: Number((prev.availableBalance + finalBounty).toFixed(2)),
      lifetimeEarnings: Number((prev.lifetimeEarnings + finalBounty).toFixed(2))
    }));

    // 3. Record transaction in wallet
    const newTx: WalletTransaction = {
      id: 'tx-task-' + Date.now(),
      testerId: sub.testerId,
      type: 'credit_bounty',
      amount: finalBounty,
      description: `Task Approved: "${sub.title}" (${project?.company || 'Client'})`,
      relatedProjectId: sub.projectId,
      status: 'completed',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      referenceId: 'SUB-' + sub.id.toUpperCase().slice(-6)
    };
    setWalletTransactions(prev => [newTx, ...prev]);

    // 4. Update client profile (deduct escrow, record paid out)
    setClientProfile(prev => ({
      ...prev,
      escrowBalance: Math.max(0, Number((prev.escrowBalance - finalBounty).toFixed(2))),
      totalPaidOut: Number((prev.totalPaidOut + finalBounty).toFixed(2))
    }));

    // 5. Update project budget disbursed
    if (project) {
      setProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return {
            ...p,
            budgetDisbursed: Number((p.budgetDisbursed + finalBounty).toFixed(2))
          };
        }
        return p;
      }));
    }

    // 6. Push notification to tester
    addNotification({
      userId: sub.testerId,
      targetRole: 'tester',
      title: `Deliverable Approved: +$${finalBounty.toFixed(2)}`,
      message: `Your task deliverable "${sub.title}" was approved by the client! $${finalBounty.toFixed(2)} credited to your wallet balance.`,
      type: 'earning',
      amount: finalBounty,
      relatedProjectId: sub.projectId,
      relatedSubmissionId: sub.id
    });

    // Confetti burst!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
  };

  const rejectTaskSubmission = (submissionId: string, feedback: string) => {
    const sub = taskSubmissions.find(s => s.id === submissionId);
    if (!sub) return;

    setTaskSubmissions(prev => prev.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'rejected',
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          clientFeedback: feedback || 'Rejected: Deliverable does not meet project guidelines.'
        };
      }
      return s;
    }));

    addNotification({
      userId: sub.testerId,
      targetRole: 'tester',
      title: `Task Deliverable Rejected`,
      message: `Submission "${sub.title}" was rejected by client: ${feedback || 'Does not match criteria.'}`,
      type: 'status_update',
      relatedProjectId: sub.projectId,
      relatedSubmissionId: sub.id
    });
  };

  const requestTaskRevision = (submissionId: string, feedback: string) => {
    const sub = taskSubmissions.find(s => s.id === submissionId);
    if (!sub) return;

    setTaskSubmissions(prev => prev.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'changes_requested',
          clientFeedback: feedback
        };
      }
      return s;
    }));

    addNotification({
      userId: sub.testerId,
      targetRole: 'tester',
      title: 'Action Required: Deliverable Revision',
      message: `Client requested clarification on "${sub.title}": ${feedback}`,
      type: 'revision',
      relatedProjectId: sub.projectId,
      relatedSubmissionId: sub.id
    });
  };

  // 6. Secure Payout processing
  const requestPayout = async (
    amount: number,
    method: 'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise',
    destination: string
  ): Promise<PayoutRequest> => {
    if (amount > testerProfile.availableBalance) {
      throw new Error('Requested amount exceeds available balance.');
    }

    // Deduct balance
    setTesterProfile(prev => ({
      ...prev,
      availableBalance: Number((prev.availableBalance - amount).toFixed(2))
    }));

    const ref = 'PAY-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);

    const newTx: WalletTransaction = {
      id: 'tx-payout-' + Date.now(),
      testerId: testerProfile.id,
      type: 'payout_withdrawal',
      amount,
      description: `Payout Transfer to ${method} (${destination})`,
      status: 'completed',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      method,
      referenceId: ref
    };

    setWalletTransactions(prev => [newTx, ...prev]);

    const payoutReq: PayoutRequest = {
      id: 'payout-' + Date.now(),
      testerId: testerProfile.id,
      amount,
      method,
      destinationAccount: destination,
      status: 'completed',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      completedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      transactionRef: ref
    };

    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: `Payout Processed: $${amount.toFixed(2)}`,
      message: `Your payment of $${amount.toFixed(2)} via ${method} has been authorized and dispatched to ${destination}. Reference: ${ref}`,
      type: 'payout',
      amount
    });

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.7 }
      });
    } catch {
      // safe
    }

    return payoutReq;
  };

  const createProject = (newProjectData: Omit<Project, 'id' | 'createdAt' | 'budgetDisbursed' | 'slotsFilled'>) => {
    const newProj: Project = {
      ...newProjectData,
      id: createApplicationId(),
      createdAt: new Date().toISOString().split('T')[0],
      budgetDisbursed: 0,
      slotsFilled: 0,
      status: 'active'
    };

    setProjects(prev => [newProj, ...prev]);
    if (isSupabaseConfigured) {
      void createProjectInSupabase(newProj).catch(error => console.error('Unable to create project in Supabase:', error));
    }

    setClientProfile(prev => ({
      ...prev,
      totalProjects: prev.totalProjects + 1,
      activeCycles: prev.activeCycles + 1
    }));

    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: `New Test Cycle Available: "${newProj.title}"`,
      message: `${newProj.company} launched a new ${newProj.category} cycle with up to $${newProj.bountyStructure.critical} per critical defect. Apply now!`,
      type: 'status_update',
      relatedProjectId: newProj.id
    });

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe
    }
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    const currentProject = projects.find(p => p.id === projectId);
    const mergedProject = currentProject ? { ...currentProject, ...updates } : updates;

    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));

    if (isSupabaseConfigured) {
      void updateProjectInSupabase(projectId, mergedProject).catch(error => console.error('Unable to update project in Supabase:', error));
    }
  };

  const deleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (isSupabaseConfigured) {
      void deleteProjectFromSupabase(projectId).catch(error => console.error('Unable to delete project in Supabase:', error));
    }
  };

  const updateTesterProfile = (updates: Partial<TesterProfile>) => {
    setTesterProfile(prev => {
      const updated = { ...prev, ...updates };
      if (updates.deviceFleet) {
        updated.devices = updates.deviceFleet
          .filter(d => d.isActive)
          .map(d => `${d.brand} ${d.model} (${d.os} ${d.osVersion})`);
      }

      void persistProfileToSupabase({
        role: 'tester',
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
        country: updated.country,
        city: updated.city,
        testerProfile: updated,
        clientProfile,
        profile_data: {
          testerProfile: {
            ...emptyTesterProfile,
            ...updated,
            paymentSettings: {
              ...emptyTesterProfile.paymentSettings,
              ...(updated.paymentSettings || {})
            },
            preferences: {
              ...emptyTesterProfile.preferences,
              ...(updated.preferences || {})
            },
            deviceFleet: updated.deviceFleet || emptyTesterProfile.deviceFleet,
            skills: updated.skills || emptyTesterProfile.skills,
            languages: updated.languages || emptyTesterProfile.languages,
            academyBadges: updated.academyBadges || emptyTesterProfile.academyBadges
          },
          clientProfile: {
            ...emptyClientProfile,
            ...clientProfile,
            defaultBountyMatrix: {
              ...emptyClientProfile.defaultBountyMatrix,
              ...(clientProfile.defaultBountyMatrix || {})
            }
          }
        }
      });

      return updated;
    });
    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: 'Profile Settings Saved',
      message: 'Your tester profile information, hardware fleet, and cycle preferences have been updated.',
      type: 'status_update'
    });
  };

  const updateClientProfile = (updates: Partial<ClientProfile>) => {
    setClientProfile(prev => {
      const updated = { ...prev, ...updates };

      void persistProfileToSupabase({
        role: 'client',
        name: updated.name,
        email: updated.email,
        company: updated.company,
        avatar: updated.avatar,
        country: '',
        city: '',
        testerProfile,
        clientProfile: updated,
        profile_data: {
          testerProfile: {
            ...emptyTesterProfile,
            ...testerProfile,
            paymentSettings: {
              ...emptyTesterProfile.paymentSettings,
              ...(testerProfile.paymentSettings || {})
            },
            preferences: {
              ...emptyTesterProfile.preferences,
              ...(testerProfile.preferences || {})
            },
            deviceFleet: testerProfile.deviceFleet || emptyTesterProfile.deviceFleet,
            skills: testerProfile.skills || emptyTesterProfile.skills,
            languages: testerProfile.languages || emptyTesterProfile.languages,
            academyBadges: testerProfile.academyBadges || emptyTesterProfile.academyBadges
          },
          clientProfile: {
            ...emptyClientProfile,
            ...updated,
            defaultBountyMatrix: {
              ...emptyClientProfile.defaultBountyMatrix,
              ...(updated.defaultBountyMatrix || {})
            }
          }
        }
      });

      return updated;
    });
    addNotification({
      userId: clientProfile.id,
      targetRole: 'client',
      title: 'Client Settings Saved',
      message: 'Your company profile, billing, and QA cycle criteria have been updated.',
      type: 'status_update'
    });
  };

  const addTesterDevice = (deviceData: Omit<DeviceFleetItem, 'id'>) => {
    const newId = 'dev-' + Date.now();
    const newDevice: DeviceFleetItem = {
      ...deviceData,
      id: newId
    };
    setTesterProfile(prev => {
      const currentFleet = prev.deviceFleet || [];
      const updatedFleet = [newDevice, ...currentFleet];
      const updatedDevices = updatedFleet
        .filter(d => d.isActive)
        .map(d => `${d.brand} ${d.model} (${d.os} ${d.osVersion})`);
      return {
        ...prev,
        deviceFleet: updatedFleet,
        devices: updatedDevices
      };
    });
    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: 'New Hardware Device Registered',
      message: `"${deviceData.brand} ${deviceData.model} (${deviceData.os} ${deviceData.osVersion})" added to your testing fleet.`,
      type: 'status_update'
    });
  };

  const removeTesterDevice = (deviceId: string) => {
    setTesterProfile(prev => {
      const currentFleet = prev.deviceFleet || [];
      const updatedFleet = currentFleet.filter(d => d.id !== deviceId);
      const updatedDevices = updatedFleet
        .filter(d => d.isActive)
        .map(d => `${d.brand} ${d.model} (${d.os} ${d.osVersion})`);
      return {
        ...prev,
        deviceFleet: updatedFleet,
        devices: updatedDevices
      };
    });
  };

  const toggleTesterDeviceActive = (deviceId: string) => {
    setTesterProfile(prev => {
      const currentFleet = prev.deviceFleet || [];
      const updatedFleet = currentFleet.map(d => d.id === deviceId ? { ...d, isActive: !d.isActive } : d);
      const updatedDevices = updatedFleet
        .filter(d => d.isActive)
        .map(d => `${d.brand} ${d.model} (${d.os} ${d.osVersion})`);
      return {
        ...prev,
        deviceFleet: updatedFleet,
        devices: updatedDevices
      };
    });
  };

  const setTesterPrimaryDevice = (deviceId: string) => {
    setTesterProfile(prev => {
      const currentFleet = prev.deviceFleet || [];
      const target = currentFleet.find(d => d.id === deviceId);
      if (!target) return prev;
      const updatedFleet = currentFleet.map(d => ({
        ...d,
        isPrimary: d.category === target.category ? d.id === deviceId : d.isPrimary
      }));
      return {
        ...prev,
        deviceFleet: updatedFleet
      };
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    if (isSupabaseConfigured && supabase && currentUserId) {
      void supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', currentUserId);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    if (isSupabaseConfigured && supabase && currentUserId) {
      void supabase.from('notifications').update({ read: true }).eq('user_id', currentUserId);
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        projects,
        applications,
        bugReports,
        taskSubmissions,
        notifications,
        walletTransactions,
        testerProfile,
        clientProfile,
        activeWorkspaceProjectId,
        setActiveWorkspaceProjectId,
        activeTab,
        setActiveTab,
        isProfileModalOpen,
        setIsProfileModalOpen,
        updateTesterProfile,
        updateClientProfile,
        addTesterDevice,
        removeTesterDevice,
        toggleTesterDeviceActive,
        setTesterPrimaryDevice,
        applyToProject,
        approveApplication,
        resendInvite,
        rejectApplication,
        acceptInvite,
        declineInvite,
        submitBugReport,
        approveBugReport,
        rejectBugReport,
        requestBugRevision,
        submitTaskDeliverable,
        approveTaskSubmission,
        rejectTaskSubmission,
        requestTaskRevision,
        requestPayout,
        createProject,
        updateProject,
        deleteProject,
        markNotificationRead,
        markAllNotificationsRead
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
