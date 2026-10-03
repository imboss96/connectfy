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
import { createPayoutRequestInSupabase, createProjectInSupabase, createSubmissionInSupabase, deleteApplicationDraftFromSupabase, deleteProjectFromSupabase, fetchApplicationDraftFromSupabase, fetchApplicationsFromSupabase, fetchPayoutRequestsFromSupabase, fetchProjectsFromSupabase, fetchSubmissionsFromSupabase, updateApplicationInSupabase, updateSubmissionInSupabase, updateTesterApplicationUtestDetailsInSupabase, upsertApplicationDraftInSupabase, upsertApplicationInSupabase, upsertApplicationUtestDetailsInSupabase, updateProjectInSupabase } from '../lib/projectRepository';
import { formatProjectEmailType, ProjectEmailType, ProjectEmailPayload, sendProjectEmail } from '../lib/emailService';

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
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
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
  fetchApplicationDraft: (projectId: string) => Promise<Record<string, unknown> | null>;
  saveApplicationDraft: (projectId: string, draftData: Record<string, unknown>) => Promise<void>;
  deleteApplicationDraft: (projectId: string) => Promise<void>;
  applyToProject: (projectId: string, devices: string[], experienceNote: string, emailDetails?: Pick<ProjectEmailPayload, 'applicantCountry' | 'applicantDevice' | 'uTestId' | 'uTestEmail' | 'applicantFullName' | 'applicantDateOfBirth' | 'applicantAgeRange' | 'applicantSmartphone' | 'applicantHasValidId' | 'applicantWillingVoiceRecording' | 'applicationReference' | 'submittedAt'> & { applicantPhone?: string; applicantUtestScreenshotUrl?: string }) => Promise<boolean>;
  approveApplication: (appId: string) => void;
  resendInvite: (appId: string) => void;
  requestUtestAccountUpdate: (appId: string) => void;
  rejectApplication: (appId: string) => void;
  acceptInvite: (appId: string) => void;
  declineInvite: (appId: string) => void;
  submitBugReport: (bugData: Omit<BugReport, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>) => Promise<BugReport>;
  approveBugReport: (bugId: string, customBounty?: number, feedback?: string, rating?: number) => void;
  rejectBugReport: (bugId: string, feedback: string) => void;
  requestBugRevision: (bugId: string, feedback: string) => void;
  submitTaskDeliverable: (data: Omit<TaskSubmission, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>) => Promise<TaskSubmission>;
  approveTaskSubmission: (submissionId: string, customBounty?: number, feedback?: string, rating?: number) => void;
  rejectTaskSubmission: (submissionId: string, feedback: string) => void;
  requestTaskRevision: (submissionId: string, feedback: string) => void;
  requestPayout: (amount: number, method: 'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise', destination: string) => Promise<PayoutRequest>;
  createProject: (newProject: Omit<Project, 'id' | 'createdAt' | 'budgetDisbursed' | 'slotsFilled'>) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'utest_crowdqa_';
const ACTIVE_TABS = ['projects', 'tasks', 'wallet', 'client_cycles', 'client_applicants', 'client_submissions', 'profile_settings', 'admin_manager', 'crm', 'google_sheet', 'email_history', 'legacy_onboarding'] as const;
type ActiveTab = typeof ACTIVE_TABS[number];

const isActiveTab = (value: string | null): value is ActiveTab =>
  ACTIVE_TABS.some(tab => tab === value);

const createApplicationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'app-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
};

const createSubmissionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = placeholder === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
  uTestId: '',
  uTestEmail: '',
  legalName: '',
  dateOfBirth: '',
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

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'activeTab');
    return isActiveTab(saved) ? saved : 'projects';
  });
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
    localStorage.setItem(STORAGE_PREFIX + 'activeTab', activeTab);
  }, [activeTab]);

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

    const client = supabase;
    let mounted = true;

    const loadNotifications = async (userId: string) => {
      if (!userId) {
        setNotifications([]);
        return;
      }

      try {
        const { data, error } = await client
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

        const { data: profile, error } = await client
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
          tier: savedTesterProfile.tier || 'Unrated',
          rating: Number(savedTesterProfile.rating || 0),
          totalReviews: Number(savedTesterProfile.totalReviews || 0),
          acceptanceRate: Number(savedTesterProfile.acceptanceRate || 0),
          availableBalance: Number(savedTesterProfile.availableBalance || 0),
          pendingEscrow: Number(savedTesterProfile.pendingEscrow || 0),
          lifetimeEarnings: Number(savedTesterProfile.lifetimeEarnings || 0),
          approvedBugsCount: Number(savedTesterProfile.approvedBugsCount || 0),
          completedCyclesCount: Number(savedTesterProfile.completedCyclesCount || 0),
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
        if (mounted) setProjects(serverProjects);
      } catch (error) {
        console.error('Unable to load projects from Supabase:', error);
      }
    };

    const loadApplications = async () => {
      try {
        const serverApplications = await fetchApplicationsFromSupabase();
        if (!mounted) return;

        const mapped = serverApplications.map((app: any) => {
          const storedUtestDetails = Array.isArray(app.application_utest_details)
            ? app.application_utest_details[0]
            : app.application_utest_details;

          return {
            id: app.id,
          projectId: app.project_id,
          testerId: app.tester_id,
          testerName: app.profiles?.name || app.tester_name || 'Tester',
          testerEmail: app.profiles?.email || app.tester_email || '',
          uTestId: storedUtestDetails?.utest_id || app.profiles?.profile_data?.testerProfile?.uTestId || '',
          uTestEmail: storedUtestDetails?.utest_email || app.profiles?.profile_data?.testerProfile?.uTestEmail || '',
          uTestAccountScreenshotUrl: storedUtestDetails?.utest_account_screenshot_url || '',
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
          };
        });

        setApplications(mapped);
      } catch (error) {
        console.error('Unable to load applications from Supabase:', error);
      }
    };

    const loadSubmissions = async (userId: string, email?: string) => {
      try {
        let serverRows = await fetchSubmissionsFromSupabase();
        const knownSubmissionIds = new Set(serverRows.map((row: any) => String(row.id)));
        const matchesLocalTester = Boolean(email && testerProfile.email && email.toLowerCase() === testerProfile.email.toLowerCase());
        const localTesterIds = new Set([userId, ...(matchesLocalTester && testerProfile.id ? [testerProfile.id] : [])]);
        const localBugReports = bugReports.filter((report) => localTesterIds.has(report.testerId));
        const localTaskSubmissions = taskSubmissions.filter((submission) => localTesterIds.has(submission.testerId));

        for (const report of localBugReports) {
          if (!isUuid(report.projectId) || (isUuid(report.id) && knownSubmissionIds.has(report.id))) continue;
          const submissionId = isUuid(report.id) ? report.id : createSubmissionId();
          try {
            await createSubmissionInSupabase({
              id: submissionId,
              projectId: report.projectId,
              testerId: userId,
              kind: 'bug',
              title: report.title,
              details: report.actualResult,
              status: report.status,
              bountyEarned: report.bountyEarned,
              submittedAt: report.submittedAt,
              payload: { ...report, testerId: userId, attachments: undefined },
              attachments: report.attachments || []
            });
            knownSubmissionIds.add(submissionId);
          } catch (migrationError) {
            console.error('Unable to sync a saved local defect submission:', migrationError);
          }
        }

        for (const submission of localTaskSubmissions) {
          if (!isUuid(submission.projectId) || (isUuid(submission.id) && knownSubmissionIds.has(submission.id))) continue;
          const submissionId = isUuid(submission.id) ? submission.id : createSubmissionId();
          try {
            await createSubmissionInSupabase({
              id: submissionId,
              projectId: submission.projectId,
              testerId: userId,
              kind: 'task',
              title: submission.title,
              details: submission.details,
              status: submission.status,
              bountyEarned: submission.bountyEarned,
              submittedAt: submission.submittedAt,
              payload: { ...submission, testerId: userId, attachments: undefined },
              attachments: submission.attachments || []
            });
            knownSubmissionIds.add(submissionId);
          } catch (migrationError) {
            console.error('Unable to sync a saved local task submission:', migrationError);
          }
        }

        serverRows = await fetchSubmissionsFromSupabase();
        if (!mounted) return;

        const mapAttachments = (rows: any[] = []) => rows.map((attachment) => ({
          id: attachment.id,
          name: attachment.name || 'Attachment',
          size: Number(attachment.bytes || 0),
          type: attachment.mime_type || 'application/octet-stream',
          url: attachment.secure_url || '',
          publicId: attachment.public_id || undefined,
          resourceType: attachment.resource_type || undefined,
          uploadedAt: attachment.created_at ? new Date(attachment.created_at).toISOString().replace('T', ' ').substring(0, 16) : ''
        }));
        const mappedBugReports: BugReport[] = [];
        const mappedTaskSubmissions: TaskSubmission[] = [];

        serverRows.forEach((row: any) => {
          const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
          const common = {
            id: row.id,
            projectId: row.project_id,
            testerId: row.tester_id,
            testerName: payload.testerName || 'Tester',
            title: row.title,
            status: row.status || 'under_review',
            bountyEarned: Number(row.bounty_earned || 0),
            submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString().replace('T', ' ').substring(0, 16) : '',
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString().replace('T', ' ').substring(0, 16) : undefined,
            clientFeedback: row.client_feedback || undefined,
            clientRating: row.client_rating || undefined,
            attachments: mapAttachments(row.attachments)
          };

          if (row.kind === 'bug') {
            mappedBugReports.push({
              ...payload,
              ...common,
              testCycleId: payload.testCycleId || row.project_id,
              featureArea: payload.featureArea || '',
              severity: payload.severity || 'Medium',
              bugType: payload.bugType || 'Functional',
              frequency: payload.frequency || 'Every time (100%)',
              device: payload.device || '',
              osVersion: payload.osVersion || '',
              browserOrBuild: payload.browserOrBuild || '',
              stepsToReproduce: Array.isArray(payload.stepsToReproduce) ? payload.stepsToReproduce : [],
              expectedResult: payload.expectedResult || '',
              actualResult: payload.actualResult || row.details || ''
            } as BugReport);
          } else if (row.kind === 'task') {
            const project = projects.find((item) => item.id === row.project_id);
            mappedTaskSubmissions.push({
              ...payload,
              ...common,
              testerAvatar: payload.testerAvatar || undefined,
              taskType: payload.taskType || project?.projectTrack || 'data_collection',
              details: row.details || '',
              metadata: payload.metadata || {}
            } as TaskSubmission);
          }
        });

        setBugReports(mappedBugReports);
        setTaskSubmissions(mappedTaskSubmissions);

        if (role === 'tester') {
          const testerRows = serverRows.filter((row: any) => row.tester_id === userId);
          const approvedRows = testerRows.filter((row: any) => row.status === 'approved');
          const pendingRows = testerRows.filter((row: any) => row.status === 'submitted' || row.status === 'under_review');
          const payoutRows = await fetchPayoutRequestsFromSupabase(userId);
          const deductedPayoutRows = payoutRows.filter((row: any) => row.status !== 'failed');
          const lifetimeEarnings = approvedRows.reduce((total: number, row: any) => total + Number(row.bounty_earned || 0), 0);
          const totalWithdrawn = deductedPayoutRows.reduce((total: number, row: any) => total + Number(row.amount || 0), 0);
          const pendingEscrow = pendingRows.reduce((total: number, row: any) => total + Number(row.bounty_earned || 0), 0);

          setTesterProfile((previous) => ({
            ...previous,
            availableBalance: Math.max(0, Number((lifetimeEarnings - totalWithdrawn).toFixed(2))),
            lifetimeEarnings: Number(lifetimeEarnings.toFixed(2)),
            pendingEscrow: Number(pendingEscrow.toFixed(2)),
            approvedBugsCount: approvedRows.filter((row: any) => row.kind === 'bug').length
          }));

          const creditTransactions: WalletTransaction[] = approvedRows.map((row: any) => ({
            id: `submission-${row.id}`,
            testerId: row.tester_id,
            type: 'credit_bounty',
            amount: Number(row.bounty_earned || 0),
            description: `Slot payout: ${row.title}`,
            relatedProjectId: row.project_id,
            status: 'completed',
            date: row.reviewed_at || row.submitted_at,
            referenceId: `SUB-${String(row.id).slice(-8).toUpperCase()}`
          }));
          const withdrawalTransactions: WalletTransaction[] = payoutRows.map((row: any) => ({
            id: row.id,
            testerId: row.tester_id,
            type: 'payout_withdrawal',
            amount: Number(row.amount || 0),
            description: `Withdrawal to ${row.method}`,
            status: row.status === 'completed' || row.status === 'processing' ? row.status : 'pending',
            date: row.requested_at,
            method: row.method,
            referenceId: row.transaction_ref
          }));
          setWalletTransactions([...creditTransactions, ...withdrawalTransactions].sort((left, right) => right.date.localeCompare(left.date)));
        }
      } catch (error) {
        console.error('Unable to load submissions from Supabase:', error);
      }
    };

    const loadAuthenticatedData = async (userId: string, email?: string) => {
      setCurrentUserId(userId);
      await syncAuthProfile(userId);
      void loadNotifications(userId);
      void loadProjects();
      void loadApplications();
      void loadSubmissions(userId, email);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(() => {
          if (mounted) void loadAuthenticatedData(session.user.id, session.user.email);
        }, 0);
      } else if (_event === 'SIGNED_OUT') {
        setCurrentUserId('');
        setNotifications([]);
        setProjects([]);
        setApplications([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) void loadAuthenticatedData(data.session.user.id, data.session.user.email);
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
    if (newRole === role) return;
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

  const triggerProjectEmail = async (type: ProjectEmailType, projectId: string, testerId: string, testerName: string, testerEmail: string, applicationId?: string, emailDetails?: Pick<ProjectEmailPayload, 'applicantCountry' | 'applicantDevice' | 'uTestId' | 'uTestEmail' | 'applicationReference' | 'submittedAt'>) => {
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
    if (project && isSupabaseConfigured && supabase && (!project.resources || project.resources.length === 0)) {
      let savedResources: Array<{ label: string; url: string }> = [];
      try {
        const { data: resourceRows, error: resourceError } = await supabase
          .from('project_resources')
          .select('label,url,sort_order')
          .eq('project_id', project.id)
          .order('sort_order', { ascending: true });

        savedResources = !resourceError && Array.isArray(resourceRows)
          ? resourceRows.map((resource: any) => ({ label: resource.label, url: resource.url }))
          : [];
      } catch (resourceFetchError) {
        console.warn('Unable to refresh project resources before email:', resourceFetchError);
      }

      if (savedResources.length === 0) {
        try {
          const { data: projectRow } = await supabase
            .from('projects')
            .select('project_data')
            .eq('id', project.id)
            .maybeSingle();
          const projectDataResources = projectRow?.project_data?.resources;
          savedResources = Array.isArray(projectDataResources) ? projectDataResources : [];
        } catch (projectDataError) {
          console.warn('Unable to load stored project resources before email:', projectDataError);
        }
      }

      if (savedResources.length > 0) {
        project = {
          ...project,
          resources: savedResources
        };
      }
    }
    const actionUrl = type === 'invite' && applicationId
      ? `${window.location.origin}?project=${projectId}&application=${applicationId}&accept=1`
      : type === 'utest_update_required'
        ? `${window.location.origin}?project=${projectId}&reapply=1`
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
        projectResources: project?.resources || [],
        ...emailDetails,
        supportEmail: 'support@connectfy.tech'
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

  const fetchApplicationDraft = async (projectId: string) => {
    try {
      return await fetchApplicationDraftFromSupabase(projectId);
    } catch (error) {
      console.error('Unable to load application draft:', error);
      return null;
    }
  };

  const saveApplicationDraft = async (projectId: string, draftData: Record<string, unknown>) => {
    try {
      await upsertApplicationDraftInSupabase(projectId, draftData);
    } catch (error) {
      console.error('Unable to save application draft:', error);
    }
  };

  const deleteApplicationDraft = async (projectId: string) => {
    try {
      await deleteApplicationDraftFromSupabase(projectId);
    } catch (error) {
      console.error('Unable to delete application draft:', error);
    }
  };

  // 1. Tester applies to project
  const applyToProject = async (projectId: string, devices: string[], experienceNote: string, emailDetails?: Pick<ProjectEmailPayload, 'applicantCountry' | 'applicantDevice' | 'uTestId' | 'uTestEmail' | 'applicantFullName' | 'applicantDateOfBirth' | 'applicantAgeRange' | 'applicantSmartphone' | 'applicantHasValidId' | 'applicantWillingVoiceRecording' | 'applicationReference' | 'submittedAt'> & { applicantPhone?: string; applicantUtestScreenshotUrl?: string }) => {
    if (!emailDetails?.applicantUtestScreenshotUrl) return false;
    const { applicantPhone = '', ...emailPayloadDetails } = emailDetails;

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
    if (existing && existing.status !== 'needs_utest_update') return false;

    const project = projects.find(p => p.id === projectId);
    const newAppId = existing?.id || createApplicationId();
    const newApp: ProjectApplication = {
      id: newAppId,
      projectId,
      testerId: effectiveTesterId,
      testerName: effectiveTesterName,
      testerEmail: effectiveTesterEmail,
      uTestId: emailDetails?.uTestId || '',
      uTestEmail: emailDetails?.uTestEmail || '',
      uTestAccountScreenshotUrl: emailDetails.applicantUtestScreenshotUrl,
      testerRating: testerProfile.rating,
      testerTier: testerProfile.tier === 'Unrated' ? 'Bronze' : testerProfile.tier,
      appliedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      selectedDevices: devices,
      experienceNote,
      status: 'pending',
      inviteHistory: existing?.inviteHistory || []
    };

    setApplications(prev => [newApp, ...prev.filter(application => application.id !== newAppId)]);

    if (isSupabaseConfigured && supabase && effectiveTesterId) {
      try {
        await upsertApplicationInSupabase({
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
        });

        if (emailDetails) {
          await upsertApplicationUtestDetailsInSupabase({
            application_id: newAppId,
            tester_id: effectiveTesterId,
            full_name: emailDetails.applicantFullName || effectiveTesterName,
            utest_id: emailDetails.uTestId || '',
            utest_email: emailDetails.uTestEmail || '',
            date_of_birth: emailDetails.applicantDateOfBirth || '',
            age_range: emailDetails.applicantAgeRange || '',
            country: emailDetails.applicantCountry || '',
            smartphone: emailDetails.applicantSmartphone || '',
            phone_number: applicantPhone,
            device_confirmation: emailDetails.applicantDevice || emailDetails.applicantSmartphone || '',
            has_valid_id: Boolean(emailDetails.applicantHasValidId),
            willing_voice_recording: Boolean(emailDetails.applicantWillingVoiceRecording),
            utest_account_screenshot_url: emailDetails.applicantUtestScreenshotUrl || ''
          });

          await updateTesterApplicationUtestDetailsInSupabase(effectiveTesterId, {
            full_name: emailDetails.applicantFullName || effectiveTesterName,
            utest_id: emailDetails.uTestId || '',
            utest_email: emailDetails.uTestEmail || '',
            date_of_birth: emailDetails.applicantDateOfBirth || '',
            country: emailDetails.applicantCountry || ''
          });
        }
      } catch (error) {
        console.error('Unable to save application details to Supabase:', error);
        return false;
      }
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
      void triggerProjectEmail('application', projectId, effectiveTesterId, effectiveTesterName, effectiveTesterEmail, newAppId, {
        ...emailPayloadDetails,
        applicationReference: newAppId
      });
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

  const requestUtestAccountUpdate = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return {
          ...a,
          status: 'needs_utest_update',
          inviteStatus: undefined
        };
      }
      return a;
    }));

    if (isSupabaseConfigured && supabase) {
      void updateApplicationInSupabase(app.id, {
        status: 'needs_utest_update',
        invite_status: null,
        updated_at: new Date().toISOString()
      }).catch(error => console.error('Unable to flag application for uTest update:', error));
    }

    addNotification({
      userId: app.testerId,
      targetRole: 'tester',
      title: 'Action Required: Create a New uTest Account',
      message: `This project requires a uTest account created within the last 7 days. Please create a new account, then reapply to "${project?.title || 'this project'}" using its new uTest ID and email.`,
      type: 'status_update',
      relatedProjectId: app.projectId
    });

    if (project && app.testerEmail) {
      void triggerProjectEmail('utest_update_required', app.projectId, app.testerId, app.testerName, app.testerEmail, app.id, {
        applicantCountry: '',
        applicantDevice: '',
        uTestId: app.uTestId || '',
        uTestEmail: app.uTestEmail || app.testerEmail,
        applicationReference: app.id,
        submittedAt: app.appliedDate
      });
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
  const submitBugReport = async (bugData: Omit<BugReport, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>): Promise<BugReport> => {
    const userContext = await getActiveUserContext();
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
      id: createSubmissionId(),
      testerId: userContext.userId || testerProfile.id,
      testerName: testerProfile.name,
      status: 'under_review',
      bountyEarned: calculatedBounty,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    if (isSupabaseConfigured && isUuid(newBug.projectId) && isUuid(newBug.testerId)) {
      await createSubmissionInSupabase({
        id: newBug.id,
        projectId: newBug.projectId,
        testerId: newBug.testerId,
        kind: 'bug',
        title: newBug.title,
        details: newBug.actualResult,
        status: newBug.status,
        bountyEarned: newBug.bountyEarned,
        submittedAt: newBug.submittedAt,
        payload: { ...newBug, attachments: undefined },
        attachments: newBug.attachments
      });
    }

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

  const persistSubmissionReview = (submissionId: string, updates: Parameters<typeof updateSubmissionInSupabase>[1]) => {
    if (!isSupabaseConfigured || !isUuid(submissionId)) return;
    void updateSubmissionInSupabase(submissionId, updates).catch((error) => {
      console.error('Unable to save submission review to Supabase:', error);
    });
  };

  // 5. Client approves bug -> CREDITS EARNINGS INTO ONE ACCOUNT AUTOMATICALLY!
  const approveBugReport = (bugId: string, customBounty?: number, feedback?: string, rating: number = 5) => {
    const bug = bugReports.find(b => b.id === bugId);
    if (!bug) return;

    const finalBounty = customBounty !== undefined ? customBounty : bug.bountyEarned;
    const project = projects.find(p => p.id === bug.projectId);
    const reviewTime = new Date().toISOString();
    const reviewFeedback = feedback || 'Approved. Great reproduction steps and clear documentation.';
    persistSubmissionReview(bugId, { status: 'approved', bountyEarned: finalBounty, clientFeedback: reviewFeedback, clientRating: rating, reviewedAt: reviewTime });

    // Update bug status
    setBugReports(prev => prev.map(b => {
      if (b.id === bugId) {
        return {
          ...b,
          status: 'approved',
          bountyEarned: finalBounty,
          reviewedAt: reviewTime.replace('T', ' ').substring(0, 16),
          clientFeedback: reviewFeedback,
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
      description: `Slot payout approved: "${bug.title.substring(0, 38)}..." (${bug.severity})`,
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
      title: `Slot payout credited: +$${finalBounty.toFixed(2)}`,
      message: `Your defect report "${bug.title}" was approved by the client! A $${finalBounty.toFixed(2)} slot payout has been credited to your available balance.`,
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
    const reviewTime = new Date().toISOString();
    const reviewFeedback = feedback || 'Rejected: Does not meet in-scope reproduction criteria.';
    persistSubmissionReview(bugId, { status: 'rejected', clientFeedback: reviewFeedback, reviewedAt: reviewTime });

    setBugReports(prev => prev.map(b => {
      if (b.id === bugId) {
        return {
          ...b,
          status: 'rejected',
          reviewedAt: reviewTime.replace('T', ' ').substring(0, 16),
          clientFeedback: reviewFeedback
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
    persistSubmissionReview(bugId, { status: 'changes_requested', clientFeedback: feedback });

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
  const submitTaskDeliverable = async (data: Omit<TaskSubmission, 'id' | 'testerId' | 'testerName' | 'status' | 'bountyEarned' | 'submittedAt'>): Promise<TaskSubmission> => {
    const userContext = await getActiveUserContext();
    const project = projects.find(p => p.id === data.projectId);
    const rate = project?.taskRate || 40.00;

    const newSubmission: TaskSubmission = {
      ...data,
      id: createSubmissionId(),
      testerId: userContext.userId || testerProfile.id,
      testerName: testerProfile.name,
      testerAvatar: testerProfile.avatar,
      status: 'under_review',
      bountyEarned: rate,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    if (isSupabaseConfigured && isUuid(newSubmission.projectId) && isUuid(newSubmission.testerId)) {
      await createSubmissionInSupabase({
        id: newSubmission.id,
        projectId: newSubmission.projectId,
        testerId: newSubmission.testerId,
        kind: 'task',
        title: newSubmission.title,
        details: newSubmission.details,
        status: newSubmission.status,
        bountyEarned: newSubmission.bountyEarned,
        submittedAt: newSubmission.submittedAt,
        payload: { ...newSubmission, attachments: undefined },
        attachments: newSubmission.attachments
      });
    }

    setTaskSubmissions(prev => [newSubmission, ...prev]);

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'New Deliverable Submitted',
      message: `${testerProfile.name} submitted "${data.title}" for "${project?.title || 'Project'}" (slot payout: $${rate.toFixed(2)} if approved).`,
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
    const reviewTime = new Date().toISOString();
    const reviewFeedback = feedback || 'Deliverable accepted and verified. High-quality submission!';
    persistSubmissionReview(submissionId, { status: 'approved', bountyEarned: finalBounty, clientFeedback: reviewFeedback, clientRating: rating, reviewedAt: reviewTime });

    // 1. Update task submission status
    setTaskSubmissions(prev => prev.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'approved',
          bountyEarned: finalBounty,
          reviewedAt: reviewTime.replace('T', ' ').substring(0, 16),
          clientFeedback: reviewFeedback,
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
      description: `Slot payout approved: "${sub.title}" (${project?.company || 'Client'})`,
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
      title: `Slot payout credited: +$${finalBounty.toFixed(2)}`,
      message: `Your task deliverable "${sub.title}" was approved by the client! A $${finalBounty.toFixed(2)} slot payout has been credited to your wallet balance.`,
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
    const reviewTime = new Date().toISOString();
    const reviewFeedback = feedback || 'Rejected: Deliverable does not meet project guidelines.';
    persistSubmissionReview(submissionId, { status: 'rejected', clientFeedback: reviewFeedback, reviewedAt: reviewTime });

    setTaskSubmissions(prev => prev.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'rejected',
          reviewedAt: reviewTime.replace('T', ' ').substring(0, 16),
          clientFeedback: reviewFeedback
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
    persistSubmissionReview(submissionId, { status: 'changes_requested', clientFeedback: feedback });

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

    const ref = 'PAY-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
    const requestedAt = new Date().toISOString();
    const payoutReq: PayoutRequest = {
      id: createApplicationId(),
      testerId: testerProfile.id,
      amount,
      method,
      destinationAccount: destination,
      status: 'completed',
      requestedAt: requestedAt.replace('T', ' ').substring(0, 16),
      completedAt: requestedAt.replace('T', ' ').substring(0, 16),
      transactionRef: ref
    };

    if (isSupabaseConfigured && isUuid(payoutReq.testerId)) {
      await createPayoutRequestInSupabase(payoutReq);
    }

    setTesterProfile(prev => ({
      ...prev,
      availableBalance: Number((prev.availableBalance - amount).toFixed(2))
    }));

    const newTx: WalletTransaction = {
      id: payoutReq.id,
      testerId: testerProfile.id,
      type: 'payout_withdrawal',
      amount,
      description: `Payout Transfer to ${method} (${destination})`,
      status: 'completed',
      date: payoutReq.requestedAt,
      method,
      referenceId: ref
    };

    setWalletTransactions(prev => [newTx, ...prev]);

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
    if (role === 'tester') return;

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
      message: `${newProj.company} launched a new ${newProj.category} project with a slot payout up to $${newProj.bountyStructure.critical} per approved critical defect. Apply now!`,
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

      void updateTesterApplicationUtestDetailsInSupabase(updated.id, {
        full_name: updated.legalName,
        utest_id: updated.uTestId,
        utest_email: updated.uTestEmail,
        date_of_birth: updated.dateOfBirth,
        country: updated.country
      }).catch(error => console.error('Unable to update application uTest details:', error));

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

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));

    if (isSupabaseConfigured && supabase && currentUserId && isUuid(id)) {
      void supabase.from('notifications').delete().eq('id', id).eq('user_id', currentUserId);
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
        fetchApplicationDraft,
        saveApplicationDraft,
        deleteApplicationDraft,
        applyToProject,
        approveApplication,
        resendInvite,
        requestUtestAccountUpdate,
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
        markAllNotificationsRead,
        dismissNotification
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
