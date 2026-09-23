import React, { useState } from 'react';
import {
  X,
  Bug,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project, BugSeverity, BugType, BugFrequency, AttachmentFile } from '../types';
import { isCloudinaryConfigured, uploadToCloudinary } from '../lib/cloudinary';

interface BugSubmissionModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BugSubmissionModal: React.FC<BugSubmissionModalProps> = ({
  project,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { submitBugReport, testerProfile } = useApp();

  const [title, setTitle] = useState('');
  const [featureArea, setFeatureArea] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('High');
  const [bugType, setBugType] = useState<BugType>('Functional');
  const [frequency, setFrequency] = useState<BugFrequency>('Every time (100%)');
  const [device, setDevice] = useState(testerProfile.devices[0] || 'iPhone 15 Pro (iOS 17.5)');
  const [browserOrBuild, setBrowserOrBuild] = useState(`${project.company} Build v4.2.1`);
  const [steps, setSteps] = useState<string[]>([
    'Launch the application and authenticate with standard test credentials.',
    'Navigate to the checkout / target feature view.',
    'Execute the specific interaction.'
  ]);
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const getBountyForSeverity = (sev: BugSeverity) => {
    switch (sev) {
      case 'Critical':
        return project.bountyStructure.critical;
      case 'High':
        return project.bountyStructure.high;
      case 'Medium':
        return project.bountyStructure.medium;
      case 'Low':
        return project.bountyStructure.low;
    }
  };

  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleUpdateStep = (index: number, val: string) => {
    const updated = [...steps];
    updated[index] = val;
    setSteps(updated);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!isCloudinaryConfigured) {
      setError('Cloudinary is not configured. Add the upload settings before attaching evidence.');
      return;
    }

    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => {
        const result = await uploadToCloudinary(file);
        const newAttachment: AttachmentFile = {
          id: 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        return newAttachment;
      }));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Evidence upload failed.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a descriptive defect summary / title.');
      return;
    }
    if (!featureArea.trim()) {
      setError('Please specify the feature area.');
      return;
    }
    if (steps.some((s) => !s.trim())) {
      setError('Please fill in all reproduction steps.');
      return;
    }
    if (!expectedResult.trim() || !actualResult.trim()) {
      setError('Expected and actual results are required for QA audit.');
      return;
    }

    submitBugReport({
      projectId: project.id,
      testCycleId: project.id,
      title,
      featureArea,
      severity,
      bugType,
      frequency,
      device,
      osVersion: device.includes('iOS') ? 'iOS 17.5' : device.includes('Android') ? 'Android 14' : 'macOS / Windows',
      browserOrBuild,
      stepsToReproduce: steps,
      expectedResult,
      actualResult,
      attachments
    });

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Log Defect / Bug Report</h2>
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  {project.company}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cycle: {project.title.substring(0, 48)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Feature */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bug Summary / Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Unhandled exception during payment OTP verification when connection drops"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Feature Area <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={featureArea}
                  onChange={(e) => setFeatureArea(e.target.value)}
                  placeholder="e.g. Checkout, Video Player, BLE Sync"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Device & OS
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {testerProfile.devices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Severity & Bounty preview */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Severity Level & Approved Bounty Tier
              </label>
              <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Bounty Upon Client Approval: ${getBountyForSeverity(severity).toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Critical', 'High', 'Medium', 'Low'] as BugSeverity[]).map((s) => {
                const b = getBountyForSeverity(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      severity === s
                        ? s === 'Critical'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : s === 'High'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : s === 'Medium'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-700/40 border-slate-500 text-slate-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold">{s}</div>
                    <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                      ${b.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bug Type & Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Defect Category
              </label>
              <select
                value={bugType}
                onChange={(e) => setBugType(e.target.value as BugType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Crash">Crash / Fatal Exception</option>
                <option value="Functional">Functional Logic Flaw</option>
                <option value="UI / Visual">UI / Visual Layout Defect</option>
                <option value="Performance">Performance / Latency / Memory</option>
                <option value="Content / Localization">Content / Localization</option>
                <option value="Security">Security / Privacy Leak</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reproduction Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BugFrequency)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Every time (100%)">Every time (100%)</option>
                <option value="Frequently (~70%)">Frequently (~70%)</option>
                <option value="Occasionally (~30%)">Occasionally (~30%)</option>
                <option value="Once">Once</option>
              </select>
            </div>
          </div>

          {/* Reproduction Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Steps to Reproduce <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="w-6 text-center text-xs font-bold text-slate-400 shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => handleUpdateStep(idx, e.target.value)}
                    placeholder={`Step ${idx + 1} detail...`}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Expected Result <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="Describe what should happen according to specs..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Actual Result <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                placeholder="Describe the error, crash, or unexpected behavior observed..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Secure Document & Media Uploading */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Test Proofs: Screenshots, Diagnostic Logs & Recordings
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                isDragging
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
              }`}
              onClick={() => {
                const input = document.getElementById('bug-file-input') as HTMLInputElement;
                input?.click();
              }}
            >
              <UploadCloud className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-200">
                Drag and drop files here, or <span className="text-blue-400 underline">browse</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports PNG, JPG, WebP, MP4, Crash Logs (.txt, .log), up to 50MB
              </p>
              <input
                id="bug-file-input"
                type="file"
                multiple
                accept="image/*,video/*,text/*,.log,.json"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Uploaded attachments preview */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-400">
                  Attached Proofs ({attachments.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, i) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {att.type.startsWith('image/') ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="text-xs text-white truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachments(attachments.filter((_, idx) => idx !== i));
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 transition ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Encrypted submission to QA review queue</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-2 transition shadow-md"
            >
              <Bug className="w-4 h-4" />
              <span>Submit Defect (${getBountyForSeverity(severity).toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
