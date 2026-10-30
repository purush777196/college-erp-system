import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  AlertTriangle,
  TrendingUp,
  Download,
  Filter,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Search
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SimpleDonutChart from '../../../components/common/SimpleDonutChart';
import { exportToCsv } from '../../../utils/csvExport';

export const AttendanceAnalyticsSection = ({
  attendanceRecords = [],
  assignedSubjects = [],
  assignedStudents = []
}) => {
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [thresholdOnly, setThresholdOnly] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  // Student history modal
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);

  // Filter attendance records by subject & date range
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      const subId = rec.subject?._id || rec.subject?.id || rec.subject;
      if (subjectFilter !== 'all' && String(subId) !== String(subjectFilter)) return false;

      if (dateRangeFilter.startDate && rec.date) {
        const recDate = new Date(rec.date).toISOString().split('T')[0];
        if (recDate < dateRangeFilter.startDate) return false;
      }
      if (dateRangeFilter.endDate && rec.date) {
        const recDate = new Date(rec.date).toISOString().split('T')[0];
        if (recDate > dateRangeFilter.endDate) return false;
      }
      return true;
    });
  }, [attendanceRecords, subjectFilter, dateRangeFilter]);

  // Overall distribution
  const totalCount = filteredRecords.length;
  const presentCount = filteredRecords.filter((r) => r.status === 'present').length;
  const absentCount = filteredRecords.filter((r) => r.status === 'absent').length;
  const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
  const complianceRate = totalCount > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalCount) * 100) : 100;

  // Student-wise aggregated stats
  const studentStats = useMemo(() => {
    const map = {};

    // Initialize all assigned students
    assignedStudents.forEach((st) => {
      const stId = st._id || st.id;
      map[stId] = {
        student: st,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        percentage: 100
      };
    });

    // Accumulate records
    filteredRecords.forEach((rec) => {
      const stId = rec.student?._id || rec.student?.id || rec.student;
      if (map[stId]) {
        map[stId].total += 1;
        if (rec.status === 'present') map[stId].present += 1;
        else if (rec.status === 'absent') map[stId].absent += 1;
        else if (rec.status === 'late') map[stId].late += 1;
      }
    });

    // Compute percentage
    return Object.values(map).map((item) => {
      const effectivePresent = item.present + item.late * 0.5;
      const pct = item.total > 0 ? Math.round((effectivePresent / item.total) * 100) : 100;
      return {
        ...item,
        percentage: pct,
        isBelowThreshold: item.total > 0 && pct < 75
      };
    });
  }, [assignedStudents, filteredRecords]);

  // Filter students by threshold & search
  const displayedStudents = studentStats.filter((item) => {
    if (thresholdOnly && !item.isBelowThreshold) return false;
    if (searchStudent.trim()) {
      const q = searchStudent.toLowerCase();
      const name = item.student?.user?.name || item.student?.name || '';
      const roll = item.student?.rollNumber || '';
      return name.toLowerCase().includes(q) || roll.toLowerCase().includes(q);
    }
    return true;
  });

  const belowThresholdCount = studentStats.filter((s) => s.isBelowThreshold).length;

  // CSV Export
  const handleExportAnalyticsCSV = () => {
    const exportData = studentStats.map((item) => ({
      rollNumber: item.student?.rollNumber || '',
      name: item.student?.user?.name || item.student?.name || 'Student',
      semester: item.student?.semester || '',
      totalSessions: item.total,
      presentSessions: item.present,
      absentSessions: item.absent,
      lateSessions: item.late,
      complianceRate: `${item.percentage}%`,
      attendanceStatus: item.percentage < 75 ? 'Low Attendance Alert' : 'Compliant'
    }));

    exportToCsv('faculty_attendance_analytics', exportData, [
      { header: 'Roll Number', key: 'rollNumber' },
      { header: 'Student Name', key: 'name' },
      { header: 'Semester', key: 'semester' },
      { header: 'Total Sessions', key: 'totalSessions' },
      { header: 'Present', key: 'presentSessions' },
      { header: 'Absent', key: 'absentSessions' },
      { header: 'Late', key: 'lateSessions' },
      { header: 'Compliance Rate', key: 'complianceRate' },
      { header: 'Status', key: 'attendanceStatus' }
    ]);
  };

  // Student specific history
  const selectedStudentRecords = useMemo(() => {
    if (!selectedStudentForHistory) return [];
    const stId = selectedStudentForHistory._id || selectedStudentForHistory.id;
    return attendanceRecords.filter((rec) => {
      const recStId = rec.student?._id || rec.student?.id || rec.student;
      return String(recStId) === String(stId);
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [selectedStudentForHistory, attendanceRecords]);

  const donutChartData = [
    { label: 'Present', value: presentCount, color: '#10b981' },
    { label: 'Absent', value: absentCount, color: '#f43f5e' },
    { label: 'Late', value: lateCount, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      <Card
        title="Advanced Classroom Attendance Analytics"
        subtitle="Subject-wise distribution, monthly compliance trends, and low-attendance thresholds"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleExportAnalyticsCSV}
              icon={Download}
            >
              Export Analytics CSV
            </Button>
          </div>
        }
      >
        {/* Analytics Filter Toolbar */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Course:</span>
            </div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">All Allocated Subjects</option>
              {assignedSubjects.map((sub) => (
                <option key={sub._id || sub.id} value={sub._id || sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>

            <span className="text-slate-400 hidden sm:inline">&bull;</span>

            <div className="flex items-center space-x-1">
              <span className="font-semibold text-slate-700">From:</span>
              <input
                type="date"
                value={dateRangeFilter.startDate}
                onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, startDate: e.target.value })}
                className="px-2 py-1 rounded border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center space-x-1">
              <span className="font-semibold text-slate-700">To:</span>
              <input
                type="date"
                value={dateRangeFilter.endDate}
                onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, endDate: e.target.value })}
                className="px-2 py-1 rounded border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {(dateRangeFilter.startDate || dateRangeFilter.endDate) && (
              <button
                type="button"
                onClick={() => setDateRangeFilter({ startDate: '', endDate: '' })}
                className="text-purple-600 hover:underline font-semibold text-[11px] cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setThresholdOnly(!thresholdOnly)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center space-x-1 ${
                thresholdOnly
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Below 75% Threshold ({belowThresholdCount})</span>
            </button>
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-purple-700 font-semibold uppercase tracking-wider block">Total Logged</span>
              <span className="text-2xl font-bold text-purple-950 block mt-0.5">{totalCount} Sessions</span>
              <span className="text-[11px] text-purple-600">Period classroom logs</span>
            </div>
            <Clock className="w-8 h-8 text-purple-400" />
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">Present Count</span>
              <span className="text-2xl font-bold text-emerald-950 block mt-0.5">{presentCount}</span>
              <span className="text-[11px] text-emerald-600">{totalCount > 0 ? `${Math.round((presentCount / totalCount) * 100)}% compliance` : 'N/A'}</span>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider block">Late Arrivals</span>
              <span className="text-2xl font-bold text-amber-950 block mt-0.5">{lateCount}</span>
              <span className="text-[11px] text-amber-600">Admitted with delay</span>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-400" />
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider block">At Risk (&lt; 75%)</span>
              <span className="text-2xl font-bold text-rose-950 block mt-0.5">{belowThresholdCount} Students</span>
              <span className="text-[11px] text-rose-600">Requires academic alert</span>
            </div>
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
        </div>

        {/* Donut Chart & Distribution Summary */}
        {totalCount > 0 && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-subtle mb-6 flex flex-col md:flex-row items-center justify-around gap-6">
            <SimpleDonutChart
              data={donutChartData}
              centerLabel="Compliance"
              centerValue={`${complianceRate}%`}
              size={170}
              thickness={20}
            />

            <div className="space-y-3 text-xs w-full max-w-sm">
              <h4 className="font-bold text-slate-800 text-sm">Attendance Summary Metrics</h4>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-100">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium">Present Lectures:</span>
                </span>
                <span className="font-bold font-mono">{presentCount} ({totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%)</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-100">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-medium">Late Sessions:</span>
                </span>
                <span className="font-bold font-mono">{lateCount} ({totalCount > 0 ? Math.round((lateCount / totalCount) * 100) : 0}%)</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 text-rose-900 border border-rose-100">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-medium">Absent Sessions:</span>
                </span>
                <span className="font-bold font-mono">{absentCount} ({totalCount > 0 ? Math.round((absentCount / totalCount) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Student-Wise Attendance Roster & History */}
        <div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Student Attendance Roster & Compliance Breakdown ({displayedStudents.length})
            </h4>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or roll..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {displayedStudents.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
              No students match the current filter or threshold criteria.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3 text-center">Total Sessions</th>
                    <th className="py-2.5 px-3 text-center">Present</th>
                    <th className="py-2.5 px-3 text-center">Late</th>
                    <th className="py-2.5 px-3 text-center">Absent</th>
                    <th className="py-2.5 px-3 text-center">Rate</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.map((item) => {
                    const st = item.student || {};
                    return (
                      <tr key={st._id || st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-900">
                          {st.rollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {st.user?.name || st.name || 'Student'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {item.total}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-700 font-semibold">
                          {item.present}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-amber-600">
                          {item.late}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-rose-600">
                          {item.absent}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={item.percentage < 75 ? 'text-rose-600' : 'text-emerald-700'}>
                            {item.percentage}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.isBelowThreshold ? (
                            <Badge variant="rose" size="xs">Below 75%</Badge>
                          ) : (
                            <Badge variant="emerald" size="xs">Compliant</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForHistory(st)}
                            className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            View History
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* STUDENT DETAILED ATTENDANCE HISTORY MODAL */}
      <Modal
        isOpen={Boolean(selectedStudentForHistory)}
        onClose={() => setSelectedStudentForHistory(null)}
        title={`Attendance History: ${selectedStudentForHistory?.user?.name || selectedStudentForHistory?.name || 'Student'}`}
        subtitle={`Roll Number: ${selectedStudentForHistory?.rollNumber} &bull; Total Logged Records: ${selectedStudentRecords.length}`}
        maxWidth="max-w-2xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedStudentForHistory(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {selectedStudentRecords.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No individual session records found for this student.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
              {selectedStudentRecords.map((rec, idx) => {
                const subObj = rec.subject || {};
                return (
                  <div
                    key={rec._id || idx}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">
                          {new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Period {rec.periodNumber || 1}
                        </span>
                      </div>
                      <span className="text-[11px] text-purple-700 font-medium block mt-0.5">
                        {subObj.code ? `${subObj.code} - ${subObj.name}` : (subObj.name || 'Lecture Course')}
                      </span>
                      {rec.remarks && (
                        <span className="text-[10px] text-slate-400 block mt-0.5 italic">
                          Remarks: {rec.remarks}
                        </span>
                      )}
                    </div>

                    <div>
                      {rec.status === 'present' && <Badge variant="emerald" size="xs">Present</Badge>}
                      {rec.status === 'late' && <Badge variant="amber" size="xs">Late</Badge>}
                      {rec.status === 'absent' && <Badge variant="rose" size="xs">Absent</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceAnalyticsSection;
