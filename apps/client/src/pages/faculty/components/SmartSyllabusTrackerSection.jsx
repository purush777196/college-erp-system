import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  FileText,
  BarChart2,
  History,
  TrendingUp,
  MapPin,
  Sparkles,
  Info,
  Check,
  X,
  ArrowRight,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import api from '../../../api/apiClient';

export const SmartSyllabusTrackerSection = ({
  assignedSubjects = [],
  timetableSlots = [],
  onAddToast = () => {}
}) => {
  // Active subject & academic year
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    assignedSubjects[0]?._id || assignedSubjects[0]?.id || ''
  );
  const [academicYear, setAcademicYear] = useState('2025-26');

  // Sub-navigation view: 'explorer' | 'analytics' | 'history'
  const [activeView, setActiveView] = useState('explorer');

  // Syllabus state
  const [syllabusRecord, setSyllabusRecord] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedUnits, setExpandedUnits] = useState({});

  // Modals state
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({
    title: '',
    description: '',
    plannedHours: 8,
    plannedStartDate: '',
    targetCompletionDate: ''
  });

  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [targetUnitForTopic, setTargetUnitForTopic] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({
    title: '',
    description: '',
    estimatedHours: 2,
    plannedCompletionDate: ''
  });

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [activeProgressTopic, setActiveProgressTopic] = useState(null);
  const [activeProgressUnit, setActiveProgressUnit] = useState(null);
  const [progressForm, setProgressForm] = useState({
    status: 'in_progress',
    teachingNotes: ''
  });

  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    isOpen: false,
    type: 'unit', // 'unit' | 'topic'
    unitId: null,
    topicId: null,
    title: '',
    warningText: ''
  });

  // Active Subject object
  const activeSubject = useMemo(() => {
    return assignedSubjects.find(
      (s) => String(s._id || s.id) === String(selectedSubjectId)
    ) || assignedSubjects[0] || null;
  }, [assignedSubjects, selectedSubjectId]);

  // Sync selectedSubjectId if initial is empty
  useEffect(() => {
    if (!selectedSubjectId && assignedSubjects.length > 0) {
      setSelectedSubjectId(assignedSubjects[0]._id || assignedSubjects[0].id);
    }
  }, [assignedSubjects, selectedSubjectId]);

  // Load syllabus data for active subject
  const loadSyllabus = useCallback(async () => {
    if (!selectedSubjectId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [syllabusRes, analyticsRes] = await Promise.all([
        api.getSubjectSyllabus(selectedSubjectId).catch((err) => {
          if (err.statusCode === 404) return { data: null };
          throw err;
        }),
        api.getSyllabusProgressAnalytics(selectedSubjectId).catch(() => ({ data: null }))
      ]);

      setSyllabusRecord(syllabusRes?.data || null);
      setAnalyticsData(analyticsRes?.data || null);

      // Auto-expand all units by default
      if (syllabusRes?.data?.units) {
        const expandMap = {};
        syllabusRes.data.units.forEach((u) => {
          expandMap[u._id || u.unitNumber] = true;
        });
        setExpandedUnits(expandMap);
      }
    } catch (err) {
      console.warn('Failed to load syllabus:', err.message);
      setErrorMessage(err.message || 'Failed to retrieve syllabus progress records.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSubjectId]);

  // Load history records
  const loadHistory = useCallback(async (page = 1) => {
    if (!selectedSubjectId) return;
    try {
      const res = await api.getSyllabusHistory(selectedSubjectId, { page, limit: 10 });
      if (res?.data) {
        setHistoryRecords(res.data);
        if (res.pagination) setHistoryPagination(res.pagination);
      }
    } catch (err) {
      console.warn('Failed to load syllabus history:', err.message);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    loadSyllabus();
  }, [loadSyllabus]);

  useEffect(() => {
    if (activeView === 'history') {
      loadHistory(historyPagination.page);
    }
  }, [activeView, loadHistory, historyPagination.page]);

  // Timetable scheduled slots for selected subject
  const subjectSlots = useMemo(() => {
    if (!selectedSubjectId) return [];
    return timetableSlots.filter((slot) => {
      const sId = slot.subject?._id || slot.subject?.id || slot.subject;
      return String(sId) === String(selectedSubjectId);
    });
  }, [timetableSlots, selectedSubjectId]);

  // Toggle unit expansion
  const toggleUnit = (unitId) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  // Expand all / collapse all
  const setAllUnitsExpanded = (expand) => {
    if (!syllabusRecord?.units) return;
    const expandMap = {};
    syllabusRecord.units.forEach((u) => {
      expandMap[u._id || u.unitNumber] = expand;
    });
    setExpandedUnits(expandMap);
  };

  // --- UNIT ACTIONS ---
  const handleOpenAddUnit = () => {
    const nextNum = (syllabusRecord?.units?.length || 0) + 1;
    setEditingUnit(null);
    setUnitForm({
      title: `Unit ${nextNum}: `,
      description: '',
      plannedHours: 10,
      plannedStartDate: '',
      targetCompletionDate: ''
    });
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitForm({
      title: unit.title || '',
      description: unit.description || '',
      plannedHours: unit.plannedHours || 8,
      plannedStartDate: unit.plannedStartDate ? new Date(unit.plannedStartDate).toISOString().split('T')[0] : '',
      targetCompletionDate: unit.targetCompletionDate ? new Date(unit.targetCompletionDate).toISOString().split('T')[0] : ''
    });
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    if (!unitForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingUnit) {
        await api.updateSyllabusUnit(selectedSubjectId, editingUnit._id, unitForm);
        onAddToast({ type: 'success', title: 'Unit Updated', message: `Unit ${editingUnit.unitNumber} updated successfully.` });
      } else {
        await api.createSyllabusUnit(selectedSubjectId, unitForm);
        onAddToast({ type: 'success', title: 'Unit Created', message: 'New curriculum unit added to syllabus.' });
      }
      setIsUnitModalOpen(false);
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to save unit.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptDeleteUnit = (unit) => {
    const topicCount = unit.topics?.length || 0;
    setConfirmDeleteModal({
      isOpen: true,
      type: 'unit',
      unitId: unit._id,
      topicId: null,
      title: `Delete Unit ${unit.unitNumber}: ${unit.title}`,
      warningText: topicCount > 0
        ? `Warning: This unit contains ${topicCount} topic(s). Deleting it will remove all topic records within it.`
        : 'Are you sure you want to delete this unit?'
    });
  };

  // --- TOPIC ACTIONS ---
  const handleOpenAddTopic = (unit) => {
    setTargetUnitForTopic(unit);
    setEditingTopic(null);
    setTopicForm({
      title: '',
      description: '',
      estimatedHours: 2,
      plannedCompletionDate: ''
    });
    setIsTopicModalOpen(true);
  };

  const handleOpenEditTopic = (unit, topic) => {
    setTargetUnitForTopic(unit);
    setEditingTopic(topic);
    setTopicForm({
      title: topic.title || '',
      description: topic.description || '',
      estimatedHours: topic.estimatedHours || 2,
      plannedCompletionDate: topic.plannedCompletionDate ? new Date(topic.plannedCompletionDate).toISOString().split('T')[0] : ''
    });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!topicForm.title.trim() || !targetUnitForTopic) return;
    setIsSubmitting(true);
    try {
      if (editingTopic) {
        await api.updateSyllabusTopic(selectedSubjectId, targetUnitForTopic._id, editingTopic._id, topicForm);
        onAddToast({ type: 'success', title: 'Topic Updated', message: 'Topic details saved.' });
      } else {
        await api.createSyllabusTopic(selectedSubjectId, targetUnitForTopic._id, topicForm);
        onAddToast({ type: 'success', title: 'Topic Added', message: `Topic added to Unit ${targetUnitForTopic.unitNumber}.` });
      }
      setIsTopicModalOpen(false);
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to save topic.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptDeleteTopic = (unit, topic) => {
    setConfirmDeleteModal({
      isOpen: true,
      type: 'topic',
      unitId: unit._id,
      topicId: topic._id,
      title: `Delete Topic: ${topic.title}`,
      warningText: 'Are you sure you want to delete this topic from the unit?'
    });
  };

  // --- TOPIC PROGRESS & NOTES MODAL ---
  const handleOpenProgressModal = (unit, topic) => {
    setActiveProgressUnit(unit);
    setActiveProgressTopic(topic);
    setProgressForm({
      status: topic.status || 'not_started',
      teachingNotes: topic.teachingNotes || ''
    });
    setIsProgressModalOpen(true);
  };

  const handleSaveProgress = async (e) => {
    e.preventDefault();
    if (!activeProgressUnit || !activeProgressTopic) return;
    setIsSubmitting(true);
    try {
      await api.updateSyllabusTopic(
        selectedSubjectId,
        activeProgressUnit._id,
        activeProgressTopic._id,
        {
          status: progressForm.status,
          teachingNotes: progressForm.teachingNotes
        }
      );
      onAddToast({
        type: 'success',
        title: 'Progress Recorded',
        message: `Topic updated to ${progressForm.status.replace('_', ' ')}.`
      });
      setIsProgressModalOpen(false);
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update progress.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick toggle topic status directly
  const handleQuickStatusChange = async (unit, topic, newStatus) => {
    try {
      await api.updateSyllabusTopic(selectedSubjectId, unit._id, topic._id, { status: newStatus });
      onAddToast({
        type: 'success',
        title: 'Status Updated',
        message: `Topic marked as ${newStatus.replace('_', ' ')}.`
      });
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update status.' });
    }
  };

  // --- CONFIRM DELETION ---
  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (confirmDeleteModal.type === 'unit') {
        await api.deleteSyllabusUnit(selectedSubjectId, confirmDeleteModal.unitId);
        onAddToast({ type: 'success', title: 'Unit Removed', message: 'Unit deleted from syllabus.' });
      } else {
        await api.deleteSyllabusTopic(selectedSubjectId, confirmDeleteModal.unitId, confirmDeleteModal.topicId);
        onAddToast({ type: 'success', title: 'Topic Removed', message: 'Topic deleted from unit.' });
      }
      setConfirmDeleteModal({ isOpen: false, type: 'unit', unitId: null, topicId: null, title: '', warningText: '' });
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize Default Syllabus
  const handleInitializeDefaultSyllabus = async () => {
    setIsSubmitting(true);
    try {
      await api.initializeSubjectSyllabus(selectedSubjectId);
      onAddToast({
        type: 'success',
        title: 'Syllabus Initialized',
        message: 'Standard 5-unit curriculum template created for this course.'
      });
      loadSyllabus();
    } catch (err) {
      onAddToast({ type: 'error', title: 'Error', message: err.message || 'Failed to initialize syllabus.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = syllabusRecord?.summary || analyticsData?.summary || {
    totalUnits: 0,
    completedUnits: 0,
    inProgressUnits: 0,
    notStartedUnits: 0,
    totalTopics: 0,
    completedTopics: 0,
    inProgressTopics: 0,
    notStartedTopics: 0,
    completionPercentage: 0,
    totalEstimatedHours: 0,
    completedEstimatedHours: 0,
    remainingHours: 0,
    delayedTopicsCount: 0,
    delayedTopics: []
  };

  const delayedTopics = summary.delayedTopics || [];

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Smart Syllabus Tracker</h3>
                <Badge variant="purple" size="xs">Phase 3</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize units and topics, record teaching notes, and track planned vs actual delivery
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Subject Selector */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Subject:</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer max-w-[240px] truncate"
              >
                {assignedSubjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Academic Year Selector */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Year:</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="xs"
              icon={RefreshCw}
              onClick={loadSyllabus}
              isLoading={isLoading}
              title="Refresh Syllabus"
            />
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 mt-5 pt-4 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveView('explorer')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeView === 'explorer'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Unit & Topic Explorer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('analytics')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-100'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Coverage Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeView === 'history'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Update History ({historyPagination.total})</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="secondary" size="xs" onClick={loadSyllabus}>Retry</Button>
        </div>
      )}

      {/* 2. Overview KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Overall Completion */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Overall Completion
          </span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-purple-900">{summary.completionPercentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${summary.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Total Units */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Curriculum Units
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{summary.totalUnits}</div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
            {summary.completedUnits} Completed
          </span>
        </div>

        {/* KPI 3: Total Topics */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Topics
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{summary.totalTopics}</div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
            All Curriculum Topics
          </span>
        </div>

        {/* KPI 4: Completed Topics */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Completed Topics
          </span>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{summary.completedTopics}</div>
          <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
            Delivered in Class
          </span>
        </div>

        {/* KPI 5: In Progress & Pending */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-card">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            In Progress
          </span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{summary.inProgressTopics}</div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            {summary.notStartedTopics} Not Started
          </span>
        </div>

        {/* KPI 6: Delayed Topics Alert */}
        <div className={`rounded-2xl p-4 border transition-all ${
          summary.delayedTopicsCount > 0
            ? 'bg-rose-50/50 border-rose-300 shadow-card'
            : 'bg-white border-slate-200/90 shadow-card'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Delayed Topics
            </span>
            {summary.delayedTopicsCount > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            )}
          </div>
          <div className={`mt-1 text-2xl font-bold ${summary.delayedTopicsCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {summary.delayedTopicsCount}
          </div>
          <span className={`text-[10px] font-medium mt-0.5 block truncate ${summary.delayedTopicsCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {summary.delayedTopicsCount > 0 ? 'Past target date' : 'All on schedule'}
          </span>
        </div>
      </div>

      {/* 3. Delayed Topics Warning Banner */}
      {delayedTopics.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Academic Delivery Notice: {delayedTopics.length} Delayed Topic(s)
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  The following topics have passed their target completion dates but remain incomplete. Update progress or adjust schedules:
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {delayedTopics.slice(0, 5).map((dt, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs flex items-center space-x-2"
                    >
                      <span className="font-semibold text-slate-800">Unit {dt.unitNumber}: {dt.topicTitle}</span>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                        {dt.daysOverdue}d overdue
                      </span>
                    </div>
                  ))}
                  {delayedTopics.length > 5 && (
                    <span className="text-xs text-amber-800 self-center">
                      +{delayedTopics.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. VIEW A: UNIT & TOPIC EXPLORER */}
      {activeView === 'explorer' && (
        <div className="space-y-4">
          {/* Action Row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setAllUnitsExpanded(true)}
              >
                Expand All
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setAllUnitsExpanded(false)}
              >
                Collapse All
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              {(!syllabusRecord?.units || syllabusRecord.units.length === 0) && (
                <Button
                  variant="secondary"
                  size="xs"
                  icon={Sparkles}
                  onClick={handleInitializeDefaultSyllabus}
                  isLoading={isSubmitting}
                >
                  Load Standard 5-Unit Template
                </Button>
              )}
              <Button
                variant="purple"
                size="xs"
                icon={Plus}
                onClick={handleOpenAddUnit}
              >
                Add Unit
              </Button>
            </div>
          </div>

          {/* Empty State */}
          {(!syllabusRecord?.units || syllabusRecord.units.length === 0) && !isLoading && (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Syllabus Configured Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                This course does not currently have units or topics initialized. You can load a standard 5-unit curriculum template or create custom units.
              </p>
              <Button
                variant="purple"
                size="sm"
                icon={Sparkles}
                onClick={handleInitializeDefaultSyllabus}
                isLoading={isSubmitting}
              >
                Initialize Standard Syllabus Template
              </Button>
            </div>
          )}

          {/* Units List */}
          {syllabusRecord?.units?.map((unit) => {
            const isExpanded = expandedUnits[unit._id || unit.unitNumber] !== false;
            const unitTopics = unit.topics || [];
            const completedCount = unitTopics.filter((t) => t.status === 'completed').length;
            const inProgressCount = unitTopics.filter((t) => t.status === 'in_progress').length;
            const unitPercent = unitTopics.length > 0
              ? Math.round((completedCount / unitTopics.length) * 100)
              : (unit.status === 'completed' ? 100 : (unit.status === 'in_progress' ? 50 : 0));

            return (
              <div
                key={unit._id || unit.unitNumber}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden transition-all"
              >
                {/* Unit Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100">
                  <div
                    className="flex items-center space-x-3 cursor-pointer select-none flex-1"
                    onClick={() => toggleUnit(unit._id || unit.unitNumber)}
                  >
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-purple-700 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-700" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="font-mono font-bold text-purple-900 text-xs bg-purple-100/70 px-2 py-0.5 rounded border border-purple-200">
                          Unit {unit.unitNumber}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          {unit.title}
                        </h4>
                        <Badge
                          variant={
                            unit.status === 'completed' || unitPercent === 100
                              ? 'emerald'
                              : unit.status === 'in_progress' || unitPercent > 0
                              ? 'amber'
                              : 'slate'
                          }
                          size="xs"
                        >
                          {unitPercent === 100 ? 'Completed' : unitPercent > 0 ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </div>

                      {unit.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {unit.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Unit Right Meta & Actions */}
                  <div className="flex items-center justify-between sm:justify-end space-x-4 pl-7 sm:pl-0">
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800">{unitPercent}%</span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${unitPercent}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                        {completedCount}/{unitTopics.length} Topics &bull; {unit.plannedHours || 8} hrs
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Plus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddTopic(unit);
                        }}
                        title="Add Topic"
                      >
                        Topic
                      </Button>

                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Edit2}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditUnit(unit);
                        }}
                        title="Edit Unit"
                      />

                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Trash2}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromptDeleteUnit(unit);
                        }}
                        className="text-rose-600 hover:text-rose-700"
                        title="Delete Unit"
                      />
                    </div>
                  </div>
                </div>

                {/* Topics Container */}
                {isExpanded && (
                  <div className="p-4 sm:p-5">
                    {unitTopics.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-400">No topics added to Unit {unit.unitNumber} yet.</p>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={Plus}
                          onClick={() => handleOpenAddTopic(unit)}
                          className="mt-2"
                        >
                          Add First Topic
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {unitTopics.map((topic, tIdx) => {
                          const isTopicDelayed = topic.plannedCompletionDate &&
                            new Date(topic.plannedCompletionDate) < new Date() &&
                            topic.status !== 'completed';

                          return (
                            <div
                              key={topic._id || tIdx}
                              className={`p-3.5 rounded-xl border transition-all ${
                                isTopicDelayed
                                  ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                                  : topic.status === 'completed'
                                  ? 'bg-emerald-50/20 border-emerald-100 hover:border-emerald-200'
                                  : 'bg-white border-slate-200 hover:border-purple-200'
                              } flex flex-col md:flex-row md:items-center justify-between gap-3`}
                            >
                              {/* Topic Left Content */}
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                  <span className="font-mono text-[11px] text-slate-400">
                                    {unit.unitNumber}.{topic.displayOrder || tIdx + 1}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900">
                                    {topic.title}
                                  </span>

                                  {/* Status Chip */}
                                  <Badge
                                    variant={
                                      topic.status === 'completed'
                                        ? 'emerald'
                                        : topic.status === 'in_progress'
                                        ? 'amber'
                                        : 'slate'
                                    }
                                    size="xs"
                                  >
                                    {topic.status === 'completed' ? 'Completed' : topic.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                                  </Badge>

                                  {isTopicDelayed && (
                                    <Badge variant="rose" size="xs">
                                      Delayed
                                    </Badge>
                                  )}
                                </div>

                                {topic.description && (
                                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                    {topic.description}
                                  </p>
                                )}

                                {/* Meta details */}
                                <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1.5 flex-wrap gap-1">
                                  <span className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{topic.estimatedHours || 2} hrs planned</span>
                                  </span>

                                  {topic.plannedCompletionDate && (
                                    <span className="flex items-center space-x-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>Target: {new Date(topic.plannedCompletionDate).toLocaleDateString()}</span>
                                    </span>
                                  )}

                                  {topic.actualCompletionDate && (
                                    <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Delivered: {new Date(topic.actualCompletionDate).toLocaleDateString()}</span>
                                    </span>
                                  )}
                                </div>

                                {topic.teachingNotes && (
                                  <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700 italic">
                                    "{topic.teachingNotes}"
                                  </div>
                                )}
                              </div>

                              {/* Topic Actions */}
                              <div className="flex items-center space-x-1.5 self-end md:self-center">
                                {/* Quick status toggles */}
                                {topic.status !== 'completed' ? (
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    icon={CheckCircle2}
                                    onClick={() => handleQuickStatusChange(unit, topic, 'completed')}
                                    className="text-emerald-700 hover:text-emerald-800"
                                    title="Mark Completed"
                                  >
                                    Done
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() => handleQuickStatusChange(unit, topic, 'in_progress')}
                                    title="Reopen as In Progress"
                                  >
                                    Reopen
                                  </Button>
                                )}

                                <Button
                                  variant="secondary"
                                  size="xs"
                                  icon={FileText}
                                  onClick={() => handleOpenProgressModal(unit, topic)}
                                  title="Record Notes & Status"
                                >
                                  Notes
                                </Button>

                                <Button
                                  variant="secondary"
                                  size="xs"
                                  icon={Edit2}
                                  onClick={() => handleOpenEditTopic(unit, topic)}
                                  title="Edit Topic"
                                />

                                <Button
                                  variant="secondary"
                                  size="xs"
                                  icon={Trash2}
                                  onClick={() => handlePromptDeleteTopic(unit, topic)}
                                  className="text-rose-600 hover:text-rose-700"
                                  title="Delete Topic"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. VIEW B: COVERAGE ANALYTICS */}
      {activeView === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Unit-wise Progress Breakdown */}
            <Card
              title="Unit-by-Unit Delivery Progress"
              subtitle="Completion percentage across curriculum units"
            >
              <div className="space-y-3.5">
                {summary.unitSummaries?.map((u, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-800">
                        Unit {u.unitNumber}: {u.title}
                      </span>
                      <span className="font-mono font-bold text-purple-900">
                        {u.completionPercentage}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${u.completionPercentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{u.completedTopics} of {u.totalTopics} topics delivered</span>
                      <span>{u.plannedHours} teaching hours</span>
                    </div>
                  </div>
                ))}

                {(!summary.unitSummaries || summary.unitSummaries.length === 0) && (
                  <p className="text-xs text-slate-400 py-6 text-center">No units configured.</p>
                )}
              </div>
            </Card>

            {/* Teaching Hours & Velocity Context */}
            <Card
              title="Planned vs Delivered Teaching Hours"
              subtitle="Calculated hours based on curriculum estimates"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 text-center">
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                      Delivered Hours
                    </span>
                    <span className="text-2xl font-bold text-purple-950 mt-1 block">
                      {summary.completedEstimatedHours} hrs
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Evaluated through topics
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Remaining Hours
                    </span>
                    <span className="text-2xl font-bold text-slate-900 mt-1 block">
                      {summary.remainingHours} hrs
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Of {summary.totalEstimatedHours} total hrs
                    </span>
                  </div>
                </div>

                {/* Timetable schedule context */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                  <div className="flex items-center space-x-2 text-slate-800 text-xs font-bold mb-2">
                    <Clock className="w-4 h-4 text-purple-700" />
                    <span>Timetable Integration Context</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    You have <span className="font-bold text-purple-900">{subjectSlots.length} weekly timetable sessions</span> scheduled for this subject.
                    At this rate (~{subjectSlots.length} hours/week), remaining curriculum delivery will take approximately{' '}
                    <span className="font-bold text-purple-900">
                      {subjectSlots.length > 0 ? Math.ceil(summary.remainingHours / subjectSlots.length) : 'N/A'} weeks
                    </span>.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {subjectSlots.map((slot, i) => (
                      <div key={i} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] flex items-center space-x-1.5 font-medium text-slate-700">
                        <span className="font-bold text-purple-900">{slot.dayOfWeek}</span>
                        <span>Period {slot.periodNumber}</span>
                        <span className="text-slate-400">({slot.startTime})</span>
                        {slot.roomNumber && <span className="text-slate-500">&bull; {slot.roomNumber}</span>}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-400 flex items-center space-x-1">
                    <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Timetable provides schedule context; topic progress must be explicitly recorded.</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 6. VIEW C: UPDATE HISTORY */}
      {activeView === 'history' && (
        <Card
          title="Syllabus Progress Audit Trail"
          subtitle="Verifiable timeline of topic status transitions and faculty teaching notes"
          headerAction={
            <Button
              variant="secondary"
              size="xs"
              icon={RefreshCw}
              onClick={() => loadHistory(1)}
            >
              Refresh History
            </Button>
          }
        >
          {historyRecords.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No progress history logged yet for this subject.
            </div>
          ) : (
            <div className="space-y-3">
              {historyRecords.map((rec) => (
                <div
                  key={rec._id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">
                        {rec.topicTitle || rec.unitTitle || 'Curriculum Milestone'}
                      </span>
                      {rec.unitNumber && (
                        <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          Unit {rec.unitNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
                      <span className="capitalize font-medium text-slate-600">
                        {rec.previousStatus?.replace('_', ' ')} &rarr; <span className="font-bold text-purple-900">{rec.newStatus?.replace('_', ' ')}</span>
                      </span>
                      <span>&bull;</span>
                      <span>By {rec.updatedBy?.name || 'Faculty'}</span>
                    </div>

                    {rec.notes && (
                      <p className="text-[11px] text-slate-700 italic mt-1 bg-white p-2 rounded border border-slate-100">
                        "{rec.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 text-[10px] text-slate-400 font-mono">
                    {new Date(rec.createdAt).toLocaleDateString()} at {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {historyPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    Page {historyPagination.page} of {historyPagination.totalPages}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={historyPagination.page === 1}
                      onClick={() => setHistoryPagination((p) => ({ ...p, page: p.page - 1 }))}
                      icon={ChevronLeft}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={historyPagination.page >= historyPagination.totalPages}
                      onClick={() => setHistoryPagination((p) => ({ ...p, page: p.page + 1 }))}
                      icon={ChevronRight}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* --- MODAL 1: ADD / EDIT UNIT --- */}
      <Modal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        title={editingUnit ? `Edit Unit ${editingUnit.unitNumber}` : 'Add Curriculum Unit'}
        subtitle="Define syllabus unit title, description, and planned delivery hours"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsUnitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="purple" size="sm" onClick={handleSaveUnit} isLoading={isSubmitting}>
              {editingUnit ? 'Save Changes' : 'Create Unit'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveUnit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Unit Title *</label>
            <input
              type="text"
              required
              value={unitForm.title}
              onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
              placeholder="e.g. Unit I: Foundations & Computational Complexity"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Syllabus Scope</label>
            <textarea
              rows={3}
              value={unitForm.description}
              onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
              placeholder="Summary of topics covered, references, and core objectives..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Planned Hours</label>
              <input
                type="number"
                min={1}
                max={50}
                value={unitForm.plannedHours}
                onChange={(e) => setUnitForm({ ...unitForm, plannedHours: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Planned Start</label>
              <input
                type="date"
                value={unitForm.plannedStartDate}
                onChange={(e) => setUnitForm({ ...unitForm, plannedStartDate: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target End</label>
              <input
                type="date"
                value={unitForm.targetCompletionDate}
                onChange={(e) => setUnitForm({ ...unitForm, targetCompletionDate: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: ADD / EDIT TOPIC --- */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title={editingTopic ? 'Edit Topic' : `Add Topic to Unit ${targetUnitForTopic?.unitNumber}`}
        subtitle="Define teaching topic title, estimated teaching hours, and target completion date"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsTopicModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="purple" size="sm" onClick={handleSaveTopic} isLoading={isSubmitting}>
              {editingTopic ? 'Save Changes' : 'Add Topic'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Topic Title *</label>
            <input
              type="text"
              required
              value={topicForm.title}
              onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
              placeholder="e.g. Asymptotic Complexity and Big-O Proofs"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={topicForm.description}
              onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
              placeholder="Specific lecture plan or textbook chapter reference..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                min={0.5}
                max={20}
                value={topicForm.estimatedHours}
                onChange={(e) => setTopicForm({ ...topicForm, estimatedHours: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Planned Completion Date</label>
              <input
                type="date"
                value={topicForm.plannedCompletionDate}
                onChange={(e) => setTopicForm({ ...topicForm, plannedCompletionDate: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 3: TOPIC PROGRESS & TEACHING NOTES --- */}
      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title={`Record Progress: ${activeProgressTopic?.title || 'Topic'}`}
        subtitle={`Unit ${activeProgressUnit?.unitNumber}: ${activeProgressUnit?.title || ''}`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsProgressModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="purple" size="sm" onClick={handleSaveProgress} isLoading={isSubmitting}>
              Record Progress
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveProgress} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Topic Delivery Status *</label>
            <select
              value={progressForm.status}
              onChange={(e) => setProgressForm({ ...progressForm, status: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress (Currently Teaching)</option>
              <option value="completed">Completed (Delivered & Verified)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Teaching Notes & Observations</label>
            <textarea
              rows={4}
              value={progressForm.teachingNotes}
              onChange={(e) => setProgressForm({ ...progressForm, teachingNotes: e.target.value })}
              placeholder="e.g. Covered lecture slides 1-35. Students solved live exercises on whiteboard. Recommended homework questions 4-8."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Progress updates are logged in the subject history audit trail with your faculty timestamp.
          </p>
        </form>
      </Modal>

      {/* --- MODAL 4: CONFIRM DELETION --- */}
      <Modal
        isOpen={confirmDeleteModal.isOpen}
        onClose={() => setConfirmDeleteModal({ ...confirmDeleteModal, isOpen: false })}
        title={confirmDeleteModal.title}
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDeleteModal({ ...confirmDeleteModal, isOpen: false })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isSubmitting}
            >
              Delete Permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 leading-relaxed">
            {confirmDeleteModal.warningText}
          </p>
          <p className="text-[11px] text-rose-600 font-medium">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default SmartSyllabusTrackerSection;
