import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Users,
  Clock,
  Layers,
  BarChart2,
  CalendarCheck,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  GraduationCap,
  MapPin,
  ExternalLink,
  ChevronRight,
  FileText,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SyllabusMaterialsSection from './SyllabusMaterialsSection';

export const AssignedCoursesSection = ({
  assignedSubjects = [],
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onOpenDetails,
  materials = [],
  onRefreshMaterials,
  onAddToast,
  onNavigateToAttendance
}) => {
  // Local state
  const [activeSubTab, setActiveSubTab] = useState('cards'); // 'cards' | 'syllabus'
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');

  // Filter logic
  const filteredSubjects = useMemo(() => {
    return assignedSubjects.filter((sub) => {
      // Semester filter
      if (semesterFilter !== 'all' && Number(sub.semester) !== Number(semesterFilter)) {
        return false;
      }
      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const code = (sub.code || '').toLowerCase();
        const name = (sub.name || '').toLowerCase();
        const dept = (sub.department?.name || sub.department?.code || '').toLowerCase();
        const room = (sub.roomNumber || '').toLowerCase();
        const sec = (sub.section || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !dept.includes(q) && !room.includes(q) && !sec.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [assignedSubjects, semesterFilter, searchTerm]);

  // Aggregate metrics
  const totalCredits = useMemo(() => {
    return assignedSubjects.reduce((acc, sub) => acc + (Number(sub.credits) || 3), 0);
  }, [assignedSubjects]);

  const totalEnrolled = useMemo(() => {
    return assignedSubjects.reduce((acc, sub) => acc + (Number(sub.enrolledCount) || 0), 0);
  }, [assignedSubjects]);

  const totalWeeklyLectures = useMemo(() => {
    return assignedSubjects.reduce((acc, sub) => acc + (sub.slots?.length || sub.weeklyLecturesCount || 0), 0);
  }, [assignedSubjects]);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER CARD */}
      <Card
        title="Assigned Courses & Teaching Allocations"
        subtitle="Manage assigned curriculum courses, classroom allotments, enrolled students, and syllabus delivery"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={onRefresh || onRetry}
              icon={RefreshCw}
              isLoading={isLoading}
              title="Refresh Assigned Courses"
            >
              Refresh
            </Button>
          </div>
        }
      >
        {/* Quick Summary Pill Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-purple-50/70 border border-purple-100/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">
                Total Courses
              </span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {assignedSubjects.length}
              </span>
              <span className="text-[10px] text-purple-600 font-medium block">
                Allocated for AY 2025-26
              </span>
            </div>
          </div>

          <div className="bg-teal-50/70 border border-teal-100/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider block">
                Total Credits
              </span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {totalCredits}
              </span>
              <span className="text-[10px] text-teal-600 font-medium block">
                Teaching Workload
              </span>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                Enrolled Students
              </span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {totalEnrolled}
              </span>
              <span className="text-[10px] text-indigo-600 font-medium block">
                Across All Cohorts
              </span>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-100/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                Weekly Periods
              </span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {totalWeeklyLectures}
              </span>
              <span className="text-[10px] text-amber-600 font-medium block">
                Scheduled in Timetable
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Tabs (Cards vs Syllabus/Materials) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5 flex-wrap gap-3">
          <div className="flex items-center space-x-2 bg-slate-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('cards')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'cards'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Course Cards & Allocations ({assignedSubjects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('syllabus')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'syllabus'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Syllabus Tracker & Learning Materials</span>
            </button>
          </div>

          {activeSubTab === 'cards' && (
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredSubjects.length} of {assignedSubjects.length} course{assignedSubjects.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* SUBTAB 2: SYLLABUS & MATERIALS TRACKER */}
        {activeSubTab === 'syllabus' && (
          <SyllabusMaterialsSection
            assignedSubjects={assignedSubjects}
            materials={materials}
            onRefreshMaterials={onRefreshMaterials}
            onOpenSubjectDetails={(sub) => onOpenDetails?.(sub, 'overview')}
            onAddToast={onAddToast}
          />
        )}

        {/* SUBTAB 1: COURSE CARDS & ALLOCATIONS */}
        {activeSubTab === 'cards' && (
          <>
            {/* Search and Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assigned courses by name, code, section, or room..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50 text-slate-800 placeholder-slate-400 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-200"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer min-w-36"
                >
                  <option value="all">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>

                {(searchTerm || semesterFilter !== 'all') && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      setSearchTerm('');
                      setSemesterFilter('all');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* ERROR STATE */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                {onRetry && (
                  <Button variant="secondary" size="xs" onClick={onRetry}>
                    Retry Connection
                  </Button>
                )}
              </div>
            )}

            {/* LOADING SKELETON STATE */}
            {isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-card space-y-4 animate-pulse"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="w-24 h-5 bg-slate-200 rounded-md" />
                        <div className="w-48 h-6 bg-slate-300 rounded-md" />
                        <div className="w-32 h-4 bg-slate-200 rounded-md" />
                      </div>
                      <div className="w-16 h-6 bg-slate-200 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-100">
                      <div className="h-4 bg-slate-200 rounded w-20" />
                      <div className="h-4 bg-slate-200 rounded w-28" />
                      <div className="h-4 bg-slate-200 rounded w-24" />
                      <div className="h-4 bg-slate-200 rounded w-20" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <div className="h-8 bg-slate-200 rounded-lg flex-1" />
                      <div className="h-8 bg-slate-200 rounded-lg flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE (NO ALLOCATIONS IN DB) */}
            {!isLoading && assignedSubjects.length === 0 && (
              <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Assigned Courses Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  There are currently no curriculum subjects or classroom timetable slots assigned to your faculty profile for Academic Year 2025-26.
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  If semester allocations are currently in progress, please contact your department Head of Department (HOD) or the Academic Dean.
                </p>
                <div className="mt-4">
                  <Button variant="secondary" size="sm" onClick={onRefresh || onRetry} icon={RefreshCw}>
                    Check Again
                  </Button>
                </div>
              </div>
            )}

            {/* EMPTY FILTER RESULTS */}
            {!isLoading && assignedSubjects.length > 0 && filteredSubjects.length === 0 && (
              <div className="py-10 px-4 text-center border border-slate-200 rounded-2xl bg-slate-50">
                <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-xs font-bold text-slate-700">No courses match your filter</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Try adjusting your search query or semester selection.
                </p>
                <Button
                  variant="secondary"
                  size="xs"
                  className="mt-3"
                  onClick={() => {
                    setSearchTerm('');
                    setSemesterFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}

            {/* SUBJECT CARDS GRID */}
            {!isLoading && filteredSubjects.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredSubjects.map((sub) => {
                  const subId = sub._id || sub.id;
                  const deptName = sub.department?.name || 'Computer Science & Engineering';
                  const courseName = sub.course?.name || sub.course?.degreeType || 'B.Tech Program';
                  const slots = sub.slots || [];
                  const enrolled = sub.enrolledCount !== undefined ? sub.enrolledCount : 2;
                  const completion = sub.syllabusCompletion || 0;
                  const completedUnits = sub.completedUnits || 0;
                  const totalUnits = sub.totalUnits || 5;

                  return (
                    <div
                      key={subId}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-card hover:border-purple-300 hover:shadow-hover transition-all p-5 flex flex-col justify-between group"
                    >
                      <div>
                        {/* Top Metadata Badges */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
                              {sub.code}
                            </span>
                            <Badge variant="teal" size="xs">
                              {sub.credits || 3} Credits
                            </Badge>
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              AY {sub.academicYear || '2025-26'}
                            </span>
                          </div>

                          <Badge variant="purple" size="xs">
                            Semester {sub.semester}
                          </Badge>
                        </div>

                        {/* Subject Title & Department */}
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors tracking-tight">
                          {sub.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center space-x-1.5 flex-wrap">
                          <span>{deptName}</span>
                          <span>&bull;</span>
                          <span>{courseName}</span>
                        </p>

                        {/* Key Specifications Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Section
                            </span>
                            <span className="font-semibold text-slate-800 mt-0.5 block">
                              Section {sub.section || 'A'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center space-x-1">
                              <MapPin className="w-2.5 h-2.5 text-purple-600 inline" />
                              <span>Classroom</span>
                            </span>
                            <span className="font-semibold text-purple-700 mt-0.5 block truncate" title={sub.roomNumber || 'LH-101'}>
                              {sub.roomNumber || 'LH-101'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center space-x-1">
                              <Users className="w-2.5 h-2.5 text-indigo-600 inline" />
                              <span>Enrolled</span>
                            </span>
                            <span className="font-bold text-indigo-700 mt-0.5 block">
                              {enrolled} Students
                            </span>
                          </div>
                        </div>

                        {/* Weekly Timetable Periods Chip List */}
                        <div className="mb-4">
                          <span className="text-[11px] font-bold text-slate-700 block mb-1.5 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Weekly Timetable Periods ({slots.length})</span>
                          </span>
                          {slots.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No specific periods scheduled in timetable.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {slots.map((slot, sIdx) => (
                                <span
                                  key={slot._id || sIdx}
                                  className="text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-100/90 rounded-md px-2 py-0.5 inline-flex items-center space-x-1"
                                >
                                  <span className="font-bold">{slot.dayOfWeek?.slice(0, 3)}:</span>
                                  <span>{slot.startTime}-{slot.endTime}</span>
                                  <span className="text-purple-500">({slot.roomNumber || 'LH-101'})</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Syllabus Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
                              <Layers className="w-3 h-3 text-purple-500" />
                              <span>Syllabus Completion</span>
                            </span>
                            <span className="font-mono font-bold text-[11px] text-purple-700">
                              {completion}% ({completedUnits}/{totalUnits} Units)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-600 to-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Working Interaction Action Buttons (Section 4) */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onOpenDetails?.(sub, 'roster')}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                            title="View enrolled students roster for this course"
                          >
                            <Users className="w-3 h-3" />
                            <span>Roster ({enrolled})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDetails?.(sub, 'syllabus')}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                            title="View syllabus unit breakdown"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Syllabus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDetails?.(sub, 'attendance')}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                            title="View subject-wise attendance analytics and compliance"
                          >
                            <BarChart2 className="w-3 h-3" />
                            <span>Attendance</span>
                          </button>
                        </div>

                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => onOpenDetails?.(sub, 'overview')}
                          icon={ChevronRight}
                          className="font-bold text-purple-700 hover:text-purple-900"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AssignedCoursesSection;
