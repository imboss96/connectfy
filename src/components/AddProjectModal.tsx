import React, { useState } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Layers,
  DollarSign,
  Smartphone,
  Calendar,
  Users,
  Building,
  CreditCard,
  CheckCircle2,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Zap,
  Mic,
  Brain,
  MapPin,
  Eye,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProjectIcon } from './ProjectIcon';
import {
  Project,
  ProjectCategory,
  ProjectTrack,
  PaymentModel,
  DeviceType,
  ProjectBountyStructure
} from '../types';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTrack?: ProjectTrack;
}

const ALL_DEVICES: DeviceType[] = [
  'iOS Mobile',
  'Android Mobile',
  'macOS',
  'Windows',
  'iPad / Tablet',
  'Smart TV',
  'Wearable'
];

export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  defaultTrack = 'qa_functional'
}) => {
  const { createProject, clientProfile, role } = useApp();

  // Basic Details
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState(clientProfile.company || 'Connectfy Global QA Ops');
  const [companyLogo, setCompanyLogo] = useState('flask');
  const [track, setTrack] = useState<ProjectTrack>(defaultTrack);
  const [category, setCategory] = useState<ProjectCategory>('Functional');
  const [shortDescription, setShortDescription] = useState('');
  const [fullOverview, setFullOverview] = useState('');
  
  // Scope
  const [inScopeText, setInScopeText] = useState('Mobile authentication, payment gateway checkout, push notification triggers, account balance synchronization');
  const [outOfScopeText, setOutOfScopeText] = useState('Third-party bank API internal errors, deliberate DDoS simulations, jailbroken/rooted devices without prior approval');

  // Devices & Countries
  const [selectedDevices, setSelectedDevices] = useState<DeviceType[]>([
    'iOS Mobile',
    'Android Mobile'
  ]);
  const [supportedCountriesText, setSupportedCountriesText] = useState('Global, Kenya, US, UK, Germany, India, Brazil');

  // Slots & Budget
  const [slotsTotal, setSlotsTotal] = useState('40');
  const [totalBudget, setTotalBudget] = useState('3500');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });

  // Bounty structure for QA
  const [criticalBounty, setCriticalBounty] = useState('75');
  const [highBounty, setHighBounty] = useState('40');
  const [medBounty, setMedBounty] = useState('20');
  const [lowBounty, setLowBounty] = useState('10');
  const [testCaseBounty, setTestCaseBounty] = useState('15');

  // Deliverables & Task Rate for Non-QA tracks
  const [taskRate, setTaskRate] = useState('45');
  const [taskUnitName, setTaskUnitName] = useState('Per 30 Utterances Batch');
  const [deliverableFormat, setDeliverableFormat] = useState('44.1kHz 16-bit WAV');
  const [deliverableCount, setDeliverableCount] = useState('30');
  const [deliverablesInstructions, setDeliverablesInstructions] = useState('Record natural conversational speech in quiet indoor room. Verify audio has no background clipping.');

  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset Template Loader for rapid PM provisioning
  const applyPreset = (presetKey: 'fintech_qa' | 'voice_data' | 'ai_redteam' | 'pos_audit') => {
    if (presetKey === 'fintech_qa') {
      setTitle('Fintech Mobile Banking: Cross-Border Transfers & Card Linking');
      setCompany('Apex Global Financial');
      setCompanyLogo('card');
      setTrack('qa_functional');
      setCategory('Payment & Checkout');
      setShortDescription('Execute exploratory and test-case regression on new biometric checkout and debit card authorization flow.');
      setFullOverview('Apex Financial is launching v4.2 of their mobile client. Testers must verify transaction authorization, 3D Secure fallback, and multi-currency exchange rates.');
      setInScopeText('Cards screen, biometric Touch/Face ID auth, virtual card generation, receipt download');
      setOutOfScopeText('Internal backend batch settlements, physical branch teller integrations');
      setSelectedDevices(['iOS Mobile', 'Android Mobile']);
      setSlotsTotal('50');
      setTotalBudget('4500');
      setCriticalBounty('85');
      setHighBounty('45');
      setMedBounty('25');
      setLowBounty('12');
      setTestCaseBounty('15');
    } else if (presetKey === 'voice_data') {
      setTitle('African Dialects Conversational Speech Dataset (Swahili & Sheng)');
      setCompany('SpeechForge AI Labs');
      setCompanyLogo('voice');
      setTrack('data_collection');
      setCategory('AI Data Collection');
      setShortDescription('Collect high-fidelity native voice recordings of spontaneous conversation and read prompts.');
      setFullOverview('SpeechForge is training acoustic foundation models for regional African dialects. Contributors record 30 spontaneous sentence audio clips according to acoustic guidelines.');
      setTaskRate('55');
      setTaskUnitName('Per 30 Validated Audio Clips');
      setDeliverableFormat('44.1kHz 16-bit Mono WAV');
      setDeliverableCount('30');
      setDeliverablesInstructions('Record in quiet indoor room without echo. Ensure microphone is 15-20cm from mouth. No background music or fan noise.');
      setSelectedDevices(['iOS Mobile', 'Android Mobile', 'Windows', 'macOS']);
      setSlotsTotal('60');
      setTotalBudget('3800');
    } else if (presetKey === 'ai_redteam') {
      setTitle('Multimodal LLM Adversarial Prompting & Red Teaming');
      setCompany('Cognitive Trust Labs');
      setCompanyLogo('ai');
      setTrack('ai_evaluation');
      setCategory('AI Model Evaluation');
      setShortDescription('Probe safety boundaries and stress-test hallucination edge cases across 25 domain prompts.');
      setFullOverview('Evaluate AI assistant safety guards against jailbreaks, prompt injection, and harmful advice generation across complex reasoning scenarios.');
      setTaskRate('65');
      setTaskUnitName('Per 25 Evaluated Prompt Pairs');
      setDeliverableFormat('Structured JSON / Markdown Rubric');
      setDeliverableCount('25');
      setDeliverablesInstructions('Attempt subtle jailbreak vectors and rate model responses against the safety taxonomy. Detail failure justifications.');
      setSelectedDevices(['Windows', 'macOS', 'iOS Mobile', 'Android Mobile']);
      setSlotsTotal('35');
      setTotalBudget('3500');
    } else if (presetKey === 'pos_audit') {
      setTitle('In-Field Retail POS Terminal & Tap-to-Pay Audit');
      setCompany('OmniPay Merchant Network');
      setCompanyLogo('store');
      setTrack('special_field');
      setCategory('Special In-Field');
      setShortDescription('Perform mystery purchases at partner supermarket terminals and document receipt printouts and NFC latency.');
      setFullOverview('Auditors visit designated merchant locations, execute contactless payment with verified card or phone, and photograph the merchant terminal receipt.');
      setTaskRate('40');
      setTaskUnitName('Per Verified Merchant Audit');
      setDeliverableFormat('Receipt Photo + Geo-tagged Timestamp');
      setDeliverableCount('1');
      setDeliverablesInstructions('Capture photo of printed POS slip showing transaction reference and approved terminal ID. Must match physical GPS coordinates.');
      setSelectedDevices(['Android Mobile', 'iOS Mobile']);
      setSlotsTotal('30');
      setTotalBudget('2200');
    }
  };

  const handleDeviceToggle = (dev: DeviceType) => {
    if (selectedDevices.includes(dev)) {
      if (selectedDevices.length === 1) return; // Keep at least one
      setSelectedDevices(selectedDevices.filter((d) => d !== dev));
    } else {
      setSelectedDevices([...selectedDevices, dev]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please enter a project title.');
      return;
    }
    if (!company.trim()) {
      setFormError('Please enter the organization / client name.');
      return;
    }

    const budgetNum = parseFloat(totalBudget) || 1000;
    const slotsNum = parseInt(slotsTotal, 10) || 20;

    const inScopeList = inScopeText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const outOfScopeList = outOfScopeText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const countriesList = supportedCountriesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const bountyStructure: ProjectBountyStructure = {
      critical: parseFloat(criticalBounty) || 75,
      high: parseFloat(highBounty) || 40,
      medium: parseFloat(medBounty) || 20,
      low: parseFloat(lowBounty) || 10,
      testCaseBounty: parseFloat(testCaseBounty) || 15
    };

    const isQA = track === 'qa_functional';

    createProject({
      title: title.trim(),
      company: company.trim(),
      companyLogo: companyLogo || 'flask',
      category,
      projectTrack: track,
      paymentModel: isQA ? 'per_approved_bug' : 'per_task',
      taskUnitName: !isQA ? taskUnitName : undefined,
      taskRate: !isQA ? parseFloat(taskRate) || 45 : undefined,
      deliverablesGuide: !isQA
        ? {
            overview: shortDescription,
            instructions: deliverablesInstructions,
            fileFormat: deliverableFormat,
            sampleCountRequired: parseInt(deliverableCount, 10) || 1,
            acceptanceCriteria: [
              'All required fields and metadata submitted',
              `Conforms strictly to ${deliverableFormat} standards`,
              'Clear of background noise, artifacting, or corrupted data'
            ]
          }
        : undefined,
      shortDescription:
        shortDescription.trim() ||
        `${category} test cycle managed by ${company} with ${slotsNum} tester slots.`,
      fullOverview: fullOverview.trim() || shortDescription.trim() || `${title} test cycle.`,
      inScope: inScopeList.length > 0 ? inScopeList : ['Functional features', 'Core workflows'],
      outOfScope: outOfScopeList.length > 0 ? outOfScopeList : ['Third party APIs'],
      requiredDevices: selectedDevices,
      supportedCountries: countriesList.length > 0 ? countriesList : ['Global'],
      slotsTotal: slotsNum,
      deadline: deadline || '2026-10-31',
      status: 'active',
      bountyStructure,
      totalBudget: budgetNum,
      clientId: clientProfile.id || 'client-primary'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 animate-fade-in">
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E2E4E] flex items-center justify-between bg-[#080D1A]/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#007AFF]/10 border border-[#007AFF]/30 text-[#00A3E0]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                  Add New Project to Listings
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin & PM Studio
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Commission a freelance test cycle, AI dataset, or in-field audit directly onto the marketplace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C33] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rapid Presets Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#080D1A] border-b border-[#1E2E4E] flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick PM Templates:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('fintech_qa')}
            className="px-2.5 py-1 rounded-lg bg-[#111C33] hover:bg-[#007AFF]/20 hover:text-[#00A3E0] border border-[#1E2E4E] text-[11px] text-slate-300 font-semibold transition"
          >
            <CreditCard className="inline h-3.5 w-3.5 text-[#00A3E0]" /> Fintech QA Bounty
          </button>
          <button
            type="button"
            onClick={() => applyPreset('voice_data')}
            className="px-2.5 py-1 rounded-lg bg-[#111C33] hover:bg-purple-900/30 hover:text-purple-300 border border-[#1E2E4E] text-[11px] text-slate-300 font-semibold transition"
          >
            <Mic className="inline h-3.5 w-3.5 text-purple-300" /> Voice Data Collection
          </button>
          <button
            type="button"
            onClick={() => applyPreset('ai_redteam')}
            className="px-2.5 py-1 rounded-lg bg-[#111C33] hover:bg-emerald-900/30 hover:text-emerald-300 border border-[#1E2E4E] text-[11px] text-slate-300 font-semibold transition"
          >
            <Brain className="inline h-3.5 w-3.5 text-emerald-300" /> AI LLM Red Teaming
          </button>
          <button
            type="button"
            onClick={() => applyPreset('pos_audit')}
            className="px-2.5 py-1 rounded-lg bg-[#111C33] hover:bg-amber-900/30 hover:text-amber-300 border border-[#1E2E4E] text-[11px] text-slate-300 font-semibold transition"
          >
            <Building className="inline h-3.5 w-3.5 text-amber-300" /> In-Field Retail POS Audit
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Track & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-200 mb-1.5">
                Marketplace Track / Execution Type *
              </label>
              <select
                value={track}
                onChange={(e) => {
                  const tr = e.target.value as ProjectTrack;
                  setTrack(tr);
                  if (tr === 'qa_functional') {
                    setCategory('Functional');
                  } else if (tr === 'data_collection') {
                    setCategory('AI Data Collection');
                  } else if (tr === 'ai_evaluation') {
                    setCategory('AI Model Evaluation');
                  } else if (tr === 'special_field') {
                    setCategory('Special In-Field');
                  }
                }}
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#007AFF]"
              >
                <option value="qa_functional">Software QA & Defect Bounty Cycle</option>
                <option value="data_collection">Voice / Speech & Multimodal Data Collection</option>
                <option value="ai_evaluation">AI Red Teaming & Prompt Alignment Eval</option>
                <option value="special_field">Special In-Field & POS Hardware Audits</option>
                <option value="ux_research">User Research & Usability Video Sessions</option>
                <option value="localization">Localization & Multilingual Translation QA</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1.5">Domain Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#007AFF]"
              >
                <option value="Payment & Checkout">Payment & Checkout</option>
                <option value="Functional">Functional QA</option>
                <option value="Usability">Usability</option>
                <option value="Security">Security & Vulnerability</option>
                <option value="Performance">Performance & Load</option>
                <option value="Localization">Localization & International</option>
                <option value="AI Data Collection">AI Data Collection</option>
                <option value="AI Model Evaluation">AI Model Evaluation</option>
                <option value="Special In-Field">Special In-Field</option>
                <option value="Exploratory">Exploratory</option>
              </select>
            </div>
          </div>

          {/* Section 2: Project Title & Client Organization */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-200 mb-1.5">Project Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fintech Cross-Border Mobile Banking & POS Testing"
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-[#007AFF]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-200 mb-1.5">
                  Client / Commissioning Organization *
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Apex Financial Corp"
                  className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#007AFF]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1.5">Brand Icon / Emoji</label>
                <input
                  type="text"
                  value={companyLogo}
                  onChange={(e) => setCompanyLogo(e.target.value)}
                  placeholder="e.g. card, movie, voice, speed"
                  className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-white font-bold text-center focus:outline-none focus:border-[#007AFF]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Descriptions */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-200 mb-1.5">
                Listing Summary (Shown on Project Card) *
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief one-line hook summarizing cycle objectives and contractor expectations..."
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-[#007AFF]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1.5">
                Full Overview & Project Scope Details
              </label>
              <textarea
                rows={3}
                value={fullOverview}
                onChange={(e) => setFullOverview(e.target.value)}
                placeholder="Elaborate on the background, sprint context, target user flows, and acceptance criteria..."
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-3 text-white text-xs focus:outline-none focus:border-[#007AFF] leading-relaxed"
              />
            </div>
          </div>

          {/* Section 4: Dynamic Payout Architecture */}
          {track === 'qa_functional' ? (
            <div className="p-4 bg-[#080D1A] rounded-xl border border-[#1E2E4E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  QA Defect Bounty Matrix ($ USD)
                </span>
                <span className="text-[11px] text-slate-400">Credited into tester wallet on client approval</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#111C33] border border-rose-500/30">
                  <label className="text-[10px] text-rose-400 block font-bold mb-1">Critical ($)</label>
                  <input
                    type="number"
                    value={criticalBounty}
                    onChange={(e) => setCriticalBounty(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded px-2 py-1 text-center text-white font-black"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#111C33] border border-amber-500/30">
                  <label className="text-[10px] text-amber-400 block font-bold mb-1">High ($)</label>
                  <input
                    type="number"
                    value={highBounty}
                    onChange={(e) => setHighBounty(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded px-2 py-1 text-center text-white font-black"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#111C33] border border-blue-500/30">
                  <label className="text-[10px] text-blue-400 block font-bold mb-1">Medium ($)</label>
                  <input
                    type="number"
                    value={medBounty}
                    onChange={(e) => setMedBounty(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded px-2 py-1 text-center text-white font-black"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#111C33] border border-slate-600/30">
                  <label className="text-[10px] text-slate-400 block font-bold mb-1">Low ($)</label>
                  <input
                    type="number"
                    value={lowBounty}
                    onChange={(e) => setLowBounty(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded px-2 py-1 text-center text-white font-black"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#111C33] border border-emerald-500/30 col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-emerald-400 block font-bold mb-1">Test Case ($)</label>
                  <input
                    type="number"
                    value={testCaseBounty}
                    onChange={(e) => setTestCaseBounty(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded px-2 py-1 text-center text-white font-black"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-purple-950/20 rounded-xl border border-purple-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-200 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Deliverable Contractor Rate & Deliverable Specs
                </span>
                <span className="text-[11px] text-purple-300">Non-QA Marketplace Task</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 block font-bold mb-1">
                    Rate per Validated Deliverable Batch ($)
                  </label>
                  <input
                    type="number"
                    value={taskRate}
                    onChange={(e) => setTaskRate(e.target.value)}
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-lg px-3 py-2 text-emerald-400 font-black text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 block font-bold mb-1">
                    Unit Description
                  </label>
                  <input
                    type="text"
                    value={taskUnitName}
                    onChange={(e) => setTaskUnitName(e.target.value)}
                    placeholder="e.g. Per 30 Audio Utterances"
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-lg px-3 py-2 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 block font-bold mb-1">
                    Deliverable Format / Spec
                  </label>
                  <input
                    type="text"
                    value={deliverableFormat}
                    onChange={(e) => setDeliverableFormat(e.target.value)}
                    placeholder="e.g. 44.1kHz 16-bit WAV, MP4, JSON"
                    className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block font-bold mb-1">
                  Deliverable Instructions for Freelancers
                </label>
                <textarea
                  rows={2}
                  value={deliverablesInstructions}
                  onChange={(e) => setDeliverablesInstructions(e.target.value)}
                  placeholder="Detail exact acoustic, recording, or format rules required for client approval..."
                  className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-lg p-2.5 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Section 5: Target Hardware Fleet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#00A3E0]" />
                Required Hardware Fleet (Select all supported)
              </label>
              <span className="text-[11px] text-slate-400">
                Matches testers with registered fleet devices
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {ALL_DEVICES.map((dev) => {
                const isChecked = selectedDevices.includes(dev);
                return (
                  <button
                    key={dev}
                    type="button"
                    onClick={() => handleDeviceToggle(dev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      isChecked
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                        : 'bg-[#111C33] text-slate-400 border-[#1E2E4E] hover:text-slate-200'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{dev}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6: In-Scope vs Out-of-Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-200 mb-1">
                In-Scope Feature Areas (comma separated)
              </label>
              <textarea
                rows={2}
                value={inScopeText}
                onChange={(e) => setInScopeText(e.target.value)}
                placeholder="e.g. Registration, checkout flow, card linking"
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-2.5 text-white text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-200 mb-1">
                Out-of-Scope Areas (comma separated)
              </label>
              <textarea
                rows={2}
                value={outOfScopeText}
                onChange={(e) => setOutOfScopeText(e.target.value)}
                placeholder="e.g. Backend load testing, root devices"
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-2.5 text-white text-xs"
              />
            </div>
          </div>

          {/* Section 7: Budget, Slots & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1E2E4E]">
            <div>
              <label className="block font-bold text-slate-200 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Escrow Budget ($ USD) *
              </label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-white font-bold text-emerald-400"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#00A3E0]" />
                Max Freelancer Slots *
              </label>
              <input
                type="number"
                value={slotsTotal}
                onChange={(e) => setSlotsTotal(e.target.value)}
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Cycle Closing Deadline *
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2 text-white font-bold"
                required
              />
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-[#1E2E4E] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Listing immediately becomes active on the crowd project board.
            </span>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#111C33] hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition border border-[#1E2E4E]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#007AFF] hover:bg-[#0066EE] text-white font-black rounded-xl shadow-lg shadow-[#007AFF]/30 flex items-center space-x-2 transition active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Publish Project to Listings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
