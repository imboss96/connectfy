import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Mail, MapPin, PlusCircle, Search, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

type RoleFilter = 'all' | 'tester' | 'client' | 'admin';
type CRMView = 'members' | 'utest';

type PlatformMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  created_at: string | null;
  profile_data?: Record<string, any>;
};

type ApplicationUtestDetails = {
  application_id: string;
  tester_id: string;
  full_name: string;
  utest_id: string;
  utest_email: string;
  date_of_birth: string | null;
  age_range: string;
  country: string;
  smartphone: string;
  device_confirmation: string;
  has_valid_id: boolean;
  willing_voice_recording: boolean;
  updated_at: string;
};

export const CRMSection: React.FC = () => {
  const [members, setMembers] = useState<PlatformMember[]>([]);
  const [utestDetails, setUtestDetails] = useState<ApplicationUtestDetails[]>([]);
  const [activeView, setActiveView] = useState<CRMView>('members');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    if (!supabase) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, company, country, city, avatar_url, created_at, profile_data')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers((data || []) as PlatformMember[]);
    } catch (error) {
      console.error('Unable to load CRM members:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
    void loadUtestDetails();
  }, []);

  const loadUtestDetails = async () => {
    if (!supabase) {
      setUtestDetails([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('application_utest_details')
        .select('application_id,tester_id,full_name,utest_id,utest_email,date_of_birth,age_range,country,smartphone,device_confirmation,has_valid_id,willing_voice_recording,updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUtestDetails((data || []) as ApplicationUtestDetails[]);
    } catch (error) {
      console.error('Unable to load application uTest details:', error);
      setUtestDetails([]);
    }
  };

  const handleInviteAdmin = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      setInviteError('Enter an email address first.');
      setInviteStatus(null);
      return;
    }

    if (!supabase) {
      setInviteError('Supabase is not configured.');
      setInviteStatus(null);
      return;
    }

    setInviting(true);
    setInviteError(null);
    setInviteStatus(null);

    try {
      const { data, error } = await supabase.rpc('invite_user_as_admin', { p_email: trimmed });
      if (error) throw error;

      setInviteStatus(data ? `Admin access granted to ${trimmed}.` : `Admin access request processed for ${trimmed}.`);
      setInviteEmail('');
      await loadMembers();
    } catch (error) {
      console.error('Unable to invite admin:', error);
      setInviteError(error instanceof Error ? error.message : 'Unable to invite user as admin.');
    } finally {
      setInviting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const haystack = [
        member.name || '',
        member.email || '',
        member.company || '',
        member.country || '',
        member.city || '',
        member.role || ''
      ].join(' ').toLowerCase();

      const matchesSearch = !term || haystack.includes(term);
      return matchesRole && matchesSearch;
    });
  }, [members, roleFilter, search]);

  const roleCounts = useMemo(() => ({
    tester: members.filter((m) => m.role === 'tester').length,
    client: members.filter((m) => m.role === 'client').length,
    admin: members.filter((m) => m.role === 'admin').length
  }), [members]);

  const testerMembers = useMemo(
    () => members.filter((member) => member.role === 'tester'),
    [members]
  );

  return (
    <div className="space-y-6 animate-fade-in text-slate-700">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00A3E0]/8 via-[#007AFF]/4 to-transparent pointer-events-none rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-2xl text-[#007AFF] shadow-sm">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">CRM & Platform Members</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">Operations Access</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">View and manage all platform member records, including testers, clients, and admin accounts from one unified view.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-200 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total Members</span>
            <span className="text-lg font-bold text-slate-900">{members.length}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Testers</span>
            <span className="text-lg font-bold text-[#007AFF]">{roleCounts.tester}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Clients & Admins</span>
            <span className="text-lg font-bold text-emerald-600">{roleCounts.client + roleCounts.admin}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveView('members')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeView === 'members' ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            Platform Members
          </button>
          <button
            type="button"
            onClick={() => setActiveView('utest')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeView === 'utest' ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            uTest Details
          </button>
        </div>

        {activeView === 'utest' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#00A3E0]/30 bg-[#e0f7ff] p-3 text-xs text-[#075985]">
              uTest IDs and emails saved by testers are shown here for project payment processing. Passwords and payment credentials are never stored.
            </div>
            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading uTest details...</div>
            ) : utestDetails.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No tester records found.</div>
            ) : (
              <div className="space-y-3">
                {utestDetails.map((details) => {
                  const member = members.find((candidate) => candidate.id === details.tester_id);
                  return (
                    <div key={details.application_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{details.full_name || member?.name || 'Unnamed tester'}</h3>
                          <p className="mt-1 text-[11px] text-slate-500">{member?.email || 'No Connectfy email'}{details.country ? ` • ${details.country}` : ''}</p>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">Tester</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Name as shown on ID</span>
                          <strong className="text-slate-900">{details.full_name || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Date of birth</span>
                          <strong className="text-slate-900">{details.date_of_birth || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">uTest ID</span>
                          <strong className="text-slate-900">{details.utest_id || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">uTest payment email</span>
                          <strong className="text-slate-900">{details.utest_email || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Country / age range</span>
                          <strong className="text-slate-900">{details.country || 'Not provided'}{details.age_range ? ` • ${details.age_range}` : ''}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Application device</span>
                          <strong className="text-slate-900">{details.device_confirmation || details.smartphone || 'Not provided'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, company, or location..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#007AFF]"
            >
              <option value="all">All roles</option>
              <option value="tester">Tester</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Invite a user by email as admin"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]"
              />
            </div>
            <button
              type="button"
              onClick={handleInviteAdmin}
              disabled={inviting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#005fce] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlusCircle className="w-4 h-4" />
              {inviting ? 'Inviting...' : 'Invite Admin'}
            </button>
          </div>

          {inviteStatus && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{inviteStatus}</div>}
          {inviteError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{inviteError}</div>}
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading member records...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No platform members match the current filters.</div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const roleTag = member.role === 'admin' ? 'Admin' : member.role === 'client' ? 'Client' : 'Tester';
              const avatarSource = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.email || 'User')}&background=random`;

              return (
                <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <img src={avatarSource} alt={member.name || 'Member'} className="h-11 w-11 rounded-full object-cover border border-slate-200 bg-white" referrerPolicy="no-referrer" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{member.name || 'Unnamed member'}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-slate-700 border-slate-200">{roleTag}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email || 'No email'}</span>
                          {(member.country || member.city) && (
                            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[member.city, member.country].filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      {member.company ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-700">
                          <Briefcase className="w-3.5 h-3.5" />
                          {member.company}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-500">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          No company profile
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                    <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-2">
                      <span className="block text-slate-500">Joined</span>
                      <strong className="text-slate-800">{member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Unknown'}</strong>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-2">
                      <span className="block text-slate-500">Member ID</span>
                      <strong className="text-slate-800">{member.id.slice(0, 8)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
