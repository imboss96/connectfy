export type UserRole = 'tester' | 'client' | 'admin';

export type ProjectTrack = 
  | 'qa_functional' 
  | 'data_collection' 
  | 'ai_evaluation' 
  | 'ux_research' 
  | 'localization' 
  | 'special_field';

export type PaymentModel = 
  | 'per_bug' 
  | 'per_approved_bug'
  | 'per_task'
  | 'per_task_submission' 
  | 'fixed_study' 
  | 'hourly_session';

export type ProjectCategory = 
  | 'Functional' 
  | 'Usability' 
  | 'Localization' 
  | 'Security' 
  | 'Performance' 
  | 'Payment & Checkout'
  | 'Exploratory'
  | 'AI Data Collection'
  | 'AI Model Evaluation'
  | 'Special In-Field';

export type DeviceType = 
  | 'iOS Mobile' 
  | 'Android Mobile' 
  | 'macOS' 
  | 'Windows' 
  | 'iPad / Tablet' 
  | 'Smart TV' 
  | 'Wearable';

export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type BugType = 'Crash' | 'Functional' | 'UI / Visual' | 'Performance' | 'Content / Localization' | 'Security';
export type BugFrequency = 'Every time (100%)' | 'Frequently (~70%)' | 'Occasionally (~30%)' | 'Once';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type InviteStatus = 'invited' | 'accepted' | 'declined' | 'completed';
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface InviteHistoryEntry {
  sentAt: string;
  type: 'invite' | 'resend';
  note: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string; // 'image/png', 'application/pdf', 'text/plain', etc.
  url: string; // base64 or object URL or mock URL
  publicId?: string;
  resourceType?: string;
  uploadedAt: string;
}

export interface ProjectResource {
  label: string;
  url: string;
}

export interface BugReport {
  id: string;
  projectId: string;
  testCycleId: string;
  testerId: string;
  testerName: string;
  title: string;
  featureArea: string;
  severity: BugSeverity;
  bugType: BugType;
  frequency: BugFrequency;
  device: string;
  osVersion: string;
  browserOrBuild: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  attachments: AttachmentFile[];
  status: SubmissionStatus;
  bountyEarned: number;
  submittedAt: string;
  reviewedAt?: string;
  clientFeedback?: string;
  clientRating?: number; // 1 to 5
}

export interface TestCaseExecution {
  id: string;
  projectId: string;
  testCycleId: string;
  testerId: string;
  title: string;
  status: 'passed' | 'failed' | 'blocked' | 'untested';
  notes?: string;
  attachments: AttachmentFile[];
  completedAt?: string;
  bounty: number;
}

export interface ProjectApplication {
  id: string;
  projectId: string;
  testerId: string;
  testerName: string;
  testerEmail: string;
  testerRating: number;
  testerTier: 'Bronze' | 'Silver' | 'Gold' | 'Top Rated';
  appliedDate: string;
  selectedDevices: string[];
  experienceNote: string;
  status: ApplicationStatus;
  inviteStatus?: InviteStatus;
  acceptedInviteAt?: string;
  lastInviteSentAt?: string;
  inviteHistory?: InviteHistoryEntry[];
}

export interface ProjectBountyStructure {
  critical: number;
  high: number;
  medium: number;
  low: number;
  testCaseBounty: number;
}

export interface DeliverablesGuide {
  overview?: string;
  instructions: string | string[];
  fileFormat?: string;
  sampleFormat?: string;
  sampleCountRequired?: number;
  acceptanceCriteria: string[];
  targetDemographicsOrHardware?: string;
}

export interface TaskSubmission {
  id: string;
  projectId: string;
  testerId: string;
  testerName: string;
  testerAvatar?: string;
  taskType: ProjectTrack;
  title: string;
  details: string;
  metadata?: {
    languageOrDialect?: string;
    sampleCount?: number;
    audioEnvironment?: string;
    deviceUsed?: string;
    promptPairRankings?: { prompt: string; responseA: string; responseB: string; preferred: 'A' | 'B' | 'Tie'; reason: string }[];
    storeLocationOrMerchant?: string;
    sessionDurationMinutes?: number;
    meetingUrlOrNotes?: string;
  };
  attachments: AttachmentFile[];
  status: SubmissionStatus;
  bountyEarned: number;
  submittedAt: string;
  reviewedAt?: string;
  clientFeedback?: string;
  clientRating?: number;
}

export interface Project {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  category: ProjectCategory;
  projectTrack?: ProjectTrack;
  paymentModel?: PaymentModel;
  taskUnitName?: string;
  taskRate?: number;
  deliverablesGuide?: DeliverablesGuide;
  shortDescription: string;
  fullOverview: string;
  resources?: ProjectResource[];
  inScope: string[];
  outOfScope: string[];
  requiredDevices: DeviceType[];
  supportedCountries: string[];
  slotsTotal: number;
  slotsFilled: number;
  deadline: string;
  status: 'active' | 'upcoming' | 'paused' | 'closed';
  bountyStructure: ProjectBountyStructure;
  totalBudget: number;
  budgetDisbursed: number;
  clientId: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  targetRole: UserRole;
  title: string;
  message: string;
  type: 'invite' | 'approval' | 'earning' | 'payout' | 'status_update' | 'revision';
  read: boolean;
  createdAt: string;
  relatedProjectId?: string;
  relatedSubmissionId?: string;
  amount?: number;
}

export interface WalletTransaction {
  id: string;
  testerId: string;
  type: 'credit_bounty' | 'payout_withdrawal';
  amount: number;
  description: string;
  relatedProjectId?: string;
  status: 'completed' | 'processing' | 'pending';
  date: string;
  method?: string;
  referenceId: string;
}

export interface PayoutRequest {
  id: string;
  testerId: string;
  amount: number;
  method: 'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise';
  destinationAccount: string;
  status: PayoutStatus;
  requestedAt: string;
  completedAt?: string;
  transactionRef: string;
}

export interface DeviceFleetItem {
  id: string;
  category: 'Smartphone' | 'Tablet' | 'Computer' | 'Smart TV' | 'Wearable' | 'Console';
  brand: string;
  model: string;
  os: string;
  osVersion: string;
  carrier?: string;
  isp?: string;
  isJailbroken: boolean;
  isPrimary: boolean;
  isActive: boolean;
}

export interface LanguageSkill {
  language: string;
  proficiency: 'Native' | 'Fluent' | 'Intermediate' | 'Basic';
}

export interface AcademyBadge {
  id: string;
  title: string;
  description: string;
  completionDate: string;
  score: string;
  icon: string;
}

export interface TesterPaymentSettings {
  preferredMethod: 'PayPal' | 'Payoneer' | 'Wise' | 'Direct Bank Wire';
  paypalEmail: string;
  payoneerId: string;
  wiseEmail: string;
  bankDetails: {
    bankName: string;
    accountHolder: string;
    ibanOrAccount: string;
    swiftBic: string;
  };
  autoWithdraw: boolean;
  autoWithdrawThreshold: number;
  taxFormType: 'W-8BEN' | 'W-9';
  taxStatus: 'Verified' | 'Pending Review' | 'Not Submitted';
  taxIdMasked: string;
  taxCountry: string;
}

export interface TesterPreferences {
  availableForCycles: boolean;
  maxWeeklyHours: number;
  weekendTesting: boolean;
  ndaAgreed: boolean;
  instantEmailAlerts: boolean;
  instantSmsAlerts: boolean;
  highBountyOnly: boolean;
  realMoneyTesting: boolean;
  apkSideloadingAllowed: boolean;
  interestedCategories: string[];
}

export interface TesterProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  country: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  timezone?: string;
  bio?: string;
  headline?: string;
  languages?: LanguageSkill[];
  tier: 'Unrated' | 'Bronze' | 'Silver' | 'Gold' | 'Top Rated';
  rating: number; // 4.92
  totalReviews: number;
  acceptanceRate: number; // 96%
  availableBalance: number;
  pendingEscrow: number;
  lifetimeEarnings: number;
  approvedBugsCount: number;
  completedCyclesCount: number;
  devices: string[];
  deviceFleet?: DeviceFleetItem[];
  badges: string[];
  academyBadges?: AcademyBadge[];
  skills?: string[];
  paymentSettings?: TesterPaymentSettings;
  preferences?: TesterPreferences;
}

export interface ClientProfile {
  id: string;
  name: string;
  company: string;
  companyLogo?: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  avatar: string;
  industry?: string;
  website?: string;
  billingAddress?: string;
  totalProjects: number;
  activeCycles: number;
  testersEngaged: number;
  totalPaidOut: number;
  escrowBalance: number;
  defaultBountyMatrix?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  ndaRequired?: boolean;
}
