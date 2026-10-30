import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Award,
  AlertTriangle,
  CalendarCheck,
  FileText,
  ChevronRight,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import Badge from '../../../components/common/Badge';

export const FacultyNotificationsCenter = ({
  assignments = [],
  exams = [],
  timetableSlots = [],
  notices = [],
  onNavigateTab
}) => {
  const [activeTab, setActiveTab] = useState('all');

  // Compute smart notifications
  const now = new Date();

  // 1. Upcoming assignment deadlines (due within 7 days)
  const upcomingDeadlines = assignments.filter((a) => {
    if (!a.dueDate || a.status === 'completed') return false;
    const due = new Date(a.dueDate);
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // 2. Pending evaluations
  const pendingEvaluations = assignments.filter((a) => {
    const submissions = a.submissions || [];
    return submissions.some((s) => s.status === 'submitted' || s.marksObtained === undefined);
  });

  // 3. Upcoming examinations (in next 14 days)
  const upcomingExams = exams.filter((ex) => {
    if (!ex.startDate) return false;
    const start = new Date(ex.startDate);
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  });

  const totalActionableAlerts = upcomingDeadlines.length + pendingEvaluations.length + upcomingExams.length;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
            <Bell className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Faculty Notifications & Action Alerts
              </h2>
              {totalActionableAlerts > 0 && (
                <Badge variant="rose" size="xs">{totalActionableAlerts} Actionable</Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Timetable reminders, pending grading evaluations, and institutional announcements
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-100 text-purple-800'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Alerts ({totalActionableAlerts + notices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-purple-100 text-purple-800'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tasks ({totalActionableAlerts})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notices')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'notices'
                ? 'bg-purple-100 text-purple-800'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Circulars ({notices.length})
          </button>
        </div>
      </div>

      {/* Notifications Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Pending Evaluations Alert */}
        {(activeTab === 'all' || activeTab === 'tasks') && pendingEvaluations.map((a) => (
          <div
            key={`eval-${a._id || a.id}`}
            className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start space-x-2.5">
              <Award className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-amber-950 block">Pending Evaluation: {a.title}</span>
                <span className="text-[11px] text-amber-800 block mt-0.5">
                  Student submissions are awaiting marks & feedback evaluation.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('assignments')}
                  className="text-purple-700 hover:underline font-semibold text-[11px] mt-1.5 inline-block cursor-pointer"
                >
                  Open Grading Console &rarr;
                </button>
              </div>
            </div>
            <Badge variant="amber" size="xs">Needs Grading</Badge>
          </div>
        ))}

        {/* Upcoming Assignment Deadlines */}
        {(activeTab === 'all' || activeTab === 'tasks') && upcomingDeadlines.map((a) => (
          <div
            key={`due-${a._id || a.id}`}
            className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition-colors flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start space-x-2.5">
              <Clock className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-purple-950 block">Upcoming Due Date: {a.title}</span>
                <span className="text-[11px] text-purple-800 block mt-0.5">
                  Submission closes on {new Date(a.dueDate).toLocaleDateString()}.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('assignments')}
                  className="text-purple-700 hover:underline font-semibold text-[11px] mt-1.5 inline-block cursor-pointer"
                >
                  View Submissions &rarr;
                </button>
              </div>
            </div>
            <Badge variant="purple" size="xs">Due Soon</Badge>
          </div>
        ))}

        {/* Upcoming Examinations */}
        {(activeTab === 'all' || activeTab === 'tasks') && upcomingExams.map((ex) => (
          <div
            key={`exam-${ex._id || ex.id}`}
            className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition-colors flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start space-x-2.5">
              <CalendarCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-blue-950 block">Examination: {ex.name}</span>
                <span className="text-[11px] text-blue-800 block mt-0.5">
                  Scheduled to commence on {new Date(ex.startDate).toLocaleDateString()}.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('exams')}
                  className="text-blue-700 hover:underline font-semibold text-[11px] mt-1.5 inline-block cursor-pointer"
                >
                  Open Examination Roster &rarr;
                </button>
              </div>
            </div>
            <Badge variant="blue" size="xs">Examination</Badge>
          </div>
        ))}

        {/* Institutional Notices */}
        {(activeTab === 'all' || activeTab === 'notices') && notices.slice(0, 4).map((notice) => (
          <div
            key={`notice-${notice._id || notice.id}`}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-200 transition-colors flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start space-x-2.5">
              <FileText className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">{notice.title}</span>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{notice.content}</p>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Published: {new Date(notice.createdAt || notice.publishedAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>
            <Badge variant="teal" size="xs">{notice.category || 'Circular'}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FacultyNotificationsCenter;
