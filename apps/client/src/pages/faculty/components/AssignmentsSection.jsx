import React, { useState } from 'react';
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
  Filter
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import Notification from '../../../components/common/Notification';
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState(null);

  // Form state
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    semester: 3,
    maxMarks: 20,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    instructionsUrl: '',
    status: 'published'
  });

  // Evaluation state for active submission modal
  const [evaluationInputs, setEvaluationInputs] = useState({});
  const [evalSubmittingId, setEvalSubmittingId] = useState(null);
  const [evalError, setEvalError] = useState('');
  const [submissionsTab, setSubmissionsTab] = useState('submissions');
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    const subId = a.subject?._id || a.subject?.id || a.subject;
    if (subjectFilter !== 'all' && String(subId) !== String(subjectFilter)) return false;
    return true;
  });

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setFormData({
      title: '',
      description: '',
      subject: assignedSubjects[0]?._id || assignedSubjects[0]?.id || '',
      semester: assignedSubjects[0]?.semester || 3,
      maxMarks: 20,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      instructionsUrl: '',
      status: 'published'
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (assign) => {
    setEditingAssignment(assign);
    const subId = assign.subject?._id || assign.subject?.id || assign.subject;
    setFormData({
      title: assign.title || '',
      description: assign.description || '',
      subject: subId || '',
      semester: assign.semester || 3,
      maxMarks: assign.maxMarks || 20,
      dueDate: assign.dueDate ? new Date(assign.dueDate).toISOString().split('T')[0] : '',
      instructionsUrl: assign.instructionsUrl || '',
      status: assign.status || 'published'
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

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

  const handleOpenSubmissions = async (assign) => {
    setViewingSubmissionsAssignment(assign);
    setEvalError('');
    setSubmissionsTab('submissions');
    setIsLoadingSubmissions(true);

    try {
      const res = await api.getAssignmentSubmissions(assign._id || assign.id);
      if (res?.data) {
        const subs = res.data.submissions || [];
        const ros = res.data.roster || [];
        setViewingSubmissionsAssignment({
          ...assign,
          submissions: subs,
          roster: ros
        });

        const inputs = {};
        subs.forEach((sub) => {
          inputs[sub._id || sub.id] = {
            marksObtained: sub.marksObtained !== undefined ? sub.marksObtained : '',
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

  const handleGradeSubmit = async (submissionId) => {
    if (!viewingSubmissionsAssignment) return;
    const input = evaluationInputs[submissionId] || {};
    const marks = Number(input.marksObtained);

    if (input.marksObtained === '' || isNaN(marks)) {
      setEvalError('Please enter a valid numeric grade.');
      return;
    }

    const maxMarks = viewingSubmissionsAssignment.maxMarks || 100;
    if (marks < 0 || marks > maxMarks) {
      setEvalError(`Marks must be between 0 and ${maxMarks}.`);
      return;
    }

    setEvalError('');
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
      // Update local view
      if (viewingSubmissionsAssignment.submissions) {
        const sub = viewingSubmissionsAssignment.submissions.find((s) => (s._id || s.id) === submissionId);
        if (sub) {
          sub.marksObtained = marks;
          sub.feedback = input.feedback || 'Good effort';
          sub.status = 'evaluated';
        }
      }
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

  return (
    <div className="space-y-6">
      <Card
        title="Faculty Assignment Management"
        subtitle="Create, publish, and evaluate academic assignments for assigned subjects"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="teal"
              size="xs"
              onClick={handleOpenCreate}
              icon={Plus}
            >
              New Assignment
            </Button>
          </div>
        }
      >
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Statuses ({assignments.length})</option>
              <option value="published">Published</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="deadline_passed">Deadline Passed</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Allocated Subjects</option>
              {assignedSubjects.map((sub) => (
                <option key={sub._id || sub.id} value={sub._id || sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredAssignments.length}</strong> assignments
          </div>
        </div>

        {/* Assignments List */}
        {filteredAssignments.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No assignments match the selected criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Create an assignment to start assigning coursework to enrolled students.</p>
            <div className="mt-4">
              <Button variant="secondary" size="xs" onClick={handleOpenCreate} icon={Plus}>
                Create First Assignment
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssignments.map((assign) => {
              const subCount = assign.submissions?.length || 0;
              const evalCount = (assign.submissions || []).filter((s) => s.status === 'evaluated').length;
              const subObj = assign.subject || {};
              const isDraft = assign.status === 'draft';

              return (
                <div
                  key={assign._id || assign.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-purple-300 hover:shadow-subtle transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900 block">{assign.title}</span>
                          {getStatusBadge(assign.status)}
                        </div>
                        <span className="text-xs text-purple-700 font-medium mt-0.5 block">
                          {subObj.code ? `${subObj.code} - ${subObj.name}` : (subObj.name || 'Subject Course')} &bull; Sem {assign.semester}
                        </span>
                      </div>
                      <Badge variant="navy" size="xs">{assign.maxMarks} Marks</Badge>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-2">
                      {assign.description || 'No additional instructions provided.'}
                    </p>

                    {assign.instructionsUrl && (
                      <a
                        href={assign.instructionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] text-purple-600 hover:underline mt-2 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Attached Resources / Syllabus Reference</span>
                      </a>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due: {new Date(assign.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-teal-700 font-semibold">
                        <Users className="w-3 h-3" />
                        <span>{subCount} Submissions ({evalCount} Graded)</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => onPublishAssignment(assign._id || assign.id)}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenSubmissions(assign)}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Submissions ({subCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(assign)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                        title="Edit Assignment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAssignment(assign._id || assign.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
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

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingAssignment ? 'Edit Course Assignment' : 'Create Course Assignment'}
        subtitle="Set task deliverables, maximum marks, and submission deadlines"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleFormSubmit} isLoading={isSubmitting}>
              {editingAssignment ? 'Save Changes' : (formData.status === 'draft' ? 'Save as Draft' : 'Publish Assignment')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Assignment Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Implementation of AVL Trees and Heap Structures"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Allocated Subject *</label>
              <select
                value={formData.subject}
                onChange={(e) => {
                  const s = assignedSubjects.find((sub) => String(sub._id || sub.id) === e.target.value);
                  setFormData({
                    ...formData,
                    subject: e.target.value,
                    semester: s?.semester || formData.semester
                  });
                }}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
              >
                {assignedSubjects.map((sub) => (
                  <option key={sub._id || sub.id} value={sub._id || sub.id}>
                    {sub.code} - {sub.name} (Sem {sub.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Maximum Marks *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={formData.maxMarks}
                onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Submission Deadline *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Publication Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
              >
                <option value="published">Published (Visible to Students)</option>
                <option value="draft">Draft (Saved Privately)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Assignment Problem & Deliverables Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide assignment questions, formatting requirements, code deliverables, or guidelines..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Resource Link / Attached PDF URL (Optional)</label>
            <input
              type="url"
              value={formData.instructionsUrl}
              onChange={(e) => setFormData({ ...formData, instructionsUrl: e.target.value })}
              placeholder="https://drive.college.edu/resources/assignment-spec.pdf"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </form>
      </Modal>

      {/* STUDENT SUBMISSION TRACKING & EVALUATION MODAL */}
      <Modal
        isOpen={Boolean(viewingSubmissionsAssignment)}
        onClose={() => setViewingSubmissionsAssignment(null)}
        title={`Submissions & Grading: ${viewingSubmissionsAssignment?.title || 'Assignment'}`}
        subtitle={`Max Marks: ${viewingSubmissionsAssignment?.maxMarks || 20} &bull; Due: ${viewingSubmissionsAssignment?.dueDate ? new Date(viewingSubmissionsAssignment.dueDate).toLocaleDateString() : 'N/A'}`}
        maxWidth="max-w-3xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setViewingSubmissionsAssignment(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {evalError && <Notification type="error" message={evalError} onClose={() => setEvalError('')} />}

          {/* Submissions summary banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-900 gap-2">
            <div>
              <span className="font-semibold block">Faculty Submission & Evaluation Console</span>
              <span>Track which students submitted, inspect deliverables, and assign evaluated grades.</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSubmissionsTab('submissions')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-xs ${
                  submissionsTab === 'submissions'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-white text-purple-700 hover:bg-purple-100'
                }`}
              >
                Deliverables ({viewingSubmissionsAssignment?.submissions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSubmissionsTab('roster')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-xs ${
                  submissionsTab === 'roster'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-white text-purple-700 hover:bg-purple-100'
                }`}
              >
                Enrolled Roster ({viewingSubmissionsAssignment?.roster?.length || 0})
              </button>
            </div>
          </div>

          {isLoadingSubmissions ? (
            <p className="text-xs text-slate-400 py-10 text-center">Loading submission data and enrolled roster...</p>
          ) : submissionsTab === 'submissions' ? (
            /* Tab 1: Submissions Evaluation Console */
            (!viewingSubmissionsAssignment?.submissions || viewingSubmissionsAssignment.submissions.length === 0) ? (
              <div className="py-10 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No student submissions recorded yet for this assignment.</p>
                <p className="text-[11px] text-slate-400 mt-1">Students enrolled in this course will appear here once they upload deliverables.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {viewingSubmissionsAssignment.submissions.map((sub) => {
                  const subId = sub._id || sub.id;
                  const stud = sub.student || {};
                  const currentInput = evaluationInputs[subId] || {
                    marksObtained: sub.marksObtained !== undefined ? sub.marksObtained : '',
                    feedback: sub.feedback || ''
                  };
                  const isEvaluated = sub.status === 'evaluated' && sub.marksObtained !== undefined;

                  return (
                    <div
                      key={subId}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-teal-900">{stud.rollNumber || 'STU-ID'}</span>
                            <span className="font-semibold text-slate-900">{stud.user?.name || stud.name || 'Student'}</span>
                            {isEvaluated ? (
                              <Badge variant="emerald" size="xs">Graded: {sub.marksObtained} / {viewingSubmissionsAssignment.maxMarks}</Badge>
                            ) : (
                              <Badge variant="amber" size="xs">Pending Evaluation</Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recently'}
                          </span>
                        </div>

                        {sub.submissionUrl && (
                          <a
                            href={sub.submissionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors inline-flex items-center space-x-1 font-medium text-[11px]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View Deliverable</span>
                          </a>
                        )}
                      </div>

                      {sub.content && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 text-[11px]">
                          <span className="font-semibold text-slate-900 block mb-0.5">Student Note:</span>
                          <span>{sub.content}</span>
                        </div>
                      )}

                      {/* Grading Form Row */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                        <div className="w-full sm:w-32">
                          <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                            Marks (0 - {viewingSubmissionsAssignment.maxMarks})
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
                            className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 font-mono text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder="Marks"
                          />
                        </div>

                        <div className="w-full flex-1">
                          <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Feedback / Comments</label>
                          <input
                            type="text"
                            value={currentInput.feedback}
                            onChange={(e) =>
                              setEvaluationInputs({
                                ...evaluationInputs,
                                [subId]: { ...currentInput, feedback: e.target.value }
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder="e.g. Excellent algorithmic structure and modular tests"
                          />
                        </div>

                        <div className="w-full sm:w-auto pt-4 sm:pt-3">
                          <Button
                            variant="teal"
                            size="xs"
                            isLoading={evalSubmittingId === subId}
                            onClick={() => handleGradeSubmit(subId)}
                            icon={CheckCircle}
                          >
                            Save Grade
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Tab 2: Enrolled Student Roster Tracking */
            (!viewingSubmissionsAssignment?.roster || viewingSubmissionsAssignment.roster.length === 0) ? (
              <p className="text-xs text-slate-400 py-8 text-center">No enrolled students found for this subject's semester cohort.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Submitted At</th>
                      <th className="py-2.5 px-3 text-right">Marks / Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingSubmissionsAssignment.roster.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-900">{row.rollNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-3 text-center">
                          {row.status === 'evaluated' && <Badge variant="emerald" size="xs">Evaluated</Badge>}
                          {row.status === 'submitted' && <Badge variant="blue" size="xs">Submitted</Badge>}
                          {row.status === 'pending' && <Badge variant="slate" size="xs">Pending</Badge>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
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
    </div>
  );
};

export default AssignmentsSection;
