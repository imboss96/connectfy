import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  Trash2,
  Info,
  Sparkles,
  MapPin,
  Mic,
  Brain,
  Eye
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project, AttachmentFile, ProjectTrack } from '../types';
import { isCloudinaryConfigured, uploadToCloudinary } from '../lib/cloudinary';

interface TaskSubmissionModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskSubmissionModal: React.FC<TaskSubmissionModalProps> = ({
  project,
  onClose,
  onSuccess
}) => {
  const { submitTaskDeliverable, testerProfile } = useApp();

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [sampleCount, setSampleCount] = useState<number>(
    project.deliverablesGuide?.sampleCountRequired || 1
  );
  const [languageOrDialect, setLanguageOrDialect] = useState('English (East African / Swahili accents)');
  const [audioEnvironment, setAudioEnvironment] = useState('Quiet Studio (<25dB noise floor)');
  const [deviceUsed, setDeviceUsed] = useState(
    testerProfile.devices[0] || 'MacBook Pro M2 + Studio Microphone'
  );
  const [storeLocation, setStoreLocation] = useState('Downtown Branch #14 (POS Terminal #882)');
  const [sessionVideoUrl, setSessionVideoUrl] = useState('');

  // AI Evaluation prompts pair
  const [promptInput, setPromptInput] = useState('Evaluate safe refusal on high-risk regulatory tax avoidance inquiries.');
  const [preferredModel, setPreferredModel] = useState<'A' | 'B'>('A');
  const [prefReason, setPrefReason] = useState('Model A maintained regulatory compliance and cited real legal barriers without hallucinations.');

  // Attachments
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAudioTrack = project.projectTrack === 'data_collection';
  const isAiTrack = project.projectTrack === 'ai_evaluation';
  const isFieldTrack = project.projectTrack === 'special_field';
  const isUxTrack = project.projectTrack === 'ux_research';

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!isCloudinaryConfigured) {
      setError('Cloudinary is not configured. Add the upload settings before attaching deliverables.');
      return;
    }

    try {
      const newAtts = await Promise.all(Array.from(files).map(async (file) => {
        const result = await uploadToCloudinary(file);
        return {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
      }));

      setAttachments((prev) => [...prev, ...newAtts]);
      setError('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Deliverable upload failed.');
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a descriptive title for this deliverable batch.');
      return;
    }
    if (!details.trim()) {
      setError('Please describe your methodology, test execution, or observations.');
      return;
    }
    if (attachments.length === 0) {
      setError('Please upload at least one deliverable file, recording, or verification screenshot.');
      return;
    }

    setSubmitting(true);

    const metadata: Record<string, any> = {
      deviceUsed,
      sampleCount
    };

    if (isAudioTrack) {
      metadata.languageOrDialect = languageOrDialect;
      metadata.audioEnvironment = audioEnvironment;
    } else if (isAiTrack) {
      metadata.promptPairRankings = [
        {
          prompt: promptInput,
          responseA: 'Safety aligned response (Adhered strictly to guardrails)',
          responseB: 'Unconstrained model response (Risk flagged)',
          preferred: preferredModel,
          reason: prefReason
        }
      ];
    } else if (isFieldTrack) {
      metadata.storeLocationOrMerchant = storeLocation;
    } else if (isUxTrack) {
      metadata.sessionVideoUrl = sessionVideoUrl;
    }

    try {
      submitTaskDeliverable({
        projectId: project.id,
        taskType: project.projectTrack || 'data_collection',
        title: title.trim(),
        details: details.trim(),
        metadata,
        attachments
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit deliverable.');
      setSubmitting(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('audio/')) return <FileAudio className="w-5 h-5 text-purple-400" />;
    if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-400" />;
    if (type.includes('json') || type.includes('code')) return <FileCode className="w-5 h-5 text-emerald-400" />;
    return <FileText className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-700">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
              {isAudioTrack && <Mic className="w-5 h-5" />}
              {isAiTrack && <Brain className="w-5 h-5" />}
              {isFieldTrack && <MapPin className="w-5 h-5" />}
              {isUxTrack && <Eye className="w-5 h-5" />}
              {!isAudioTrack && !isAiTrack && !isFieldTrack && !isUxTrack && <Sparkles className="w-5 h-5" />}
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Submit Task Deliverable</h3>
              <p className="text-xs text-slate-600">
                {project.title} • <span className="text-emerald-600 font-semibold">${project.taskRate?.toFixed(2) || '40.00'} Bounty</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Deliverable Guide Banner */}
          {project.deliverablesGuide && (
            <div className="p-3.5 bg-violet-50 border border-violet-200 rounded-xl text-violet-700 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-violet-800">
                <Info className="w-4 h-4" />
                <span>Deliverable Specifications from Client:</span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                {project.deliverablesGuide.instructions}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-violet-700">
                <span>Format: <strong className="text-slate-900">{project.deliverablesGuide.fileFormat}</strong></span>
                <span>•</span>
                <span>Min Samples: <strong className="text-slate-900">{project.deliverablesGuide.sampleCountRequired} items</strong></span>
                <span>•</span>
                <span>Quality Gate: <strong className="text-slate-900">{project.deliverablesGuide.acceptanceCriteria[0]}</strong></span>
              </div>
            </div>
          )}

          {/* Deliverable Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Deliverable Title / Batch Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isAudioTrack
                  ? 'e.g., Batch #2: 30 Conversational Voice Utterances (Nairobi Dialect)'
                  : isAiTrack
                  ? 'e.g., Red Team Eval #1: 5 Prompt Injection & Multi-Turn Stress Tests'
                  : isFieldTrack
                  ? 'e.g., Store Audit #208: Westlands Fuel Station Contactless POS Test'
                  : 'e.g., UX Usability Session: Cart Checkout Screen Recording & Notes'
              }
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Track-Specific Metadata Fields */}
          {isAudioTrack && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Language / Dialect / Accent</label>
                <input
                  type="text"
                  value={languageOrDialect}
                  onChange={(e) => setLanguageOrDialect(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Audio Room Environment</label>
                <input
                  type="text"
                  value={audioEnvironment}
                  onChange={(e) => setAudioEnvironment(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Recording Equipment / Mic</label>
                <input
                  type="text"
                  value={deviceUsed}
                  onChange={(e) => setDeviceUsed(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Total Utterances / Audio Clips</label>
                <input
                  type="number"
                  value={sampleCount}
                  onChange={(e) => setSampleCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
            </div>
          )}

          {isAiTrack && (
            <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-violet-700" />
                <span>Prompt Evaluation Test Case</span>
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Evaluated Attack Prompt / Query</label>
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredModel('A')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    preferredModel === 'A'
                      ? 'bg-violet-100 border-violet-300 text-violet-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">Model Output A Preferred</span>
                  <span className="text-[10px] text-slate-500">Maintained safety boundaries</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredModel('B')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    preferredModel === 'B'
                      ? 'bg-violet-100 border-violet-300 text-violet-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">Model Output B Preferred</span>
                  <span className="text-[10px] text-slate-500">Better factual accuracy</span>
                </button>
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Alignment Reasoning & Failure Log</label>
                <input
                  type="text"
                  value={prefReason}
                  onChange={(e) => setPrefReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
            </div>
          )}

          {isFieldTrack && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Store / Fuel Station Location</label>
                <input
                  type="text"
                  value={storeLocation}
                  onChange={(e) => setStoreLocation(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Payment Card / NFC Terminal Used</label>
                <input
                  type="text"
                  value={deviceUsed}
                  onChange={(e) => setDeviceUsed(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
                />
              </div>
            </div>
          )}

          {isUxTrack && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block font-medium text-slate-600 mb-1">Usability Session Video Link (Loom / Drive)</label>
              <input
                type="url"
                value={sessionVideoUrl}
                onChange={(e) => setSessionVideoUrl(e.target.value)}
                placeholder="https://www.loom.com/share/..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 text-xs"
              />
            </div>
          )}

          {/* Detailed Observations & Transcript Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Methodology, Execution Notes & Observations <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Detail your testing procedure, step-by-step notes, acoustic calibration, or merchant verification..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Secure Document & File Uploader */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Upload Deliverable Files & Proofs <span className="text-rose-500">*</span>
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
              onClick={() => fileInputRef.current?.click()}
              className={`p-5 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                isDragging
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-7 h-7 text-violet-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900">
                Drag and drop files here, or <span className="text-violet-700 underline">browse</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Audio WAV/MP3, JSON evaluations, Store Receipts, Test Logs, Video MP4 (Max 50MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Uploaded File List */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {attachments.length} file{attachments.length > 1 ? 's' : ''} attached:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 group"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {getFileIcon(att.type)}
                        <div className="truncate">
                          <p className="text-slate-900 truncate font-medium">{att.name}</p>
                          <p className="text-[10px] text-slate-500">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-slate-500 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Freelance Scope Confirmation */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-700 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Once approved by {project.company}, the bounty of <strong>${project.taskRate?.toFixed(2) || '40.00'}</strong> will be automatically credited to your available payout balance.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{submitting ? 'Submitting Batch...' : 'Submit Deliverable for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
