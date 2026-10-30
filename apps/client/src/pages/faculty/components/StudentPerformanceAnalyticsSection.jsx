import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart2,
  TrendingUp,
  Award,
  Users,
  AlertTriangle,
  Percent,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  GraduationCap,
  Building2,
  RefreshCw,
  BookOpen,
  ArrowUpDown,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SimpleDonutChart from '../../../components/common/SimpleDonutChart';
import api from '../../../api/apiClient';
import { exportToCsv } from '../../../utils/csvExport';
import AttendanceAnalyticsSection from './AttendanceAnalyticsSection';

export const StudentPerformanceAnalyticsSection = ({
  assignedSubjects = [],
  assignedStudents = [],
  attendanceRecords = []
}) => {
  // Main view tab: 'academic' vs 'attendance'
  const [activeAnalyticsView, setActiveAnalyticsView] = useState('academic');

  // Overview KPIs state
  const [overview, setOverview] = useState({
    totalStudents: 0,
    classAverage: 0,
    highestPerformance: 0,
    lowestPerformance: 0,
    passPercentage: 0,
    studentsRequiringAttention: 0,
    totalEvaluationsCount: 0,
    totalAssignmentsCount: 0,
    totalExamsCount: 0,
    passingThreshold: 40
  });

  // Subject analytics breakdown
  const [subjectAnalytics, setSubjectAnalytics] = useState([]);

  // Student list state
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Filters & Search
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rollNumber');
  const [sortOrder, setSortOrder] = useState('asc');

  // Trend data
  const [trends, setTrends] = useState({
    assessmentTrend: [],
    subjectComparison: [],
    gradeDistribution: [],
    performanceRanges: []
  });

  // Student detail modal state
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Load Overview and Trends
  const loadOverviewAndTrends = useCallback(async () => {
    try {
      const [overviewRes, trendsRes, subjectsRes] = await Promise.all([
        api.getFacultyAnalyticsOverview({
          subject: selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined
        }).catch(() => ({ data: null })),
        api.getFacultyAnalyticsTrends().catch(() => ({ data: null })),
        api.getFacultyAnalyticsSubjects().catch(() => ({ data: [] }))
      ]);

      if (overviewRes?.data) setOverview(overviewRes.data);
      if (trendsRes?.data) setTrends(trendsRes.data);
      if (subjectsRes?.data) setSubjectAnalytics(subjectsRes.data);
    } catch (err) {
      console.warn('Failed to load overview analytics:', err);
    }
  }, [selectedSubjectFilter]);

  // 2. Load Student Performance List
  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.getFacultyAnalyticsStudents({
        subject: selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined,
        section: selectedSectionFilter !== 'all' ? selectedSectionFilter : undefined,
        category: selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        sortOrder,
        page: pagination.page,
        limit: pagination.limit
      });

      if (res?.data) {
        setStudents(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to retrieve student performance records.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSubjectFilter, selectedSectionFilter, selectedCategoryFilter, searchQuery, sortBy, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    loadOverviewAndTrends();
  }, [loadOverviewAndTrends]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Open Student Detail Drawer
  const handleOpenStudentDetail = async (studentId) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    setSelectedStudentDetail(null);
    try {
      const res = await api.getFacultyAnalyticsStudentDetail(studentId);
      if (res?.data) {
        setSelectedStudentDetail(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch student assessment detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Export Analytics to CSV
  const handleExportCSV = () => {
    if (students.length === 0) return;
    const exportData = students.map((s) => ({
      'Roll Number': s.rollNumber,
      'Student Name': s.name,
      'Email': s.email,
      'Department': s.department,
      'Semester': s.semester,
      'Section': s.section,
      'Assignment Average (%)': s.assignmentAverage !== null ? `${s.assignmentAverage}%` : 'N/A',
      'Examination Average (%)': s.examinationAverage !== null ? `${s.examinationAverage}%` : 'N/A',
      'Overall Performance (%)': s.overallPerformance !== null ? `${s.overallPerformance}%` : 'N/A',
      'Attendance Compliance (%)': s.attendancePercentage !== null ? `${s.attendancePercentage}%` : 'N/A',
      'Status': s.performanceCategory,
      'At-Risk Indicators': s.riskFlags.join('; ') || 'None'
    }));

    exportToCsv(exportData, `student-performance-analytics-${new Date().toISOString().split('T')[0]}`);
  };

  // Toggle Sorting
  const handleSortToggle = (colKey) => {
    if (sortBy === colKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colKey);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* View Switcher: Academic Performance vs Attendance Analytics */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveAnalyticsView('academic')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeAnalyticsView === 'academic'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-200/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Academic Performance Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveAnalyticsView('attendance')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeAnalyticsView === 'attendance'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-200/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Attendance Compliance Analytics</span>
          </button>
        </div>

        {activeAnalyticsView === 'academic' && (
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="xs"
              icon={Download}
              onClick={handleExportCSV}
              disabled={students.length === 0}
            >
              Export CSV Report
            </Button>
            <Button
              variant="secondary"
              size="xs"
              icon={RefreshCw}
              onClick={() => {
                loadOverviewAndTrends();
                loadStudents();
              }}
              isLoading={isLoading}
              title="Refresh Analytics"
            />
          </div>
        )}
      </div>

      {activeAnalyticsView === 'academic' ? (
        <>
          {/* 1. Six Authority KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* KPI 1: Total Students */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:border-purple-300 transition-all">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Students
              </span>
              <div className="mt-1 text-2xl font-bold text-slate-900">{overview.totalStudents}</div>
              <span className="text-[10px] text-purple-700 font-semibold mt-0.5 block truncate">
                Enrolled Cohorts
              </span>
            </div>

            {/* KPI 2: Class Average */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:border-purple-300 transition-all">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Class Average
              </span>
              <div className="mt-1 text-2xl font-bold text-purple-900">
                {overview.classAverage}%
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                {overview.totalEvaluationsCount} Evaluated
              </span>
            </div>

            {/* KPI 3: Highest Performance */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:border-purple-300 transition-all">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Highest Score
              </span>
              <div className="mt-1 text-2xl font-bold text-emerald-600">
                {overview.highestPerformance}%
              </div>
              <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block truncate">
                Peak Assessment
              </span>
            </div>

            {/* KPI 4: Lowest Performance */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:border-purple-300 transition-all">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Lowest Score
              </span>
              <div className="mt-1 text-2xl font-bold text-rose-600">
                {overview.lowestPerformance}%
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                Minimum Recorded
              </span>
            </div>

            {/* KPI 5: Pass Percentage */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card hover:border-purple-300 transition-all">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Pass Percentage
              </span>
              <div className="mt-1 text-2xl font-bold text-teal-800">
                {overview.passPercentage}%
              </div>
              <span className="text-[10px] text-teal-700 font-semibold mt-0.5 block truncate">
                &ge; {overview.passingThreshold}% Benchmark
              </span>
            </div>

            {/* KPI 6: Students Requiring Attention */}
            <div className={`rounded-2xl p-4 border transition-all ${
              overview.studentsRequiringAttention > 0
                ? 'bg-amber-50/40 border-amber-300 shadow-card'
                : 'bg-white border-slate-200/90 shadow-card'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  At-Risk Support
                </span>
                {overview.studentsRequiringAttention > 0 && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
              </div>
              <div className={`mt-1 text-2xl font-bold ${overview.studentsRequiringAttention > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {overview.studentsRequiringAttention}
              </div>
              <span className="text-[10px] text-amber-800 font-medium mt-0.5 block truncate">
                {overview.studentsRequiringAttention === 0 ? 'All on track' : 'Action recommended'}
              </span>
            </div>
          </div>

          {/* 2. Visual Trends & Subject Comparison Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart 1: Subject Performance Comparison (Bar visualization) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <BarChart2 className="w-4 h-4 text-purple-700" />
                    <span>Subject-wise Average Academic Performance</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mean scores normalized to 100% across assigned courses
                  </p>
                </div>
              </div>

              {trends.subjectComparison.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  No evaluated assessment data available across assigned subjects yet.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {trends.subjectComparison.map((item, idx) => {
                    const pct = item.averageScore || 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {item.code} &bull; {item.name}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-400 text-[11px] font-mono">
                              ({item.evaluatedCount} evals)
                            </span>
                            <span className="font-bold text-purple-900 font-mono">{pct}%</span>
                          </div>
                        </div>

                        {/* Responsive Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 75
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                                : pct >= 50
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
                                : 'bg-gradient-to-r from-amber-500 to-rose-500'
                            }`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart 2: Grade & Score Distribution */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Award className="w-4 h-4 text-purple-700" />
                    <span>Grade & Score Distribution</span>
                  </h3>
                  <Badge variant="purple" size="xs">Examination Grading</Badge>
                </div>

                {trends.gradeDistribution.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    No graded examination results on record.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
                    {trends.gradeDistribution.map((item) => (
                      <div
                        key={item.grade}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-between ${
                          item.grade === 'F' && item.count > 0
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : item.count > 0
                            ? 'bg-purple-50/60 border-purple-200 text-purple-900'
                            : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}
                      >
                        <span className="text-[11px] font-bold font-mono uppercase">{item.grade}</span>
                        <span className="text-lg font-bold mt-1 block">{item.count}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Students</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Performance Score Ranges */}
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Score Range Segmentation:
                </span>
                <div className="space-y-1.5 text-xs">
                  {trends.performanceRanges?.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">{r.range}</span>
                      <span className="font-bold text-slate-900 font-mono">{r.count} students</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Subject Comparative Breakdown Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-purple-700" />
              <span>Assigned Subject Performance Overview</span>
            </h3>

            {subjectAnalytics.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No teaching subjects assigned to this faculty profile.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-center">Enrolled</th>
                      <th className="py-2.5 px-3 text-center">Evaluated</th>
                      <th className="py-2.5 px-3 text-center">Average Score</th>
                      <th className="py-2.5 px-3 text-center">High / Low</th>
                      <th className="py-2.5 px-3 text-center">Pass %</th>
                      <th className="py-2.5 px-3 text-right">Pending Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjectAnalytics.map((sub) => (
                      <tr key={sub.subjectId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-purple-700">{sub.code}</span>
                          <span className="text-slate-800 font-medium ml-1.5">{sub.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-700">Sec {sub.sections?.join(', ') || 'A'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                          {sub.enrolledCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {sub.evaluatedCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-900">
                          {sub.averageMarks}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {sub.highestMarks}% / {sub.lowestMarks}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={sub.passPercentage >= 75 ? 'emerald' : sub.passPercentage >= 50 ? 'purple' : 'amber'} size="xs">
                            {sub.passPercentage}%
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {sub.pendingEvaluations > 0 ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {sub.pendingEvaluations} Submissions Pending
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-700">Up to date</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Detailed Student Performance Directory */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-purple-700" />
                  <span>Student Academic Performance & Support Directory</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Track individual student examination averages, assignment scores, and support alerts
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCategoryFilter === 'all'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Students ({pagination.total})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('at_risk')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1 ${
                    selectedCategoryFilter === 'at_risk'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Needs Support ({overview.studentsRequiringAttention})</span>
                </button>
              </div>
            </div>

            {/* Search & Selection Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name or roll number..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
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

              {/* Subject Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Subject:</span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
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

              {/* Section Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Sec:</span>
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                  <option value="C">Sec C</option>
                </select>
              </div>
            </div>

            {/* Students Table */}
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Loading student performance data and evaluations...
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700">No Student Records Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No student records match the active search and filter parameters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th
                        className="py-3 px-3.5 cursor-pointer hover:text-purple-700"
                        onClick={() => handleSortToggle('rollNumber')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Student Details</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">Class & Section</th>
                      <th
                        className="py-3 px-3 text-center cursor-pointer hover:text-purple-700"
                        onClick={() => handleSortToggle('assignmentAverage')}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Assignments</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-center cursor-pointer hover:text-purple-700"
                        onClick={() => handleSortToggle('examinationAverage')}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Exams</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-center cursor-pointer hover:text-purple-700"
                        onClick={() => handleSortToggle('overallPerformance')}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Overall Score</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-center cursor-pointer hover:text-purple-700"
                        onClick={() => handleSortToggle('attendancePercentage')}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Attendance</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-center">Academic Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <tr
                        key={st.studentId}
                        onClick={() => handleOpenStudentDetail(st.studentId)}
                        className="hover:bg-purple-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-3.5">
                          <div className="flex items-center space-x-2.5">
                            <span className="font-mono font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                              {st.rollNumber}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block group-hover:text-purple-900 transition-colors">
                                {st.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                {st.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-600 font-medium">
                          Sem {st.semester} &bull; Sec {st.section || 'A'}
                        </td>

                        <td className="py-3 px-3 text-center font-mono">
                          {st.assignmentAverage !== null ? (
                            <span className="font-bold text-slate-900">{st.assignmentAverage}%</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-mono">
                          {st.examinationAverage !== null ? (
                            <span className="font-bold text-slate-900">{st.examinationAverage}%</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-bold text-purple-950">
                          {st.overallPerformance !== null ? `${st.overallPerformance}%` : '—'}
                        </td>

                        <td className="py-3 px-3 text-center font-mono">
                          {st.attendancePercentage !== null ? (
                            <Badge variant={st.attendancePercentage >= 75 ? 'emerald' : 'amber'} size="xs">
                              {st.attendancePercentage}%
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-[11px]">N/A</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {st.isAtRisk ? (
                            <div className="inline-flex flex-col items-center">
                              <Badge variant="amber" size="xs" className="font-bold">
                                Needs Attention
                              </Badge>
                              {st.riskFlags.length > 0 && (
                                <span className="text-[9px] text-amber-700 font-medium mt-0.5 max-w-[120px] truncate block" title={st.riskFlags.join(', ')}>
                                  {st.riskFlags[0]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant={st.performanceCategory === 'Excellent' ? 'emerald' : 'purple'} size="xs">
                              {st.performanceCategory}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStudentDetail(st.studentId);
                            }}
                            className="text-xs text-purple-700 hover:text-purple-900 font-bold hover:underline inline-flex items-center space-x-0.5"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>
                  Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total students)
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-700 px-2">
                    {pagination.page}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* View B: Attendance Compliance Analytics (Preserved and fully functional) */
        <AttendanceAnalyticsSection
          attendanceRecords={attendanceRecords}
          assignedSubjects={assignedSubjects}
          assignedStudents={assignedStudents}
        />
      )}

      {/* 5. INDIVIDUAL STUDENT ASSESSMENT DETAIL MODAL */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedStudentDetail(null);
        }}
        title={`Student Performance Profile: ${selectedStudentDetail?.student?.name || 'Loading...'}`}
        subtitle={`Roll Number: ${selectedStudentDetail?.student?.rollNumber || ''} &bull; Semester ${selectedStudentDetail?.student?.semester || ''} &bull; Section ${selectedStudentDetail?.student?.section || 'A'}`}
        maxWidth="max-w-4xl"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsDetailModalOpen(false);
              setSelectedStudentDetail(null);
            }}
          >
            Close
          </Button>
        }
      >
        {isLoadingDetail || !selectedStudentDetail ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading comprehensive assessment history and attendance logs...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Student Header Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                  {selectedStudentDetail.student?.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {selectedStudentDetail.student?.name}
                  </h4>
                  <span className="text-purple-700 font-mono font-semibold">
                    {selectedStudentDetail.student?.rollNumber} &bull; {selectedStudentDetail.student?.email}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedStudentDetail.student?.department || 'Computer Science & Engineering'} &bull; Semester {selectedStudentDetail.student?.semester} (Sec {selectedStudentDetail.student?.section})
                  </p>
                </div>
              </div>

              {/* Attendance quick compliance pill */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center space-x-3">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Attendance Rate</span>
                  <span className={`text-base font-bold font-mono ${
                    selectedStudentDetail.attendance?.percentage >= 75 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {selectedStudentDetail.attendance?.percentage}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  <span>{selectedStudentDetail.attendance?.present} Present</span>
                  <span className="block">{selectedStudentDetail.attendance?.absent} Absent</span>
                </div>
              </div>
            </div>

            {/* Section A: Examination Results */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-purple-700" />
                <span>Examination Evaluations on Record</span>
              </h5>

              {selectedStudentDetail.examinations?.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-400 text-xs">
                  No examination marks recorded for this student in your assigned courses.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Examination</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3 text-center">Internal (40)</th>
                        <th className="py-2.5 px-3 text-center">External (60)</th>
                        <th className="py-2.5 px-3 text-center">Total (100)</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedStudentDetail.examinations.map((ex, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-800">{ex.examName}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono">{ex.subjectCode}</td>
                          <td className="py-2 px-3 text-center font-mono">{ex.internalMarks}</td>
                          <td className="py-2 px-3 text-center font-mono">{ex.externalMarks}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">{ex.totalMarks}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant={ex.grade === 'F' ? 'danger' : 'emerald'} size="xs">{ex.grade}</Badge>
                          </td>
                          <td className="py-2 px-3 text-right capitalize font-semibold text-slate-700">{ex.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section B: Assignment Submissions */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4 h-4 text-purple-700" />
                <span>Assignment Deliverables & Scores</span>
              </h5>

              {selectedStudentDetail.assignments?.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-400 text-xs">
                  No assignments allotted or submitted.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudentDetail.assignments.map((asgn, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{asgn.title}</span>
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            {asgn.subjectCode}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Due: {asgn.dueDate ? new Date(asgn.dueDate).toLocaleDateString() : 'N/A'} &bull; Status: {asgn.status}
                        </span>
                        {asgn.feedback && (
                          <p className="text-[11px] text-slate-600 italic mt-1 bg-slate-50 p-1.5 rounded">
                            Feedback: "{asgn.feedback}"
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        {asgn.marksObtained !== null ? (
                          <div>
                            <span className="font-mono font-bold text-sm text-purple-900 block">
                              {asgn.marksObtained} / {asgn.maxMarks}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              {asgn.percentage}% Score
                            </span>
                          </div>
                        ) : (
                          <Badge variant="amber" size="xs">Pending Evaluation</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentPerformanceAnalyticsSection;
