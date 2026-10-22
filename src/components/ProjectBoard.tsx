import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  DollarSign,
  Smartphone,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  X,
  AlertCircle,
  Mic,
  Brain,
  MapPin,
  Eye,
  Bug,
  Info,
  Layers,
  FileCheck,
  Plus,
  ExternalLink,
  Link2,
  Image as ImageIcon,
  Edit3
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getProjectAvailabilityLabel, isProjectOpenForApplications, isProjectVisibleToTesters } from '../lib/projectStatus';
import { isCloudinaryConfigured, uploadToCloudinary } from '../lib/cloudinary';
import { Project, DeviceType, ProjectCategory, ProjectTrack, TesterProfile } from '../types';
import { AddProjectModal } from './AddProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ProjectIcon } from './ProjectIcon';
import evidenceImage from '../../evidence.png';
import { getBlockingProjectApplication, getProjectApplicationLockMessage } from '../lib/projectApplicationEligibility';

type ApplicationDraft = {
  projectId: string;
  testerId: string;
  fullName: string;
  utestEmail: string;
  dateOfBirth: string;
  ageRange: string;
  country: string;
  smartphone: string;
  phoneNumber: string;
  hasValidId: boolean;
  willingVoiceRecording: boolean;
  utestAccountScreenshotUrl: string;
  gmailEmail: string;
  screenerGender: string;
  screenerGenderOther: string;
  fluentLanguages: string[];
  languageOther: string;
  recordingSpaceAvailable: boolean | null;
  screenerDeviceType: string;
  screenerDeviceOther: string;
  screenerOsVersion: string;
  screenerConsent: boolean;
  createdAt: string;
  updatedAt: string;
};

const SCREENER_LANGUAGES = ['English', 'Bengali', 'Hindi', 'Bahasa', 'Portuguese', 'Spanish (MX)', 'None of the above', 'Other'];
const SCREENER_GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say', 'Other'];
const SCREENER_DEVICES = [
  'Android (mobile) — camera & mic functional',
  'iOS (mobile) — camera & mic functional',
  'No functional camera/microphone',
  'Other'
];

const getDateInputMax = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getScreenerAgeRange = (dateOfBirth: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return '';
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year
    || birthDate.getMonth() !== month - 1
    || birthDate.getDate() !== day) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birthDate > today) return '';

  const age = today.getFullYear() - birthDate.getFullYear()
    - ((today.getMonth() < birthDate.getMonth()
      || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) ? 1 : 0);
  if (age < 18) return '';
  if (age <= 25) return '18-25';
  if (age <= 39) return '26-39';
  if (age <= 59) return '40-59';
  return '60+';
};

const isValidPhoneNumber = (phoneNumber: string) => {
  const phone = phoneNumber.trim();
  const digits = phone.replace(/\D/g, '');
  return /^[+]?[0-9][0-9 ().-]*$/.test(phone) && digits.length >= 7 && digits.length <= 15;
};

const getScreenerLanguagesFromProfile = (languages: NonNullable<TesterProfile['languages']>) => {
  const known = new Set(SCREENER_LANGUAGES);
  return languages
    .filter((language) => language.proficiency === 'Native' || language.proficiency === 'Fluent')
    .map((language) => language.language.trim())
    .map((language) => language.toLowerCase().startsWith('spanish') ? 'Spanish (MX)' : language)
    .filter((language) => known.has(language) && language !== 'None of the above' && language !== 'Other');
};

const createDraftFromProject = (project: Project): ApplicationDraft => ({
  projectId: project.id,
  testerId: '',
  fullName: '',
  utestEmail: '',
  dateOfBirth: '',
  ageRange: '',
  country: '',
  smartphone: '',
  phoneNumber: '',
  hasValidId: false,
  willingVoiceRecording: false,
  utestAccountScreenshotUrl: '',
  gmailEmail: '',
  screenerGender: '',
  screenerGenderOther: '',
  fluentLanguages: [],
  languageOther: '',
  recordingSpaceAvailable: null,
  screenerDeviceType: '',
  screenerDeviceOther: '',
  screenerOsVersion: '',
  screenerConsent: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

interface ProjectBoardProps {
  onOpenWorkspace: (projectId: string) => void;
}

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ onOpenWorkspace }) => {
  const {
    projects,
    applications,
    bugReports,
    taskSubmissions,
    testerProfile,
    applyToProject,
    updateTesterProfile,
    fetchApplicationDraft,
    saveApplicationDraft,
    deleteApplicationDraft,
    acceptInvite,
    addTesterDevice,
    role
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  
  // Project detail modal
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  
  // Apply modal
  const [applyingProject, setApplyingProject] = useState<Project | null>(null);
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [experienceNote, setExperienceNote] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applicationScreenerResult, setApplicationScreenerResult] = useState<{
    applicationId: string;
    submitted: boolean;
    queued: boolean;
    retryable: boolean;
    message: string;
  } | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{ projectId: string; url: string; error: boolean } | null>(null);
  const [isUploadingUtestScreenshot, setIsUploadingUtestScreenshot] = useState(false);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(false);
  const [deviceDraft, setDeviceDraft] = useState({
    category: 'Smartphone' as 'Smartphone' | 'Tablet' | 'Computer' | 'Smart TV' | 'Wearable' | 'Console',
    brand: '',
    model: '',
    os: 'iOS',
    osVersion: '',
    isJailbroken: false,
    isPrimary: false,
    isActive: true,
    carrier: '',
    isp: ''
  });
  const [deviceFormError, setDeviceFormError] = useState('');
  const applicationSubmissions = [...bugReports, ...taskSubmissions].map((submission) => ({
    id: submission.id,
    projectId: submission.projectId,
    testerId: submission.testerId,
    status: submission.status,
    resubmissionOfId: submission.resubmissionOfId
  }));
  const getApplicationBlocker = (targetProjectId?: string) => getBlockingProjectApplication(
    applications,
    applicationSubmissions,
    testerProfile.id,
    targetProjectId
  );
  const globalApplicationBlocker = role === 'tester' ? getApplicationBlocker() : null;
  const globalBlockingProject = globalApplicationBlocker
    ? projects.find((project) => project.id === globalApplicationBlocker.projectId)
    : undefined;
  const globalApplicationLockMessage = globalApplicationBlocker
    ? getProjectApplicationLockMessage(globalApplicationBlocker, globalBlockingProject?.title || 'your current project')
    : '';

  const tracks: { id: string; label: string; icon: any }[] = [
    { id: 'all', label: 'All Opportunities', icon: Layers },
    { id: 'data_collection', label: 'AI Data Collection', icon: Mic },
    { id: 'ai_evaluation', label: 'AI Red Teaming & Eval', icon: Brain },
    { id: 'qa_functional', label: 'Functional QA & Bug Bounty', icon: Bug },
    { id: 'special_field', label: 'In-Field & Mystery Audits', icon: MapPin },
    { id: 'ux_research', label: 'UX Research Sessions', icon: Eye }
  ];

  const categories: ProjectCategory[] = [
    'Payment & Checkout',
    'Functional',
    'Usability',
    'Localization',
    'Security',
    'Exploratory'
  ];

  const devicesList: DeviceType[] = [
    'iOS Mobile',
    'Android Mobile',
    'macOS',
    'Windows',
    'iPad / Tablet',
    'Smart TV',
    'Wearable'
  ];

  // Filtering
  const filteredProjects = projects.filter((proj) => {
    if (!isProjectVisibleToTesters(proj)) return false;

    const matchesSearch =
      proj.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proj.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proj.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTrack =
      selectedTrack === 'all' || proj.projectTrack === selectedTrack;

    const matchesCategory =
      selectedCategory === 'all' || proj.category === selectedCategory;

    const matchesDevice =
      selectedDevice === 'all' ||
      proj.requiredDevices.includes(selectedDevice as DeviceType);

    return matchesSearch && matchesTrack && matchesCategory && matchesDevice;
  });

  const featuredProject = filteredProjects.find((project) => project.isFeatured === true);
  const regularProjects = filteredProjects.filter((project) => project.id !== featuredProject?.id);
  const featuredApplication = featuredProject
    ? applications.find((application) => application.projectId === featuredProject.id && application.testerId === testerProfile.id)
    : undefined;
  const featuredNeedsUtestUpdate = featuredProject
    ? applications.some((application) => application.projectId === featuredProject.id && application.testerId === testerProfile.id && application.status === 'needs_utest_update')
    : false;
  const featuredApplicationBlocker = featuredProject && role === 'tester'
    ? getApplicationBlocker(featuredProject.id)
    : null;

  const getApplicationForProject = (projectId: string) => {
    return applications.find(
      (a) => a.projectId === projectId && a.testerId === testerProfile.id
    );
  };

  const createProjectApplicationUrl = (projectId: string) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('project', projectId);
    url.searchParams.set('apply', '1');
    url.hash = '';
    return url.toString();
  };

  const copyProjectApplicationUrl = async (projectId: string) => {
    const url = createProjectApplicationUrl(projectId);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await navigator.clipboard.writeText(url);
      setShareFeedback({ projectId, url, error: false });
    } catch (error) {
      console.warn('Unable to copy project application link:', error);
      setShareFeedback({ projectId, url, error: true });
    }
  };

  const handleOpenApplyModal = (project: Project) => {
    const blockingApplication = role === 'tester' ? getApplicationBlocker(project.id) : null;
    if (blockingApplication) {
      const blockingProject = projects.find((item) => item.id === blockingApplication.projectId);
      setApplyError(getProjectApplicationLockMessage(
        blockingApplication,
        blockingProject?.title || 'your current project'
      ));
      return;
    }

    const canReapplyForExistingSlot = getApplicationForProject(project.id)?.status === 'needs_utest_update';
    if (!isProjectOpenForApplications(project) && !canReapplyForExistingSlot) {
      setApplyError('This project is no longer accepting applications.');
      return;
    }

    const requiresNewUtestAccount = getApplicationForProject(project.id)?.status === 'needs_utest_update';
    const draft = {
      ...createDraftFromProject(project),
      testerId: requiresNewUtestAccount ? '' : testerProfile.uTestId || '',
      utestEmail: requiresNewUtestAccount ? '' : testerProfile.uTestEmail || '',
      fullName: testerProfile.legalName || '',
      dateOfBirth: testerProfile.dateOfBirth || '',
      ageRange: testerProfile.ageRange || '18-25',
      country: testerProfile.country || '',
      smartphone: testerProfile.smartphone || '',
      phoneNumber: testerProfile.phone || '',
      hasValidId: Boolean(testerProfile.hasValidId),
      willingVoiceRecording: Boolean(testerProfile.willingVoiceRecording),
      utestAccountScreenshotUrl: testerProfile.uTestAccountScreenshotUrl || '',
      gmailEmail: testerProfile.email || '',
      fluentLanguages: getScreenerLanguagesFromProfile(testerProfile.languages || []),
      screenerConsent: true
    };

    setApplyingProject(project);
    setApplicationDraft(draft);
    setApplicationScreenerResult(null);
    setApplyError('');
    setSelectedDevices(draft.smartphone ? [draft.smartphone] : []);

    void fetchApplicationDraft(project.id).then((savedDraft) => {
      if (!savedDraft) return;
      const restoredDraft = {
        ...draft,
        ...savedDraft,
        gmailEmail: draft.gmailEmail,
        fullName: String(savedDraft.fullName || draft.fullName),
        testerId: String(savedDraft.testerId || draft.testerId),
        utestEmail: String(savedDraft.utestEmail || draft.utestEmail),
        dateOfBirth: String(savedDraft.dateOfBirth || draft.dateOfBirth),
        ageRange: String(savedDraft.ageRange || draft.ageRange),
        country: String(savedDraft.country || draft.country),
        smartphone: String(savedDraft.smartphone || draft.smartphone),
        phoneNumber: String(savedDraft.phoneNumber || draft.phoneNumber),
        hasValidId: typeof savedDraft.hasValidId === 'boolean' ? savedDraft.hasValidId : draft.hasValidId,
        willingVoiceRecording: typeof savedDraft.willingVoiceRecording === 'boolean'
          ? savedDraft.willingVoiceRecording
          : draft.willingVoiceRecording,
        utestAccountScreenshotUrl: String(savedDraft.utestAccountScreenshotUrl || draft.utestAccountScreenshotUrl),
        screenerGender: String(savedDraft.screenerGender || draft.screenerGender),
        screenerGenderOther: String(savedDraft.screenerGenderOther || draft.screenerGenderOther),
        fluentLanguages: Array.isArray(savedDraft.fluentLanguages)
          ? savedDraft.fluentLanguages.filter((language): language is string => typeof language === 'string')
          : draft.fluentLanguages,
        languageOther: String(savedDraft.languageOther || draft.languageOther),
        recordingSpaceAvailable: typeof savedDraft.recordingSpaceAvailable === 'boolean'
          ? savedDraft.recordingSpaceAvailable
          : draft.recordingSpaceAvailable,
        screenerDeviceType: String(savedDraft.screenerDeviceType || draft.screenerDeviceType),
        screenerDeviceOther: String(savedDraft.screenerDeviceOther || draft.screenerDeviceOther),
        screenerOsVersion: String(savedDraft.screenerOsVersion || draft.screenerOsVersion),
        screenerConsent: true,
        ...(requiresNewUtestAccount ? { testerId: '', utestEmail: '', utestAccountScreenshotUrl: '' } : {}),
        projectId: project.id
      } as ApplicationDraft;
      setApplicationDraft(restoredDraft);
      setSelectedDevices(restoredDraft.smartphone ? [restoredDraft.smartphone] : []);
    });

    if (project.projectTrack === 'data_collection') {
      setExperienceNote('Native speaker with quiet recording studio (<25dB) & directional mic setup.');
    } else if (project.projectTrack === 'ai_evaluation') {
      setExperienceNote('Experienced prompt red teamer with expertise in safety boundaries & compliance stress testing.');
    } else if (project.projectTrack === 'special_field') {
      setExperienceNote('Equipped with active contactless payment cards and within reach of target retail merchants.');
    } else {
      setExperienceNote(`Experienced QA tester specializing in ${project.category} verification.`);
    }

    setApplyError('');
    setApplySuccess(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    if (!projectId) return;

    const project = projects.find((item) => item.id === projectId);
    if (!project || !isProjectVisibleToTesters(project)) return;

    const shouldApply = params.get('apply') === '1';
    if (shouldApply && role === 'tester' && isProjectOpenForApplications(project)) {
      handleOpenApplyModal(project);
    } else {
      setViewingProject(project);
    }

    params.delete('apply');
    const query = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [projects, role]);

  const handleToggleDevice = (d: string) => {
    if (selectedDevices.includes(d)) {
      if (selectedDevices.length === 1) return;
      setSelectedDevices(selectedDevices.filter((item) => item !== d));
    } else {
      setSelectedDevices([...selectedDevices, d]);
    }
  };

  const handleToggleScreenerLanguage = (language: string) => {
    if (!applicationDraft) return;
    const selected = applicationDraft.fluentLanguages;
    const next = selected.includes(language)
      ? selected.filter((item) => item !== language)
      : language === 'None of the above'
        ? [language]
        : [...selected.filter((item) => item !== 'None of the above'), language];
    updateDraft({ fluentLanguages: next });
  };

  const handleAddInlineDevice = () => {
    const brand = deviceDraft.brand.trim();
    const model = deviceDraft.model.trim();
    const osVersion = deviceDraft.osVersion.trim();

    if (!brand || !model || !osVersion) {
      setDeviceFormError('Please fill in the brand, model, and OS version for the device.');
      return;
    }

    const newDeviceLabel = `${brand} ${model} (${deviceDraft.os} ${osVersion})`;
    addTesterDevice({
      category: deviceDraft.category,
      brand,
      model,
      os: deviceDraft.os,
      osVersion,
      carrier: deviceDraft.carrier.trim(),
      isp: deviceDraft.isp.trim(),
      isJailbroken: deviceDraft.isJailbroken,
      isPrimary: deviceDraft.isPrimary,
      isActive: deviceDraft.isActive
    });

    setSelectedDevices(prev => (prev.includes(newDeviceLabel) ? prev : [...prev, newDeviceLabel]));
    setDeviceDraft({
      category: 'Smartphone',
      brand: '',
      model: '',
      os: 'iOS',
      osVersion: '',
      isJailbroken: false,
      isPrimary: false,
      isActive: true,
      carrier: '',
      isp: ''
    });
    setDeviceFormError('');
    setShowAddDeviceForm(false);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingProject || !applicationDraft || isSubmittingApplication) return;

    if (!applicationDraft.fullName || !applicationDraft.utestEmail || !applicationDraft.dateOfBirth || !applicationDraft.country || !applicationDraft.phoneNumber.trim() || !applicationDraft.smartphone) {
      setApplyError('Please complete all required fields before submitting your application.');
      return;
    }

    if (!/^30\d+$/.test(applicationDraft.testerId.trim())) {
      setApplyError('The Applause screener is available only for uTest IDs that start with 30 and contain digits only.');
      return;
    }

    const ageRange = getScreenerAgeRange(applicationDraft.dateOfBirth);
    if (!ageRange) {
      setApplyError('Enter a valid date of birth. Applicants must be at least 18 years old.');
      return;
    }
    if (applicationDraft.ageRange !== ageRange) {
      setApplyError('Select the age range that matches your date of birth.');
      return;
    }

    if (!isValidPhoneNumber(applicationDraft.phoneNumber)) {
      setApplyError('Enter a valid phone number using 7 to 15 digits. You may include a leading +, spaces, parentheses, or hyphens.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationDraft.gmailEmail.trim())
      || !applicationDraft.gmailEmail.trim().toLowerCase().endsWith('@gmail.com')) {
      setApplyError('The email address in your Connectfy profile must be a valid @gmail.com address for this screener.');
      return;
    }

    if (!applicationDraft.screenerGender
      || (applicationDraft.screenerGender === 'Other' && !applicationDraft.screenerGenderOther.trim())
      || applicationDraft.fluentLanguages.length === 0
      || (applicationDraft.fluentLanguages.includes('Other') && !applicationDraft.languageOther.trim())
      || (applicationDraft.fluentLanguages.includes('None of the above') && applicationDraft.fluentLanguages.length > 1)
      || applicationDraft.recordingSpaceAvailable === null
      || !applicationDraft.screenerDeviceType
      || (applicationDraft.screenerDeviceType === 'Other' && !applicationDraft.screenerDeviceOther.trim())
      || !applicationDraft.screenerOsVersion.trim()) {
      setApplyError('Complete the required Applause screener answers before submitting.');
      return;
    }

    if (!applicationDraft.utestAccountScreenshotUrl) {
      setApplyError('Upload a screenshot of your uTest account before submitting your application.');
      return;
    }

    if (isUploadingUtestScreenshot) {
      setApplyError('Wait for the uTest account screenshot upload to finish.');
      return;
    }

    if (!applicationDraft.hasValidId || !applicationDraft.willingVoiceRecording) {
      setApplyError('Please confirm the ID check and voice recording requirement before submitting.');
      return;
    }

    const finalDevices = selectedDevices.length > 0 ? selectedDevices : [applicationDraft.smartphone].filter(Boolean);
    if (finalDevices.length === 0) {
      setApplyError('Please choose at least one device you will use.');
      return;
    }
    const isExistingAccountUpdate = getApplicationForProject(applyingProject.id)?.status === 'needs_utest_update';
    if (!isProjectOpenForApplications(applyingProject) && !isExistingAccountUpdate) {
      setApplyError('This project has no remaining slots and is no longer accepting applications.');
      return;
    }

    const finalDraft = {
      ...applicationDraft,
      ageRange,
      updatedAt: new Date().toISOString(),
      smartphone: applicationDraft.smartphone || finalDevices[0],
      phoneNumber: applicationDraft.phoneNumber.trim()
    };
    setIsSubmittingApplication(true);
    try {
      await saveApplicationDraft(applyingProject.id, finalDraft);

      const combinedExperience = [
        experienceNote.trim(),
        `Full name: ${finalDraft.fullName}`,
        `uTest email: ${finalDraft.utestEmail}`,
        `DOB: ${finalDraft.dateOfBirth}`,
        `Age range: ${finalDraft.ageRange}`,
        `Country: ${finalDraft.country}`,
        `Device: ${finalDraft.smartphone}`,
        `Government ID available: ${finalDraft.hasValidId ? 'Yes' : 'No'}`,
        `Voice recordings consent: ${finalDraft.willingVoiceRecording ? 'Yes' : 'No'}`
      ].filter(Boolean).join(' | ');

      updateTesterProfile({
        legalName: finalDraft.fullName,
        dateOfBirth: finalDraft.dateOfBirth,
        uTestId: finalDraft.testerId,
        uTestEmail: finalDraft.utestEmail,
        ageRange: finalDraft.ageRange,
        country: finalDraft.country,
        smartphone: finalDraft.smartphone,
        phone: finalDraft.phoneNumber,
        hasValidId: finalDraft.hasValidId,
        willingVoiceRecording: finalDraft.willingVoiceRecording,
        uTestAccountScreenshotUrl: finalDraft.utestAccountScreenshotUrl
      });

      const result = await applyToProject(applyingProject.id, finalDevices, combinedExperience, {
        applicantCountry: finalDraft.country,
        applicantDevice: finalDraft.smartphone,
        uTestId: finalDraft.testerId,
        uTestEmail: finalDraft.utestEmail,
        applicantFullName: finalDraft.fullName,
        applicantDateOfBirth: finalDraft.dateOfBirth,
        applicantAgeRange: finalDraft.ageRange,
        applicantSmartphone: finalDraft.smartphone,
        applicantPhone: finalDraft.phoneNumber,
        applicantHasValidId: finalDraft.hasValidId,
        applicantWillingVoiceRecording: finalDraft.willingVoiceRecording,
        applicantUtestScreenshotUrl: finalDraft.utestAccountScreenshotUrl,
        applicantGmailEmail: finalDraft.gmailEmail.trim(),
        applicantGender: finalDraft.screenerGender,
        applicantGenderOther: finalDraft.screenerGenderOther.trim(),
        applicantFluentLanguages: finalDraft.fluentLanguages,
        applicantLanguageOther: finalDraft.languageOther.trim(),
        applicantRecordingSpaceAvailable: Boolean(finalDraft.recordingSpaceAvailable),
        applicantScreenerDeviceType: finalDraft.screenerDeviceType,
        applicantScreenerDeviceOther: finalDraft.screenerDeviceOther.trim(),
        applicantScreenerOsVersion: finalDraft.screenerOsVersion.trim(),
        applicantScreenerConsent: finalDraft.screenerConsent,
        submittedAt: finalDraft.updatedAt
      });
      if (result.saved && result.applicationId && result.screener) {
        void deleteApplicationDraft(applyingProject.id);
        setApplySuccess(true);
        setApplicationScreenerResult({
          applicationId: result.applicationId,
          submitted: result.screener.submitted,
          queued: result.screener.queued,
          retryable: result.screener.retryable,
          message: result.screener.message
        });
        if (result.screener.submitted) {
          setTimeout(() => {
            setApplyingProject(null);
            setApplicationDraft(null);
            setApplySuccess(false);
            setApplicationScreenerResult(null);
          }, 1800);
        }
      } else {
        setApplyError(result.error || 'You may already have applied, or the project has filled its remaining slots.');
      }
    } catch (error) {
      console.error('Unable to submit the project application:', error);
      setApplyError(error instanceof Error ? error.message : 'Unable to submit your application. Please try again.');
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const handleUtestScreenshotUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setApplyError('Choose an image file showing your uTest account.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setApplyError('The screenshot must be 8 MB or smaller.');
      return;
    }
    if (!isCloudinaryConfigured) {
      setApplyError('Screenshot upload is unavailable right now. Please contact support.');
      return;
    }

    setIsUploadingUtestScreenshot(true);
    setApplyError('');
    try {
      const result = await uploadToCloudinary(file);
      updateDraft({ utestAccountScreenshotUrl: result.secure_url });
    } catch (error) {
      console.error('Unable to upload uTest account screenshot:', error);
      setApplyError('Could not upload the screenshot. Please try again.');
    } finally {
      setIsUploadingUtestScreenshot(false);
    }
  };

  const updateDraft = (updates: Partial<ApplicationDraft>) => {
    if (!applyingProject) return;

    const nextDraft = {
      ...(applicationDraft || createDraftFromProject(applyingProject)),
      ...updates,
      projectId: applyingProject.id,
      updatedAt: new Date().toISOString()
    };

    setApplicationDraft(nextDraft);
    void saveApplicationDraft(applyingProject.id, nextDraft);
  };

  const getTrackBadge = (track?: ProjectTrack) => {
    switch (track) {
      case 'data_collection':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Data Collection
          </span>
        );
      case 'ai_evaluation':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <Brain className="w-3 h-3" /> AI Red Teaming
          </span>
        );
      case 'special_field':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Field Audit
          </span>
        );
      case 'ux_research':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Eye className="w-3 h-3" /> UX Research
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00A3E0]/15 text-[#00A3E0] border border-[#00A3E0]/30 flex items-center gap-1">
            <Bug className="w-3 h-3 text-[#00A3E0]" /> Functional QA
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 relative overflow-hidden w-full max-w-full shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight break-words">
                Freelance Opportunities & Test Cycles
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00A3E0]/15 text-[#00A3E0] border border-[#00A3E0]/30 shrink-0">
                {projects.length} Active Cycles
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Browse freelance testing, AI prompt evaluation, voice data recording, and mystery shopping audits. Apply, get invited, submit deliverables, and get credited.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#00A3E0] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects, companies..."
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
              />
            </div>

            {role !== 'tester' && (
              <button
                onClick={() => setIsAddProjectModalOpen(true)}
                className="px-3.5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-md shadow-[#007AFF]/25 shrink-0 whitespace-nowrap active:scale-95"
                title="Add a new project to listings"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Post Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Track Category Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#1E2E4E] w-full max-w-full overflow-hidden">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none w-full min-w-0">
            {tracks.map((t) => {
              const Icon = t.icon;
              const isSelected = selectedTrack === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrack(t.id)}
                  className={`market-track-filter ${isSelected ? 'market-track-filter-selected' : ''} px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shrink-0 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/30'
                      : 'bg-[#080D1A] text-slate-300 border border-[#1E2E4E] hover:text-white hover:border-[#00A3E0]/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#00A3E0]'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs w-full min-w-0">
          <span className="text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#00A3E0]" /> Filter by:
          </span>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#080D1A] border border-[#1E2E4E] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A3E0] flex-1 sm:flex-none min-w-[130px]"
          >
            <option value="all">All Specialties</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="bg-[#080D1A] border border-[#1E2E4E] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A3E0] flex-1 sm:flex-none min-w-[130px]"
          >
            <option value="all">All Hardware</option>
            {devicesList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {(selectedTrack !== 'all' || selectedCategory !== 'all' || selectedDevice !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedTrack('all');
                setSelectedCategory('all');
                setSelectedDevice('all');
                setSearchTerm('');
              }}
              className="text-xs text-[#00A3E0] hover:text-[#38BDF8] underline ml-1 shrink-0 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {globalApplicationBlocker && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold">Finish your current project before applying to another</p>
            <p className="mt-1 text-sm">{globalApplicationLockMessage}</p>
          </div>
        </div>
      )}

      {shareFeedback && (
        <div role={shareFeedback.error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${shareFeedback.error ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <p className="font-semibold">
            {shareFeedback.error
              ? 'Could not copy automatically. Copy the project application link below.'
              : 'Application link copied. Anyone who opens it can sign in or create an account, then apply.'}
          </p>
          {shareFeedback.error && (
            <input
              aria-label="Project application link"
              readOnly
              value={shareFeedback.url}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-800"
            />
          )}
        </div>
      )}

      {featuredProject && (
        <div className="rounded-[28px] border border-[#9ddce9] bg-[radial-gradient(circle_at_top_left,_rgba(64,206,255,0.18),_rgba(255,255,255,0.96)_38%)] p-5 shadow-[0_30px_60px_rgba(15,47,64,0.08)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-full border border-[#00A3E0]/30 bg-[#00A3E0]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#006f9a]">
              Featured Project
            </span>
            <span className="text-[11px] font-semibold text-[#006f9a]">
              {Math.max(0, featuredProject.slotsTotal - featuredProject.slotsFilled)} slots remaining • {featuredProject.slotsFilled}/{featuredProject.slotsTotal} filled
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black tracking-[-0.03em] text-slate-900 sm:text-2xl">{featuredProject.title}</h2>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">{getProjectAvailabilityLabel(featuredProject.status, featuredProject.startsAt, featuredProject.slotsFilled, featuredProject.slotsTotal)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {featuredProject.shortDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {featuredProject.requiredDevices.map((device) => (
                  <span key={device} className="rounded-full border border-[#dfeaf0] bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {device}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <button
                type="button"
                onClick={() => void copyProjectApplicationUrl(featuredProject.id)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00A3E0]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#006f9a] transition hover:border-[#00A3E0]/40 hover:bg-[#f1fbff]"
              >
                <Link2 className="h-3.5 w-3.5" />
                Share apply link
              </button>
              <button
                onClick={() => setViewingProject(featuredProject)}
                className="rounded-xl border border-[#00A3E0]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#006f9a] transition hover:border-[#00A3E0]/40 hover:bg-[#f1fbff]"
              >
                View Scope
              </button>
              {role === 'tester' && featuredApplication?.status === 'pending' ? (
                <span className="text-xs font-semibold text-amber-700">Application pending · screener handled automatically</span>
              ) : featuredApplicationBlocker ? (
                <span className="max-w-52 text-xs font-semibold text-amber-800">
                  {globalBlockingProject?.title || 'Current project'} must be completed first
                </span>
              ) : (
                <button
                  onClick={() => handleOpenApplyModal(featuredProject)}
                  disabled={!isProjectOpenForApplications(featuredProject) && !featuredNeedsUtestUpdate}
                  className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0066EE] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {isProjectOpenForApplications(featuredProject)
                    ? featuredNeedsUtestUpdate ? 'Create Account & Reapply' : 'Apply to Featured Project'
                    : getProjectAvailabilityLabel(featuredProject.status, featuredProject.startsAt, featuredProject.slotsFilled, featuredProject.slotsTotal)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0">
        {regularProjects.map((project) => {
          const app = getApplicationForProject(project.id);
          const hasApplied = !!app;
          const isApproved = app?.status === 'approved';
          const isInvited = app?.inviteStatus === 'invited';
          const isAccepted = app?.inviteStatus === 'accepted';
          const isRejected = app?.status === 'rejected';
          const requiresNewUtestAccount = app?.status === 'needs_utest_update';
          const applicationBlocker = role === 'tester' ? getApplicationBlocker(project.id) : null;

          const isQA = !project.projectTrack || project.projectTrack === 'qa_functional';

          const slotsRemaining = Math.max(0, project.slotsTotal - project.slotsFilled);
          const slotPercentage = project.slotsTotal > 0
            ? Math.min(100, Math.round((project.slotsFilled / project.slotsTotal) * 100))
            : 100;

          return (
            <div
              key={project.id}
              className="bg-[#0B132B] border border-[#1E2E4E] hover:border-[#00A3E0]/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition group shadow-md hover:shadow-xl min-w-0 overflow-hidden"
            >
              <div>
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl p-2 bg-[#080D1A] rounded-xl border border-[#1E2E4E] shrink-0">
                      <ProjectIcon name={project.companyLogo} className="h-6 w-6 text-[#00A3E0]" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        {getTrackBadge(project.projectTrack)}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {project.category}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-base group-hover:text-[#00A3E0] transition leading-snug">
                        {project.title}
                      </h3>
                      <span className="inline-flex mt-1 rounded-full border border-[#1E2E4E] bg-[#111C33] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {getProjectAvailabilityLabel(project.status, project.startsAt, project.slotsFilled, project.slotsTotal)}
                      </span>
                      <p className="mt-1">
                        <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-md border border-[#9ACFC1] bg-[#DDF3EE] px-2 py-1 text-[11px] font-medium leading-relaxed text-[#185C52]">
                          <span>{project.company}</span>
                          <span aria-hidden="true">•</span>
                          <span>{project.supportedCountries.join(', ') || 'Global'}</span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-4">
                  {project.shortDescription}
                </p>

                {/* Device tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {project.requiredDevices.map((d) => (
                    <span
                      key={d}
                      className="px-2 py-0.5 rounded-md bg-[#080D1A] border border-[#1E2E4E] text-[11px] text-slate-300 flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3 text-[#00A3E0]" />
                      {d}
                    </span>
                  ))}
                </div>

                {/* Slot payout rate display */}
                {isQA ? (
                  <div className="slot-payout-highlight p-3 rounded-xl border border-[#E7C47B] mb-4 text-xs">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex justify-between">
                      <span>Slot payout per approved defect:</span>
                      <span className="text-emerald-800 font-bold">
                        Up to ${project.bountyStructure.critical}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                      <div className="bg-[#FCEAEA] p-1 rounded border border-[#E6AAAA]">
                        <span className="text-[#B94F4F] block font-bold">Crit</span>
                        <span className="text-white font-semibold">${project.bountyStructure.critical}</span>
                      </div>
                      <div className="bg-[#FFF9E8] p-1 rounded border border-[#EAD9B0]">
                        <span className="text-[#9A6714] block font-bold">High</span>
                        <span className="text-white font-semibold">${project.bountyStructure.high}</span>
                      </div>
                      <div className="bg-[#E3F4F5] p-1 rounded border border-[#91D2D5]">
                        <span className="text-[#087F8C] block font-bold">Med</span>
                        <span className="text-white font-semibold">${project.bountyStructure.medium}</span>
                      </div>
                      <div className="bg-[#E7F4EC] p-1 rounded border border-[#A7D2B7]">
                        <span className="text-[#287A59] block font-bold">Run</span>
                        <span className="text-white font-semibold">${project.bountyStructure.testCaseBounty}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Slot Capacity & Deadline */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#00A3E0]" />
                    <span>{project.status === 'upcoming' ? getProjectAvailabilityLabel(project.status, project.startsAt, project.slotsFilled, project.slotsTotal) : `Closes: ${project.deadline || 'Not set'}`}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-300">
                      {slotsRemaining} slots remaining
                    </span>
                    <div className="w-16 bg-[#080D1A] rounded-full h-1.5 overflow-hidden border border-[#1E2E4E]">
                      <div
                        className="bg-[#007AFF] h-full rounded-full"
                        style={{ width: `${slotPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions based on Freelance Scope */}
              <div className="pt-3 border-t border-[#1E2E4E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
                  <button
                    onClick={() => setViewingProject(project)}
                    className="text-xs text-[#00A3E0] hover:text-[#38BDF8] transition font-medium py-1"
                  >
                    View Scope & Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyProjectApplicationUrl(project.id)}
                    className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-slate-300 transition hover:text-white"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Share apply link
                  </button>
                </div>

                {/* Status-adaptive action button */}
                {isAccepted ? (
                  <button
                    onClick={() => onOpenWorkspace(project.id)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : isInvited ? (
                  <button
                    onClick={() => acceptInvite(app.id)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center justify-center space-x-1.5 transition shadow animate-pulse"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Invite Ready! Accept & Start</span>
                  </button>
                ) : hasApplied && isApproved ? (
                  <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                ) : requiresNewUtestAccount && !hasApplied ? (
                  <button
                    onClick={() => handleOpenApplyModal(project)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow"
                  >
                    <span>Create Account & Reapply</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : hasApplied && isRejected ? (
                  <span className="text-xs font-semibold text-slate-500 text-center sm:text-left py-1">
                    Not Selected
                  </span>
                ) : hasApplied ? (
                  <div className="space-y-2">
                    <span className="inline-flex items-center justify-center sm:justify-start gap-1 text-xs font-semibold text-amber-400/90 py-1">
                      <Clock className="w-3.5 h-3.5" /> Application Pending
                    </span>
                    {role === 'tester' && app && (
                      <span className="block text-[11px] font-semibold text-sky-200">Screener handled automatically</span>
                    )}
                  </div>
                ) : applicationBlocker ? (
                  <span className="text-xs font-semibold text-amber-300">
                    Complete {globalBlockingProject?.title || 'your current project'} before applying
                  </span>
                ) : !isProjectOpenForApplications(project) ? (
                  <span className="px-4 py-2.5 text-xs font-bold text-slate-400 text-center">
                    {getProjectAvailabilityLabel(project.status, project.startsAt, project.slotsFilled, project.slotsTotal)}
                  </span>
                ) : (
                  <button
                    onClick={() => handleOpenApplyModal(project)}
                    className="px-4 py-2.5 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm shadow-[#007AFF]/30"
                  >
                    <span>Apply for Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Details Modal */}
      {viewingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ProjectIcon name={viewingProject.companyLogo} className="h-7 w-7 text-[#00A3E0]" />
                <div>
                  <div className="flex items-center gap-2">
                    {getTrackBadge(viewingProject.projectTrack)}
                    <span className="text-xs text-slate-500">{viewingProject.company}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {viewingProject.title}
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {Math.max(0, viewingProject.slotsTotal - viewingProject.slotsFilled)} of {viewingProject.slotsTotal} slots remaining
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingProject(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs bg-white">
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Campaign Overview</h4>
                <p className="text-slate-600 leading-relaxed">
                  {viewingProject.fullOverview}
                </p>
              </div>

              {viewingProject.resources && viewingProject.resources.length > 0 && (
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                  <h4 className="font-semibold text-sky-800 mb-2">Project Resources</h4>
                  <div className="space-y-1.5">
                    {viewingProject.resources.map((resource) => (
                      <a key={`${resource.label}-${resource.url}`} href={resource.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sky-700 hover:text-sky-900 underline underline-offset-2">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>{resource.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliverables Guide if non-QA */}
              {viewingProject.deliverablesGuide && (
                <div className="p-4 bg-[#f3ebff] border border-[#d8c8ff] rounded-xl space-y-3 text-slate-800">
                  <div className="flex items-center space-x-2 text-violet-700 font-semibold">
                    <Info className="w-4 h-4" />
                    <span>Deliverable Specifications & Quality Gates</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-700">
                    {viewingProject.deliverablesGuide.instructions}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Format:</span>
                      <strong className="text-slate-900">{viewingProject.deliverablesGuide.fileFormat}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Required Samples:</span>
                      <strong className="text-slate-900">{viewingProject.deliverablesGuide.sampleCountRequired} items</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-violet-200">
                      <span className="text-slate-600 block">Settlement Rate:</span>
                      <strong className="text-emerald-700">${viewingProject.taskRate?.toFixed(2)} / batch</strong>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="font-semibold text-violet-700 block mb-1 text-[11px]">Acceptance Criteria:</span>
                    <ul className="space-y-1 text-slate-700 text-[11px]">
                      {viewingProject.deliverablesGuide.acceptanceCriteria.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-emerald-600 block mb-1.5">
                    In-Scope Requirements:
                  </span>
                  <ul className="space-y-1 text-slate-700 list-disc list-inside">
                    {viewingProject.inScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-rose-600 block mb-1.5">
                    Out of Scope:
                  </span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside">
                    {viewingProject.outOfScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Payment breakdown */}
              {viewingProject.projectTrack === 'qa_functional' ? (
                <div className="slot-payout-highlight rounded-xl border border-[#E7C47B] p-3">
                  <h4 className="mb-2 font-semibold text-slate-900">Slot Payout Rates</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg border border-[#E6AAAA] bg-[#FCEAEA] p-2">
                      <span className="block text-[11px] text-[#9E4141]">Critical Defect</span>
                      <span className="text-sm font-bold text-[#B94F4F]">
                        ${viewingProject.bountyStructure.critical}
                      </span>
                    </div>
                    <div className="rounded-lg border border-[#EAD9B0] bg-[#FFF9E8] p-2">
                      <span className="block text-[11px] text-[#806018]">High Defect</span>
                      <span className="text-sm font-bold text-[#9A6714]">
                        ${viewingProject.bountyStructure.high}
                      </span>
                    </div>
                    <div className="rounded-lg border border-[#91D2D5] bg-[#E3F4F5] p-2">
                      <span className="block text-[11px] text-[#28676A]">Medium Defect</span>
                      <span className="text-sm font-bold text-[#087F8C]">
                        ${viewingProject.bountyStructure.medium}
                      </span>
                    </div>
                    <div className="rounded-lg border border-[#A7D2B7] bg-[#E7F4EC] p-2">
                      <span className="block text-[11px] text-[#3E6C52]">Test Run Slot Payout</span>
                      <span className="text-sm font-bold text-[#287A59]">
                        ${viewingProject.bountyStructure.testCaseBounty}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="slot-payout-highlight rounded-xl border border-[#E7C47B] p-3">
                  <h4 className="mb-1 font-semibold text-[#76500F]">Bundle / Slot Payout</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Slot payout per task bundle</span>
                    <span className="font-black text-emerald-700">
                      ${viewingProject.taskRate?.toFixed(2) || viewingProject.bountyStructure.testCaseBounty || '45.00'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
              <span className="text-xs text-slate-600">
                Total Project Budget: ${viewingProject.totalBudget.toLocaleString()}
              </span>
              {role === 'admin' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-semibold text-slate-600">Admin task controls</span>
                  <button
                    type="button"
                    onClick={() => void copyProjectApplicationUrl(viewingProject.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Share apply link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(viewingProject);
                      setViewingProject(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0066EE]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit task
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyProjectApplicationUrl(viewingProject.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Share apply link
                  </button>
                  {role === 'tester' && getApplicationForProject(viewingProject.id)?.status === 'pending' ? (
                    <span className="text-xs font-semibold text-amber-700">Application pending · screener handled automatically</span>
                  ) : role === 'tester' && getApplicationBlocker(viewingProject.id) ? (
                    <span className="text-xs font-semibold text-amber-800">
                      Complete {globalBlockingProject?.title || 'your current project'} before applying
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        const proj = viewingProject;
                        setViewingProject(null);
                        handleOpenApplyModal(proj);
                      }}
                      disabled={!isProjectOpenForApplications(viewingProject)}
                      className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-xs font-bold rounded-xl transition shadow-sm shadow-[#007AFF]/30 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      {isProjectOpenForApplications(viewingProject) ? 'Apply for Opportunity' : getProjectAvailabilityLabel(viewingProject.status, viewingProject.startsAt, viewingProject.slotsFilled, viewingProject.slotsTotal)}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply to Project Modal */}
      {applyingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Submit Application</h3>
              </div>
              <button
                onClick={() => setApplyingProject(null)}
                disabled={isSubmittingApplication}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {applicationScreenerResult?.submitted === false ? 'Application Saved' : 'Application Submitted!'}
                </h4>
                <p className="text-xs text-slate-600">
                  {applicationScreenerResult?.queued
                    ? `${applicationScreenerResult.message} If Applause confirms the response, your application will be approved and an invitation email queued.`
                    : applicationScreenerResult?.message || 'Your application has been submitted.'}
                </p>
                {applicationScreenerResult && !applicationScreenerResult.queued && !applicationScreenerResult.submitted && (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
                    <p className="text-xs leading-relaxed text-amber-900">
                      Your application is saved, but there was a problem saving the screener details. {applicationScreenerResult.message}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitApplication} className="min-h-0 space-y-4 overflow-y-auto pr-1 pt-4 text-xs">
                {applyError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{applyError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Opportunity:</span>
                  <p className="font-semibold text-slate-900">{applyingProject.title}</p>
                  <p className="text-[#00A3E0]">{applyingProject.company} • {applyingProject.category}</p>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-[11px] leading-relaxed text-sky-900">
                  <p className="font-semibold">
                    Most of our projects are carried out on our partner site,{' '}
                    <a
                      href="https://www.utest.com/signup"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-900"
                    >
                      uTest.com
                    </a>
                    . Connectfy does not collect or process participant payments directly. Please sign up and share your uTest ID and uTest email so payments can be processed through the partner platform.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Full Identity Name
                    <input
                      value={applicationDraft?.fullName || ''}
                      onChange={(event) => updateDraft({ fullName: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="Full Identity Name"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    uTest Tester ID
                    <input
                      value={applicationDraft?.testerId || ''}
                      onChange={(event) => updateDraft({ testerId: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="uTest Tester ID"
                    />
                    <span className="text-[10px] font-normal text-slate-500">Applause screener submissions require an ID beginning with 30.</span>
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    uTest Email
                    <input
                      type="email"
                      value={applicationDraft?.utestEmail || ''}
                      onChange={(event) => updateDraft({ utestEmail: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="uTest Email"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Date of Birth
                    <input
                      type="date"
                      max={getDateInputMax()}
                      value={applicationDraft?.dateOfBirth || ''}
                      onChange={(event) => updateDraft({
                        dateOfBirth: event.target.value,
                        ageRange: getScreenerAgeRange(event.target.value)
                      })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Age Range
                    <select
                      required
                      value={applicationDraft?.ageRange || ''}
                      onChange={(event) => updateDraft({ ageRange: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                    >
                      <option value="" disabled>Select an age range</option>
                      <option value="18-25">18-25</option>
                      <option value="26-39">26-39</option>
                      <option value="40-59">40-59</option>
                      <option value="60+">60+</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Country
                    <input
                      value={applicationDraft?.country || ''}
                      onChange={(event) => updateDraft({ country: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="Country"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700 sm:col-span-2">
                    Smartphone / Device used for this project
                    <input
                      value={applicationDraft?.smartphone || ''}
                      onChange={(event) => updateDraft({ smartphone: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="e.g. iPhone 15 Pro (iOS 17.5)"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700 sm:col-span-2">
                    Phone number <span className="text-rose-600">*</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      pattern="[+]?[0-9][0-9 ().-]{5,28}"
                      title="Enter a phone number with 7 to 15 digits. A leading +, spaces, parentheses, and hyphens are allowed."
                      inputMode="tel"
                      value={applicationDraft?.phoneNumber || ''}
                      onChange={(event) => updateDraft({ phoneNumber: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="e.g. +254 712 345 678"
                    />
                    <span className="text-[10px] font-normal text-slate-500">Use 7 to 15 digits; a leading +, spaces, parentheses, and hyphens are allowed.</span>
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Gmail address from your Connectfy profile <span className="text-rose-600">*</span>
                    <input
                      type="email"
                      required
                      readOnly
                      value={applicationDraft?.gmailEmail || ''}
                      className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                    <span className="text-[10px] font-normal text-slate-500">The Applause screener requires a Gmail address. Update your account profile if this is not the right address.</span>
                  </label>

                  <div className="space-y-1.5">
                    <label htmlFor="screener-gender" className="block font-semibold text-slate-700">
                      Gender <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="screener-gender"
                      required
                      value={applicationDraft?.screenerGender || ''}
                      onChange={(event) => updateDraft({ screenerGender: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                    >
                      <option value="" disabled>Select an option</option>
                      {SCREENER_GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                    </select>
                    {applicationDraft?.screenerGender === 'Other' && (
                      <input
                        value={applicationDraft.screenerGenderOther}
                        onChange={(event) => updateDraft({ screenerGenderOther: event.target.value })}
                        required
                        aria-label="Enter gender"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                        placeholder="Enter gender"
                      />
                    )}
                  </div>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    What type of mobile device do you own, and does it have a functional camera and microphone? <span className="text-rose-600">*</span>
                    <select
                      required
                      value={applicationDraft?.screenerDeviceType || ''}
                      onChange={(event) => updateDraft({ screenerDeviceType: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                    >
                      <option value="" disabled>Select an option</option>
                      {SCREENER_DEVICES.map((device) => <option key={device} value={device}>{device}</option>)}
                    </select>
                    {applicationDraft?.screenerDeviceType === 'Other' && (
                      <input
                        value={applicationDraft.screenerDeviceOther}
                        onChange={(event) => updateDraft({ screenerDeviceOther: event.target.value })}
                        required
                        aria-label="Enter mobile device type"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                        placeholder="Enter device type"
                      />
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5 font-semibold text-slate-700">
                    Mobile device OS version <span className="text-rose-600">*</span>
                    <input
                      required
                      value={applicationDraft?.screenerOsVersion || ''}
                      onChange={(event) => updateDraft({ screenerOsVersion: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="e.g. Android 14 or iOS 18.1"
                    />
                  </label>
                </div>

                <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <legend className="px-1 font-semibold text-slate-800">
                    Fluent languages <span className="text-rose-600">*</span>
                  </legend>
                  <p className="text-[11px] text-slate-600">Select every language you can speak and read naturally.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SCREENER_LANGUAGES.map((language) => (
                      <label key={language} className="flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(applicationDraft?.fluentLanguages.includes(language))}
                          onChange={() => handleToggleScreenerLanguage(language)}
                          className="h-4 w-4 accent-[#00A3E0]"
                        />
                        {language}
                      </label>
                    ))}
                  </div>
                  {applicationDraft?.fluentLanguages.includes('Other') && (
                    <input
                      value={applicationDraft.languageOther}
                      onChange={(event) => updateDraft({ languageOther: event.target.value })}
                      required
                      aria-label="Enter fluent language"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00A3E0]"
                      placeholder="Enter fluent language"
                    />
                  )}
                </fieldset>

                <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <legend className="px-1 font-semibold text-slate-800">
                    Do you have access to both a quiet recording space and a space with background noise? <span className="text-rose-600">*</span>
                  </legend>
                  <div className="flex gap-5">
                    {[true, false].map((available) => (
                      <label key={String(available)} className="flex items-center gap-2 text-slate-700">
                        <input
                          type="radio"
                          name="recording-space-available"
                          checked={applicationDraft?.recordingSpaceAvailable === available}
                          onChange={() => updateDraft({ recordingSpaceAvailable: available })}
                          className="h-4 w-4 accent-[#00A3E0]"
                        />
                        {available ? 'Yes' : 'No'}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="block font-semibold text-slate-800" htmlFor="utest-account-screenshot">
                    uTest account screenshot <span className="text-rose-600">*</span>
                  </label>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Upload a screenshot showing your uTest profile or account ID. Crop out passwords, recovery codes, and payment details. Image files up to 8 MB.
                  </p>
                  <a href={evidenceImage} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700 bg-[#080D1A]" aria-label="Open the example uTest account screenshot">
                    <img src={evidenceImage} alt="Example uTest sidebar with the account name and tester ID highlighted" className="h-40 w-full object-cover object-[center_90%]" />
                    <span className="block border-t border-slate-700 px-3 py-1.5 text-[10px] font-semibold text-slate-200">Example screenshot: keep your uTest account name and ID visible</span>
                  </a>
                  <input
                    id="utest-account-screenshot"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void handleUtestScreenshotUpload(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                    disabled={isUploadingUtestScreenshot}
                    className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-100 disabled:opacity-60"
                  />
                  {isUploadingUtestScreenshot && <p className="text-xs font-medium text-sky-700">Uploading screenshot…</p>}
                  {applicationDraft?.utestAccountScreenshotUrl && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-2">
                      <ImageIcon className="h-4 w-4 shrink-0 text-emerald-700" />
                      <img src={applicationDraft.utestAccountScreenshotUrl} alt="Uploaded uTest account screenshot preview" className="h-14 w-20 rounded border border-slate-200 object-cover" />
                      <span className="min-w-0 flex-1 text-xs font-semibold text-emerald-800">Screenshot uploaded</span>
                      <a href={applicationDraft.utestAccountScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">View</a>
                    </div>
                  )}
                </div>

                <p className="rounded-lg border border-[#00A3E0]/30 bg-[#007AFF]/10 px-3 py-2 text-[11px] leading-relaxed text-[#005b85]">
                  Payment reminder: Connectfy does not collect your payments. Your uTest ID and uTest email are required for payment processing through uTest.
                </p>

                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-[11px] leading-relaxed text-sky-950">
                    This organization-only project uses your prior hiring authorization. After you apply, Connectfy automatically sends your saved application details and screener answers to Applause through its{' '}
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >Google Form</a>. Contact project management if your prior authorization has changed.
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex items-start gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(applicationDraft?.hasValidId)}
                      onChange={(event) => updateDraft({ hasValidId: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#00A3E0]"
                    />
                    I have a valid government-issued ID available and understand that ID verification is required to participate.
                  </label>

                  <label className="flex items-start gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(applicationDraft?.willingVoiceRecording)}
                      onChange={(event) => updateDraft({ willingVoiceRecording: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#00A3E0]"
                    />
                    I am willing to complete short voice recordings, including recordings in both quiet and normal/noisy environments.
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Select Your Hardware / Fleet for this Project:
                  </label>

                  {testerProfile.devices.length === 0 && !showAddDeviceForm ? (
                    <div className="p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-600">
                      <p className="font-medium text-slate-700 mb-2">No devices saved yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddDeviceForm(true)}
                        className="px-3 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white text-[11px] font-bold rounded-lg"
                      >
                        Add Device
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {testerProfile.devices.map((device) => {
                          const isChecked = selectedDevices.includes(device);
                          return (
                            <button
                              key={device}
                              type="button"
                              onClick={() => handleToggleDevice(device)}
                              className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition ${
                                isChecked
                                  ? 'bg-[#007AFF] border-[#0066EE] text-white shadow-md shadow-[#007AFF]/25'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {isChecked ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-white" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="truncate">{device}</span>
                              {isChecked && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide">Selected</span>}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDeviceFormError('');
                          setShowAddDeviceForm(prev => !prev);
                        }}
                        className="text-[11px] font-semibold text-[#00A3E0] hover:text-[#38BDF8]"
                      >
                        {showAddDeviceForm ? 'Cancel device form' : '+ Add another device'}
                      </button>
                    </div>
                  )}

                  {showAddDeviceForm && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                      {deviceFormError && (
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px]">
                          {deviceFormError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={deviceDraft.category}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, category: e.target.value as any }))}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#00A3E0]"
                        >
                          <option value="Smartphone">Smartphone</option>
                          <option value="Tablet">Tablet</option>
                          <option value="Computer">Computer</option>
                          <option value="Smart TV">Smart TV</option>
                          <option value="Wearable">Wearable</option>
                          <option value="Console">Console</option>
                        </select>

                        <select
                          value={deviceDraft.os}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, os: e.target.value }))}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#00A3E0]"
                        >
                          <option value="iOS">iOS</option>
                          <option value="Android">Android</option>
                          <option value="macOS">macOS</option>
                          <option value="Windows">Windows</option>
                          <option value="tvOS">tvOS</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={deviceDraft.brand}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="Brand"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                        <input
                          type="text"
                          value={deviceDraft.model}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="Model"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={deviceDraft.osVersion}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, osVersion: e.target.value }))}
                          placeholder="OS version"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                        <input
                          type="text"
                          value={deviceDraft.carrier}
                          onChange={(e) => setDeviceDraft(prev => ({ ...prev, carrier: e.target.value }))}
                          placeholder="Carrier (optional)"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#00A3E0]"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={deviceDraft.isJailbroken}
                            onChange={(e) => setDeviceDraft(prev => ({ ...prev, isJailbroken: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          Jailbroken / rooted
                        </label>

                        <button
                          type="button"
                          onClick={handleAddInlineDevice}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg"
                        >
                          Save Device
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qualifications & Relevant Experience Note:
                  </label>
                  <textarea
                    rows={3}
                    value={experienceNote}
                    onChange={(e) => setExperienceNote(e.target.value)}
                    placeholder="Describe your testing experience or data collection capabilities..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-[#00A3E0]"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Freelancer Scope & Payout Commitment</span>
                  </div>
                  <p>
                    Once approved and your task deliverable or defect is validated, your bounty will automatically credit to your wallet balance for direct payout transfer.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingProject(null)}
                    disabled={isSubmittingApplication}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingUtestScreenshot || isSubmittingApplication}
                    className="px-5 py-2 bg-[#007AFF] hover:bg-[#0066EE] text-white font-bold rounded-xl shadow transition shadow-[#007AFF]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingApplication ? 'Submitting…' : 'Confirm & Send Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal for Admins & PMs */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
      />
      <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} />
    </div>
  );
};
