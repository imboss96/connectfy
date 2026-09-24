import React, { useEffect, useState } from 'react';
import { Calendar, ExternalLink, Save, X } from 'lucide-react';
import { Project } from '../types';
import { useApp } from '../context/AppContext';

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
  const [slotsTotal, setSlotsTotal] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [status, setStatus] = useState<Project['status']>('active');

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setShortDescription(project.shortDescription);
    setFullOverview(project.fullOverview);
    setResourcesText((project.resources || []).map((resource) => `${resource.label} | ${resource.url}`).join('\n'));
    setDeadline(project.deadline || '');
    setSlotsTotal(String(project.slotsTotal));
    setTotalBudget(String(project.totalBudget));
    setStatus(project.status);
  }, [project]);

  if (!project) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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
      slotsTotal: Math.max(project.slotsFilled, Number(slotsTotal) || project.slotsTotal),
      totalBudget: Number(totalBudget) || project.totalBudget,
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

          <div>
            <label className="block font-bold text-slate-200 mb-1.5">External links or attachments</label>
            <textarea rows={4} value={resourcesText} onChange={(event) => setResourcesText(event.target.value)} placeholder="Google Form | https://forms.google.com/..." className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl p-3 text-white leading-relaxed" />
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> One labeled HTTPS link per line.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-slate-300"> <span className="block font-bold mb-1">Deadline</span><span className="relative block"><Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-amber-400" /><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl pl-8 pr-2 py-2 text-white" /></span></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Max slots</span><input type="number" min={project.slotsFilled} value={slotsTotal} onChange={(event) => setSlotsTotal(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white" /></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Budget</span><input type="number" min="0" value={totalBudget} onChange={(event) => setTotalBudget(event.target.value)} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white" /></label>
            <label className="text-slate-300"><span className="block font-bold mb-1">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as Project['status'])} className="w-full bg-[#080D1A] border border-[#1E2E4E] rounded-xl px-2 py-2 text-white"><option value="active">Active</option><option value="upcoming">Upcoming</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label>
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
