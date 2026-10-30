import React from 'react';
import {
  User,
  GraduationCap,
  Building2,
  Clock,
  BookOpen,
  CalendarCheck,
  Award,
  Mail,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

export const FacultyProfileModal = ({
  isOpen,
  onClose,
  profile,
  user,
  assignedSubjects = [],
  timetableSlots = []
}) => {
  if (!isOpen) return null;

  // Compute workload metrics
  const weeklyHours = timetableSlots.length; // Each slot is 1 lecture hour
  const distinctSemesters = [...new Set(assignedSubjects.map((s) => s.semester))].sort();
  const distinctSections = [...new Set(timetableSlots.map((s) => s.section).filter(Boolean))];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Faculty Profile & Workload Allocation"
      subtitle="Institutional staff credentials, department designation, and teaching timetable load"
      maxWidth="max-w-2xl"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close Profile
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Profile Header Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-bold text-lg">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'F'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white">{user?.name || 'Faculty Member'}</h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold text-purple-100 uppercase tracking-wider">
                  {profile?.designation || 'Assistant Professor'}
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5 font-mono">
                Employee ID: {profile?.employeeId || 'FAC-N/A'} &bull; {user?.email}
              </p>
            </div>
          </div>
          <Badge variant="emerald" size="xs">Active Staff</Badge>
        </div>

        {/* Academic Credentials & Department Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Department
            </span>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900 text-sm">
                {profile?.department?.name || 'Computer Science & Engineering'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
              Code: {profile?.department?.code || 'CSE'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Designation & Title
            </span>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900 text-sm">
                {profile?.designation || 'Assistant Professor'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Tenured Academic Faculty
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Highest Qualification
            </span>
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900 text-sm">
                {profile?.qualification || 'Ph.D. / M.Tech in Computer Science'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Specialization & Research
            </span>
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900 text-sm">
                {profile?.specialization || 'Distributed Algorithms & Systems'}
              </span>
            </div>
          </div>
        </div>

        {/* Workload Allocation Statistics */}
        <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-purple-700" />
              <span>Weekly Teaching Workload & Allocation</span>
            </h4>
            <Badge variant="purple" size="xs">{weeklyHours} Hours / Week</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
              <span className="text-lg font-bold text-purple-950 font-mono block">{assignedSubjects.length}</span>
              <span className="text-[11px] text-slate-500">Assigned Subjects</span>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
              <span className="text-lg font-bold text-purple-950 font-mono block">{weeklyHours}</span>
              <span className="text-[11px] text-slate-500">Weekly Lecture Hours</span>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
              <span className="text-lg font-bold text-purple-950 font-mono block">
                {distinctSemesters.length > 0 ? `Sem ${distinctSemesters.join(', ')}` : 'N/A'}
              </span>
              <span className="text-[11px] text-slate-500">Allocated Classes</span>
            </div>
          </div>
        </div>

        {/* Assigned Subjects Listing */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Curriculum Courses Taught
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
            {assignedSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No assigned subjects found.</p>
            ) : (
              assignedSubjects.map((sub) => (
                <div
                  key={sub._id || sub.id}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900">{sub.name}</span>
                    <span className="text-[11px] text-purple-700 font-mono block mt-0.5">
                      Code: {sub.code} &bull; Semester {sub.semester}
                    </span>
                  </div>
                  <Badge variant="navy" size="xs">{sub.credits} Credits</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FacultyProfileModal;
