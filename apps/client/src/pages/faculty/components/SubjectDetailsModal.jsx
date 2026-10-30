import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  UploadCloud,
  ExternalLink,
  Trash2,
  Plus,
  AlertCircle,
  Calendar,
  Award,
  Download,
  Search,
  X,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
  GraduationCap,
  CalendarCheck,
  Percent,
  Check,
  Edit2
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import SimpleDonutChart from '../../../components/common/SimpleDonutChart';
import Notification from '../../../components/common/Notification';
import api from '../../../api/apiClient';
import { exportToCsv } from '../../../utils/csvExport';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '1.2 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const SubjectDetailsModal = ({
  isOpen,
  onClose,
  subject,
  onNavigateToAttendance,
  onRefreshAssignedSubjects,
  onAddToast
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'roster' | 'syllabus' | 'materials' | 'assignments' | 'attendance'

  // ==========================================
  // SECTION B: STUDENT ROSTER STATE
  // ==========================================
  const [rosterStudents, setRosterStudents] = useState([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const ROSTER_PAGE_SIZE = 8;

  // ==========================================
  // SECTION C: SYLLABUS MANAGEMENT STATE
  // ==========================================
  const [syllabusRecord, setSyllabusRecord] = useState(null);
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);
  const [updatingUnitId, setUpdatingUnitId] = useState(null);

  // ==========================================
  // SECTION D: LEARNING MATERIALS STATE
  // ==========================================
  const [materialsList, setMaterialsList] = useState([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [materialForm, setMaterialForm] = useState({
    title: '',
    description: '',
    unitNumber: 1,
    fileName: '',
    fileUrl: '',
    fileSize: 1572864 // 1.5MB default
  });

  // ==========================================
  // SECTION E: ASSIGNMENTS STATE
  // ==========================================
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    maxMarks: 20,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'published',
    instructions: ''
  });

  // ==========================================
  // LOAD DATA ON OPEN / SUBJECT CHANGE
  // ==========================================
  const subjectId = subject?._id || subject?.id;

  const loadAllSubjectData = useCallback(async () => {
    if (!subjectId) return;

    // Load Roster & Performance
    setIsLoadingRoster(true);
    try {
      const res = await api.getAssignedSubjectStudents(subjectId);
      if (res?.data?.students) {
        setRosterStudents(res.data.students);
      }
    } catch (err) {
      console.warn('Failed to fetch assigned subject roster:', err.message);
    } finally {
      setIsLoadingRoster(false);
    }

    // Load Syllabus Progress
    setIsLoadingSyllabus(true);
    try {
      const res = await api.getSubjectSyllabus(subjectId);
      if (res?.data) {
        setSyllabusRecord(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch subject syllabus:', err.message);
    } finally {
      setIsLoadingSyllabus(false);
    }

    // Load Materials
    setIsLoadingMaterials(true);
    try {
      const res = await api.getMaterials();
      const allMats = Array.isArray(res?.data) ? res.data : [];
      const subMats = allMats.filter(
        (m) => String(m.subject?._id || m.subject?.id || m.subject) === String(subjectId)
      );
      setMaterialsList(subMats);
    } catch (err) {
      console.warn('Failed to fetch subject materials:', err.message);
    } finally {
      setIsLoadingMaterials(false);
    }

    // Load Assignments
    setIsLoadingAssignments(true);
    try {
      const res = await api.getAssignments();
      const allAsgns = Array.isArray(res?.data) ? res.data : [];
      const subAsgns = allAsgns.filter(
        (a) => String(a.subject?._id || a.subject?.id || a.subject) === String(subjectId)
      );
      setSubjectAssignments(subAsgns);
    } catch (err) {
      console.warn('Failed to fetch subject assignments:', err.message);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (isOpen && subjectId) {
      setActiveTab('overview');
      loadAllSubjectData();
    }
  }, [isOpen, subjectId, loadAllSubjectData]);

  // ==========================================
  // SYLLABUS HANDLERS
  // ==========================================
  const handleUpdateUnitStatus = async (unitId, nextStatus) => {
    if (!syllabusRecord?._id || !unitId) return;
    setUpdatingUnitId(unitId);
    try {
      const res = await api.updateSyllabusUnit(syllabusRecord._id, unitId, {
        status: nextStatus,
        completionRemarks: `Updated by course faculty to ${nextStatus.replace('_', ' ')}`
      });
      if (res?.data) {
        setSyllabusRecord(res.data);
        if (onAddToast) {
          onAddToast({
            type: 'success',
            title: 'Syllabus Updated',
            message: `Unit status updated to ${nextStatus.replace('_', ' ')}`
          });
        }
        if (onRefreshAssignedSubjects) onRefreshAssignedSubjects();
      }
    } catch (err) {
      if (onAddToast) {
        onAddToast({
          type: 'error',
          title: 'Update Failed',
          message: err.message
        });
      }
    } finally {
      setUpdatingUnitId(null);
    }
  };

  // ==========================================
  // MATERIAL HANDLERS
  // ==========================================
  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.title.trim()) {
      setMaterialError('Resource title is required.');
      return;
    }
    if (!materialForm.fileName.trim()) {
      setMaterialError('Please specify a file name (e.g. Unit1_Lecture_Notes.pdf).');
      return;
    }
    if (!materialForm.fileUrl.trim()) {
      setMaterialError('Please provide a secure document URL or resource link.');
      return;
    }

    setIsSubmittingMaterial(true);
    setMaterialError('');
    try {
      await api.createMaterial({
        title: materialForm.title.trim(),
        description: materialForm.description.trim(),
        subject: subjectId,
        unitNumber: Number(materialForm.unitNumber) || 1,
        fileName: materialForm.fileName.trim(),
        fileUrl: materialForm.fileUrl.trim(),
        fileSize: Number(materialForm.fileSize) || 1572864,
        fileType: 'application/pdf'
      });

      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Material Uploaded',
          message: `Resource "${materialForm.title}" published successfully.`
        });
      }

      setIsUploadModalOpen(false);
      setMaterialForm({
        title: '',
        description: '',
        unitNumber: 1,
        fileName: '',
        fileUrl: '',
        fileSize: 1572864
      });

      // Reload materials
      const res = await api.getMaterials();
      const allMats = Array.isArray(res?.data) ? res.data : [];
      setMaterialsList(
        allMats.filter((m) => String(m.subject?._id || m.subject?.id || m.subject) === String(subjectId))
      );
    } catch (err) {
      setMaterialError(err.message || 'Failed to publish material');
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (matId) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.deleteMaterial(matId);
      setMaterialsList((prev) => prev.filter((m) => (m._id || m.id) !== matId));
      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Material Deleted',
          message: 'Resource removed successfully.'
        });
      }
    } catch (err) {
      if (onAddToast) {
        onAddToast({
          type: 'error',
          title: 'Delete Failed',
          message: err.message
        });
      }
    }
  };

  // ==========================================
  // ASSIGNMENT HANDLERS
  // ==========================================
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentForm.title.trim()) {
      setAssignmentError('Assignment title is required.');
      return;
    }
    if (!assignmentForm.dueDate) {
      setAssignmentError('Due date is required.');
      return;
    }

    setIsSubmittingAssignment(true);
    setAssignmentError('');
    try {
      await api.createAssignment({
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        subject: subjectId,
        semester: Number(subject?.semester) || 3,
        maxMarks: Number(assignmentForm.maxMarks) || 20,
        dueDate: assignmentForm.dueDate,
        status: assignmentForm.status || 'published',
        instructions: assignmentForm.instructions.trim()
      });

      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Assignment Created',
          message: `Assignment "${assignmentForm.title}" created successfully.`
        });
      }

      setIsCreateAssignmentOpen(false);
      setAssignmentForm({
        title: '',
        description: '',
        maxMarks: 20,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'published',
        instructions: ''
      });

      // Reload assignments
      const res = await api.getAssignments();
      const allAsgns = Array.isArray(res?.data) ? res.data : [];
      setSubjectAssignments(
        allAsgns.filter((a) => String(a.subject?._id || a.subject?.id || a.subject) === String(subjectId))
      );
      if (onRefreshAssignedSubjects) onRefreshAssignedSubjects();
    } catch (err) {
      setAssignmentError(err.message || 'Failed to create assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleTogglePublishAssignment = async (asgn) => {
    try {
      if (asgn.status === 'draft') {
        await api.publishAssignment(asgn._id || asgn.id);
        if (onAddToast) {
          onAddToast({
            type: 'success',
            title: 'Assignment Published',
            message: `"${asgn.title}" is now open for student submissions.`
          });
        }
      } else {
        await api.updateAssignment(asgn._id || asgn.id, { status: 'draft' });
        if (onAddToast) {
          onAddToast({
            type: 'info',
            title: 'Assignment Saved as Draft',
            message: `"${asgn.title}" reverted to draft.`
          });
        }
      }
      const res = await api.getAssignments();
      const allAsgns = Array.isArray(res?.data) ? res.data : [];
      setSubjectAssignments(
        allAsgns.filter((a) => String(a.subject?._id || a.subject?.id || a.subject) === String(subjectId))
      );
    } catch (err) {
      if (onAddToast) {
        onAddToast({
          type: 'error',
          title: 'Action Failed',
          message: err.message
        });
      }
    }
  };

  const handleDeleteAssignment = async (asgnId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await api.deleteAssignment(asgnId);
      setSubjectAssignments((prev) => prev.filter((a) => (a._id || a.id) !== asgnId));
      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Assignment Removed',
          message: 'Assignment removed successfully.'
        });
      }
      if (onRefreshAssignedSubjects) onRefreshAssignedSubjects();
    } catch (err) {
      if (onAddToast) {
        onAddToast({
          type: 'error',
          title: 'Delete Failed',
          message: err.message
        });
      }
    }
  };

  // ==========================================
  // ROSTER SEARCH & PAGINATION
  // ==========================================
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return rosterStudents;
    const q = rosterSearch.toLowerCase().trim();
    return rosterStudents.filter((st) => {
      const name = (st.user?.name || '').toLowerCase();
      const roll = (st.rollNumber || '').toLowerCase();
      const email = (st.user?.email || '').toLowerCase();
      return name.includes(q) || roll.includes(q) || email.includes(q);
    });
  }, [rosterStudents, rosterSearch]);

  const totalRosterPages = Math.ceil(filteredRoster.length / ROSTER_PAGE_SIZE) || 1;
  const paginatedRoster = useMemo(() => {
    const start = (rosterPage - 1) * ROSTER_PAGE_SIZE;
    return filteredRoster.slice(start, start + ROSTER_PAGE_SIZE);
  }, [filteredRoster, rosterPage]);

  const handleExportRosterCSV = () => {
    if (rosterStudents.length === 0) return;
    const rows = rosterStudents.map((st) => ({
      RollNumber: st.rollNumber,
      Name: st.user?.name || 'Student',
      Email: st.user?.email || '',
      Semester: st.currentSemester,
      Department: st.department?.code || st.department?.name || 'CSE',
      BatchYear: st.batchYear,
      AttendancePercentage: st.attendance?.percentage ? `${st.attendance.percentage}%` : 'N/A',
      ClassesAttended: `${st.attendance?.present || 0}/${st.attendance?.totalClasses || 0}`,
      InternalMarks: st.performance?.internalMarks ?? 'N/A',
      ExternalMarks: st.performance?.externalMarks ?? 'N/A',
      TotalMarks: st.performance?.totalMarks ?? 'N/A',
      Grade: st.performance?.grade || 'N/A'
    }));
    exportToCsv(rows, `${subject?.code || 'Subject'}_Student_Roster.csv`);
  };

  // ==========================================
  // ATTENDANCE STATS
  // ==========================================
  const attendanceStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    rosterStudents.forEach((st) => {
      totalPresent += st.attendance?.present || 0;
      totalAbsent += st.attendance?.absent || 0;
      totalLate += st.attendance?.late || 0;
    });
    const totalRecords = totalPresent + totalAbsent + totalLate;
    const complianceRate = totalRecords > 0
      ? Math.round(((totalPresent + totalLate * 0.5) / totalRecords) * 100)
      : 0;
    return {
      totalPresent,
      totalAbsent,
      totalLate,
      totalRecords,
      complianceRate,
      donutData: totalRecords > 0 ? [
        { label: 'Present', value: totalPresent, color: '#10b981' },
        { label: 'Absent', value: totalAbsent, color: '#ef4444' },
        { label: 'Late', value: totalLate, color: '#f59e0b' }
      ] : []
    };
  }, [rosterStudents]);

  // Syllabus stats
  const units = syllabusRecord?.units || [];
  const completedUnitsCount = units.filter((u) => u.status === 'completed').length;
  const inProgressUnitsCount = units.filter((u) => u.status === 'in_progress').length;
  const totalUnitsCount = units.length || 5;
  const syllabusPercent = totalUnitsCount > 0 ? Math.round((completedUnitsCount / totalUnitsCount) * 100) : 0;

  if (!isOpen || !subject) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-5xl border border-slate-200 animate-in zoom-in-95 fade-in duration-200 my-4 sm:my-8 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-800 px-6 py-5 text-white flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 pr-4">
                <div className="flex items-center space-x-2 mb-1.5 flex-wrap gap-y-1">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/20 text-white tracking-wider">
                    {subject.code}
                  </span>
                  <Badge variant="teal" size="xs">
                    Semester {subject.semester}
                  </Badge>
                  <Badge variant="purple" size="xs">
                    {subject.credits} Credits
                  </Badge>
                  <span className="text-xs text-purple-200 font-medium">
                    AY {subject.academicYear || '2025-26'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                  {subject.name}
                </h2>
                <p className="text-xs text-purple-200 mt-1 flex items-center space-x-3 flex-wrap">
                  <span>Department: {subject.department?.name || 'Computer Science & Engineering'}</span>
                  <span>&bull;</span>
                  <span>Sections: {subject.section || 'Sec A'}</span>
                  <span>&bull;</span>
                  <span>Rooms: {subject.roomNumber || 'LH-101'}</span>
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex border-b border-white/20 mt-5 space-x-1 overflow-x-auto scrollbar-none text-xs">
              {[
                { id: 'overview', label: 'Overview', icon: BookOpen },
                { id: 'roster', label: `Student Roster (${rosterStudents.length})`, icon: Users },
                { id: 'syllabus', label: `Syllabus (${syllabusPercent}%)`, icon: Layers },
                { id: 'materials', label: `Materials (${materialsList.length})`, icon: FileText },
                { id: 'assignments', label: `Assignments (${subjectAssignments.length})`, icon: Award },
                { id: 'attendance', label: 'Attendance', icon: BarChart2 }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-3 font-semibold rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-white text-purple-900 shadow-sm'
                        : 'text-purple-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body Content (Scrollable) */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
            {/* ========================================================= */}
            {/* TAB 1: OVERVIEW */}
            {/* ========================================================= */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Enrolled Cohort
                    </span>
                    <span className="text-2xl font-bold text-slate-900 mt-1 block">
                      {subject.enrolledCount || rosterStudents.length}
                    </span>
                    <span className="text-[11px] text-purple-600 font-medium mt-0.5 block">
                      Sem {subject.semester} Active Students
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Syllabus Progress
                    </span>
                    <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                      {syllabusPercent}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                      {completedUnitsCount} of {totalUnitsCount} Units Done
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Weekly Lectures
                    </span>
                    <span className="text-2xl font-bold text-purple-700 mt-1 block">
                      {subject.weeklyLecturesCount || subject.slots?.length || 2}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                      Periods Scheduled
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Attendance Rate
                    </span>
                    <span className="text-2xl font-bold text-teal-700 mt-1 block">
                      {attendanceStats.complianceRate}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                      Overall Compliance
                    </span>
                  </div>
                </div>

                {/* Academic Metadata Grid */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-subtle">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    <span>Curriculum & Allotment Specifications</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Subject Code:</span>
                      <span className="font-mono font-bold text-purple-700">{subject.code}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Subject Title:</span>
                      <span className="font-semibold text-slate-900">{subject.name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Academic Semester:</span>
                      <span className="font-bold text-slate-800">Semester {subject.semester}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Credit Weight:</span>
                      <span className="font-bold text-teal-700">{subject.credits} Credits</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Department:</span>
                      <span className="font-medium text-slate-800">{subject.department?.name || 'CSE'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Degree / Course:</span>
                      <span className="font-medium text-slate-800">{subject.course?.name || 'B.Tech CSE'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Assigned Section(s):</span>
                      <span className="font-bold text-slate-900">{subject.section || 'A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Allotted Classroom(s):</span>
                      <span className="font-bold text-purple-800">{subject.roomNumber || 'LH-101'}</span>
                    </div>
                  </div>

                  {/* Scheduled Lecture Timetable Slots */}
                  {subject.slots && subject.slots.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-800 block mb-2.5">
                        Weekly Timetable Periods
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {subject.slots.map((slot, idx) => (
                          <div
                            key={slot._id || idx}
                            className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <Clock className="w-3.5 h-3.5 text-purple-600" />
                              <span className="font-bold text-purple-900">{slot.dayOfWeek}</span>
                              <span className="text-purple-600 font-mono text-[11px]">
                                Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                              </span>
                            </div>
                            <Badge variant="teal" size="xs">Room {slot.roomNumber || 'LH-101'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Navigation Action Grid */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="teal"
                    size="sm"
                    onClick={() => {
                      if (onNavigateToAttendance) {
                        onClose();
                        onNavigateToAttendance(subject._id);
                      }
                    }}
                    icon={CalendarCheck}
                  >
                    Mark Attendance
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('roster')}
                    icon={Users}
                  >
                    View Student Roster
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('syllabus')}
                    icon={Layers}
                  >
                    Manage Syllabus
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('assignments')}
                    icon={Award}
                  >
                    Assignments
                  </Button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: STUDENT ROSTER */}
            {/* ========================================================= */}
            {activeTab === 'roster' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search enrolled students by name, roll number, or email..."
                      value={rosterSearch}
                      onChange={(e) => {
                        setRosterSearch(e.target.value);
                        setRosterPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={handleExportRosterCSV}
                      icon={Download}
                      disabled={rosterStudents.length === 0}
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>

                {isLoadingRoster ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Loading enrolled student cohort...
                  </div>
                ) : filteredRoster.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No students match the search criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedRoster.map((st) => {
                      const attPct = st.attendance?.percentage;
                      const grade = st.performance?.grade;
                      const hasMarks = st.performance?.totalMarks !== null && st.performance?.totalMarks !== undefined;

                      return (
                        <div
                          key={st._id || st.id}
                          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-purple-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-subtle text-xs"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-bold flex items-center justify-center font-mono text-[11px] flex-shrink-0">
                              {st.rollNumber?.slice(-3) || 'STU'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-teal-900">{st.rollNumber}</span>
                                <span className="font-bold text-slate-900">{st.user?.name || 'Student'}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                                {st.user?.email} &bull; Batch {st.batchYear}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 self-end sm:self-center">
                            {/* Attendance status */}
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">Attendance</span>
                              {attPct !== null && attPct !== undefined ? (
                                <Badge
                                  variant={attPct >= 75 ? 'emerald' : attPct >= 60 ? 'amber' : 'rose'}
                                  size="xs"
                                >
                                  {attPct}% ({st.attendance.present}/{st.attendance.totalClasses})
                                </Badge>
                              ) : (
                                <Badge variant="slate" size="xs">No Records</Badge>
                              )}
                            </div>

                            {/* Performance Grade */}
                            <div className="text-right min-w-[70px]">
                              <span className="text-[10px] text-slate-400 block">Grade</span>
                              {hasMarks ? (
                                <span className="font-bold text-purple-800 text-xs">
                                  {st.performance.totalMarks} pts ({grade})
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Ungraded</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination */}
                    {totalRosterPages > 1 && (
                      <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
                        <span>
                          Page {rosterPage} of {totalRosterPages} ({filteredRoster.length} students)
                        </span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="secondary"
                            size="xs"
                            disabled={rosterPage === 1}
                            onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                            icon={ChevronLeft}
                          >
                            Prev
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            disabled={rosterPage === totalRosterPages}
                            onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                            icon={ChevronRight}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: SYLLABUS MANAGEMENT */}
            {/* ========================================================= */}
            {activeTab === 'syllabus' && (
              <div className="space-y-5">
                {/* Progress bar card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Overall Syllabus Completion ({completedUnitsCount} of {totalUnitsCount} Units)
                    </span>
                    <span className="text-xs font-bold text-purple-700">{syllabusPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${syllabusPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>Not Started: {totalUnitsCount - completedUnitsCount - inProgressUnitsCount}</span>
                    <span>In Progress: {inProgressUnitsCount}</span>
                    <span className="text-emerald-600 font-semibold">Completed: {completedUnitsCount}</span>
                  </div>
                </div>

                {/* Units List */}
                <div className="space-y-3">
                  {units.map((unit) => {
                    const isCompleted = unit.status === 'completed';
                    const isInProgress = unit.status === 'in_progress';
                    const isUpdating = updatingUnitId === unit._id;

                    return (
                      <div
                        key={unit._id || unit.unitNumber}
                        className={`p-4 rounded-xl border transition-colors bg-white ${
                          isCompleted
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : isInProgress
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-start space-x-3">
                            <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              U{unit.unitNumber}
                            </span>
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">{unit.title}</h4>
                              {unit.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{unit.description}</p>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono block mt-1">
                                Planned: {unit.plannedHours || 8} lecture hours
                                {unit.completedAt && ` • Completed on ${new Date(unit.completedAt).toLocaleDateString()}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end sm:self-center">
                            <select
                              value={unit.status}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateUnitStatus(unit._id, e.target.value)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 4: LEARNING MATERIALS */}
            {/* ========================================================= */}
            {activeTab === 'materials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    PDF lecture notes and learning resources for {subject.code}
                  </span>
                  <Button
                    variant="purple"
                    size="xs"
                    onClick={() => setIsUploadModalOpen(true)}
                    icon={UploadCloud}
                  >
                    Upload Resource
                  </Button>
                </div>

                {isLoadingMaterials ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Loading materials catalog...
                  </div>
                ) : materialsList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No learning resources uploaded for this subject yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Upload PDF handouts, syllabus notes, and reference materials.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {materialsList.map((mat) => (
                      <div
                        key={mat._id || mat.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-subtle hover:border-purple-200 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{mat.title}</span>
                            <span className="text-[11px] text-slate-500 block">
                              Unit {mat.unitNumber || 1} &bull; {mat.fileName} ({formatBytes(mat.fileSize)})
                            </span>
                            {mat.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{mat.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <a
                            href={mat.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50 transition-colors"
                            title="View / Download"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleDeleteMaterial(mat._id || mat.id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Resource"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 5: ASSIGNMENTS */}
            {/* ========================================================= */}
            {activeTab === 'assignments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Coursework and assignments created for {subject.code}
                  </span>
                  <Button
                    variant="purple"
                    size="xs"
                    onClick={() => setIsCreateAssignmentOpen(true)}
                    icon={Plus}
                  >
                    Create Assignment
                  </Button>
                </div>

                {isLoadingAssignments ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Loading assignments...
                  </div>
                ) : subjectAssignments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No assignments created for this subject yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click "Create Assignment" to post coursework and track submissions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subjectAssignments.map((asgn) => {
                      const isPublished = asgn.status === 'published';
                      return (
                        <div
                          key={asgn._id || asgn.id}
                          className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-subtle hover:border-purple-200 transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Award className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900">{asgn.title}</span>
                                <Badge variant={isPublished ? 'emerald' : 'slate'} size="xs">
                                  {isPublished ? 'Published' : 'Draft'}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{asgn.description}</p>
                              <span className="text-[10px] text-slate-400 font-mono block mt-1">
                                Max Marks: {asgn.maxMarks || 20} &bull; Due:{' '}
                                {asgn.dueDate ? new Date(asgn.dueDate).toLocaleDateString() : 'Next week'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end sm:self-center">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleTogglePublishAssignment(asgn)}
                            >
                              {isPublished ? 'Unpublish' : 'Publish'}
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDeleteAssignment(asgn._id || asgn.id)}
                              icon={Trash2}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 6: ATTENDANCE */}
            {/* ========================================================= */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Column: Donut Breakdown */}
                  <div className="md:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-subtle flex flex-col items-center justify-center text-center">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Subject Attendance Distribution
                    </h4>
                    {attendanceStats.totalRecords === 0 ? (
                      <div className="py-8 text-slate-400 text-xs">
                        <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p>No classroom sessions recorded yet.</p>
                      </div>
                    ) : (
                      <>
                        <SimpleDonutChart
                          data={attendanceStats.donutData}
                          centerLabel="Compliance"
                          centerValue={`${attendanceStats.complianceRate}%`}
                          size={150}
                          thickness={18}
                        />
                        <div className="grid grid-cols-3 gap-2 w-full mt-4 text-xs pt-3 border-t border-slate-100">
                          <div>
                            <span className="text-emerald-700 font-bold block">{attendanceStats.totalPresent}</span>
                            <span className="text-[10px] text-slate-400">Present</span>
                          </div>
                          <div>
                            <span className="text-rose-700 font-bold block">{attendanceStats.totalAbsent}</span>
                            <span className="text-[10px] text-slate-400">Absent</span>
                          </div>
                          <div>
                            <span className="text-amber-700 font-bold block">{attendanceStats.totalLate}</span>
                            <span className="text-[10px] text-slate-400">Late</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: Attendance Action & Summary */}
                  <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-subtle flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        Classroom Attendance Workflow
                      </h4>
                      <p className="text-xs text-slate-600 mb-4">
                        Record daily or period-wise student attendance for {subject.name} ({subject.code}). Roster compliances update across student transcripts and parent notifications automatically.
                      </p>

                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-purple-700 font-medium">Subject Sections:</span>
                          <span className="font-bold text-purple-900">{subject.section || 'A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700 font-medium">Classroom Allotment:</span>
                          <span className="font-bold text-purple-900">{subject.roomNumber || 'LH-101'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700 font-medium">Eligible Students:</span>
                          <span className="font-bold text-purple-900">{rosterStudents.length} Students</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-3 border-t border-slate-100">
                      <Button
                        variant="purple"
                        size="sm"
                        onClick={() => {
                          if (onNavigateToAttendance) {
                            onClose();
                            onNavigateToAttendance(subject._id);
                          }
                        }}
                        icon={CalendarCheck}
                      >
                        Record Period Attendance Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0 text-xs">
            <span className="text-slate-400">
              Department of {subject.department?.name || 'Engineering'} &bull; College ERP
            </span>
            <Button variant="secondary" size="xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL 1: UPLOAD LEARNING MATERIAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto">
          <div className="fixed inset-0 bg-navy-950/60" onClick={() => setIsUploadModalOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Upload Subject Resource</h3>
              {materialError && <Notification type="error" message={materialError} className="mb-3" />}
              <form onSubmit={handleCreateMaterial} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Resource Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit 1 Lecture Notes & Reference Guide"
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Syllabus Unit</label>
                  <select
                    value={materialForm.unitNumber}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitNumber: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  >
                    {[1, 2, 3, 4, 5].map((u) => (
                      <option key={u} value={u}>Unit {u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">File Name (PDF) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS301_Unit1_Notes.pdf"
                    value={materialForm.fileName}
                    onChange={(e) => setMaterialForm({ ...materialForm, fileName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Document URL / Storage Link *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={materialForm.fileUrl}
                    onChange={(e) => setMaterialForm({ ...materialForm, fileUrl: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description or chapter coverage..."
                    value={materialForm.description}
                    onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <Button variant="secondary" size="xs" onClick={() => setIsUploadModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="purple" size="xs" type="submit" isLoading={isSubmittingMaterial}>
                    Upload Resource
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: CREATE ASSIGNMENT */}
      {isCreateAssignmentOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto">
          <div className="fixed inset-0 bg-navy-950/60" onClick={() => setIsCreateAssignmentOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Create Subject Assignment</h3>
              {assignmentError && <Notification type="error" message={assignmentError} className="mb-3" />}
              <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assignment Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Assignment 2: Binary Search Trees"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Max Marks *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={assignmentForm.maxMarks}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, maxMarks: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={assignmentForm.dueDate}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={assignmentForm.status}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="published">Published (Active)</option>
                    <option value="draft">Draft (Private)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Description / Problem Statement</label>
                  <textarea
                    rows={3}
                    placeholder="Detail the assignment deliverables and guidelines..."
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <Button variant="secondary" size="xs" onClick={() => setIsCreateAssignmentOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="purple" size="xs" type="submit" isLoading={isSubmittingAssignment}>
                    Create Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectDetailsModal;
