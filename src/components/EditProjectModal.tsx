import React, { useEffect, useState } from 'react';
import { Calendar, ExternalLink, Save, X } from 'lucide-react';
import { Project } from '../types';
import { useApp } from '../context/AppContext';
import { getDeliverableFormatOptions } from '../lib/deliverableFormats';
import { DeliverableFormatSelect } from './DeliverableFormatSelect';

interface EditProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose }) => {
  const { updateProject } = useApp();
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullOverview, setFullOverview] = useState('');
  const [resourcesText, setResourcesText] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [slotsTotal, setSlotsTotal] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [taskRate, setTaskRate] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [taskFileFormat, setTaskFileFormat] = useState('');
  const [taskSampleCount, setTaskSampleCount] = useState('');
  const [taskAcceptanceCriteria, setTaskAcceptanceCriteria] = useState('');
  const [inScopeText, setInScopeText] = useState('');
  const [outOfScopeText, setOutOfScopeText] = useState('');
  const [status, setStatus] = useState<Project['status']>('active');

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setShortDescription(project.shortDescription);
    setFullOverview(project.fullOverview);
    setResourcesText((project.resources || []).map((resource) => `${resource.label} | ${resource.url}`).join('\n'));
    setDeadline(project.deadline || '');
    setStartsAt(project.startsAt || '');
    setSlotsTotal(String(project.slotsTotal));
    setTotalBudget(String(project.totalBudget));
    setTaskRate(String(project.taskRate || project.bountyStructure.testCaseBounty || ''));
    const instructions = project.deliverablesGuide?.instructions;
    setTaskInstructions(Array.isArray(instructions) ? instructions.join('\n') : instructions || '');
    setTaskFileFormat(project.deliverablesGuide?.fileFormat || '');
    setTaskSampleCount(String(project.deliverablesGuide?.sampleCountRequired || ''));
    setTaskAcceptanceCriteria((project.deliverablesGuide?.acceptanceCriteria || []).join('\n'));
    setInScopeText((project.inScope || []).join('\n'));
    setOutOfScopeText((project.outOfScope || []).join('\n'));
    setStatus(project.status);
  }, [project]);

  if (!project) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedTaskRate = Number(taskRate);
    const savedTaskRate = Number.isFinite(parsedTaskRate) && taskRate.trim() !== ''
      ? parsedTaskRate
      : project.taskRate || project.bountyStructure.testCaseBounty;
    const acceptanceCriteria = taskAcceptanceCriteria
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^conforms strictly to .+ standards$/i.test(line) && line !== 'No file attachment is required for this task');
    if (taskFileFormat === 'No file required') {
      acceptanceCriteria.push('No file attachment is required for this task');
    } else if (taskFileFormat) {
      acceptanceCriteria.push(`Conforms strictly to ${taskFileFormat} standards`);
    }
    const resources = resourcesText
      .split('\n')
      .map((line) => {
        const [label, ...urlParts] = line.split('|');
        return { label: label.trim(), url: urlParts.join('|').trim() };
      })
      .filter((resource) => resource.label && /^https?:\/\//i.test(resource.url));

    updateProject(project.id, {
      title: title.trim() || project.title,
      shortDescription: shortDescription.trim(),
      fullOverview: fullOverview.trim(),
      resources,
      deadline,
      startsAt,
      slotsTotal: Math.max(project.slotsFilled, Number(slotsTotal) || project.slotsTotal),
      totalBudget: Number(totalBudget) || project.totalBudget,
      taskRate: project.deliverablesGuide ? savedTaskRate : project.taskRate,
      deliverablesGuide: project.deliverablesGuide
        ? {
            ...project.deliverablesGuide,
            instructions: taskInstructions.trim(),
            fileFormat: taskFileFormat.trim(),
            sampleCountRequired: Math.max(1, Number(taskSampleCount) || 1),
            acceptanceCriteria
          }
        : undefined,
      bountyStructure: project.deliverablesGuide
        ? { ...project.bountyStructure, testCaseBounty: savedTaskRate }
        : project.bountyStructure,
      inScope: inScopeText.split('\n').map((line) => line.trim()).filter(Boolean),
      outOfScope: outOfScopeText.split('\n').map((line) => line.trim()).filter(Boolean),
      status
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5">
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 sm:p-5 border-b border-[#1E2E4E] flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-base sm:text-lg">Edit Posted Project</h3>
            <p className="text-xs text-slate-400 mt-1">Update the listing and resources used in future invites.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C33]" title="Close edit dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-200 mb-1.5">Project title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2.5 text-white font-bold" required />
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1.5">Short project summary</label>
            <input value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-3 py-2.5 text-white" />
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1.5">Project scope</label>
            <textarea rows={4} value={fullOverview} onChange={(event) => setFullOverview(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-3 text-white leading-relaxed" />
          </div>

          <div className="space-y-3 rounded-xl border border-[#1E2E4E] bg-[#080D1A] p-3">
            <h4 className="font-bold text-white">Task details and scope</h4>
            {project.deliverablesGuide && (
              <>
                <label className="block font-bold text-slate-200">
                  Task instructions
                  <textarea rows={4} value={taskInstructions} onChange={(event) => setTaskInstructions(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] p-3 font-normal leading-relaxed text-white" placeholder="Instructions shown to testers" />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="font-bold text-slate-200">Slot payout per task/batch ($)<input type="number" min="0" step="0.01" value={taskRate} onChange={(event) => setTaskRate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] px-3 py-2 font-normal text-white" /></label>
                  <label className="font-bold text-slate-200">Required file format<DeliverableFormatSelect value={taskFileFormat} onChange={setTaskFileFormat} options={getDeliverableFormatOptions(taskFileFormat)} label="Required file format" className="mt-1.5 border border-[#1E2E4E] bg-[#0B132B] font-normal text-white" /></label>
                  <label className="font-bold text-slate-200">Required samples<input type="number" min="1" value={taskSampleCount} onChange={(event) => setTaskSampleCount(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] px-3 py-2 font-normal text-white" /></label>
                </div>
                <label className="block font-bold text-slate-200">
                  Acceptance criteria
                  <textarea rows={3} value={taskAcceptanceCriteria} onChange={(event) => setTaskAcceptanceCriteria(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] p-3 font-normal leading-relaxed text-white" placeholder="One criterion per line" />
                </label>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block font-bold text-slate-200">In scope<textarea rows={3} value={inScopeText} onChange={(event) => setInScopeText(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] p-3 font-normal leading-relaxed text-white" placeholder="One requirement per line" /></label>
              <label className="block font-bold text-slate-200">Out of scope<textarea rows={3} value={outOfScopeText} onChange={(event) => setOutOfScopeText(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#1E2E4E] bg-[#0B132B] p-3 font-normal leading-relaxed text-white" placeholder="One exclusion per line" /></label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1.5">External links or attachments</label>
            <textarea rows={4} value={resourcesText} onChange={(event) => setResourcesText(event.target.value)} placeholder="Google Form | https://forms.google.com/..." className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-3 text-white leading-relaxed" />
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> One labeled HTTPS link per line.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <label className="text-slate-300"><span className="block font-bold mb-1">Starts at</span><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white" /></label>
            <label className="text-slate-300"> <span className="block font-bold mb-1">Deadline</span><span className="relative block"><Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-amber-400" /><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl pl-8 pr-2 py-2 text-white" /></span></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Max slots</span><input type="number" min={project.slotsFilled} value={slotsTotal} onChange={(event) => setSlotsTotal(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white" /></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Budget</span><input type="number" min="0" value={totalBudget} onChange={(event) => setTotalBudget(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white" /></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as Project['status'])} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white"><option value="active">Open</option><option value="upcoming">Coming soon</option><option value="paused">Paused</option><option value="closed">Closed</option><option value="ended">Ended</option><option value="hidden">Hidden</option></select></label>
          </div>

          <div className="pt-4 border-t border-[#1E2E4E] flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#111C33] text-slate-300 font-bold rounded-xl border border-[#1E2E4E]">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-[#007AFF] text-white font-black rounded-xl flex items-center gap-2"><Save className="w-4 h-4" />Save Project</button>
          </div>
        </form>
      </div>
    </div>
  );
};
