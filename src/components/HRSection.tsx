import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Star,
  UserRound,
  Users,
  Wallet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { sendProjectEmail } from '../lib/emailService';
import {
  buildEmployeeContractTermsSnapshot,
  employeeContractTermsChanged,
  EmployeeContractTermsSnapshot
} from '../lib/hrEmployeeContract';
import { getHrJobTitleAdminAccess } from '../lib/hrJobTitleAccess';
import { supabase } from '../lib/supabase';

type HrTab = 'overview' | 'onboarding' | 'attendance' | 'reports' | 'leave' | 'payroll' | 'performance';
type HrReportRange = 'current_pay_period' | 'last_30_days' | 'current_month';
type EmployeeStatus = 'active' | 'on_leave' | 'inactive' | 'terminated';
type LeaveStatus = 'pending' | 'approved' | 'declined';
type PayrollStatus = 'planned' | 'paid' | 'void';

interface HrEmployee {
  id: string;
  profile_id: string;
  job_title: string;
  department: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  employment_status: EmployeeStatus;
  hire_date: string;
  compensation_type: 'salary' | 'hourly';
  compensation_rate: number;
  compensation_currency: string;
  pay_frequency: 'weekly' | 'biweekly' | 'monthly';
  previous_platform_role: 'tester' | 'client' | null;
  hr_platform_access_level: 'super_admin' | 'project_manager' | 'reviewer' | null;
  welcome_email_sent_at: string | null;
  employment_contract_sent_at: string | null;
  employment_contract_terms: EmployeeContractTermsSnapshot | null;
}

interface PlatformProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  admin_access_level: string | null;
}

type HrOptionCategory = 'department' | 'job_title';

interface HrOption {
  id: string;
  category: HrOptionCategory;
  label: string;
  is_active: boolean;
  sort_order: number;
}

interface OnboardingTask {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  due_date: string | null;
  is_required: boolean;
  status: 'pending' | 'completed' | 'waived';
  completed_at: string | null;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
}

interface HrAdjustment {
  id: string;
  employee_id: string;
  adjustment_type: 'time' | 'pay';
  attendance_record_id: string | null;
  amount: number | null;
  currency: string | null;
  previous_clocked_in_at: string | null;
  previous_clocked_out_at: string | null;
  new_clocked_in_at: string | null;
  new_clocked_out_at: string | null;
  reason: string;
  created_by: string;
  created_at: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  reason: string;
  status: LeaveStatus;
  review_note: string;
  created_at: string;
}

interface PayrollRecord {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  currency: string;
  status: PayrollStatus;
  paid_at: string | null;
  notes: string;
}

interface PerformanceReview {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  rating: number;
  summary: string;
  strengths: string;
  growth_goals: string;
  created_at: string;
}

const tabs: Array<{ id: HrTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: BriefcaseBusiness },
  { id: 'onboarding', label: 'Onboarding', icon: CheckCircle2 },
  { id: 'attendance', label: 'Attendance', icon: Clock3 },
  { id: 'reports', label: 'Hourly reports', icon: BarChart3 },
  { id: 'leave', label: 'Leave', icon: CalendarDays },
  { id: 'payroll', label: 'Payroll', icon: Wallet },
  { id: 'performance', label: 'Performance', icon: Star }
];

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

const toDateLabel = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(parsed);
};

const toDateOnlyLabel = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
};

const toDateTimeLabel = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const getCurrentPayPeriod = (employee: HrEmployee, now = new Date()) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (employee.pay_frequency === 'monthly') {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const endExclusive = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return { start, endExclusive };
  }

  const periodDays = employee.pay_frequency === 'weekly' ? 7 : 14;
  const hireDate = Date.parse(`${employee.hire_date}T00:00:00.000Z`);
  const elapsedDays = Math.max(0, Math.floor((today - hireDate) / dayMs));
  const start = hireDate + Math.floor(elapsedDays / periodDays) * periodDays * dayMs;
  return { start, endExclusive: start + periodDays * dayMs };
};

const getReportPeriod = (employee: HrEmployee, range: HrReportRange, now = new Date()) => {
  if (range === 'current_pay_period') return getCurrentPayPeriod(employee, now);

  const dayMs = 24 * 60 * 60 * 1000;
  if (range === 'last_30_days') {
    return { start: now.getTime() - 30 * dayMs, endExclusive: now.getTime() };
  }

  return {
    start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    endExclusive: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  };
};

const toLocalDateTimeInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

const statusClass = (status: string) => {
  if (status === 'active' || status === 'approved' || status === 'completed' || status === 'paid') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (status === 'declined' || status === 'terminated' || status === 'void') {
    return 'bg-rose-50 text-rose-700';
  }
  return 'bg-amber-50 text-amber-800';
};

const Card: React.FC<React.PropsWithChildren<{ title?: string; action?: React.ReactNode; className?: string }>> = ({
  title,
  action,
  className = '',
  children
}) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

const AccountPicker: React.FC<{
  profiles: PlatformProfile[];
  value: string;
  onChange: (profileId: string) => void;
}> = ({ profiles, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const selectedProfile = profiles.find((profile) => profile.id === value);
  const selectedLabel = selectedProfile
    ? `${selectedProfile.name || selectedProfile.email} · ${selectedProfile.email}`
    : '';
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredProfiles = profiles.filter((profile) =>
    !normalizedSearch
    || profile.name.toLocaleLowerCase().includes(normalizedSearch)
    || profile.email.toLocaleLowerCase().includes(normalizedSearch)
    || profile.role.toLocaleLowerCase().includes(normalizedSearch)
  );

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const anchor = inputRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const gap = 6;
      const edgePadding = 8;
      const desiredHeight = Math.min(320, Math.max(112, window.innerHeight * 0.45));
      const spaceBelow = window.innerHeight - anchor.bottom - gap - edgePadding;
      const spaceAbove = anchor.top - gap - edgePadding;
      const openAbove = spaceBelow < Math.min(220, desiredHeight) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(88, Math.min(desiredHeight, openAbove ? spaceAbove : spaceBelow));
      const width = Math.min(anchor.width, window.innerWidth - edgePadding * 2);
      const left = Math.max(edgePadding, Math.min(anchor.left, window.innerWidth - width - edgePadding));
      const top = openAbove
        ? Math.max(edgePadding, anchor.top - gap - maxHeight)
        : Math.min(window.innerHeight - maxHeight - edgePadding, anchor.bottom + gap);

      setPosition({ left, top, width, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, filteredProfiles.length]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!inputRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const openPicker = () => {
    setSearch('');
    setIsOpen(true);
  };

  return (
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        className={`${inputClass} pl-9`}
        role="combobox"
        aria-label="Search existing Connectfy accounts"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls="hr-account-picker-options"
        aria-required="true"
        autoComplete="off"
        placeholder="Search by name, email, or role…"
        value={isOpen ? search : selectedLabel}
        onFocus={openPicker}
        onClick={() => {
          if (!isOpen) openPicker();
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen && position && createPortal(
        <div
          ref={dropdownRef}
          id="hr-account-picker-options"
          role="listbox"
          aria-label="Matching Connectfy accounts"
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight
          }}
        >
          {filteredProfiles.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No accounts match that search.</p>
          ) : filteredProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              role="option"
              aria-selected={profile.id === value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(profile.id);
                setSearch('');
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 ${
                profile.id === value ? 'bg-blue-50' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {profile.name || profile.email}
                </span>
                <span className="block truncate text-xs text-slate-500">{profile.email}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600">
                {profile.role.replace('_', ' ')}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const HrOptionManager: React.FC<{
  options: HrOption[];
  isSaving: boolean;
  onAdd: (category: HrOptionCategory, label: string) => Promise<boolean>;
  onUpdate: (option: HrOption, label: string) => Promise<boolean>;
  onToggle: (option: HrOption) => Promise<boolean>;
}> = ({ options, isSaving, onAdd, onUpdate, onToggle }) => {
  const [newDepartment, setNewDepartment] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const categories: Array<{ id: HrOptionCategory; label: string }> = [
    { id: 'department', label: 'Departments' },
    { id: 'job_title', label: 'Job titles' }
  ];

  const submitNewOption = async (event: FormEvent, category: HrOptionCategory) => {
    event.preventDefault();
    const value = category === 'department' ? newDepartment : newJobTitle;
    if (!value.trim()) return;
    if (await onAdd(category, value.trim())) {
      if (category === 'department') setNewDepartment('');
      else setNewJobTitle('');
    }
  };

  return (
    <Card title="Manage department and job title options">
      <p className="mb-4 text-xs text-slate-500">
        Super Admin, Project Manager, Reviewer, and Project Reviewer titles grant the matching operations workspace.
        Only a Super Admin can assign these titles. Accounts already managed in Admin Management keep their separately assigned access.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {categories.map(({ id, label }) => {
          const categoryOptions = options.filter((option) => option.category === id);
          const value = id === 'department' ? newDepartment : newJobTitle;
          return (
            <section key={id} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">{label}</h3>
              <form className="flex gap-2" onSubmit={(event) => void submitNewOption(event, id)}>
                <input
                  className={inputClass}
                  value={value}
                  onChange={(event) => id === 'department'
                    ? setNewDepartment(event.target.value)
                    : setNewJobTitle(event.target.value)}
                  placeholder={`Add ${id === 'department' ? 'department' : 'job title'}`}
                  aria-label={`Add ${id === 'department' ? 'department' : 'job title'}`}
                  maxLength={80}
                />
                <button type="submit" className={buttonClass} disabled={isSaving || !value.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>
              <div className="space-y-2">
                {categoryOptions.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      className={inputClass}
                      value={drafts[option.id] ?? option.label}
                      onChange={(event) => setDrafts((current) => ({ ...current, [option.id]: event.target.value }))}
                      aria-label={`Edit ${option.label}`}
                      maxLength={80}
                    />
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={isSaving || !(drafts[option.id] ?? option.label).trim()
                        || (drafts[option.id] ?? option.label).trim() === option.label}
                      onClick={() => void onUpdate(option, (drafts[option.id] ?? option.label).trim())}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={isSaving}
                      onClick={() => void onToggle(option)}
                    >
                      {option.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {!option.is_active && <span className="text-[10px] font-semibold text-slate-500">Inactive</span>}
                  </div>
                ))}
                {categoryOptions.length === 0 && <p className="text-xs text-slate-500">No options yet.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
};

export const HRSection: React.FC = () => {
  const { role, adminAccessLevel, isOrganizationEmployee, testerProfile, clientProfile } = useApp();
  const isHrAdmin = role === 'admin' && adminAccessLevel === 'super_admin';
  const currentProfileId = testerProfile.id || clientProfile.id;
  const currentName = testerProfile.name || clientProfile.name || 'Employee';
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [profiles, setProfiles] = useState<PlatformProfile[]>([]);
  const [hrOptions, setHrOptions] = useState<HrOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [reportAttendance, setReportAttendance] = useState<AttendanceRecord[]>([]);
  const [reportAdjustments, setReportAdjustments] = useState<HrAdjustment[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [activeTab, setActiveTab] = useState<HrTab>('overview');
  const [reportRange, setReportRange] = useState<HrReportRange>('current_pay_period');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileId, setProfileId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<HrEmployee['employment_type']>('full_time');
  const [employmentStatus, setEmploymentStatus] = useState<EmployeeStatus>('active');
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [compensationType, setCompensationType] = useState<HrEmployee['compensation_type']>('salary');
  const [compensationRate, setCompensationRate] = useState('0');
  const [compensationCurrency, setCompensationCurrency] = useState('USD');
  const [payFrequency, setPayFrequency] = useState<HrEmployee['pay_frequency']>('monthly');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');
  const [payPeriodStart, setPayPeriodStart] = useState('');
  const [payPeriodEnd, setPayPeriodEnd] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState('USD');
  const [payNotes, setPayNotes] = useState('');
  const [reviewStart, setReviewStart] = useState('');
  const [reviewEnd, setReviewEnd] = useState('');
  const [reviewRating, setReviewRating] = useState('3');
  const [reviewSummary, setReviewSummary] = useState('');
  const [reviewStrengths, setReviewStrengths] = useState('');
  const [reviewGoals, setReviewGoals] = useState('');
  const [adjustmentEmployeeId, setAdjustmentEmployeeId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'time' | 'pay'>('time');
  const [adjustmentAttendanceId, setAdjustmentAttendanceId] = useState('');
  const [adjustmentClockIn, setAdjustmentClockIn] = useState('');
  const [adjustmentClockOut, setAdjustmentClockOut] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || null;
  const selectedProfile = profiles.find((profile) => profile.id === selectedEmployee?.profile_id);
  const hourlyEmployees = useMemo(
    () => employees.filter((employee) => employee.compensation_type === 'hourly'),
    [employees]
  );
  const hourlyEmployeeIdsKey = hourlyEmployees.map((employee) => employee.id).join(',');
  const activeDepartmentOptions = hrOptions.filter((option) => option.category === 'department' && option.is_active);
  const activeJobTitleOptions = hrOptions.filter((option) => option.category === 'job_title' && option.is_active);
  const departmentOptions = selectedEmployee?.department && !activeDepartmentOptions.some((option) => option.label === selectedEmployee.department)
    ? [{ id: `legacy-${selectedEmployee.department}`, label: selectedEmployee.department }, ...activeDepartmentOptions]
    : activeDepartmentOptions;
  const jobTitleOptions = selectedEmployee?.job_title && !activeJobTitleOptions.some((option) => option.label === selectedEmployee.job_title)
    ? [{ id: `legacy-${selectedEmployee.job_title}`, label: selectedEmployee.job_title }, ...activeJobTitleOptions]
    : activeJobTitleOptions;
  const availableProfiles = profiles.filter((profile) =>
    !employees.some((employee) => employee.profile_id === profile.id)
  );
  const currentEmployee = employees.find((employee) => employee.profile_id === currentProfileId) || null;
  const visibleEmployee = isHrAdmin ? selectedEmployee : currentEmployee;
  const visibleProfile = isHrAdmin
    ? selectedProfile
    : { id: currentProfileId, name: currentName, email: testerProfile.email || clientProfile.email, role };
  const activeClock = attendance.find((record) => !record.clocked_out_at);
  const pendingLeaveCount = leaveRequests.filter((request) => request.status === 'pending').length;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const reportRows = useMemo(() => {
    const now = Date.now();
    return hourlyEmployees.map((employee) => {
      const period = getReportPeriod(employee, reportRange, new Date(now));
      const sessions = reportAttendance.filter((record) => {
        if (record.employee_id !== employee.id) return false;
        const clockIn = Date.parse(record.clocked_in_at);
        const clockOut = record.clocked_out_at ? Date.parse(record.clocked_out_at) : now;
        return clockIn < period.endExclusive && clockOut > period.start;
      });
      const hours = sessions.reduce((total, record) => {
        const clockIn = Math.max(Date.parse(record.clocked_in_at), period.start);
        const clockOut = Math.min(
          record.clocked_out_at ? Date.parse(record.clocked_out_at) : now,
          period.endExclusive,
          now
        );
        return total + Math.max(0, clockOut - clockIn) / 3600000;
      }, 0);
      const adjustments = reportAdjustments.filter((adjustment) => {
        const createdAt = Date.parse(adjustment.created_at);
        return adjustment.employee_id === employee.id
          && createdAt >= period.start
          && createdAt < period.endExclusive;
      });
      const payAdjustments = adjustments
        .filter((adjustment) => adjustment.adjustment_type === 'pay')
        .reduce((total, adjustment) => total + (Number(adjustment.amount) || 0), 0);
      return { employee, period, sessions, hours, adjustments, payAdjustments };
    });
  }, [hourlyEmployees, reportAttendance, reportAdjustments, reportRange]);
  const reportSessionRows = reportRows.flatMap(({ employee, period, sessions }) =>
    sessions.map((record) => ({ employee, period, record }))
  );
  const adjustmentEmployee = hourlyEmployees.find((employee) => employee.id === adjustmentEmployeeId) || null;
  const adjustmentSessions = reportRows.find((row) => row.employee.id === adjustmentEmployeeId)
    ?.sessions.filter((record) => record.clocked_out_at) || [];
  const adjustmentAttendance = adjustmentSessions.find((record) => record.id === adjustmentAttendanceId) || null;

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError('HR data is unavailable because Supabase is not configured.');
      setEmployees([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { data: employeeRows, error: employeeError } = await supabase
        .from('hr_employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (employeeError) throw employeeError;

      const loadedEmployees = (employeeRows || []) as HrEmployee[];
      setEmployees(loadedEmployees);
      if (isHrAdmin) {
        const [profileResult, optionsResult] = await Promise.all([
          supabase.from('profiles').select('id,name,email,role,admin_access_level').order('name'),
          supabase.from('hr_option_catalog').select('*').order('category').order('sort_order').order('label')
        ]);
        const { data: profileRows, error: profileError } = profileResult;
        if (profileError) throw profileError;
        if (optionsResult.error) throw optionsResult.error;
        setProfiles((profileRows || []) as PlatformProfile[]);
        setHrOptions((optionsResult.data || []) as HrOption[]);
        setSelectedEmployeeId((currentId) => {
          if (loadedEmployees.some((employee) => employee.id === currentId)) return currentId;
          return loadedEmployees[0]?.id || '';
        });
      } else {
        setSelectedEmployeeId(loadedEmployees[0]?.id || '');
      }
    } catch (loadError) {
      console.error('Unable to load HR employee records:', loadError);
      setError(loadError instanceof Error
        ? loadError.message
        : 'Unable to load HR records. Apply the HR database migration and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isHrAdmin]);

  const loadTeamReport = useCallback(async () => {
    const client = supabase;
    if (!client || !isHrAdmin || hourlyEmployees.length === 0) {
      setReportAttendance([]);
      setReportAdjustments([]);
      setIsReportLoading(false);
      return;
    }

    setIsReportLoading(true);
    try {
      const now = new Date();
      const earliestPeriodStart = Math.min(...hourlyEmployees.map((employee) => getReportPeriod(employee, reportRange, now).start));
      const employeeIds = hourlyEmployees.map((employee) => employee.id);
      const fetchAttendance = async () => {
        const records: AttendanceRecord[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: queryError } = await client
            .from('hr_attendance_records')
            .select('*')
            .in('employee_id', employeeIds)
            .or(`clocked_out_at.is.null,clocked_out_at.gte.${new Date(earliestPeriodStart).toISOString()}`)
            .lte('clocked_in_at', now.toISOString())
            .order('clocked_in_at', { ascending: false })
            .range(offset, offset + 499);
          if (queryError) throw queryError;
          const page = (data || []) as AttendanceRecord[];
          records.push(...page);
          if (page.length < 500) return records;
        }
      };
      const fetchAdjustments = async () => {
        const adjustments: HrAdjustment[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: queryError } = await client
            .from('hr_adjustments')
            .select('*')
            .in('employee_id', employeeIds)
            .gte('created_at', new Date(earliestPeriodStart).toISOString())
            .lte('created_at', now.toISOString())
            .order('created_at', { ascending: false })
            .range(offset, offset + 499);
          if (queryError) throw queryError;
          const page = (data || []) as HrAdjustment[];
          adjustments.push(...page);
          if (page.length < 500) return adjustments;
        }
      };
      const [attendanceRecords, adjustments] = await Promise.all([fetchAttendance(), fetchAdjustments()]);
      setReportAttendance(attendanceRecords);
      setReportAdjustments(adjustments);
    } catch (loadError) {
      console.error('Unable to load hourly team reports:', loadError);
      setError(getErrorMessage(loadError, 'Unable to load hourly team reports.'));
    } finally {
      setIsReportLoading(false);
    }
  }, [hourlyEmployees, isHrAdmin, reportRange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (isHrAdmin && activeTab === 'reports') {
      void loadTeamReport();
    }
  }, [activeTab, isHrAdmin, loadTeamReport]);

  useEffect(() => {
    if (!hourlyEmployees.some((employee) => employee.id === adjustmentEmployeeId)) {
      setAdjustmentEmployeeId(hourlyEmployees[0]?.id || '');
    }
  }, [adjustmentEmployeeId, hourlyEmployees]);

  useEffect(() => {
    if (!adjustmentSessions.some((record) => record.id === adjustmentAttendanceId)) {
      setAdjustmentAttendanceId(adjustmentSessions[0]?.id || '');
    }
  }, [adjustmentAttendanceId, adjustmentSessions]);

  useEffect(() => {
    if (!adjustmentAttendance) return;
    setAdjustmentClockIn(toLocalDateTimeInput(adjustmentAttendance.clocked_in_at));
    setAdjustmentClockOut(toLocalDateTimeInput(adjustmentAttendance.clocked_out_at || ''));
  }, [adjustmentAttendance]);

  useEffect(() => {
    const client = supabase;
    if (!client || !visibleEmployee) {
      setTasks([]);
      setAttendance([]);
      setLeaveRequests([]);
      setPayroll([]);
      setReviews([]);
      return;
    }

    let cancelled = false;
    const loadEmployeeRecords = async () => {
      setError('');
      const results = await Promise.all([
        client.from('hr_onboarding_tasks').select('*').eq('employee_id', visibleEmployee.id).order('created_at', { ascending: false }),
        client.from('hr_attendance_records').select('*').eq('employee_id', visibleEmployee.id).order('clocked_in_at', { ascending: false }).limit(100),
        client.from('hr_leave_requests').select('*').eq('employee_id', visibleEmployee.id).order('created_at', { ascending: false }),
        client.from('hr_payroll_records').select('*').eq('employee_id', visibleEmployee.id).order('period_end', { ascending: false }),
        client.from('hr_performance_reviews').select('*').eq('employee_id', visibleEmployee.id).order('period_end', { ascending: false })
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      if (cancelled) return;
      setTasks((results[0].data || []) as OnboardingTask[]);
      setAttendance((results[1].data || []) as AttendanceRecord[]);
      setLeaveRequests((results[2].data || []) as LeaveRequest[]);
      setPayroll((results[3].data || []) as PayrollRecord[]);
      setReviews((results[4].data || []) as PerformanceReview[]);
    };
    void loadEmployeeRecords().catch((loadError: unknown) => {
      console.error('Unable to load HR employee details:', loadError);
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load employee HR details.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visibleEmployee?.id]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setJobTitle(selectedEmployee.job_title);
    setDepartment(selectedEmployee.department);
    setEmploymentType(selectedEmployee.employment_type);
    setEmploymentStatus(selectedEmployee.employment_status);
    setHireDate(selectedEmployee.hire_date);
    setCompensationType(selectedEmployee.compensation_type);
    setCompensationRate(String(selectedEmployee.compensation_rate));
    setCompensationCurrency(selectedEmployee.compensation_currency);
    setPayFrequency(selectedEmployee.pay_frequency);
  }, [selectedEmployee]);

  const runAction = async (action: () => Promise<void>, successMessage: string): Promise<boolean> => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await loadData();
      await loadCurrentEmployeeRecords();
      return true;
    } catch (actionError) {
      console.error('HR action failed:', actionError);
      setError(getErrorMessage(actionError, 'The HR action could not be completed.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const loadCurrentEmployeeRecords = async () => {
    const client = supabase;
    if (!client || !visibleEmployee) return;
    const [taskResult, attendanceResult, leaveResult, payrollResult, reviewResult] = await Promise.all([
      client.from('hr_onboarding_tasks').select('*').eq('employee_id', visibleEmployee.id).order('created_at', { ascending: false }),
      client.from('hr_attendance_records').select('*').eq('employee_id', visibleEmployee.id).order('clocked_in_at', { ascending: false }).limit(100),
      client.from('hr_leave_requests').select('*').eq('employee_id', visibleEmployee.id).order('created_at', { ascending: false }),
      client.from('hr_payroll_records').select('*').eq('employee_id', visibleEmployee.id).order('period_end', { ascending: false }),
      client.from('hr_performance_reviews').select('*').eq('employee_id', visibleEmployee.id).order('period_end', { ascending: false })
    ]);
    const failed = [taskResult, attendanceResult, leaveResult, payrollResult, reviewResult].find((result) => result.error);
    if (failed?.error) throw failed.error;
    setTasks((taskResult.data || []) as OnboardingTask[]);
    setAttendance((attendanceResult.data || []) as AttendanceRecord[]);
    setLeaveRequests((leaveResult.data || []) as LeaveRequest[]);
    setPayroll((payrollResult.data || []) as PayrollRecord[]);
    setReviews((reviewResult.data || []) as PerformanceReview[]);
  };

  const refreshEmployeeRecords = async () => {
    await loadCurrentEmployeeRecords();
    await loadData();
  };

  const saveEmployee = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !currentProfileId) return;
    const rate = Number(compensationRate);
    if (!jobTitle.trim() || !Number.isFinite(rate) || rate < 0 || !/^[A-Z]{3}$/.test(compensationCurrency)) {
      setError('Enter a job title, a non-negative pay rate, and a three-letter uppercase currency code.');
      return;
    }

    const values = {
      job_title: jobTitle.trim(),
      department: department.trim(),
      employment_type: employmentType,
      employment_status: employmentStatus,
      hire_date: hireDate,
      compensation_type: compensationType,
      compensation_rate: rate,
      compensation_currency: compensationCurrency,
      pay_frequency: payFrequency,
      updated_by: currentProfileId
    };
    const targetProfileId = selectedEmployee?.profile_id || profileId;
    const targetProfile = profiles.find((profile) => profile.id === targetProfileId);
    if (!targetProfile) {
      setError('Select a valid existing Connectfy account before saving the employee profile.');
      return;
    }
    const hrAccessLevel = getHrJobTitleAdminAccess(jobTitle);
    const isHrManagedAccess = targetProfile.role !== 'admin' || Boolean(selectedEmployee?.previous_platform_role);
    if (hrAccessLevel === 'super_admin' && isHrManagedAccess
      && !window.confirm('This grants full Super Admin access to the selected account, including user, payment, HR, and platform administration. Continue?')) {
      return;
    }
    let sentEmployeeEmailPurpose: 'welcome' | 'contract' | 'contract_update' | null = null;
    const contractTerms = buildEmployeeContractTermsSnapshot(values);
    const shouldSendEmployeeEmail = !selectedEmployee
      || employeeContractTermsChanged(selectedEmployee.employment_contract_terms, contractTerms);
    const actionSucceeded = await runAction(async () => {
      let employeeId = selectedEmployee?.id || '';
      if (selectedEmployee) {
        const { error: updateError } = await client
          .from('hr_employees')
          .update(values)
          .eq('id', selectedEmployee.id);
        if (updateError) throw updateError;
      } else {
        if (!profileId) throw new Error('Select an existing Connectfy account to add as an employee.');
        const { data, error: insertError } = await client
          .from('hr_employees')
          .insert({ ...values, profile_id: profileId, created_by: currentProfileId })
          .select('id')
          .single();
        if (insertError) throw insertError;
        employeeId = data.id;
        setSelectedEmployeeId(data.id);
        setProfileId('');
      }
      let platformAccessError: unknown;
      if (isHrManagedAccess) {
        try {
          const { data: accessProfile, error: accessError } = await client.rpc('hr_update_employee_platform_access', {
            p_profile_id: targetProfileId,
            p_admin_access_level: hrAccessLevel
          });
          if (accessError) throw accessError;
          if (!accessProfile) throw new Error('Employee details were saved, but platform access could not be updated.');
        } catch (accessError) {
          platformAccessError = accessError;
          await loadData();
        }
      }
      let employeeEmailError: unknown;
      if (shouldSendEmployeeEmail) {
        sentEmployeeEmailPurpose = !selectedEmployee
          ? 'welcome'
          : selectedEmployee.employment_contract_sent_at ? 'contract_update' : 'contract';
        try {
          await sendProjectEmail({
            type: 'employee_welcome',
            employeeProfileId: targetProfileId,
            employeeEmailPurpose: sentEmployeeEmailPurpose
          });
          const { error: emailTrackingError } = await client
            .from('hr_employees')
            .update({
              welcome_email_sent_at: new Date().toISOString(),
              employment_contract_sent_at: new Date().toISOString(),
              employment_contract_terms: contractTerms,
              updated_by: currentProfileId
            })
            .eq('id', employeeId);
          if (emailTrackingError) {
            throw new Error(`The employee email and contract PDF were accepted, but delivery status could not be saved: ${emailTrackingError.message}`);
          }
        } catch (emailError) {
          employeeEmailError = emailError;
          await loadData();
        }
      }
      if (platformAccessError || employeeEmailError) {
        const errors = [
          platformAccessError ? `Platform access: ${getErrorMessage(platformAccessError, 'The update failed.')}` : '',
          employeeEmailError ? `Employee email and contract PDF: ${getErrorMessage(employeeEmailError, 'The email could not be sent.')}` : ''
        ].filter(Boolean);
        throw new Error(`Employee details were saved, but follow-up actions need attention. ${errors.join(' ')}`);
      }
    }, selectedEmployee ? 'Employee profile updated.' : 'Employee profile created.');
    if (actionSucceeded && sentEmployeeEmailPurpose) {
      setNotice(sentEmployeeEmailPurpose === 'welcome'
        ? 'Employee profile created and welcome email with draft contract PDF accepted by the email service.'
        : sentEmployeeEmailPurpose === 'contract'
          ? 'Employee profile saved and first draft contract PDF accepted by the email service.'
          : 'Employee terms updated and revised draft contract PDF accepted by the email service.');
    }
  };

  const addHrOption = (category: HrOptionCategory, label: string) => runAction(async () => {
    const client = supabase;
    if (!client || !currentProfileId) throw new Error('Your HR admin session is unavailable.');
    const sortOrder = Math.max(0, ...hrOptions.filter((option) => option.category === category).map((option) => option.sort_order)) + 10;
    const { error: insertError } = await client.from('hr_option_catalog').insert({
      category,
      label,
      sort_order: sortOrder,
      created_by: currentProfileId,
      updated_by: currentProfileId,
      updated_at: new Date().toISOString()
    });
    if (insertError) throw insertError;
  }, `${category === 'department' ? 'Department' : 'Job title'} added.`);

  const updateHrOption = (option: HrOption, label: string) => runAction(async () => {
    const client = supabase;
    if (!client || !currentProfileId) throw new Error('Your HR admin session is unavailable.');
    const { data, error: updateError } = await client
      .from('hr_option_catalog')
      .update({ label, updated_by: currentProfileId, updated_at: new Date().toISOString() })
      .eq('id', option.id)
      .select('id')
      .single();
    if (updateError) throw updateError;
    if (!data) throw new Error('The dropdown option could not be updated.');
  }, 'Dropdown option updated.');

  const toggleHrOption = (option: HrOption) => runAction(async () => {
    const client = supabase;
    if (!client || !currentProfileId) throw new Error('Your HR admin session is unavailable.');
    const { data, error: updateError } = await client
      .from('hr_option_catalog')
      .update({
        is_active: !option.is_active,
        updated_by: currentProfileId,
        updated_at: new Date().toISOString()
      })
      .eq('id', option.id)
      .select('id')
      .single();
    if (updateError) throw updateError;
    if (!data) throw new Error('The dropdown option status could not be updated.');
  }, option.is_active ? 'Dropdown option deactivated.' : 'Dropdown option reactivated.');

  const submitTask = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !visibleEmployee || !currentProfileId || !taskTitle.trim()) return;
    await runAction(async () => {
      const { error: insertError } = await client.from('hr_onboarding_tasks').insert({
        employee_id: visibleEmployee.id,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        due_date: taskDueDate || null,
        created_by: currentProfileId
      });
      if (insertError) throw insertError;
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
    }, 'Onboarding task added.');
  };

  const completeTask = (taskId: string) => runAction(async () => {
    const client = supabase;
    if (!client) throw new Error('HR service is unavailable.');
    const { error: rpcError } = await client.rpc('hr_complete_onboarding_task', { p_task_id: taskId });
    if (rpcError) throw rpcError;
  }, 'Onboarding task marked complete.');

  const updateClock = () => runAction(async () => {
    const client = supabase;
    if (!client) throw new Error('HR service is unavailable.');
    const { error: rpcError } = await client.rpc(activeClock ? 'hr_clock_out' : 'hr_clock_in');
    if (rpcError) throw rpcError;
  }, activeClock ? 'You are clocked out.' : 'You are clocked in.');

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !adjustmentEmployee || !adjustmentReason.trim()) {
      setError('Choose an hourly employee and enter an adjustment reason.');
      return;
    }

    const params = {
      p_employee_id: adjustmentEmployee.id,
      p_adjustment_type: adjustmentType,
      p_reason: adjustmentReason.trim(),
      p_amount: null as number | null,
      p_attendance_record_id: null as string | null,
      p_clocked_in_at: null as string | null,
      p_clocked_out_at: null as string | null
    };
    if (adjustmentType === 'pay') {
      const amount = Number(adjustmentAmount);
      if (!Number.isFinite(amount) || amount === 0) {
        setError('Enter a non-zero pay adjustment. Use a positive amount for an addition and a negative amount for a deduction.');
        return;
      }
      params.p_amount = amount;
    } else {
      const clockIn = new Date(adjustmentClockIn);
      const clockOut = new Date(adjustmentClockOut);
      if (!adjustmentAttendance || Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())
        || clockOut <= clockIn) {
        setError('Choose a completed time entry and valid corrected clock-in and clock-out times.');
        return;
      }
      params.p_attendance_record_id = adjustmentAttendance.id;
      params.p_clocked_in_at = clockIn.toISOString();
      params.p_clocked_out_at = clockOut.toISOString();
    }

    const didSave = await runAction(async () => {
      const { error: rpcError } = await client.rpc('hr_record_adjustment', params);
      if (rpcError) throw rpcError;
      setAdjustmentAmount('');
      setAdjustmentReason('');
    }, adjustmentType === 'time' ? 'Time correction saved to the adjustment history.' : 'Pay adjustment added to the adjustment history.');
    if (didSave) await loadTeamReport();
  };

  const submitLeave = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !visibleEmployee) return;
    const days = Number(leaveDays);
    if (!leaveStart || !leaveEnd || leaveEnd < leaveStart || !Number.isFinite(days) || days <= 0) {
      setError('Choose a valid date range and enter a positive number of working days.');
      return;
    }
    await runAction(async () => {
      const { error: insertError } = await client.from('hr_leave_requests').insert({
        employee_id: visibleEmployee.id,
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        requested_days: days,
        reason: leaveReason.trim(),
        status: 'pending'
      });
      if (insertError) throw insertError;
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveDays('1');
      setLeaveReason('');
    }, 'Leave request submitted for review.');
  };

  const decideLeave = (requestId: string, status: Exclude<LeaveStatus, 'pending'>) => runAction(async () => {
    const client = supabase;
    if (!client || !currentProfileId) throw new Error('Your HR admin session is unavailable.');
    const { error: updateError } = await client
      .from('hr_leave_requests')
      .update({ status, decided_by: currentProfileId, decided_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending');
    if (updateError) throw updateError;
  }, `Leave request ${status}.`);

  const submitPayroll = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !visibleEmployee || !currentProfileId) return;
    const amount = Number(payAmount);
    if (!payPeriodStart || !payPeriodEnd || payPeriodEnd < payPeriodStart
      || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(payCurrency)) {
      setError('Enter a valid pay period, non-negative amount, and three-letter currency code.');
      return;
    }
    await runAction(async () => {
      const { error: insertError } = await client.from('hr_payroll_records').insert({
        employee_id: visibleEmployee.id,
        period_start: payPeriodStart,
        period_end: payPeriodEnd,
        gross_amount: amount,
        currency: payCurrency,
        status: 'planned',
        notes: payNotes.trim(),
        created_by: currentProfileId
      });
      if (insertError) throw insertError;
      setPayAmount('');
      setPayNotes('');
    }, 'Payroll tracking record created. No payment was sent.');
  };

  const updatePayrollStatus = (recordId: string, status: Exclude<PayrollStatus, 'planned'>) => runAction(async () => {
    const client = supabase;
    if (!client) throw new Error('HR service is unavailable.');
    const { error: updateError } = await client
      .from('hr_payroll_records')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', recordId);
    if (updateError) throw updateError;
  }, status === 'paid' ? 'Payroll record marked as paid.' : 'Payroll record voided.');

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !visibleEmployee || !currentProfileId) return;
    if (!reviewStart || !reviewEnd || reviewEnd < reviewStart || !reviewSummary.trim()) {
      setError('Enter a valid review period and summary.');
      return;
    }
    await runAction(async () => {
      const { error: insertError } = await client.from('hr_performance_reviews').insert({
        employee_id: visibleEmployee.id,
        period_start: reviewStart,
        period_end: reviewEnd,
        rating: Number(reviewRating),
        summary: reviewSummary.trim(),
        strengths: reviewStrengths.trim(),
        growth_goals: reviewGoals.trim(),
        created_by: currentProfileId
      });
      if (insertError) throw insertError;
      setReviewSummary('');
      setReviewStrengths('');
      setReviewGoals('');
    }, 'Performance review saved and shared with the employee.');
  };

  const employeeProfileLabel = (employee: HrEmployee) => {
    const profile = profiles.find((item) => item.id === employee.profile_id);
    return profile?.name || profile?.email || `Employee ${employee.profile_id.slice(0, 8)}`;
  };

  const summaryTiles = useMemo(() => [
    { label: 'Onboarding', value: `${completedTasks}/${tasks.length}`, icon: CheckCircle2 },
    { label: 'Pending leave', value: String(pendingLeaveCount), icon: CalendarDays },
    { label: 'Payroll records', value: String(payroll.length), icon: Wallet },
    { label: 'Reviews', value: String(reviews.length), icon: Star }
  ], [completedTasks, tasks.length, pendingLeaveCount, payroll.length, reviews.length]);

  if (!isHrAdmin && !isOrganizationEmployee) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Users className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">Employee HR</h1>
        <p className="mt-2 text-sm text-slate-600">This account has not been linked to an employee profile. Contact a Super Admin for access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">People & Culture</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{isHrAdmin ? 'HR Management' : 'Employee HR'}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isHrAdmin
              ? 'Manage employee records, hourly reports, attendance, adjustments, leave, payroll history, and reviews.'
              : 'View your onboarding, record your working time, request leave, and review your HR records.'}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void refreshEmployeeRecords().catch((refreshError: unknown) => setError(refreshError instanceof Error ? refreshError.message : 'Refresh failed.'))}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {isHrAdmin && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
            <Card
            title="Employee directory"
            action={<button type="button" className={secondaryButtonClass} onClick={() => {
              setSelectedEmployeeId('');
              setProfileId('');
              setJobTitle('');
              setDepartment('');
              setEmploymentType('full_time');
              setEmploymentStatus('active');
              setHireDate(new Date().toISOString().slice(0, 10));
              setCompensationType('salary');
              setCompensationRate('0');
              setCompensationCurrency('USD');
              setPayFrequency('monthly');
            }}><Plus className="h-4 w-4" /> Add employee</button>}
          >
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading employee records…</p>
            ) : employees.length === 0 ? (
              <EmptyState message="No employee profiles yet. Link an existing account below to start its HR onboarding." />
            ) : (
              <div className="space-y-2">
                {employees.map((employee) => (
                  <button
                    type="button"
                    key={employee.id}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      employee.id === selectedEmployeeId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{employeeProfileLabel(employee)}</span>
                      <span className="block text-xs text-slate-500">{employee.job_title}{employee.department ? ` · ${employee.department}` : ''}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${statusClass(employee.employment_status)}`}>
                      {employee.employment_status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title={selectedEmployee ? 'Employee profile' : 'Add employee'}>
            {!selectedEmployee && availableProfiles.length === 0 ? (
              <p className="text-sm text-slate-600">
                Create the employee’s Connectfy account first using the standard sign-up flow. It will appear here for HR setup after their first sign-in.
              </p>
            ) : (
              <form onSubmit={saveEmployee} className="space-y-3">
                {!selectedEmployee && (
                  <label className="block text-xs font-semibold text-slate-700">
                    Existing Connectfy account
                    <AccountPicker profiles={availableProfiles} value={profileId} onChange={setProfileId} />
                  </label>
                )}
                {selectedEmployee && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{selectedProfile?.name || selectedProfile?.email || 'Employee account'}</p>
                    <p className="text-xs text-slate-500">{selectedProfile?.email}</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">Job title
                    <select className={`${inputClass} mt-1`} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required>
                      <option value="">Choose a job title</option>
                      {jobTitleOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Department
                    <select className={`${inputClass} mt-1`} value={department} onChange={(event) => setDepartment(event.target.value)}>
                      <option value="">No department</option>
                      {departmentOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Super Admin, Project Manager, Reviewer, and Project Reviewer titles promote this account into its matching operations workspace. A Super Admin can later restore the account’s original Tester or Client role by changing the title to one without platform access. Newly assigned Super Admin access requires confirmation.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">Employment type
                    <select className={`${inputClass} mt-1`} value={employmentType} onChange={(event) => setEmploymentType(event.target.value as HrEmployee['employment_type'])}>
                      <option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="intern">Intern</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Status
                    <select className={`${inputClass} mt-1`} value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value as EmployeeStatus)}>
                      <option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Hire date<input className={`${inputClass} mt-1`} type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} required /></label>
                  <label className="text-xs font-semibold text-slate-700">Compensation type
                    <select className={`${inputClass} mt-1`} value={compensationType} onChange={(event) => setCompensationType(event.target.value as HrEmployee['compensation_type'])}>
                      <option value="salary">Salary</option><option value="hourly">Hourly</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Rate / amount<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={compensationRate} onChange={(event) => setCompensationRate(event.target.value)} /></label>
                  <label className="text-xs font-semibold text-slate-700">Currency<input className={`${inputClass} mt-1 uppercase`} maxLength={3} value={compensationCurrency} onChange={(event) => setCompensationCurrency(event.target.value.toUpperCase())} /></label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Pay frequency
                    <select className={`${inputClass} mt-1`} value={payFrequency} onChange={(event) => setPayFrequency(event.target.value as HrEmployee['pay_frequency'])}>
                      <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option>
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">Compensation is visible only to Super Admins and this employee. HR records do not send money.</p>
                <button className={buttonClass} type="submit" disabled={isSaving}>
                  <UserRound className="h-4 w-4" /> {selectedEmployee ? 'Save employee profile' : 'Add employee'}
                </button>
              </form>
            )}
            </Card>
          </div>
          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-900">
              Manage department and job title options
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Advanced setup — expand only when you need to change the choices used in employee profiles.
              </span>
            </summary>
            <div className="mt-4">
              <HrOptionManager
                options={hrOptions}
                isSaving={isSaving}
                onAdd={addHrOption}
                onUpdate={updateHrOption}
                onToggle={toggleHrOption}
              />
            </div>
          </details>
        </div>
      )}

      {!isHrAdmin && !visibleEmployee && !isLoading && (
        <EmptyState message="Your employee record has not finished loading. Refresh this page or contact a Super Admin." />
      )}

      {visibleEmployee && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="font-bold text-slate-900">{visibleProfile?.name || currentName}</p>
              <p className="text-xs text-slate-500">{visibleEmployee.job_title}{visibleEmployee.department ? ` · ${visibleEmployee.department}` : ''}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(visibleEmployee.employment_status)}`}>
              {visibleEmployee.employment_status.replace('_', ' ')}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.filter(({ id }) => id !== 'reports' || isHrAdmin).map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                  activeTab === id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryTiles.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{label}</span><Icon className="h-4 w-4 text-blue-600" /></div>
                    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Employment">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-1 font-semibold capitalize">{visibleEmployee.employment_type.replace('_', ' ')}</dd></div>
                    <div><dt className="text-xs text-slate-500">Hire date</dt><dd className="mt-1 font-semibold">{toDateLabel(visibleEmployee.hire_date)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Compensation</dt><dd className="mt-1 font-semibold">{formatMoney(visibleEmployee.compensation_rate, visibleEmployee.compensation_currency)} {visibleEmployee.compensation_type === 'hourly' ? '/ hour' : `· ${visibleEmployee.pay_frequency}`}</dd></div>
                    <div><dt className="text-xs text-slate-500">Pay frequency</dt><dd className="mt-1 font-semibold capitalize">{visibleEmployee.pay_frequency}</dd></div>
                  </dl>
                </Card>
                <Card title="Recent HR activity">
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between gap-3"><span>Open onboarding tasks</span><strong>{tasks.filter((task) => task.status === 'pending').length}</strong></li>
                    <li className="flex justify-between gap-3"><span>Pending leave requests</span><strong>{pendingLeaveCount}</strong></li>
                    <li className="flex justify-between gap-3"><span>Latest attendance</span><strong>{attendance[0] ? toDateLabel(attendance[0].clocked_in_at) : 'None yet'}</strong></li>
                    <li className="flex justify-between gap-3"><span>Latest payroll record</span><strong>{payroll[0] ? formatMoney(payroll[0].gross_amount, payroll[0].currency) : 'None yet'}</strong></li>
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'onboarding' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
              <Card title="Onboarding checklist">
                {tasks.length === 0 ? <EmptyState message="No onboarding tasks have been assigned." /> : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900">{task.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusClass(task.status)}`}>{task.status}</span>
                            {task.is_required && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Required</span>}
                          </div>
                          {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
                          <p className="mt-1 text-xs text-slate-500">Due: {toDateLabel(task.due_date)}</p>
                        </div>
                        {!isHrAdmin && task.status === 'pending' && (
                          <button type="button" className={secondaryButtonClass} disabled={isSaving} onClick={() => void completeTask(task.id)}>
                            <Check className="h-4 w-4" /> Mark complete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {isHrAdmin && (
                <Card title="Assign onboarding task">
                  <form onSubmit={submitTask} className="space-y-3">
                    <label className="block text-xs font-semibold">Task title<input className={`${inputClass} mt-1`} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required /></label>
                    <label className="block text-xs font-semibold">Instructions<textarea className={`${inputClass} mt-1`} rows={3} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} /></label>
                    <label className="block text-xs font-semibold">Due date<input className={`${inputClass} mt-1`} type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label>
                    <button type="submit" className={buttonClass} disabled={isSaving}><Plus className="h-4 w-4" /> Add task</button>
                  </form>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              {!isHrAdmin && (
                <Card title="Time clock">
                  <p className="mb-4 text-sm text-slate-600">Clock in when you start work and clock out when you finish. Each action is timestamped by the server.</p>
                  {activeClock && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Clocked in at {toDateTimeLabel(activeClock.clocked_in_at)}</p>}
                  <button type="button" className={buttonClass} disabled={isSaving || visibleEmployee.employment_status !== 'active'} onClick={() => void updateClock()}>
                    <Clock3 className="h-4 w-4" /> {activeClock ? 'Clock out' : 'Clock in'}
                  </button>
                  {visibleEmployee.employment_status !== 'active' && <p className="mt-3 text-xs text-amber-700">Time clock access is available only for active employee records.</p>}
                </Card>
              )}
              <Card title="Attendance history" className={isHrAdmin ? 'lg:col-span-2' : ''}>
                {attendance.length === 0 ? <EmptyState message="No time entries have been recorded." /> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-4">Clock in</th><th className="py-2 pr-4">Clock out</th><th className="py-2">Duration</th></tr></thead>
                      <tbody>{attendance.map((record) => {
                        const hours = record.clocked_out_at
                          ? Math.max(0, (new Date(record.clocked_out_at).getTime() - new Date(record.clocked_in_at).getTime()) / 3600000)
                          : null;
                        return <tr key={record.id} className="border-b border-slate-100"><td className="py-3 pr-4">{toDateTimeLabel(record.clocked_in_at)}</td><td className="py-3 pr-4">{toDateTimeLabel(record.clocked_out_at)}</td><td className="py-3">{hours === null ? 'In progress' : `${hours.toFixed(2)} hours`}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'reports' && isHrAdmin && (
            <div className="space-y-5">
              {(() => {
                const totalHours = reportRows.reduce((total, row) => total + row.hours, 0);
                const loggedEntries = reportRows.reduce((total, row) => total + row.sessions.length, 0);
                const adjustmentRows = reportRows.flatMap((row) =>
                  row.adjustments.map((adjustment) => ({ employee: row.employee, adjustment }))
                );
                return (
                  <>
                    <p className="text-sm text-slate-600">
                      {reportRange === 'current_pay_period'
                        ? 'Reports cover each hourly employee’s current pay period. Weekly and biweekly periods follow the employee’s hire-date cycle; monthly periods follow the calendar month.'
                        : reportRange === 'last_30_days'
                          ? 'Reports cover the last 30 days, through now.'
                          : 'Reports cover the current calendar month, through now.'}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: 'Hourly team members', value: hourlyEmployees.length.toString() },
                        { label: 'Hours in selected range', value: `${totalHours.toFixed(2)} hrs` },
                        { label: 'Logged sessions', value: loggedEntries.toString() },
                        { label: 'All adjustments', value: adjustmentRows.length.toString() }
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                          <p className="mt-2 text-2xl font-black text-slate-900">{metric.value}</p>
                        </div>
                      ))}
                    </div>

                    <Card title="Hourly team summary" action={
                      <div className="flex flex-wrap items-center gap-2">
                        <select className={`${inputClass} w-auto`} value={reportRange} onChange={(event) => setReportRange(event.target.value as HrReportRange)}>
                          <option value="current_pay_period">Current pay period</option>
                          <option value="last_30_days">Last 30 days</option>
                          <option value="current_month">Current month</option>
                        </select>
                        <button type="button" className={secondaryButtonClass} disabled={isReportLoading} onClick={() => void loadTeamReport()}>
                          <RefreshCw className={`h-4 w-4 ${isReportLoading ? 'animate-spin' : ''}`} /> Refresh report
                        </button>
                      </div>
                    }>
                      {isReportLoading ? (
                        <p className="text-sm text-slate-500">Loading hourly reports…</p>
                      ) : reportRows.length === 0 ? (
                        <EmptyState message="No employees are currently configured for hourly compensation." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead><tr className="border-b text-xs uppercase text-slate-500">
                              <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Report period</th><th className="py-2 pr-4">Hours</th><th className="py-2 pr-4">Hourly rate</th><th className="py-2 pr-4">Pay adjustments</th><th className="py-2">Status</th>
                            </tr></thead>
                            <tbody>{reportRows.map(({ employee, period, hours, payAdjustments }) => {
                              const profile = profiles.find((item) => item.id === employee.profile_id);
                              const periodStartLabel = toDateOnlyLabel(new Date(period.start).toISOString().slice(0, 10));
                              const periodEndLabel = toDateOnlyLabel(new Date(period.endExclusive - 1).toISOString().slice(0, 10));
                              return (
                                <tr key={employee.id} className="border-b border-slate-100">
                                  <td className="py-3 pr-4"><span className="block font-semibold text-slate-900">{profile?.name || profile?.email || 'Employee'}</span><span className="text-xs text-slate-500">{employee.job_title}{employee.department ? ` · ${employee.department}` : ''}</span></td>
                                  <td className="py-3 pr-4 whitespace-nowrap">{periodStartLabel} – {periodEndLabel}</td>
                                  <td className="py-3 pr-4 font-semibold">{hours.toFixed(2)}</td>
                                  <td className="py-3 pr-4 whitespace-nowrap">{formatMoney(employee.compensation_rate, employee.compensation_currency)}/hr</td>
                                  <td className="py-3 pr-4 whitespace-nowrap">{formatMoney(payAdjustments, employee.compensation_currency)}</td>
                                  <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${statusClass(employee.employment_status)}`}>{employee.employment_status.replace('_', ' ')}</span></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    <Card title="Time entries in selected range">
                      {reportSessionRows.length === 0 ? <EmptyState message="No time entries have been recorded in the selected range." /> : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Clock in</th><th className="py-2 pr-4">Clock out</th><th className="py-2">Duration in period</th></tr></thead>
                            <tbody>{reportSessionRows.map(({ employee, period, record }) => {
                              const profile = profiles.find((item) => item.id === employee.profile_id);
                              const clockIn = Math.max(Date.parse(record.clocked_in_at), period.start);
                              const clockOut = Math.min(
                                record.clocked_out_at ? Date.parse(record.clocked_out_at) : Date.now(),
                                period.endExclusive,
                                Date.now()
                              );
                              const duration = Math.max(0, clockOut - clockIn) / 3600000;
                              return <tr key={record.id} className="border-b border-slate-100"><td className="py-3 pr-4">{profile?.name || profile?.email || 'Employee'}</td><td className="py-3 pr-4 whitespace-nowrap">{toDateTimeLabel(record.clocked_in_at)}</td><td className="py-3 pr-4 whitespace-nowrap">{toDateTimeLabel(record.clocked_out_at)}</td><td className="py-3">{record.clocked_out_at ? `${duration.toFixed(2)} hours` : `${duration.toFixed(2)} hours · in progress`}</td></tr>;
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    <Card title="Adjustments in selected range">
                      {adjustmentRows.length === 0 ? <EmptyState message="No time or pay adjustments have been recorded in the selected range." /> : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Change</th><th className="py-2 pr-4">Reason</th><th className="py-2">Recorded by</th></tr></thead>
                            <tbody>{adjustmentRows.map(({ employee, adjustment }) => {
                              const profile = profiles.find((item) => item.id === employee.profile_id);
                              const actor = profiles.find((item) => item.id === adjustment.created_by);
                              const change = adjustment.adjustment_type === 'pay'
                                ? formatMoney(Number(adjustment.amount) || 0, adjustment.currency || employee.compensation_currency)
                                : `${toDateTimeLabel(adjustment.previous_clocked_in_at)} – ${toDateTimeLabel(adjustment.previous_clocked_out_at)} → ${toDateTimeLabel(adjustment.new_clocked_in_at)} – ${toDateTimeLabel(adjustment.new_clocked_out_at)}`;
                              return <tr key={adjustment.id} className="border-b border-slate-100"><td className="py-3 pr-4 whitespace-nowrap">{toDateTimeLabel(adjustment.created_at)}</td><td className="py-3 pr-4">{profile?.name || profile?.email || 'Employee'}</td><td className="py-3 pr-4 capitalize">{adjustment.adjustment_type === 'time' ? 'Time correction' : 'Pay'}</td><td className="py-3 pr-4">{change}</td><td className="py-3 pr-4">{adjustment.reason}</td><td className="py-3">{actor?.name || actor?.email || 'Super Admin'}</td></tr>;
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    <Card title="Record an adjustment">
                      <form onSubmit={submitAdjustment} className="grid gap-3 md:grid-cols-2">
                        <label className="block text-xs font-semibold text-slate-700">Hourly employee
                          <select className={`${inputClass} mt-1`} value={adjustmentEmployeeId} onChange={(event) => setAdjustmentEmployeeId(event.target.value)} required>
                            <option value="">Choose an employee</option>
                            {hourlyEmployees.map((employee) => {
                              const profile = profiles.find((item) => item.id === employee.profile_id);
                              return <option key={employee.id} value={employee.id}>{profile?.name || profile?.email || employee.job_title}</option>;
                            })}
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">Adjustment type
                          <select className={`${inputClass} mt-1`} value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as 'time' | 'pay')}>
                            <option value="time">Correct a time entry</option><option value="pay">Add a pay adjustment</option>
                          </select>
                        </label>
                        {adjustmentType === 'time' ? (
                          <>
                            <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Completed time entry
                              <select className={`${inputClass} mt-1`} value={adjustmentAttendanceId} onChange={(event) => setAdjustmentAttendanceId(event.target.value)} required>
                                <option value="">Choose a time entry</option>
                                {adjustmentSessions.map((record) => <option key={record.id} value={record.id}>{toDateTimeLabel(record.clocked_in_at)} – {toDateTimeLabel(record.clocked_out_at)}</option>)}
                              </select>
                            </label>
                            <label className="block text-xs font-semibold text-slate-700">Corrected clock-in
                              <input className={`${inputClass} mt-1`} type="datetime-local" value={adjustmentClockIn} onChange={(event) => setAdjustmentClockIn(event.target.value)} required />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700">Corrected clock-out
                              <input className={`${inputClass} mt-1`} type="datetime-local" value={adjustmentClockOut} onChange={(event) => setAdjustmentClockOut(event.target.value)} required />
                            </label>
                            {adjustmentSessions.length === 0 && <p className="text-xs text-amber-700 md:col-span-2">No completed time entries are available to correct in this report range.</p>}
                          </>
                        ) : (
                          <label className="block text-xs font-semibold text-slate-700">Pay adjustment ({adjustmentEmployee?.compensation_currency || 'USD'})
                            <input className={`${inputClass} mt-1`} type="number" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="Positive addition or negative deduction" required />
                            <span className="mt-1 block font-normal text-slate-500">Use a positive amount for an addition and a negative amount for a deduction. Tracking only; this does not send payment.</span>
                          </label>
                        )}
                        <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Reason
                          <textarea className={`${inputClass} mt-1`} rows={2} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} required />
                        </label>
                        <div className="md:col-span-2"><button type="submit" className={buttonClass} disabled={isSaving || !adjustmentEmployee || (adjustmentType === 'time' && !adjustmentAttendance)}><Plus className="h-4 w-4" /> Record adjustment</button></div>
                      </form>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              {!isHrAdmin && (
                <Card title="Request leave">
                  <form onSubmit={submitLeave} className="space-y-3">
                    <label className="block text-xs font-semibold">Leave type
                      <select className={`${inputClass} mt-1`} value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
                        <option value="annual">Annual</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="unpaid">Unpaid</option><option value="other">Other</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs font-semibold">Start date<input className={`${inputClass} mt-1`} type="date" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} required /></label>
                      <label className="text-xs font-semibold">End date<input className={`${inputClass} mt-1`} type="date" value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} required /></label>
                    </div>
                    <label className="block text-xs font-semibold">Working days requested<input className={`${inputClass} mt-1`} type="number" min="0.5" step="0.5" value={leaveDays} onChange={(event) => setLeaveDays(event.target.value)} required /></label>
                    <label className="block text-xs font-semibold">Reason<textarea className={`${inputClass} mt-1`} rows={3} value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} /></label>
                    <button type="submit" className={buttonClass} disabled={isSaving}><Plus className="h-4 w-4" /> Submit request</button>
                  </form>
                </Card>
              )}
              <Card title={isHrAdmin ? 'Leave requests' : 'My leave requests'} className={isHrAdmin ? 'lg:col-span-2' : ''}>
                {leaveRequests.length === 0 ? <EmptyState message="No leave requests have been submitted." /> : (
                  <div className="space-y-3">
                    {leaveRequests.map((request) => (
                      <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold capitalize text-slate-900">{request.leave_type} leave · {request.requested_days} working days</p>
                            <p className="mt-1 text-sm text-slate-600">{toDateLabel(request.start_date)} – {toDateLabel(request.end_date)}</p>
                            {request.reason && <p className="mt-2 text-sm text-slate-600">{request.reason}</p>}
                            {request.review_note && <p className="mt-2 text-xs text-slate-500">HR note: {request.review_note}</p>}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                        </div>
                        {isHrAdmin && request.status === 'pending' && (
                          <div className="mt-3 flex gap-2">
                            <button type="button" className={buttonClass} disabled={isSaving} onClick={() => void decideLeave(request.id, 'approved')}><Check className="h-4 w-4" /> Approve</button>
                            <button type="button" className={secondaryButtonClass} disabled={isSaving} onClick={() => void decideLeave(request.id, 'declined')}>Decline</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Payroll here is record-keeping only. Creating or marking a record paid does not send money or call M-Pesa/PayPal.
              </div>
              {isHrAdmin && (
                <Card title="Add payroll record">
                  <form onSubmit={submitPayroll} className="grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-semibold">Period start<input className={`${inputClass} mt-1`} type="date" value={payPeriodStart} onChange={(event) => setPayPeriodStart(event.target.value)} required /></label>
                    <label className="text-xs font-semibold">Period end<input className={`${inputClass} mt-1`} type="date" value={payPeriodEnd} onChange={(event) => setPayPeriodEnd(event.target.value)} required /></label>
                    <label className="text-xs font-semibold">Gross amount<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} required /></label>
                    <label className="text-xs font-semibold">Currency<input className={`${inputClass} mt-1 uppercase`} maxLength={3} value={payCurrency} onChange={(event) => setPayCurrency(event.target.value.toUpperCase())} required /></label>
                    <label className="text-xs font-semibold md:col-span-2">Notes<input className={`${inputClass} mt-1`} value={payNotes} onChange={(event) => setPayNotes(event.target.value)} /></label>
                    <div className="md:col-span-3"><button type="submit" className={buttonClass} disabled={isSaving}><Plus className="h-4 w-4" /> Add record</button></div>
                  </form>
                </Card>
              )}
              <Card title={isHrAdmin ? 'Payroll history' : 'My payroll history'}>
                {payroll.length === 0 ? <EmptyState message="No payroll tracking records yet." /> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-4">Pay period</th><th className="py-2 pr-4">Gross amount</th><th className="py-2 pr-4">Status</th><th className="py-2">Paid date / action</th></tr></thead>
                      <tbody>{payroll.map((record) => (
                        <tr key={record.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4">{toDateLabel(record.period_start)} – {toDateLabel(record.period_end)}{record.notes && <span className="mt-1 block text-xs text-slate-500">{record.notes}</span>}</td>
                          <td className="py-3 pr-4 font-semibold">{formatMoney(record.gross_amount, record.currency)}</td>
                          <td className="py-3 pr-4"><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusClass(record.status)}`}>{record.status}</span></td>
                          <td className="py-3">
                            {record.status === 'paid'
                              ? toDateTimeLabel(record.paid_at)
                              : isHrAdmin && record.status === 'planned'
                                ? <div className="flex flex-wrap gap-2">
                                  <button className={secondaryButtonClass} type="button" disabled={isSaving} onClick={() => void updatePayrollStatus(record.id, 'paid')}>Mark recorded as paid</button>
                                  <button className={secondaryButtonClass} type="button" disabled={isSaving} onClick={() => void updatePayrollStatus(record.id, 'void')}>Void</button>
                                </div>
                                : '—'}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              {isHrAdmin && (
                <Card title="Write performance review">
                  <form onSubmit={submitReview} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs font-semibold">Period start<input className={`${inputClass} mt-1`} type="date" value={reviewStart} onChange={(event) => setReviewStart(event.target.value)} required /></label>
                      <label className="text-xs font-semibold">Period end<input className={`${inputClass} mt-1`} type="date" value={reviewEnd} onChange={(event) => setReviewEnd(event.target.value)} required /></label>
                    </div>
                    <label className="block text-xs font-semibold">Rating
                      <select className={`${inputClass} mt-1`} value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select>
                    </label>
                    <label className="block text-xs font-semibold">Summary<textarea className={`${inputClass} mt-1`} rows={3} value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} required /></label>
                    <label className="block text-xs font-semibold">Strengths<textarea className={`${inputClass} mt-1`} rows={2} value={reviewStrengths} onChange={(event) => setReviewStrengths(event.target.value)} /></label>
                    <label className="block text-xs font-semibold">Growth goals<textarea className={`${inputClass} mt-1`} rows={2} value={reviewGoals} onChange={(event) => setReviewGoals(event.target.value)} /></label>
                    <button type="submit" className={buttonClass} disabled={isSaving}><Plus className="h-4 w-4" /> Save review</button>
                  </form>
                </Card>
              )}
              <Card title={isHrAdmin ? 'Performance history' : 'My performance reviews'} className={isHrAdmin ? '' : 'lg:col-span-2'}>
                {reviews.length === 0 ? <EmptyState message="No performance reviews have been shared." /> : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <article key={review.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-slate-900">{toDateLabel(review.period_start)} – {toDateLabel(review.period_end)}</p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"><Star className="h-3.5 w-3.5" /> {review.rating}/5</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{review.summary}</p>
                        {review.strengths && <p className="mt-3 text-sm"><strong>Strengths:</strong> {review.strengths}</p>}
                        {review.growth_goals && <p className="mt-2 text-sm"><strong>Growth goals:</strong> {review.growth_goals}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};
