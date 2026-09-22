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
  TaskSubmission
} from '../types';
import {
  initialProjects,
  initialApplications,
  initialBugReports,
  initialWalletTransactions,
  initialNotifications,
  initialTesterProfile,
  initialClientProfile,
  initialTaskSubmissions
} from '../mockData';

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
  activeTab: 'projects' | 'tasks' | 'wallet' | 'client_cycles' | 'client_applicants' | 'client_submissions' | 'profile_settings' | 'admin_manager';
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
  applyToProject: (projectId: string, devices: string[], experienceNote: string) => boolean;
  approveApplication: (appId: string) => void;
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
  resetToSampleData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'utest_crowdqa_';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'role');
    return (saved === 'client' || saved === 'tester' || saved === 'admin') ? (saved as UserRole) : 'tester';
  });

  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'wallet' | 'client_cycles' | 'client_applicants' | 'client_submissions' | 'profile_settings' | 'admin_manager'>('projects');
  const [activeWorkspaceProjectId, setActiveWorkspaceProjectId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'projects');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  const [applications, setApplications] = useState<ProjectApplication[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'applications');
    return saved ? JSON.parse(saved) : initialApplications;
  });

  const [bugReports, setBugReports] = useState<BugReport[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'bugReports');
    return saved ? JSON.parse(saved) : initialBugReports;
  });

  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'taskSubmissions');
    return saved ? JSON.parse(saved) : initialTaskSubmissions;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'notifications');
    return saved ? JSON.parse(saved) : initialNotifications;
  });

  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'walletTransactions');
    return saved ? JSON.parse(saved) : initialWalletTransactions;
  });

  const [testerProfile, setTesterProfile] = useState<TesterProfile>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'testerProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialTesterProfile,
          ...parsed,
          deviceFleet: parsed.deviceFleet && parsed.deviceFleet.length > 0 ? parsed.deviceFleet : initialTesterProfile.deviceFleet,
          skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : initialTesterProfile.skills,
          academyBadges: parsed.academyBadges && parsed.academyBadges.length > 0 ? parsed.academyBadges : initialTesterProfile.academyBadges,
          paymentSettings: {
            ...initialTesterProfile.paymentSettings,
            ...(parsed.paymentSettings || {})
          },
          preferences: {
            ...initialTesterProfile.preferences,
            ...(parsed.preferences || {})
          },
          languages: parsed.languages && parsed.languages.length > 0 ? parsed.languages : initialTesterProfile.languages
        };
      } catch {
        return initialTesterProfile;
      }
    }
    return initialTesterProfile;
  });

  const [clientProfile, setClientProfile] = useState<ClientProfile>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'clientProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialClientProfile,
          ...parsed,
          defaultBountyMatrix: {
            ...initialClientProfile.defaultBountyMatrix,
            ...(parsed.defaultBountyMatrix || {})
          }
        };
      } catch {
        return initialClientProfile;
      }
    }
    return initialClientProfile;
  });

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

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'client') {
      setActiveTab('client_cycles');
    } else {
      setActiveTab('projects');
    }
  };

  const addNotification = (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...item,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      read: false,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // 1. Tester applies to project
  const applyToProject = (projectId: string, devices: string[], experienceNote: string) => {
    // Check if already applied
    const existing = applications.find(a => a.projectId === projectId && a.testerId === testerProfile.id);
    if (existing) return false;

    const project = projects.find(p => p.id === projectId);
    const newApp: ProjectApplication = {
      id: 'app-' + Date.now(),
      projectId,
      testerId: testerProfile.id,
      testerName: testerProfile.name,
      testerEmail: testerProfile.email,
      testerRating: testerProfile.rating,
      testerTier: testerProfile.tier,
      appliedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      selectedDevices: devices,
      experienceNote,
      status: 'pending'
    };

    setApplications(prev => [newApp, ...prev]);

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'New Tester Application 📝',
      message: `${testerProfile.name} (${testerProfile.tier} Tier, ${testerProfile.rating}★) applied for "${project?.title || 'Project'}".`,
      type: 'status_update',
      relatedProjectId: projectId
    });

    return true;
  };

  // 2. Client approves application -> Sends test cycle invitation
  const approveApplication = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);

    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return {
          ...a,
          status: 'approved',
          inviteStatus: 'invited'
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

    // Notify tester
    addNotification({
      userId: app.testerId,
      targetRole: 'tester',
      title: 'Application Approved! Test Invite Received 🎉',
      message: `Congratulations! You've been approved and invited to test "${project?.title}". Accept the invite to begin testing!`,
      type: 'invite',
      relatedProjectId: app.projectId
    });
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
  };

  // 3. Tester accepts invite & starts task
  const acceptInvite = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const project = projects.find(p => p.id === app.projectId);

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

    // Notify client
    addNotification({
      userId: project?.clientId || 'client-default',
      targetRole: 'client',
      title: 'Tester Accepted Invite 🚀',
      message: `${app.testerName} has accepted the invitation and started testing for "${project?.title}".`,
      type: 'status_update',
      relatedProjectId: app.projectId
    });

    // Auto open workspace
    setActiveWorkspaceProjectId(app.projectId);
    setActiveTab('tasks');
  };

  const declineInvite = (appId: string) => {
    setApplications(prev => prev.map(a => {
      if (a.id === appId) {
        return { ...a, inviteStatus: 'declined' };
      }
      return a;
    }));
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
      title: `New ${bugData.severity} Defect Logged 🐞`,
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
      title: `Bounty Credited: +$${finalBounty.toFixed(2)} 💰`,
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
        title: `Action Required: Changes Requested ⚠️`,
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
      title: `New Deliverable Submitted 📦`,
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
      title: `Deliverable Approved: +$${finalBounty.toFixed(2)} 💰`,
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
      title: `Action Required: Deliverable Revision ⚠️`,
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
      title: `Payout Processed: $${amount.toFixed(2)} 🏦`,
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
      id: 'proj-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
      budgetDisbursed: 0,
      slotsFilled: 0,
      status: 'active'
    };

    setProjects(prev => [newProj, ...prev]);

    setClientProfile(prev => ({
      ...prev,
      totalProjects: prev.totalProjects + 1,
      activeCycles: prev.activeCycles + 1
    }));

    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: `New Test Cycle Available: "${newProj.title}" 🔔`,
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
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
  };

  const deleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const updateTesterProfile = (updates: Partial<TesterProfile>) => {
    setTesterProfile(prev => {
      const updated = { ...prev, ...updates };
      if (updates.deviceFleet) {
        updated.devices = updates.deviceFleet
          .filter(d => d.isActive)
          .map(d => `${d.brand} ${d.model} (${d.os} ${d.osVersion})`);
      }
      return updated;
    });
    addNotification({
      userId: testerProfile.id,
      targetRole: 'tester',
      title: 'Profile Settings Saved ✅',
      message: 'Your tester profile information, hardware fleet, and cycle preferences have been updated.',
      type: 'status_update'
    });
  };

  const updateClientProfile = (updates: Partial<ClientProfile>) => {
    setClientProfile(prev => ({ ...prev, ...updates }));
    addNotification({
      userId: clientProfile.id,
      targetRole: 'client',
      title: 'Client Settings Saved ✅',
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
      title: 'New Hardware Device Registered 📱',
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
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const resetToSampleData = () => {
    localStorage.removeItem(STORAGE_PREFIX + 'projects');
    localStorage.removeItem(STORAGE_PREFIX + 'applications');
    localStorage.removeItem(STORAGE_PREFIX + 'bugReports');
    localStorage.removeItem(STORAGE_PREFIX + 'taskSubmissions');
    localStorage.removeItem(STORAGE_PREFIX + 'notifications');
    localStorage.removeItem(STORAGE_PREFIX + 'walletTransactions');
    localStorage.removeItem(STORAGE_PREFIX + 'testerProfile');
    localStorage.removeItem(STORAGE_PREFIX + 'clientProfile');

    setProjects(initialProjects);
    setApplications(initialApplications);
    setBugReports(initialBugReports);
    setTaskSubmissions(initialTaskSubmissions);
    setNotifications(initialNotifications);
    setWalletTransactions(initialWalletTransactions);
    setTesterProfile(initialTesterProfile);
    setClientProfile(initialClientProfile);
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
        resetToSampleData
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
