import React, { useEffect, useState } from 'react';
import {
  User,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  Watch,
  Gamepad2,
  CreditCard,
  Award,
  Sliders,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
  Save,
  Star,
  X,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Building,
  DollarSign,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Briefcase
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectIcon } from './ProjectIcon';
import { DeviceFleetItem, LanguageSkill } from '../types';
import { isCloudinaryConfigured, uploadToCloudinary } from '../lib/cloudinary';

interface ProfileSettingsProps {
  onBack?: () => void;
}

type SettingsTab = 'personal' | 'utest' | 'devices' | 'skills' | 'payment' | 'preferences' | 'client';

type PaymentMethodOption = 'PayPal' | 'Payoneer' | 'Wise' | 'Direct Bank Wire';

const PaymentMethodLogo: React.FC<{ method: PaymentMethodOption; className?: string }> = ({ method, className = 'h-5 w-5' }) => {
  const commonProps = { className, viewBox: '0 0 32 32', fill: 'none' } as const;

  switch (method) {
    case 'PayPal':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F6BFF"/>
          <path d="M10 18.5C10 15.7 12.1 13.5 15.1 13.5H18.5C21.8 13.5 24.1 15.8 24.1 19.1C24.1 22.5 21.7 25 18.2 25H14.4C13.1 25 12 24 12 22.7L10.7 16.9C10.5 15.9 10.9 15.1 11.7 15.1H15.4C17.8 15.1 19.2 16.3 19.2 18.4C19.2 20.4 17.7 21.6 15.5 21.6H13.7L13.1 18.5H10Z" fill="white"/>
          <path d="M12.9 11.3L13.7 8.8C14 7.9 14.7 7.3 15.8 7.3H19.1C20.8 7.3 22.1 8.4 22.1 10.2C22.1 11.8 21 12.8 19.2 12.8H17.2L16.5 11.3H12.9Z" fill="#A7D1FF"/>
        </svg>
      );
    case 'Wise':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#1F5CFF"/>
          <path d="M9 10.5H18.3C21.2 10.5 23.5 12.8 23.5 15.8C23.5 18.7 21.2 21 18.3 21H13.7L15.8 18.2H18.2C19.6 18.2 20.7 17.1 20.7 15.7C20.7 14.3 19.6 13.2 18.2 13.2H11.8L9 10.5Z" fill="white"/>
          <path d="M10.8 15.9H12.9L9.8 21H7.6L10.8 15.9ZM13.3 9.5H15.9L12.8 14.7H10.2L13.3 9.5Z" fill="#DDEBFF"/>
        </svg>
      );
    case 'Payoneer':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#121C2D"/>
          <path d="M10 23.2V8.8H16.2C19.7 8.8 22 10.8 22 14.2C22 17.7 19.8 19.7 16.1 19.7H14.5V23.2H10ZM14.5 16.3H15.8C17.4 16.3 18.1 15.7 18.1 14.3C18.1 12.8 17.4 12.2 15.8 12.2H14.5V16.3Z" fill="#D7F3FF"/>
          <path d="M18.5 8.8H22V23.2H18.5V8.8Z" fill="#7CD8FF"/>
        </svg>
      );
    case 'Direct Bank Wire':
    default:
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F766E"/>
          <path d="M9 11.5C9 10.1 10.1 9 11.5 9H20.5C21.9 9 23 10.1 23 11.5V20.5C23 21.9 21.9 23 20.5 23H11.5C10.1 23 9 21.9 9 20.5V11.5Z" fill="white" fillOpacity="0.12"/>
          <path d="M11 12.5H21M11 16H21M11 19.5H17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M13.5 9V6.5M18.5 9V6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
  }
};

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onBack }) => {
  const {
    role,
    setRole,
    testerProfile,
    clientProfile,
    updateTesterProfile,
    updateClientProfile,
    addTesterDevice,
    removeTesterDevice,
    toggleTesterDeviceActive,
    setTesterPrimaryDevice,
    setActiveTab
  } = useApp();

  // Active settings tab
  const [currentTab, setCurrentTab] = useState<SettingsTab>(role === 'client' ? 'client' : 'personal');

  // Form states for Tester Profile
  const [name, setName] = useState(testerProfile.name || '');
  const [email, setEmail] = useState(testerProfile.email || '');
  const [utestId, setUtestId] = useState(testerProfile.uTestId || '');
  const [utestEmail, setUtestEmail] = useState(testerProfile.uTestEmail || '');
  const [legalName, setLegalName] = useState(testerProfile.legalName || '');
  const [dateOfBirth, setDateOfBirth] = useState(testerProfile.dateOfBirth || '');
  const [phone, setPhone] = useState(testerProfile.phone || '');
  const [country, setCountry] = useState(testerProfile.country || '');
  const [city, setCity] = useState(testerProfile.city || '');
  const [stateOrProvince, setStateOrProvince] = useState(testerProfile.stateOrProvince || '');
  const [postalCode, setPostalCode] = useState(testerProfile.postalCode || '');
  const [timezone, setTimezone] = useState(testerProfile.timezone || '');
  const [headline, setHeadline] = useState(testerProfile.headline || '');
  const [bio, setBio] = useState(testerProfile.bio || '');
  const [avatar, setAvatar] = useState(testerProfile.avatar || '');
  const [clientAvatar, setClientAvatar] = useState(clientProfile.avatar || '');

  // Languages state
  const [languages, setLanguages] = useState<LanguageSkill[]>(testerProfile.languages || []);
  const [newLangName, setNewLangName] = useState('');
  const [newLangProficiency, setNewLangProficiency] = useState<'Native' | 'Fluent' | 'Intermediate' | 'Basic'>('Fluent');

  // Preferences toggles state
  const [availableForCycles, setAvailableForCycles] = useState(testerProfile.preferences?.availableForCycles ?? true);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(testerProfile.preferences?.maxWeeklyHours ?? 20);
  const [weekendTesting, setWeekendTesting] = useState(testerProfile.preferences?.weekendTesting ?? false);
  const [ndaAgreed, setNdaAgreed] = useState(testerProfile.preferences?.ndaAgreed ?? false);
  const [instantEmailAlerts, setInstantEmailAlerts] = useState(testerProfile.preferences?.instantEmailAlerts ?? true);
  const [instantSmsAlerts, setInstantSmsAlerts] = useState(testerProfile.preferences?.instantSmsAlerts ?? false);
  const [highBountyOnly, setHighBountyOnly] = useState(testerProfile.preferences?.highBountyOnly ?? false);
  const [realMoneyTesting, setRealMoneyTesting] = useState(testerProfile.preferences?.realMoneyTesting ?? true);
  const [apkSideloadingAllowed, setApkSideloadingAllowed] = useState(testerProfile.preferences?.apkSideloadingAllowed ?? false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(testerProfile.preferences?.interestedCategories || []);

  // Payment Settings state
  const [preferredMethod, setPreferredMethod] = useState<'PayPal' | 'Payoneer' | 'Wise' | 'Direct Bank Wire'>(
    testerProfile.paymentSettings?.preferredMethod || 'PayPal'
  );
  const [paypalEmail, setPaypalEmail] = useState(testerProfile.paymentSettings?.paypalEmail || '');
  const [payoneerId, setPayoneerId] = useState(testerProfile.paymentSettings?.payoneerId || '');
  const [wiseEmail, setWiseEmail] = useState(testerProfile.paymentSettings?.wiseEmail || '');
  const [bankName, setBankName] = useState(testerProfile.paymentSettings?.bankDetails?.bankName || '');
  const [accountHolder, setAccountHolder] = useState(testerProfile.paymentSettings?.bankDetails?.accountHolder || '');
  const [ibanOrAccount, setIbanOrAccount] = useState(testerProfile.paymentSettings?.bankDetails?.ibanOrAccount || '');
  const [swiftBic, setSwiftBic] = useState(testerProfile.paymentSettings?.bankDetails?.swiftBic || '');
  const [autoWithdraw, setAutoWithdraw] = useState(testerProfile.paymentSettings?.autoWithdraw ?? false);
  const [autoWithdrawThreshold, setAutoWithdrawThreshold] = useState(testerProfile.paymentSettings?.autoWithdrawThreshold || 50);

  // Skills state
  const [skills, setSkills] = useState<string[]>(testerProfile.skills || []);
  const [newSkillText, setNewSkillText] = useState('');

  // Device fleet filter
  const [deviceCategoryFilter, setDeviceCategoryFilter] = useState<string>('all');
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  // Add device form state
  const [newDevCategory, setNewDevCategory] = useState<'Smartphone' | 'Tablet' | 'Computer' | 'Smart TV' | 'Wearable' | 'Console'>('Smartphone');
  const [newDevBrand, setNewDevBrand] = useState('Apple');
  const [newDevModel, setNewDevModel] = useState('');
  const [newDevOs, setNewDevOs] = useState('iOS');
  const [newDevOsVersion, setNewDevOsVersion] = useState('');
  const [newDevCarrier, setNewDevCarrier] = useState('Safaricom 5G');
  const [newDevIsp, setNewDevIsp] = useState('Safaricom Fiber');
  const [newDevJailbroken, setNewDevJailbroken] = useState(false);
  const [newDevPrimary, setNewDevPrimary] = useState(false);

  // Client Profile state
  const [clientCompanyName, setClientCompanyName] = useState(clientProfile.company || '');
  const [clientDirectorName, setClientDirectorName] = useState(clientProfile.name || '');
  const [clientEmail, setClientEmail] = useState(clientProfile.email || '');
  const [clientPhone, setClientPhone] = useState(clientProfile.phone || '');
  const [clientIndustry, setClientIndustry] = useState(clientProfile.industry || '');
  const [clientWebsite, setClientWebsite] = useState(clientProfile.website || '');
  const [clientBillingAddress, setClientBillingAddress] = useState(clientProfile.billingAddress || '');
  const [clientNdaRequired, setClientNdaRequired] = useState(clientProfile.ndaRequired ?? false);
  const [clientCriticalBounty, setClientCriticalBounty] = useState(clientProfile.defaultBountyMatrix?.critical || 0);
  const [clientHighBounty, setClientHighBounty] = useState(clientProfile.defaultBountyMatrix?.high || 0);
  const [clientMediumBounty, setClientMediumBounty] = useState(clientProfile.defaultBountyMatrix?.medium || 0);
  const [clientLowBounty, setClientLowBounty] = useState(clientProfile.defaultBountyMatrix?.low || 0);

  // Toast / Save feedback
  const [saveSuccess, setSaveSuccess] = useState(false);

  const availableCategoriesList = [
    'Payment & Checkout',
    'Functional',
    'Security',
    'Usability',
    'Localization',
    'Exploratory',
    'Performance & Load',
    'Streaming & Video'
  ];

  useEffect(() => {
    setName(testerProfile.name || '');
    setEmail(testerProfile.email || '');
    setUtestId(testerProfile.uTestId || '');
    setUtestEmail(testerProfile.uTestEmail || '');
    setLegalName(testerProfile.legalName || '');
    setDateOfBirth(testerProfile.dateOfBirth || '');
    setPhone(testerProfile.phone || '');
    setCountry(testerProfile.country || '');
    setCity(testerProfile.city || '');
    setStateOrProvince(testerProfile.stateOrProvince || '');
    setPostalCode(testerProfile.postalCode || '');
    setTimezone(testerProfile.timezone || '');
    setHeadline(testerProfile.headline || '');
    setBio(testerProfile.bio || '');
    setAvatar(testerProfile.avatar || '');
    setLanguages(testerProfile.languages || []);
    setAvailableForCycles(testerProfile.preferences?.availableForCycles ?? true);
    setMaxWeeklyHours(testerProfile.preferences?.maxWeeklyHours ?? 20);
    setWeekendTesting(testerProfile.preferences?.weekendTesting ?? false);
    setNdaAgreed(testerProfile.preferences?.ndaAgreed ?? false);
    setInstantEmailAlerts(testerProfile.preferences?.instantEmailAlerts ?? true);
    setInstantSmsAlerts(testerProfile.preferences?.instantSmsAlerts ?? false);
    setHighBountyOnly(testerProfile.preferences?.highBountyOnly ?? false);
    setRealMoneyTesting(testerProfile.preferences?.realMoneyTesting ?? true);
    setApkSideloadingAllowed(testerProfile.preferences?.apkSideloadingAllowed ?? false);
    setSelectedCategories(testerProfile.preferences?.interestedCategories || []);
    setPreferredMethod(testerProfile.paymentSettings?.preferredMethod || 'PayPal');
    setPaypalEmail(testerProfile.paymentSettings?.paypalEmail || '');
    setPayoneerId(testerProfile.paymentSettings?.payoneerId || '');
    setWiseEmail(testerProfile.paymentSettings?.wiseEmail || '');
    setBankName(testerProfile.paymentSettings?.bankDetails?.bankName || '');
    setAccountHolder(testerProfile.paymentSettings?.bankDetails?.accountHolder || '');
    setIbanOrAccount(testerProfile.paymentSettings?.bankDetails?.ibanOrAccount || '');
    setSwiftBic(testerProfile.paymentSettings?.bankDetails?.swiftBic || '');
    setAutoWithdraw(testerProfile.paymentSettings?.autoWithdraw ?? false);
    setAutoWithdrawThreshold(testerProfile.paymentSettings?.autoWithdrawThreshold || 50);
    setSkills(testerProfile.skills || []);
  }, [testerProfile]);

  useEffect(() => {
    setClientCompanyName(clientProfile.company || '');
    setClientDirectorName(clientProfile.name || '');
    setClientEmail(clientProfile.email || '');
    setClientPhone(clientProfile.phone || '');
    setClientIndustry(clientProfile.industry || '');
    setClientWebsite(clientProfile.website || '');
    setClientBillingAddress(clientProfile.billingAddress || '');
    setClientNdaRequired(clientProfile.ndaRequired ?? false);
    setClientAvatar(clientProfile.avatar || '');
    setClientCriticalBounty(clientProfile.defaultBountyMatrix?.critical || 0);
    setClientHighBounty(clientProfile.defaultBountyMatrix?.high || 0);
    setClientMediumBounty(clientProfile.defaultBountyMatrix?.medium || 0);
    setClientLowBounty(clientProfile.defaultBountyMatrix?.low || 0);
  }, [clientProfile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!isCloudinaryConfigured) {
        throw new Error('Cloudinary upload is not configured. Add your Cloudinary settings to .env.local first.');
      }

      const result = await uploadToCloudinary(file);
      const secureUrl = result.secure_url;

      if (!secureUrl) {
        throw new Error('Cloudinary returned no image URL.');
      }

      if (role === 'client' || currentTab === 'client') {
        setClientAvatar(secureUrl);
      } else {
        setAvatar(secureUrl);
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      window.alert(error instanceof Error ? error.message : 'Unable to upload profile image.');
    } finally {
      event.target.value = '';
    }
  };

  const currentAvatarUrl = role === 'client' ? (clientAvatar || clientProfile.avatar) : (avatar || testerProfile.avatar || clientProfile.avatar);

  const handleSaveAll = () => {
    if (role === 'tester' || currentTab !== 'client') {
      updateTesterProfile({
        name,
        email,
        uTestId: utestId,
        uTestEmail: utestEmail,
        legalName,
        dateOfBirth,
        phone,
        country,
        city,
        stateOrProvince,
        postalCode,
        timezone,
        headline,
        bio,
        avatar,
        languages,
        skills,
        preferences: {
          availableForCycles,
          maxWeeklyHours,
          weekendTesting,
          ndaAgreed,
          instantEmailAlerts,
          instantSmsAlerts,
          highBountyOnly,
          realMoneyTesting,
          apkSideloadingAllowed,
          interestedCategories: selectedCategories
        },
        paymentSettings: {
          preferredMethod,
          paypalEmail,
          payoneerId,
          wiseEmail,
          bankDetails: {
            bankName,
            accountHolder,
            ibanOrAccount,
            swiftBic
          },
          autoWithdraw,
          autoWithdrawThreshold,
          taxFormType: testerProfile.paymentSettings?.taxFormType || 'W-8BEN',
          taxStatus: testerProfile.paymentSettings?.taxStatus || 'Verified',
          taxIdMasked: testerProfile.paymentSettings?.taxIdMasked || 'PIN: A00***492K',
          taxCountry: testerProfile.paymentSettings?.taxCountry || 'Kenya'
        }
      });
    }

    if (role === 'client' || currentTab === 'client') {
      updateClientProfile({
        company: clientCompanyName,
        name: clientDirectorName,
        email: clientEmail,
        phone: clientPhone,
        industry: clientIndustry,
        website: clientWebsite,
        billingAddress: clientBillingAddress,
        avatar: clientAvatar,
        ndaRequired: clientNdaRequired,
        defaultBountyMatrix: {
          critical: Number(clientCriticalBounty),
          high: Number(clientHighBounty),
          medium: Number(clientMediumBounty),
          low: Number(clientLowBounty)
        }
      });
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleAddLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangName.trim()) return;
    if (languages.some(l => l.language.toLowerCase() === newLangName.trim().toLowerCase())) return;
    setLanguages([...languages, { language: newLangName.trim(), proficiency: newLangProficiency }]);
    setNewLangName('');
  };

  const handleRemoveLanguage = (langName: string) => {
    setLanguages(languages.filter(l => l.language !== langName));
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillText.trim()) return;
    if (skills.includes(newSkillText.trim())) return;
    setSkills([...skills, newSkillText.trim()]);
    setNewSkillText('');
  };

  const handleRemoveSkill = (skillText: string) => {
    setSkills(skills.filter(s => s !== skillText));
  };

  const handleToggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleAddDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevBrand.trim() || !newDevModel.trim()) return;

    addTesterDevice({
      category: newDevCategory,
      brand: newDevBrand.trim(),
      model: newDevModel.trim(),
      os: newDevOs,
      osVersion: newDevOsVersion.trim() || 'Latest',
      carrier: newDevCarrier.trim() || 'WiFi Only',
      isp: newDevIsp.trim() || 'Broadband',
      isJailbroken: newDevJailbroken,
      isPrimary: newDevPrimary,
      isActive: true
    });

    // Reset add device form
    setNewDevModel('');
    setNewDevOsVersion('');
    setIsAddDeviceOpen(false);
  };

  const currentDeviceFleet = testerProfile.deviceFleet || [];
  const filteredDevices = currentDeviceFleet.filter(dev => {
    if (deviceCategoryFilter === 'all') return true;
    return dev.category.toLowerCase() === deviceCategoryFilter.toLowerCase();
  });

  const getDeviceIcon = (cat: string) => {
    switch (cat) {
      case 'Smartphone': return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'Tablet': return <Tablet className="w-4 h-4 text-emerald-400" />;
      case 'Computer': return <Laptop className="w-4 h-4 text-indigo-400" />;
      case 'Smart TV': return <Tv className="w-4 h-4 text-purple-400" />;
      case 'Wearable': return <Watch className="w-4 h-4 text-amber-400" />;
      case 'Console': return <Gamepad2 className="w-4 h-4 text-rose-400" />;
      default: return <Smartphone className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="theme-settings space-y-6 animate-fade-in text-slate-100">
      
      {/* Top Banner & Header */}
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00A3E0]/10 via-[#007AFF]/5 to-transparent pointer-events-none rounded-full blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-[#111C33] hover:bg-slate-700 text-slate-300 hover:text-white transition border border-[#1E2E4E]"
                title="Return to previous view"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="relative">
              <img
                key={currentAvatarUrl || 'default-avatar'}
                src={currentAvatarUrl}
                alt={role === 'tester' || role === 'admin' ? (name || testerProfile.name || 'User') : (clientCompanyName || clientProfile.company || 'User')}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#00A3E0]/40 shadow-lg shadow-[#00A3E0]/10"
                referrerPolicy="no-referrer"
              />
              <label className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-[#007AFF] border border-white cursor-pointer shadow-lg">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Plus className="w-3.5 h-3.5 text-white" />
              </label>
              <span className="absolute -bottom-1 -left-1 px-1.5 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-md shadow-xs flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-slate-950" />
                {role === 'tester' ? testerProfile.tier : 'Director'}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">
                  {role === 'tester' ? name : clientCompanyName}
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Connectfy Verified Member
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                {role === 'tester'
                  ? headline
                  : `${clientDirectorName} • ${clientIndustry} • Managed Crowdsourced QA`}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#00A3E0]" />
                  {role === 'tester' ? `${city}, ${country}` : clientBillingAddress}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#00A3E0]" />
                  {timezone}
                </span>
                {role === 'tester' && (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    {testerProfile.acceptanceRate}% Bug Acceptance
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Right Controls: Role toggle & Save Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start bg-[#080D1A] p-1 rounded-xl border border-[#1E2E4E]">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-300 w-full justify-between sm:justify-start">
                <div className="flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#00A3E0]" />
                  <span className="text-slate-400 font-normal">Active Role:</span>
                </div>
                <span className="text-amber-400 font-bold">
                  {role === 'tester' ? 'Tester Profile' : role === 'admin' ? 'Admin Profile' : 'Client Profile'}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveAll}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#007AFF] hover:bg-[#0066EE] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#007AFF]/25 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>

        {/* Live Saved Toast Notification Banner */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between animate-fade-in text-emerald-300 text-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Settings successfully saved!</strong> All your profile updates, hardware fleet additions, and cycle preferences are now active in the matching algorithm.
              </span>
            </div>
            <button onClick={() => setSaveSuccess(false)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Settings navigation tabs */}
      <div className="flex items-center space-x-1 bg-[#0B132B] p-1.5 rounded-2xl border border-[#1E2E4E] overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCurrentTab('personal')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'personal'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal & Contact Info</span>
        </button>

        <button
          onClick={() => setCurrentTab('utest')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'utest'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>uTest Details</span>
        </button>

        <button
          onClick={() => setCurrentTab('devices')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'devices'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Hardware Fleet</span>
          <span className="px-1.5 py-0.2 bg-[#080D1A] rounded text-[10px] text-[#38BDF8] border border-[#1E2E4E]">
            {currentDeviceFleet.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('skills')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'skills'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Skills & Academy</span>
        </button>

        <button
          onClick={() => setCurrentTab('payment')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'payment'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payments & Tax (W-8BEN)</span>
        </button>

        <button
          onClick={() => setCurrentTab('preferences')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'preferences'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Testing Preferences & Toggles</span>
        </button>

        <button
          onClick={() => setCurrentTab('client')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            currentTab === 'client'
              ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C33]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Client QA Org Settings</span>
        </button>
      </div>

      {/* Tab 1: Personal & Contact Information */}
      {currentTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity & Basic Credentials Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <User className="w-4 h-4 text-blue-400" />
                Tester Identity & Contact Credentials
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Primary Email (Connectfy Login)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500 pr-20"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                      Verified
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Phone Number (SMS Cycle Alerts)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                    placeholder="+254 712 345 678"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-xs">
                  Professional QA Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                  placeholder="e.g. Lead Exploratory QA Engineer | Mobile & Payment Specialist"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-xs">
                  Testing Bio / Summary
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 resize-none"
                  placeholder="Summarize your hands-on QA experience, testing tools, and domain specializations."
                />
              </div>
            </div>

            {/* Location & Geographic Matching Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Globe className="w-4 h-4 text-emerald-400" />
                Geographic Location & Timezone (Used for Cycle Targeting)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Country of Residence</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">State / Province / County</label>
                  <input
                    type="text"
                    value={stateOrProvince}
                    onChange={(e) => setStateOrProvince(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Postal / Zip Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Languages & Localization */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Globe className="w-4 h-4 text-blue-400" />
                Spoken & Written Languages
              </h3>
              <p className="text-xs text-slate-400">
                Clients match localization and linguistic QA test cycles against your registered languages.
              </p>

              {/* Language list */}
              <div className="space-y-2">
                {languages.map((lang) => (
                  <div
                    key={lang.language}
                    className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{lang.language}</span>
                      <span className="text-[10px] text-blue-400 font-semibold">
                        {lang.proficiency} Proficiency
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveLanguage(lang.language)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Remove Language"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Language Input */}
              <form onSubmit={handleAddLanguage} className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block">Add Language</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLangName}
                    onChange={(e) => setNewLangName(e.target.value)}
                    placeholder="Language name"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500"
                  />
                  <select
                    value={newLangProficiency}
                    onChange={(e) => setNewLangProficiency(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-300 focus:outline-hidden"
                  >
                    <option value="Native">Native</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Basic">Basic</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Language</span>
                </button>
              </form>
            </div>

            {/* Quick Profile Health Checklist */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                Connectfy Matching Score: {Math.max(0, Number(testerProfile.acceptanceRate || 0))}%
              </h4>

              {(() => {
                const emailVerified = Boolean((testerProfile.email || '').trim());
                const phoneVerified = Boolean((testerProfile.phone || '').trim());
                const taxStatusDone = testerProfile.paymentSettings?.taxStatus === 'Verified';
                const hardwareReady = (testerProfile.devices?.length || 0) >= 5 || (testerProfile.deviceFleet || []).filter((d) => d.isActive).length >= 5;
                const payoutLinked = (() => {
                  const settings = testerProfile.paymentSettings;
                  if (!settings) return false;
                  if (settings.preferredMethod === 'PayPal') return Boolean((settings.paypalEmail || '').trim());
                  if (settings.preferredMethod === 'Payoneer') return Boolean((settings.payoneerId || '').trim());
                  if (settings.preferredMethod === 'Wise') return Boolean((settings.wiseEmail || '').trim());
                  return Boolean((settings.bankDetails?.bankName || '').trim()) && Boolean((settings.bankDetails?.ibanOrAccount || '').trim());
                })();

                const checklist = [
                  { label: 'Email Verified', done: emailVerified },
                  { label: 'Phone Number Added', done: phoneVerified },
                  { label: 'W-8BEN Tax Form Current', done: taxStatusDone },
                  { label: '5+ Hardware Devices', done: hardwareReady },
                  { label: 'Payout Method Linked', done: payoutLinked }
                ];

                return (
                  <div className="space-y-2 text-xs">
                    {checklist.map(({ label, done }) => (
                      <div key={label} className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Check className={`w-3.5 h-3.5 ${done ? 'text-emerald-400' : 'text-amber-400'}`} />
                          {label}
                        </span>
                        <span className={`font-bold ${done ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {done ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

          {/* Tab 2: Hardware Fleet */}
      {currentTab === 'utest' && (
        <div className="max-w-3xl rounded-2xl border border-[#1E2E4E] bg-[#0B132B] p-6 shadow-lg">
          <div className="mb-5 flex items-start gap-3 border-b border-[#1E2E4E] pb-4">
            <div className="rounded-xl bg-[#007AFF]/15 p-2 text-[#38BDF8]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">uTest Partner Details</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Most projects are completed through uTest. Save the account details used for project participation and payment processing.
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 font-semibold text-slate-300">
              Name as Shown on Government ID
              <input
                type="text"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                placeholder="Enter your legal name exactly as shown on your ID"
                className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] px-3 py-2.5 text-white outline-none focus:border-[#00A3E0]"
              />
            </label>

            <label className="flex flex-col gap-1.5 font-semibold text-slate-300">
              Date of Birth
              <input
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] px-3 py-2.5 text-white outline-none focus:border-[#00A3E0]"
              />
            </label>

            <label className="flex flex-col gap-1.5 font-semibold text-slate-300">
              uTest Tester ID
              <input
                type="text"
                value={utestId}
                onChange={(event) => setUtestId(event.target.value)}
                placeholder="Enter your uTest ID"
                className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] px-3 py-2.5 text-white outline-none focus:border-[#00A3E0]"
              />
            </label>

            <label className="flex flex-col gap-1.5 font-semibold text-slate-300">
              uTest Email for Payment Processing
              <input
                type="email"
                value={utestEmail}
                onChange={(event) => setUtestEmail(event.target.value)}
                placeholder="Enter your uTest email"
                className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] px-3 py-2.5 text-white outline-none focus:border-[#00A3E0]"
              />
            </label>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#00A3E0]/50 bg-[#e0f7ff] p-3 text-[11px] font-semibold leading-relaxed text-[#075985]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#007AFF]" />
            <p>Connectfy does not collect participant payments directly. Approved payments are processed through uTest. Never share your uTest password or payment credentials here.</p>
          </div>
        </div>
      )}

      {currentTab === 'devices' && (
        <div className="space-y-6">
          
          {/* Header Controls for Hardware */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                Hardware Fleet & Device Manager ({currentDeviceFleet.length} Registered)
              </h3>
              <p className="text-xs text-slate-400">
                Toggle devices active or inactive to include or exclude them from automatic cycle matchmaking.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsAddDeviceOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Device</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
            {['all', 'Smartphone', 'Tablet', 'Computer', 'Smart TV', 'Wearable', 'Console'].map((cat) => (
              <button
                key={cat}
                onClick={() => setDeviceCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition whitespace-nowrap ${
                  deviceCategoryFilter === cat
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-900'
                }`}
              >
                {cat === 'all' ? 'All Hardware' : cat}
              </button>
            ))}
          </div>

          {/* Device Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((dev) => (
              <div
                key={dev.id}
                className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                  dev.isActive
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                        {getDeviceIcon(dev.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white">{dev.brand} {dev.model}</h4>
                          {dev.isPrimary && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black rounded">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {dev.os} {dev.osVersion}
                        </span>
                      </div>
                    </div>

                    {/* Delete device button */}
                    <button
                      onClick={() => removeTesterDevice(dev.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
                      title="Remove from fleet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 my-3 text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                    {dev.carrier && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Carrier:</span>
                        <span className="text-slate-300 font-medium">{dev.carrier}</span>
                      </div>
                    )}
                    {dev.isp && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ISP:</span>
                        <span className="text-slate-300 font-medium">{dev.isp}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Root / Jailbreak:</span>
                      <span className={dev.isJailbroken ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                        {dev.isJailbroken ? 'Yes (Rooted)' : 'No (Stock Clean)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Controls: Active Toggle & Primary Switch */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  {/* Toggle Active Status in Matchmaking */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dev.isActive}
                      onChange={() => toggleTesterDeviceActive(dev.id)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {dev.isActive ? 'Active in Matching' : 'Disabled'}
                    </span>
                  </label>

                  {/* Set Primary Button */}
                  {!dev.isPrimary && (
                    <button
                      onClick={() => setTesterPrimaryDevice(dev.id)}
                      className="text-[11px] text-slate-400 hover:text-amber-400 transition"
                      title="Set as primary device for this category"
                    >
                      Make Primary
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Device Modal Dialog */}
          {isAddDeviceOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-400" />
                    Register Hardware Device to Fleet
                  </h3>
                  <button
                    onClick={() => setIsAddDeviceOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddDeviceSubmit} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Device Category</label>
                      <select
                        value={newDevCategory}
                        onChange={(e) => {
                          const cat = e.target.value as any;
                          setNewDevCategory(cat);
                          if (cat === 'Smartphone' || cat === 'Tablet') {
                            setNewDevOs('iOS');
                          } else if (cat === 'Computer') {
                            setNewDevOs('macOS');
                          } else if (cat === 'Smart TV') {
                            setNewDevOs('tvOS');
                          } else if (cat === 'Wearable') {
                            setNewDevOs('watchOS');
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      >
                        <option value="Smartphone">Smartphone</option>
                        <option value="Tablet">Tablet</option>
                        <option value="Computer">Computer / Laptop</option>
                        <option value="Smart TV">Smart TV / Streamer</option>
                        <option value="Wearable">Wearable / Smartwatch</option>
                        <option value="Console">Gaming Console</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Manufacturer / Brand</label>
                      <input
                        type="text"
                        required
                        value={newDevBrand}
                        onChange={(e) => setNewDevBrand(e.target.value)}
                        placeholder="e.g. Apple, Samsung, Google, Dell"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Model Name / Number</label>
                      <input
                        type="text"
                        required
                        value={newDevModel}
                        onChange={(e) => setNewDevModel(e.target.value)}
                        placeholder="e.g. iPhone 16 Pro, Galaxy S24"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Operating System</label>
                      <select
                        value={newDevOs}
                        onChange={(e) => setNewDevOs(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      >
                        <option value="iOS">iOS</option>
                        <option value="Android">Android</option>
                        <option value="macOS">macOS</option>
                        <option value="Windows">Windows</option>
                        <option value="iPadOS">iPadOS</option>
                        <option value="Linux">Linux</option>
                        <option value="tvOS">tvOS</option>
                        <option value="watchOS">watchOS</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">OS Version / Build</label>
                      <input
                        type="text"
                        value={newDevOsVersion}
                        onChange={(e) => setNewDevOsVersion(e.target.value)}
                        placeholder="e.g. 17.5.1, 14 OneUI 6"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Cellular Carrier</label>
                      <input
                        type="text"
                        value={newDevCarrier}
                        onChange={(e) => setNewDevCarrier(e.target.value)}
                        placeholder="e.g. Safaricom 5G, AT&T, WiFi"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Home ISP / Network Connection</label>
                    <input
                      type="text"
                      value={newDevIsp}
                      onChange={(e) => setNewDevIsp(e.target.value)}
                      placeholder="e.g. Safaricom Fiber 100Mbps, Zuku Fiber"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDevJailbroken}
                        onChange={(e) => setNewDevJailbroken(e.target.checked)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="text-slate-300">Device is Rooted / Jailbroken</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDevPrimary}
                        onChange={(e) => setNewDevPrimary(e.target.checked)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="text-amber-400 font-semibold">Make Primary Device</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddDeviceOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                    >
                      Register Device
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tab 3: Skills, Badges & Academy */}
      {currentTab === 'skills' && (
        <div className="space-y-6">
          {/* Top QA Standing Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 block mb-1">Tester Rating</span>
              <span className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
                <Star className="w-5 h-5 fill-amber-400" />
                {testerProfile.rating.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Based on {testerProfile.totalReviews} reviews</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 block mb-1">Bug Acceptance Rate</span>
              <span className="text-2xl font-black text-emerald-400">
                {testerProfile.acceptanceRate}%
              </span>
              <span className="text-[10px] text-emerald-300/80 mt-1 block">Top 5% Global Standing</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 block mb-1">Approved Defects</span>
              <span className="text-2xl font-black text-blue-400">
                {testerProfile.approvedBugsCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Across {testerProfile.completedCyclesCount} test cycles</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 block mb-1">Lifetime Earnings</span>
              <span className="text-2xl font-black text-emerald-400">
                ${testerProfile.lifetimeEarnings.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">100% Disbursed</span>
            </div>
          </div>

          {/* Connectfy Academy Track Certifications */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Award className="w-4 h-4 text-amber-400" />
              Connectfy Academy Accreditations & Badges
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(testerProfile.academyBadges || []).map((badge) => (
                <div
                  key={badge.id}
                  className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-start space-x-3.5"
                >
                  <span className="text-3xl p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <ProjectIcon name={badge.icon} className="h-5 w-5 text-[#00A3E0]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{badge.title}</h4>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                        {badge.score}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{badge.description}</p>
                    <span className="text-[10px] text-slate-500 block mt-2">
                      Certified on: {badge.completionDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Core Testing Skills & Tool Competencies */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Briefcase className="w-4 h-4 text-blue-400" />
              Verified QA Skills & Tool Proficiencies
            </h3>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 text-xs font-semibold"
                >
                  <span>{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-slate-500 hover:text-rose-400 ml-1 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddSkill} className="flex gap-2 pt-3 border-t border-slate-800 max-w-md">
              <input
                type="text"
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                placeholder="Add skill (e.g. Charles Proxy, Wireshark, Postman)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition"
              >
                Add Skill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Payment Methods & Tax Compliance (W-8BEN) */}
      {currentTab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Preferred Payout Method Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Disbursal Account & Preferred Payout Gateway
                </h3>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Ready for Withdrawals
                </span>
              </div>

              {/* Method Selector Tabs */}
              <div>
                <label className="block text-slate-400 font-semibold mb-2 text-xs">
                  Select Primary Disbursal Method:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(['PayPal', 'Payoneer', 'Wise', 'Direct Bank Wire'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPreferredMethod(method)}
                      className={`p-3 rounded-xl border font-bold text-center transition ${
                        preferredMethod === method
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <PaymentMethodLogo method={method} className="h-5 w-5" />
                        <span>{method}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Credential Inputs based on selected method */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                {preferredMethod === 'PayPal' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      PayPal Account Email Address
                    </label>
                    <input
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Earnings will be transferred via automated PayPal MassPay API directly to this address.
                    </span>
                  </div>
                )}

                {preferredMethod === 'Payoneer' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Payoneer Payee ID / Email
                    </label>
                    <input
                      type="text"
                      value={payoneerId}
                      onChange={(e) => setPayoneerId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}

                {preferredMethod === 'Wise' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Wise Multi-Currency Account Email
                    </label>
                    <input
                      type="email"
                      value={wiseEmail}
                      onChange={(e) => setWiseEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}

                {preferredMethod === 'Direct Bank Wire' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">IBAN / Account Number</label>
                      <input
                        type="text"
                        value={ibanOrAccount}
                        onChange={(e) => setIbanOrAccount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">SWIFT / BIC Code</label>
                      <input
                        type="text"
                        value={swiftBic}
                        onChange={(e) => setSwiftBic(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Auto Withdrawal Toggle & Threshold */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Automatic Bi-Weekly Earnings Disbursal
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    When enabled, approved test earnings exceeding the threshold are automatically paid out on the 15th and 30th of each month.
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <select
                    value={autoWithdrawThreshold}
                    onChange={(e) => setAutoWithdrawThreshold(Number(e.target.value))}
                    disabled={!autoWithdraw}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white disabled:opacity-50"
                  >
                    <option value={20}>&gt; $20.00 Min</option>
                    <option value={50}>&gt; $50.00 Min</option>
                    <option value={100}>&gt; $100.00 Min</option>
                    <option value={200}>&gt; $200.00 Min</option>
                  </select>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoWithdraw}
                      onChange={(e) => setAutoWithdraw(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                  </label>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: Tax Compliance (W-8BEN / W-9) */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-blue-400" />
                Tax Status & Compliance
              </h3>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    Form {testerProfile.paymentSettings?.taxFormType || 'W-8BEN'} Certified
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Certificate of Foreign Status for United States Tax Withholding and Reporting is on file and active through December 2027.
                </p>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-emerald-500/20">
                  <div className="flex justify-between">
                    <span>Tax Jurisdiction:</span>
                    <span className="text-white font-semibold">{testerProfile.paymentSettings?.taxCountry || 'Kenya'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ID:</span>
                    <span className="text-white font-mono">{testerProfile.paymentSettings?.taxIdMasked || 'PIN: A00***492K'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-400">
                <p>
                  United States Internal Revenue Service regulations require Connectfy to maintain current tax records for all freelance testers before issuing payouts.
                </p>
                <button
                  type="button"
                  onClick={() => alert('Your tax form is already verified and up to date for 2026-2027!')}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition text-center"
                >
                  Recertify or Update Tax Information
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Tab 5: Testing Preferences & Availability Toggles */}
      {currentTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Availability & Capacity Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-blue-400" />
              Availability & Weekly Testing Capacity
            </h3>

            {/* Main Availability Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Available for New Test Cycle Invitations
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When paused, you won't receive cycle invites and your profile will be marked on vacation.
                </p>
              </div>
              <label className="flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={availableForCycles}
                  onChange={(e) => setAvailableForCycles(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
              </label>
            </div>

            {/* Weekly Hours Capacity */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Weekly Testing Target:</span>
                <span className="font-bold text-blue-400">{maxWeeklyHours} Hours / Week</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={maxWeeklyHours}
                onChange={(e) => setMaxWeeklyHours(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>5 hrs (Casual)</span>
                <span>25 hrs (Part-time)</span>
                <span>50 hrs (Full-time QA)</span>
              </div>
            </div>

            {/* Individual Boolean Toggles */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-750 transition">
                <div>
                  <span className="text-xs font-semibold text-white block">Weekend Testing Available</span>
                  <span className="text-[11px] text-slate-400">Receive expedited weekend bug hunting cycles (higher bounty rates)</span>
                </div>
                <input
                  type="checkbox"
                  checked={weekendTesting}
                  onChange={(e) => setWeekendTesting(e.target.checked)}
                  className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-750 transition">
                <div>
                  <span className="text-xs font-semibold text-white block">Real-Money Payment Testing Authorized</span>
                  <span className="text-[11px] text-slate-400">Perform sandbox & client-reimbursed live checkout verification</span>
                </div>
                <input
                  type="checkbox"
                  checked={realMoneyTesting}
                  onChange={(e) => setRealMoneyTesting(e.target.checked)}
                  className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-750 transition">
                <div>
                  <span className="text-xs font-semibold text-white block">TestFlight & Android APK Beta Sideloading</span>
                  <span className="text-[11px] text-slate-400">Willing to install enterprise certs and test build APKs</span>
                </div>
                <input
                  type="checkbox"
                  checked={apkSideloadingAllowed}
                  onChange={(e) => setApkSideloadingAllowed(e.target.checked)}
                  className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-750 transition">
                <div>
                  <span className="text-xs font-semibold text-white block">Confidentiality & Master NDA Signed</span>
                  <span className="text-[11px] text-slate-400">Eligible for unannounced products & pre-release prototypes</span>
                </div>
                <input
                  type="checkbox"
                  checked={ndaAgreed}
                  onChange={(e) => setNdaAgreed(e.target.checked)}
                  className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                />
              </label>
            </div>

          </div>

          {/* Notifications & Category Preferences */}
          <div className="space-y-6">
            
            {/* Notification Toggles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Mail className="w-4 h-4 text-emerald-400" />
                Invitation Alerts & Communication Channels
              </h3>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-white block">Instant Email Cycle Invites</span>
                    <span className="text-[11px] text-slate-400">Get emails the second client approves your slot application</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={instantEmailAlerts}
                    onChange={(e) => setInstantEmailAlerts(e.target.checked)}
                    className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-white block">SMS / WhatsApp Urgent Test Cycle Pings</span>
                    <span className="text-[11px] text-slate-400">For emergency 2-hour turnaround triage cycles</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={instantSmsAlerts}
                    onChange={(e) => setInstantSmsAlerts(e.target.checked)}
                    className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-white block">High Bounty ($50+) Cycles Only</span>
                    <span className="text-[11px] text-slate-400">Filter notifications to only critical payment/security cycles</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={highBountyOnly}
                    onChange={(e) => setHighBountyOnly(e.target.checked)}
                    className="rounded border-slate-750 text-blue-600 focus:ring-0 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* Preferred Project Categories */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Preferred Test Cycle Domains & Categories
              </h3>
              <p className="text-xs text-slate-400">
                Select domain areas you prefer to test on:
              </p>

              <div className="flex flex-wrap gap-2">
                {availableCategoriesList.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 6: Client QA Org Settings */}
      {currentTab === 'client' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                Client Organization & Default Cycle Guidelines
              </h3>
              <span className="text-xs text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Enterprise QA Director
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  value={clientCompanyName}
                  onChange={(e) => setClientCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Lead QA Director / Sponsor</label>
                <input
                  type="text"
                  value={clientDirectorName}
                  onChange={(e) => setClientDirectorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Corporate Billing Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Billing Phone</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Industry Vertical</label>
                <input
                  type="text"
                  value={clientIndustry}
                  onChange={(e) => setClientIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Company Website</label>
                <input
                  type="url"
                  value={clientWebsite}
                  onChange={(e) => setClientWebsite(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Billing Address</label>
                <input
                  type="text"
                  value={clientBillingAddress}
                  onChange={(e) => setClientBillingAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Default Defect Bounty Matrix */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-white mb-2">
                Default Defect Bounty Structure (Auto-applied to new test cycles)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="block text-rose-400 font-bold mb-1">Critical Defect ($)</label>
                  <input
                    type="number"
                    value={clientCriticalBounty}
                    onChange={(e) => setClientCriticalBounty(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="block text-amber-400 font-bold mb-1">High Defect ($)</label>
                  <input
                    type="number"
                    value={clientHighBounty}
                    onChange={(e) => setClientHighBounty(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="block text-blue-400 font-bold mb-1">Medium Defect ($)</label>
                  <input
                    type="number"
                    value={clientMediumBounty}
                    onChange={(e) => setClientMediumBounty(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="block text-slate-400 font-bold mb-1">Low / Cosmetic ($)</label>
                  <input
                    type="number"
                    value={clientLowBounty}
                    onChange={(e) => setClientLowBounty(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* NDA Mandatory Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">Require Tester Signed Master NDA</span>
                <span className="text-[11px] text-slate-400">Ensure only accredited testers who signed cycle NDA can apply to your cycles</span>
              </div>
              <input
                type="checkbox"
                checked={clientNdaRequired}
                onChange={(e) => setClientNdaRequired(e.target.checked)}
                className="rounded border-slate-750 text-indigo-600 focus:ring-0 w-4 h-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Keep your hardware fleet and preferences updated to receive higher priority test invites.</span>
        </div>

        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSaveAll}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save All Profile Changes</span>
          </button>
        </div>
      </div>

    </div>
  );
};
