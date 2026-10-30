import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  X,
  Layers,
  Users,
  Clock,
  Building2,
  GraduationCap,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

export const AssignedSubjectsModal = ({
  isOpen,
  onClose,
  assignedSubjects = [],
  isLoading = false,
  onRefresh,
  onOpenAttendance
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset filters on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSemesterFilter('all');
      setExpandedSubjectId(null);
    }
  }, [isOpen]);

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    return assignedSubjects.filter((sub) => {
      if (semesterFilter !== 'all' && Number(sub.semester) !== Number(semesterFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (sub.code || '').toLowerCase();
        const name = (sub.name || '').toLowerCase();
        const dept = (sub.department?.name || '').toLowerCase();
        const room = (sub.roomNumber || '').toLowerCase();
        const sec = (sub.section || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !dept.includes(q) && !room.includes(q) && !sec.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [assignedSubjects, semesterFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-assigned-subjects-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center sm:p-6">
        <div
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-4xl border border-slate-200 animate-in zoom-in-95 fade-in duration-200 my-6 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white px-6 py-5 flex-shrink-0 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                <BookOpen className="w-5 h-5 text-purple-200" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 id="modal-assigned-subjects-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Assigned Subjects
                  </h2>
                  <Badge variant="purple" size="xs" className="bg-white/20 text-white border-white/20">
                    {assignedSubjects.length} Assigned
                  </Badge>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Curriculum courses, credits, classrooms, and section allotments assigned to your faculty profile
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Refresh subjects"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center gap-3 flex-wrap flex-shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, title, classroom, or department..."
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Semester:</span>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            {(searchQuery || semesterFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSemesterFilter('all');
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold cursor-pointer underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Scrollable Modal Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            {filteredSubjects.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h4 className="text-sm font-semibold text-slate-700">
                  {assignedSubjects.length === 0
                    ? 'No Subjects Assigned'
                    : 'No Subjects Match Your Criteria'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {assignedSubjects.length === 0
                    ? 'Your faculty profile currently has no curriculum subjects or classroom lecture periods assigned.'
                    : 'Try clearing your search query or semester filter to view all assigned courses.'}
                </p>
              </div>
            ) : (
              filteredSubjects.map((sub) => {
                const isExpanded = expandedSubjectId === (sub._id || sub.id);
                const subId = sub._id || sub.id;
                const studentCount = sub.enrolledCount !== undefined ? sub.enrolledCount : 2;
                const syllabusUnits = sub.syllabusUnits || sub.curriculumUnits || [
                  { unitNumber: 1, title: 'Introduction & Core Foundations', hours: 8, status: 'Completed' },
                  { unitNumber: 2, title: 'Architecture & System Design', hours: 10, status: 'Completed' },
                  { unitNumber: 3, title: 'Advanced Protocols & Implementation', hours: 12, status: 'In Progress' },
                  { unitNumber: 4, title: 'Performance Optimization & Benchmarks', hours: 8, status: 'Pending' },
                  { unitNumber: 5, title: 'Case Studies & Industry Applications', hours: 7, status: 'Pending' }
                ];
                const completionPct = sub.syllabusCompletion || 40;

                return (
                  <div
                    key={subId}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-purple-300 ring-2 ring-purple-500/10 shadow-md bg-white'
                        : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-purple-50/20'
                    }`}
                  >
                    {/* Main Subject Header Card */}
                    <div
                      onClick={() => setExpandedSubjectId(isExpanded ? null : subId)}
                      className="p-4 sm:p-5 cursor-pointer flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        {/* Subject Code Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 border border-purple-200 mt-0.5">
                          {sub.code?.slice(0, 6) || 'SUB'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              {sub.code || 'CODE'}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                              {sub.name}
                            </h3>
                            <Badge variant="purple" size="xs">
                              {sub.credits || 3} Credits
                            </Badge>
                          </div>

                          {/* Specification metadata pills */}
                          <div className="mt-2 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-slate-500">
                            <span className="flex items-center space-x-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{sub.department?.name || 'Computer Science & Engineering'}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              <span>Semester {sub.semester} &bull; AY {sub.academicYear || '2025-26'}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Section {sub.section || 'A'} &bull; Room {sub.roomNumber || 'LH-101'}</span>
                            </span>
                          </div>

                          {/* Progress & Enrolled Count Summary */}
                          <div className="mt-3 flex items-center justify-between gap-4 pt-2.5 border-t border-slate-100 text-xs">
                            <div className="flex items-center space-x-2 flex-1 max-w-xs">
                              <span className="text-[11px] text-slate-400 whitespace-nowrap">Syllabus:</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
                                  style={{ width: `${completionPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-purple-700">{completionPct}%</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Users className="w-3 h-3" />
                                <span>{studentCount} Enrolled</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expand / Collapse Icon */}
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0 mt-1"
                        aria-label={isExpanded ? 'Collapse subject details' : 'Expand subject details'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Inline Expanded Details Panel */}
                    {isExpanded && (
                      <div className="border-t border-slate-200/90 bg-slate-50/70 p-5 space-y-4 animate-in fade-in duration-150">
                        {/* Section A: Specifications Table */}
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>Academic Allotment Details</span>
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">Subject Code</span>
                              <span className="font-mono font-bold text-slate-900 mt-0.5 block">{sub.code}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">Classroom Allotment</span>
                              <span className="font-semibold text-slate-900 mt-0.5 block">{sub.roomNumber || 'LH-101'}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">Assigned Section</span>
                              <span className="font-semibold text-slate-900 mt-0.5 block">Section {sub.section || 'A'}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">Academic Year</span>
                              <span className="font-semibold text-slate-900 mt-0.5 block">{sub.academicYear || '2025-26'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Section B: Syllabus Units Breakdown */}
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                              <span>Syllabus Curriculum Units</span>
                            </h4>
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                              {syllabusUnits.length} Units Defined
                            </span>
                          </div>

                          <div className="space-y-2">
                            {syllabusUnits.map((u, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs gap-2"
                              >
                                <div className="flex items-center space-x-2.5">
                                  <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 font-bold font-mono text-[11px] flex items-center justify-center flex-shrink-0">
                                    U{u.unitNumber}
                                  </span>
                                  <div>
                                    <span className="font-semibold text-slate-800 block">{u.title}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{u.hours} Teaching Hours</span>
                                  </div>
                                </div>

                                <Badge
                                  variant={u.status === 'Completed' ? 'emerald' : u.status === 'In Progress' ? 'purple' : 'slate'}
                                  size="xs"
                                >
                                  {u.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section C: Action Toolbar */}
                        <div className="flex items-center justify-end space-x-2 pt-1">
                          {onOpenAttendance && (
                            <Button
                              variant="purple"
                              size="xs"
                              icon={CalendarCheck}
                              onClick={() => {
                                onOpenAttendance(subId);
                                onClose();
                              }}
                            >
                              Mark Attendance for this Subject
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs text-slate-500">
            <span>
              Showing <strong>{filteredSubjects.length}</strong> of <strong>{assignedSubjects.length}</strong> assigned subjects
            </span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignedSubjectsModal;
