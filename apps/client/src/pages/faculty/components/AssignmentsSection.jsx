import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Award,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  Send,
  Download,
  Filter,
  Search,
  X,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Paperclip
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import Notification from '../../../components/common/Notification';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import api from '../../../api/apiClient';

export const AssignmentsSection = ({
  assignments = [],
  assignedSubjects = [],
  enrolledStudents = [],
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onPublishAssignment,
  onEvaluateSubmission,
  isLoading = false
}) => {
  // Filters & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState(null);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    semester: 3,
    section: 'A',
    maxMarks: 20,
    publishDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    instructionsUrl: '',
    status: 'published'
  });

  // Evaluation & Submissions Modal state
  const [evaluationInputs, setEvaluationInputs] = useState({});
  const [evalSubmittingId, setEvalSubmittingId] = useState(null);
  const [evalError, setEvalError] = useState('');
  const [evalSuccess, setEvalSuccess] = useState('');
  const [submissionsTab, setSubmissionsTab] = useState('submissions'); // 'submissions' | 'roster'
  const [submissionsFilter, setSubmissionsFilter] = useState('all'); // 'all' | 'evaluated' | 'pending'
  const [submissionsSearch, setSubmissionsSearch] = useState('');
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Overall statistics calculation
  const stats = useMemo(() => {
    let totalSubmissions = 0;
    let totalEvaluated = 0;
    let totalPendingEval = 0;
    let publishedCount = 0;

    assignments.forEach((a) => {
      if (a.status === 'published' || a.status === 'active') publishedCount++;
      const subCount = a.submissionCount !== undefined ? a.submissionCount : (a.submissions?.length || 0);
      const evalCount = a.evaluatedCount !== undefined
        ? a.evaluatedCount
        : (a.submissions || []).filter((s) => s.status === 'evaluated').length;

      totalSubmissions += subCount;
      totalEvaluated += evalCount;
      totalPendingEval += Math.max(0, subCount - evalCount);
    });

    return {
      total: assignments.length,
      published: publishedCount,
      submissions: totalSubmissions,
      evaluated: totalEvaluated,
      pendingEvaluation: totalPendingEval
    };
  }, [assignments]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      const subId = a.subject?._id || a.subject?.id || a.subject;
      if (subjectFilter !== 'all' && String(subId) !== String(subjectFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (a.title || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        const subName = (a.subject?.name || '').toLowerCase();
        const subCode = (a.subject?.code || '').toLowerCase();
        if (!title.includes(q) && !desc.includes(q) && !subName.includes(q) && !subCode.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [assignments, statusFilter, subjectFilter, searchQuery]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingAssignment(null);
    const initialSub = assignedSubjects[0];
    const initialSec = Array.isArray(initialSub?.sections) && initialSub.sections.length > 0
      ? initialSub.sections[0]
      : (initialSub?.section || 'A');

    setFormData({
      title: '',
      description: '',
      subject: initialSub?._id || initialSub?.id || '',
      semester: initialSub?.semester || 3,
      section: initialSec,
      maxMarks: 20,
      publishDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      instructionsUrl: '',
      status: 'published'
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (assign) => {
    setEditingAssignment(assign);
    const subId = assign.subject?._id || assign.subject?.id || assign.subject;
    setFormData({
      title: assign.title || '',
      description: assign.description || '',
      subject: subId || '',
      semester: assign.semester || 3,
      section: assign.section || 'A',
      maxMarks: assign.maxMarks || 20,
      publishDate: assign.publishDate ? new Date(assign.publishDate).toISOString().split('T')[0] : '',
      dueDate: assign.dueDate ? new Date(assign.dueDate).toISOString().split('T')[0] : '',
      instructionsUrl: assign.instructionsUrl || '',
      status: assign.status || 'published'
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Submit Create / Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Assignment title is required.');
      return;
    }
    if (!formData.subject) {
      setFormError('Please select an assigned subject.');
      return;
    }
    if (Number(formData.maxMarks) <= 0) {
      setFormError('Maximum marks must be greater than 0.');
      return;
    }
    if (!formData.dueDate) {
      setFormError('Submission deadline is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAssignment) {
        await onUpdateAssignment(editingAssignment._id || editingAssignment.id, formData);
      } else {
        await onCreateAssignment(formData);
      }
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm and execute delete
  const handleConfirmDelete = async () => {
    if (!deletingAssignmentId) return;
    setIsDeleting(true);
    try {
      await onDeleteAssignment(deletingAssignmentId);
      setDeletingAssignmentId(null);
    } catch (err) {
      console.warn('Failed to delete assignment:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Submissions tracking & evaluation modal
  const handleOpenSubmissions = async (assign) => {
    setViewingSubmissionsAssignment(assign);
    setEvalError('');
    setEvalSuccess('');
    setSubmissionsTab('submissions');
    setSubmissionsFilter('all');
    setSubmissionsSearch('');
    setIsLoadingSubmissions(true);

    try {
      const res = await api.getAssignmentSubmissions(assign._id || assign.id);
      if (res?.data) {
        const subs = res.data.submissions || [];
        const ros = res.data.roster || [];
        setViewingSubmissionsAssignment({
          ...assign,
          submissions: subs,
          roster: ros,
          summary: res.data.summary
        });

        const inputs = {};
        subs.forEach((sub) => {
          inputs[sub._id || sub.id] = {
            marksObtained: sub.marksObtained !== undefined && sub.marksObtained !== null ? sub.marksObtained : '',
            feedback: sub.feedback || ''
          };
        });
        setEvaluationInputs(inputs);
      }
    } catch (err) {
      console.warn('Failed to fetch assignment submissions:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Grade evaluation submission
  const handleGradeSubmit = async (submissionId) => {
    if (!viewingSubmissionsAssignment) return;
    const input = evaluationInputs[submissionId] || {};
    const marks = Number(input.marksObtained);

    if (input.marksObtained === '' || isNaN(marks)) {
      setEvalError('Please enter a valid numeric score.');
      return;
    }

    const maxMarks = viewingSubmissionsAssignment.maxMarks || 100;
    if (marks < 0 || marks > maxMarks) {
      setEvalError(`Marks must be between 0 and ${maxMarks}.`);
      return;
    }

    setEvalError('');
    setEvalSuccess('');
    setEvalSubmittingId(submissionId);
    try {
      await onEvaluateSubmission(
        viewingSubmissionsAssignment._id || viewingSubmissionsAssignment.id,
        submissionId,
        {
          marksObtained: marks,
          feedback: input.feedback || 'Good effort'
        }
      );

      // Instant optimistic state update
      if (viewingSubmissionsAssignment.submissions) {
        const sub = viewingSubmissionsAssignment.submissions.find((s) => (s._id || s.id) === submissionId);
        if (sub) {
          sub.marksObtained = marks;
          sub.feedback = input.feedback || 'Good effort';
          sub.status = 'evaluated';
          sub.evaluatedAt = new Date().toISOString();
        }
      }
      setEvalSuccess('Evaluation grade and feedback persisted successfully.');
    } catch (err) {
      setEvalError(err.message || 'Failed to submit grade evaluation.');
    } finally {
      setEvalSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <Badge variant="blue" size="xs">Published</Badge>;
      case 'active':
        return <Badge variant="purple" size="xs">Active</Badge>;
      case 'deadline_passed':
        return <Badge variant="amber" size="xs">Deadline Passed</Badge>;
      case 'completed':
        return <Badge variant="emerald" size="xs">Completed</Badge>;
      case 'draft':
      default:
        return <Badge variant="slate" size="xs">Draft</Badge>;
    }
  };

  // Submissions inside modal filtered by search & status
  const modalFilteredSubmissions = useMemo(() => {
    if (!viewingSubmissionsAssignment?.submissions) return [];
    return viewingSubmissionsAssignment.submissions.filter((sub) => {
      if (submissionsFilter === 'evaluated' && sub.status !== 'evaluated') return false;
      if (submissionsFilter === 'pending' && sub.status === 'evaluated') return false;

      if (submissionsSearch.trim()) {
        const q = submissionsSearch.toLowerCase().trim();
        const stud = sub.student || {};
        const name = (stud.user?.name || stud.name || '').toLowerCase();
        const roll = (stud.rollNumber || '').toLowerCase();
        if (!name.includes(q) && !roll.includes(q)) return false;
      }
      return true;
    });
  }, [viewingSubmissionsAssignment, submissionsFilter, submissionsSearch]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-card">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Assignments
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
          <span className="text-[11px] text-purple-600 font-medium mt-0.5 block">
            {stats.published} Active / Published
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-card">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Submissions Received
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-teal-800">{stats.submissions}</div>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
            Across enrolled cohorts
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-card">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Evaluated & Graded
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{stats.evaluated}</div>
          <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
            Marks computed
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-card">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Grading
            </span>
          </div>
          <div className={`mt-1 text-2xl font-bold ${stats.pendingEvaluation > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {stats.pendingEvaluation}
          </div>
          <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
            {stats.pendingEvaluation === 0 ? 'Up to date' : 'Action required'}
          </span>
        </div>
      </div>

      {/* 2. Main Assignment Workplace Card */}
      <Card
        title="Faculty Assignment Management"
        subtitle="Create, configure, publish, and evaluate academic coursework for your assigned subject cohorts"
        headerAction={
          <Button
            variant="purple"
            size="sm"
            onClick={handleOpenCreate}
            icon={Plus}
            className="shadow-xs cursor-pointer"
          >
            Create Assignment
          </Button>
        }
      >
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assignments by title, description, or subject code..."
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white cursor-pointer"
              >
                <option value="all">All Statuses ({assignments.length})</option>
                <option value="published">Published</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="deadline_passed">Deadline Passed</option>
                <option value="completed">Completed</option>
              </select>

              {/* Subject Filter */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full sm:w-auto text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">All Assigned Subjects</option>
                {assignedSubjects.map((sub) => (
                  <option key={sub._id || sub.id} value={sub._id || sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 self-center">
            Showing <strong className="text-slate-900">{filteredAssignments.length}</strong> of{' '}
            <strong>{assignments.length}</strong> assignments
          </div>
        </div>

        {/* Assignments Grid */}
        {filteredAssignments.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No Assignments Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {assignments.length === 0
                ? 'Create your first course assignment to assign deliverables and grade student submissions.'
                : 'No assignments match the selected search query and filter criteria.'}
            </p>
            {assignments.length === 0 && (
              <div className="mt-4">
                <Button variant="purple" size="sm" onClick={handleOpenCreate} icon={Plus}>
                  Create First Assignment
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssignments.map((assign) => {
              const subCount = assign.submissionCount !== undefined ? assign.submissionCount : (assign.submissions?.length || 0);
              const evalCount = assign.evaluatedCount !== undefined
                ? assign.evaluatedCount
                : (assign.submissions || []).filter((s) => s.status === 'evaluated').length;
              const pendingCount = Math.max(0, subCount - evalCount);
              const subObj = assign.subject || {};
              const isDraft = assign.status === 'draft';

              return (
                <div
                  key={assign._id || assign.id}
                  className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-purple-300 hover:shadow-subtle transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                            {assign.title}
                          </h3>
                          {getStatusBadge(assign.status)}
                        </div>
                        <span className="text-xs text-purple-700 font-semibold mt-1 block">
                          {subObj.code ? `${subObj.code} - ${subObj.name}` : (subObj.name || 'Subject Course')} &bull; Sem {assign.semester} &bull; Section {assign.section || 'A'}
                        </span>
                      </div>
                      <Badge variant="navy" size="xs">
                        {assign.maxMarks} Max Marks
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                      {assign.description || 'No additional instructions provided for this assignment.'}
                    </p>

                    {/* Attached Resource / PDF Reference */}
                    {assign.instructionsUrl && (
                      <div className="mt-2.5">
                        <a
                          href={assign.instructionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors font-medium"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate max-w-xs">Attached Deliverables / Assignment Spec PDF</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 text-purple-500" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Footer & Actions */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3 text-slate-500 text-[11px] flex-wrap gap-y-1">
                      <span className="flex items-center space-x-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Due: {new Date(assign.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-teal-800 font-semibold">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        <span>{subCount} Submissions ({evalCount} Graded)</span>
                      </span>
                      {pendingCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                          {pendingCount} Pending Grading
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                      {isDraft && (
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={Send}
                          onClick={() => onPublishAssignment(assign._id || assign.id)}
                          className="text-purple-700 hover:bg-purple-50 border-purple-200"
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        variant="teal"
                        size="xs"
                        icon={Eye}
                        onClick={() => handleOpenSubmissions(assign)}
                        className="shadow-xs"
                      >
                        Submissions ({subCount})
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(assign)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Assignment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAssignmentId(assign._id || assign.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 3. CREATE / EDIT ASSIGNMENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingAssignment ? 'Edit Course Assignment' : 'Create New Course Assignment'}
        subtitle="Configure coursework problem deliverables, class section allotment, maximum marks, and submission deadlines"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="purple" size="sm" onClick={handleFormSubmit} isLoading={isSubmitting}>
              {editingAssignment ? 'Save Changes' : (formData.status === 'draft' ? 'Save as Draft' : 'Publish Assignment')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Assignment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Implementation of AVL Trees and Heap Structures"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Allocated Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.subject}
                onChange={(e) => {
                  const s = assignedSubjects.find((sub) => String(sub._id || sub.id) === e.target.value);
                  const autoSec = Array.isArray(s?.sections) && s.sections.length > 0 ? s.sections[0] : (s?.section || 'A');
                  setFormData({
                    ...formData,
                    subject: e.target.value,
                    semester: s?.semester || formData.semester,
                    section: autoSec
                  });
                }}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white cursor-pointer"
              >
                {assignedSubjects.map((sub) => (
                  <option key={sub._id || sub.id} value={sub._id || sub.id}>
                    {sub.code} - {sub.name} (Sem {sub.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Class Section <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white cursor-pointer"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="All Sections">All Sections</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Maximum Marks <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={formData.maxMarks}
                onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Publication Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white cursor-pointer"
              >
                <option value="published">Published (Visible to Students)</option>
                <option value="draft">Draft (Saved Privately)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Submission Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Assignment Description & Deliverable Instructions
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Outline assignment problem statements, submission formatting requirements, code deliverables, or rubric criteria..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Resource Link / Specification Document URL (Optional)
            </label>
            <input
              type="url"
              value={formData.instructionsUrl}
              onChange={(e) => setFormData({ ...formData, instructionsUrl: e.target.value })}
              placeholder="https://storage.college.edu/course-specs/assignment-1.pdf"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
        </form>
      </Modal>

      {/* 4. STUDENT SUBMISSION TRACKING & EVALUATION MODAL */}
      <Modal
        isOpen={Boolean(viewingSubmissionsAssignment)}
        onClose={() => setViewingSubmissionsAssignment(null)}
        title={`Submissions & Grading: ${viewingSubmissionsAssignment?.title || 'Assignment'}`}
        subtitle={`Maximum Marks: ${viewingSubmissionsAssignment?.maxMarks || 20} &bull; Deadline: ${viewingSubmissionsAssignment?.dueDate ? new Date(viewingSubmissionsAssignment.dueDate).toLocaleDateString() : 'N/A'}`}
        maxWidth="max-w-4xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setViewingSubmissionsAssignment(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {evalError && <Notification type="error" message={evalError} onClose={() => setEvalError('')} />}
          {evalSuccess && <Notification type="success" message={evalSuccess} onClose={() => setEvalSuccess('')} />}

          {/* Submissions summary banner with metrics */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm text-purple-950 block">Faculty Evaluation & Submission Console</span>
              <p className="text-xs text-purple-700 mt-0.5">
                Review submitted deliverables, record marks within maximum limit, and inspect enrolled student cohort status.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSubmissionsTab('submissions')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all text-xs cursor-pointer ${
                  submissionsTab === 'submissions'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-100/60'
                }`}
              >
                Deliverables Received ({viewingSubmissionsAssignment?.submissions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSubmissionsTab('roster')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all text-xs cursor-pointer ${
                  submissionsTab === 'roster'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-100/60'
                }`}
              >
                Enrolled Cohort Roster ({viewingSubmissionsAssignment?.roster?.length || 0})
              </button>
            </div>
          </div>

          {isLoadingSubmissions ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading student submissions and cohort records...
            </div>
          ) : submissionsTab === 'submissions' ? (
            /* TAB A: Submissions & Grading Console */
            <div className="space-y-3">
              {/* Filter and Search within submissions */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={submissionsSearch}
                    onChange={(e) => setSubmissionsSearch(e.target.value)}
                    placeholder="Search by student name or roll number..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  {submissionsSearch && (
                    <button
                      type="button"
                      onClick={() => setSubmissionsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={submissionsFilter}
                    onChange={(e) => setSubmissionsFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="all">All Submissions ({viewingSubmissionsAssignment?.submissions?.length || 0})</option>
                    <option value="pending">Pending Evaluation</option>
                    <option value="evaluated">Graded & Evaluated</option>
                  </select>
                </div>
              </div>

              {modalFilteredSubmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2.5 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-700">No submissions found matching criteria.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {viewingSubmissionsAssignment?.submissions?.length === 0
                      ? 'No students have uploaded deliverables for this assignment yet.'
                      : 'Try resetting the search or status filter.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                  {modalFilteredSubmissions.map((sub) => {
                    const subId = sub._id || sub.id;
                    const stud = sub.student || {};
                    const currentInput = evaluationInputs[subId] || {
                      marksObtained: sub.marksObtained !== undefined && sub.marksObtained !== null ? sub.marksObtained : '',
                      feedback: sub.feedback || ''
                    };
                    const isEvaluated = sub.status === 'evaluated' && sub.marksObtained !== undefined && sub.marksObtained !== null;

                    return (
                      <div
                        key={subId}
                        className={`p-4 rounded-2xl border transition-all ${
                          isEvaluated ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/20 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-purple-200 mt-0.5">
                              {(stud.user?.name || stud.name || 'ST').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="font-mono font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                  {stud.rollNumber || 'ROLL-NO'}
                                </span>
                                <span className="font-bold text-slate-900 text-sm">
                                  {stud.user?.name || stud.name || 'Student'}
                                </span>
                                {isEvaluated ? (
                                  <Badge variant="emerald" size="xs">
                                    Graded: {sub.marksObtained} / {viewingSubmissionsAssignment.maxMarks}
                                  </Badge>
                                ) : (
                                  <Badge variant="amber" size="xs">
                                    Pending Evaluation
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-1">
                                Submitted on: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recently'}
                              </span>
                            </div>
                          </div>

                          {/* Deliverable Link */}
                          {(sub.submissionUrl || (sub.attachments && sub.attachments.length > 0)) && (
                            <a
                              href={sub.submissionUrl || sub.attachments?.[0]?.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center space-x-1 font-semibold text-xs flex-shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                              <span>View Deliverable</span>
                            </a>
                          )}
                        </div>

                        {/* Student Notes / Answers */}
                        {sub.content && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-xs">
                            <span className="font-semibold text-slate-900 block mb-0.5 text-[11px]">
                              Student Submission Notes:
                            </span>
                            <p className="leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                          </div>
                        )}

                        {/* Grading Form Row */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-end gap-3">
                          <div className="w-full sm:w-36">
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Marks (0 &ndash; {viewingSubmissionsAssignment.maxMarks})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={viewingSubmissionsAssignment.maxMarks}
                              step="0.5"
                              value={currentInput.marksObtained}
                              onChange={(e) =>
                                setEvaluationInputs({
                                  ...evaluationInputs,
                                  [subId]: { ...currentInput, marksObtained: e.target.value }
                                })
                              }
                              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 font-mono text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                              placeholder="Score"
                            />
                          </div>

                          <div className="w-full flex-1">
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Evaluation Feedback & Remarks
                            </label>
                            <input
                              type="text"
                              value={currentInput.feedback}
                              onChange={(e) =>
                                setEvaluationInputs({
                                  ...evaluationInputs,
                                  [subId]: { ...currentInput, feedback: e.target.value }
                                })
                              }
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                              placeholder="e.g. Excellent algorithmic design, verified edge case handling"
                            />
                          </div>

                          <div className="w-full sm:w-auto">
                            <Button
                              variant={isEvaluated ? 'secondary' : 'teal'}
                              size="sm"
                              isLoading={evalSubmittingId === subId}
                              onClick={() => handleGradeSubmit(subId)}
                              icon={CheckCircle}
                              className="w-full sm:w-auto whitespace-nowrap"
                            >
                              {isEvaluated ? 'Update Grade' : 'Save Grade'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB B: Enrolled Cohort Roster Tracking */
            (!viewingSubmissionsAssignment?.roster || viewingSubmissionsAssignment.roster.length === 0) ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No enrolled students found for this subject's semester cohort.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Submission Status</th>
                      <th className="py-3 px-4 text-center">Submission Date</th>
                      <th className="py-3 px-4 text-right">Marks Awarded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingSubmissionsAssignment.roster.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-teal-900">{row.rollNumber}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-4 text-center">
                          {row.status === 'evaluated' && <Badge variant="emerald" size="xs">Evaluated</Badge>}
                          {row.status === 'submitted' && <Badge variant="blue" size="xs">Submitted</Badge>}
                          {row.status === 'pending' && <Badge variant="slate" size="xs">Pending</Badge>}
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">
                          {row.marksObtained !== null && row.marksObtained !== undefined
                            ? `${row.marksObtained} / ${viewingSubmissionsAssignment.maxMarks}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </Modal>

      {/* 5. DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deletingAssignmentId)}
        onClose={() => setDeletingAssignmentId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Course Assignment"
        message="Are you sure you want to delete this assignment? All associated student submissions and evaluation records will also be removed."
        confirmText="Delete Assignment"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AssignmentsSection;
