import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  X,
  Building2,
  GraduationCap,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Percent,
  CheckCircle2,
  CalendarCheck,
  FileSpreadsheet
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

export const StudentsUnderMySubjectsModal = ({
  isOpen,
  onClose,
  uniqueStudents = [],
  assignedSubjects = [],
  attendanceRecords = [],
  getStudentsForSubject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const PAGE_SIZE = 6;

  // Escape key handler
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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subjectFilter, semesterFilter, sectionFilter]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSubjectFilter('all');
      setSemesterFilter('all');
      setSectionFilter('all');
      setCurrentPage(1);
      setExpandedStudentId(null);
    }
  }, [isOpen]);

  // Map each unique student with the subjects they are enrolled in under this faculty
  const enrichedStudents = useMemo(() => {
    return uniqueStudents.map((st) => {
      const stId = st._id || st.id;

      // Find subjects this student is enrolled in under authenticated faculty
      const enrolledIn = [];
      assignedSubjects.forEach((sub) => {
        const subId = sub._id || sub.id;
        const subStudents = getStudentsForSubject ? getStudentsForSubject(subId) : [];
        const isEnrolled = subStudents.some((s) => String(s._id || s.id) === String(stId));
        if (isEnrolled) {
          enrolledIn.push(sub);
        }
      });

      // Calculate real attendance records for this student across faculty's subjects
      const facultySubIds = new Set(assignedSubjects.map((s) => String(s._id || s.id)));
      const stRecords = attendanceRecords.filter((r) => {
        const rStId = r.student?._id || r.student?.id || r.student;
        const rSubId = r.subject?._id || r.subject?.id || r.subject;
        return String(rStId) === String(stId) && facultySubIds.has(String(rSubId));
      });

      let present = 0;
      let late = 0;
      let absent = 0;
      stRecords.forEach((r) => {
        const s = r.status?.toLowerCase();
        if (s === 'present') present++;
        else if (s === 'late') late++;
        else if (s === 'absent') absent++;
      });

      const totalClasses = stRecords.length;
      const attPercentage = totalClasses > 0 ? Math.round(((present + late * 0.5) / totalClasses) * 100) : null;

      return {
        ...st,
        enrolledSubjects: enrolledIn,
        attendanceStats: {
          totalClasses,
          present,
          late,
          absent,
          percentage: attPercentage
        }
      };
    });
  }, [uniqueStudents, assignedSubjects, attendanceRecords, getStudentsForSubject]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((st) => {
      if (semesterFilter !== 'all' && Number(st.currentSemester) !== Number(semesterFilter)) {
        return false;
      }
      if (sectionFilter !== 'all' && (st.section || 'A').toUpperCase() !== sectionFilter.toUpperCase()) {
        return false;
      }
      if (subjectFilter !== 'all') {
        const hasSub = st.enrolledSubjects.some((s) => String(s._id || s.id) === String(subjectFilter));
        if (!hasSub) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (st.user?.name || st.name || '').toLowerCase();
        const roll = (st.rollNumber || '').toLowerCase();
        const email = (st.user?.email || st.email || '').toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !email.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedStudents, semesterFilter, sectionFilter, subjectFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-students-title">
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
                <Users className="w-5 h-5 text-purple-200" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 id="modal-students-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Students Under My Subjects
                  </h2>
                  <Badge variant="purple" size="xs" className="bg-white/20 text-white border-white/20">
                    {uniqueStudents.length} Unique Enrolled
                  </Badge>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Verified unique student cohorts enrolled across your assigned curriculum subjects and class sections
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center gap-3 flex-wrap flex-shrink-0">
            {/* Search by Name or Roll Number */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or roll number..."
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

            {/* Filter by Subject */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500 font-medium">Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer max-w-[160px] truncate"
              >
                <option value="all">All Assigned Subjects</option>
                {assignedSubjects.map((sub) => (
                  <option key={sub._id || sub.id} value={sub._id || sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Semester */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500 font-medium">Sem:</span>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
              >
                <option value="all">All</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>Sem {sem}</option>
                ))}
              </select>
            </div>

            {/* Filter by Section */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500 font-medium">Sec:</span>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="A">Sec A</option>
                <option value="B">Sec B</option>
                <option value="C">Sec C</option>
              </select>
            </div>

            {(searchQuery || subjectFilter !== 'all' || semesterFilter !== 'all' || sectionFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSubjectFilter('all');
                  setSemesterFilter('all');
                  setSectionFilter('all');
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold cursor-pointer underline ml-auto"
              >
                Reset
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h4 className="text-sm font-semibold text-slate-700">
                  {uniqueStudents.length === 0
                    ? 'No Students Enrolled'
                    : 'No Students Match Filter'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {uniqueStudents.length === 0
                    ? 'There are currently no active students enrolled in your assigned courses and departments.'
                    : 'Try clearing your search terms or filters to view all enrolled students.'}
                </p>
              </div>
            ) : (
              paginatedStudents.map((st) => {
                const stId = st._id || st.id;
                const isExpanded = expandedStudentId === stId;
                const attPct = st.attendanceStats.percentage;
                const primarySubject = st.enrolledSubjects[0] || assignedSubjects[0];

                return (
                  <div
                    key={stId}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-purple-300 ring-2 ring-purple-500/10 shadow-sm bg-white'
                        : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-purple-50/20'
                    }`}
                  >
                    {/* Student Row */}
                    <div
                      onClick={() => setExpandedStudentId(isExpanded ? null : stId)}
                      className="p-4 sm:p-4.5 cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                        {/* Student Avatar Initials */}
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-purple-200">
                          {(st.user?.name || st.name || 'ST').slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                            <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {st.rollNumber}
                            </span>
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {st.user?.name || st.name}
                            </span>
                            {st.user?.email && (
                              <span className="text-xs text-slate-400 hidden sm:inline">
                                ({st.user.email})
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500">
                            <span className="flex items-center space-x-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{st.department?.name || 'Computer Science & Engineering'}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              <span>Semester {st.currentSemester} &bull; Section {st.section || 'A'}</span>
                            </span>
                            {primarySubject && (
                              <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-100 text-[11px]">
                                {primarySubject.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attendance Percentage Chip & Expand Icon */}
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        {attPct !== null ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center space-x-1 ${
                              attPct >= 75
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : attPct >= 60
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <Percent className="w-3 h-3" />
                            <span>{attPct}% Att.</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 px-2 py-0.5 bg-slate-50 rounded border border-slate-200">
                            No Records
                          </span>
                        )}

                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          aria-label={isExpanded ? 'Collapse details' : 'Expand student details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Authorized Details Panel */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4.5 space-y-3.5 animate-in fade-in duration-150">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase">Roll Number</span>
                            <span className="font-mono font-bold text-slate-900 mt-0.5 block">{st.rollNumber}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase">Official Email</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                              {st.user?.email || 'Authorized portal email'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase">Semester & Sec</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block">
                              Semester {st.currentSemester} (Sec {st.section || 'A'})
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase">Attendance Compliance</span>
                            <span className="font-bold text-purple-700 mt-0.5 block">
                              {attPct !== null ? `${attPct}%` : 'N/A'} ({st.attendanceStats.present}P / {st.attendanceStats.absent}A)
                            </span>
                          </div>
                        </div>

                        {/* Enrolled Subjects List under this Faculty */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                            Enrolled Subjects Under Your Teaching:
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {st.enrolledSubjects.length === 0 ? (
                              <span className="text-xs text-slate-400">Allotted under general department cohort.</span>
                            ) : (
                              st.enrolledSubjects.map((sub) => (
                                <span
                                  key={sub._id || sub.id}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold"
                                >
                                  <span className="font-mono">{sub.code}:</span>
                                  <span>{sub.name}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Pagination */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs text-slate-500">
            <div>
              Showing <strong>{filteredStudents.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * PAGE_SIZE, filteredStudents.length)}</strong> of{' '}
              <strong>{filteredStudents.length}</strong> students
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 px-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentsUnderMySubjectsModal;
