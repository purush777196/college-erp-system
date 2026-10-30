import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  UploadCloud,
  ExternalLink,
  Trash2,
  Plus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Notification from '../../../components/common/Notification';
import api from '../../../api/apiClient';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '1.2 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const SyllabusMaterialsSection = ({
  assignedSubjects = [],
  materials = [],
  onRefreshMaterials,
  onOpenSubjectDetails,
  onAddToast
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [syllabusData, setSyllabusData] = useState({});
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);
  const [updatingUnitNumber, setUpdatingUnitNumber] = useState(null);

  // Material upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [materialForm, setMaterialForm] = useState({
    title: '',
    description: '',
    subject: '',
    unitNumber: 1,
    fileName: '',
    fileUrl: '',
    fileSize: 2048576 // 2MB default
  });

  // Set initial selected subject
  useEffect(() => {
    if (assignedSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(assignedSubjects[0]._id || assignedSubjects[0].id);
    }
  }, [assignedSubjects, selectedSubjectId]);

  // Load syllabus for selected subject
  const loadSubjectSyllabus = async (subId) => {
    if (!subId) return;
    setIsLoadingSyllabus(true);
    try {
      const res = await api.getSubjectSyllabus(subId);
      if (res?.data) {
        setSyllabusData((prev) => ({
          ...prev,
          [subId]: res.data
        }));
      }
    } catch (err) {
      console.warn('Failed to load syllabus progress:', err.message);
    } finally {
      setIsLoadingSyllabus(false);
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      loadSubjectSyllabus(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const activeSubject = assignedSubjects.find(
    (s) => String(s._id || s.id) === String(selectedSubjectId)
  ) || assignedSubjects[0];

  const currentSyllabus = activeSubject ? syllabusData[activeSubject._id || activeSubject.id] : null;
  const units = currentSyllabus?.units || [];
  const completedCount = units.filter((u) => u.status === 'completed').length;
  const inProgressCount = units.filter((u) => u.status === 'in_progress').length;
  const totalUnits = units.length || 5;
  const percentComplete = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

  // Materials for selected subject
  const subjectMaterials = materials.filter((m) => {
    const subId = m.subject?._id || m.subject?.id || m.subject;
    return String(subId) === String(selectedSubjectId);
  });

  // Handle unit status update
  const handleUnitStatusChange = async (unitNumber, newStatus) => {
    if (!activeSubject) return;
    const subId = activeSubject._id || activeSubject.id;
    setUpdatingUnitNumber(unitNumber);
    try {
      const res = await api.updateUnitProgress(subId, unitNumber, {
        status: newStatus,
        completionRemarks: newStatus === 'completed' ? 'Completed standard unit lecture hours' : ''
      });
      if (res?.data) {
        setSyllabusData((prev) => ({
          ...prev,
          [subId]: res.data
        }));
      }
      onAddToast?.({
        type: 'success',
        title: 'Syllabus Updated',
        message: `Unit ${unitNumber} marked as ${newStatus.replace('_', ' ')}.`
      });
    } catch (err) {
      onAddToast?.({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update unit status.'
      });
    } finally {
      setUpdatingUnitNumber(null);
    }
  };

  // Open Material Modal
  const handleOpenUploadMaterial = () => {
    setMaterialError('');
    setMaterialForm({
      title: '',
      description: '',
      subject: activeSubject?._id || activeSubject?.id || '',
      unitNumber: 1,
      fileName: '',
      fileUrl: '',
      fileSize: 2048576
    });
    setIsUploadModalOpen(true);
  };

  // Submit Material
  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    setMaterialError('');

    if (!materialForm.title.trim()) {
      setMaterialError('Material title is required.');
      return;
    }
    if (!materialForm.fileName.trim()) {
      setMaterialError('File name is required (e.g. Unit1_Lecture_Notes.pdf).');
      return;
    }
    if (!materialForm.fileUrl.trim()) {
      setMaterialError('Resource or document URL is required.');
      return;
    }

    setIsSubmittingMaterial(true);
    try {
      await api.createMaterial({
        title: materialForm.title,
        description: materialForm.description,
        subject: materialForm.subject,
        unitNumber: Number(materialForm.unitNumber),
        fileName: materialForm.fileName,
        fileUrl: materialForm.fileUrl,
        fileSize: Number(materialForm.fileSize)
      });
      onAddToast?.({
        type: 'success',
        title: 'Learning Resource Added',
        message: `Material "${materialForm.title}" published successfully.`
      });
      setIsUploadModalOpen(false);
      onRefreshMaterials?.();
    } catch (err) {
      setMaterialError(err.message || 'Failed to upload learning material.');
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  // Delete Material
  const handleDeleteMaterial = async (id, title) => {
    try {
      await api.deleteMaterial(id);
      onAddToast?.({
        type: 'success',
        title: 'Resource Removed',
        message: `"${title}" has been deleted.`
      });
      onRefreshMaterials?.();
    } catch (err) {
      onAddToast?.({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Assigned Courses & Curriculum Syllabus"
        subtitle="Track modular curriculum unit completion and manage digital learning resources"
        headerAction={
          <div className="flex items-center gap-2">
            {activeSubject && onOpenSubjectDetails && (
              <Button
                variant="secondary"
                size="xs"
                onClick={() => onOpenSubjectDetails(activeSubject)}
              >
                Subject Details Drawer &rarr;
              </Button>
            )}
            <Button
              variant="teal"
              size="xs"
              onClick={handleOpenUploadMaterial}
              icon={UploadCloud}
            >
              Upload Material
            </Button>
          </div>
        }
      >
        {/* Subject Selector Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Active Course:</span>
          {assignedSubjects.map((sub) => {
            const isSelected = String(sub._id || sub.id) === String(selectedSubjectId);
            return (
              <button
                key={sub._id || sub.id}
                type="button"
                onClick={() => setSelectedSubjectId(sub._id || sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{sub.code}</span>
                <span className="opacity-80">({sub.name})</span>
              </button>
            );
          })}
        </div>

        {activeSubject ? (
          <div className="space-y-6">
            {/* Course Summary & Progress Bar */}
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">{activeSubject.name}</h3>
                  <Badge variant="purple" size="xs">{activeSubject.code}</Badge>
                  <Badge variant="navy" size="xs">Semester {activeSubject.semester}</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Credits: {activeSubject.credits} &bull; Room: {activeSubject.roomNumber || 'LH-101'} &bull; Department: {activeSubject.department?.name || 'Engineering'}
                </p>
              </div>

              {/* Progress Metric */}
              <div className="min-w-64">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-purple-900">Syllabus Completion</span>
                  <span className="font-bold font-mono text-purple-700">{percentComplete}% ({completedCount}/{totalUnits} Units)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-purple-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-teal-500 transition-all duration-500 rounded-full"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Units Progress Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Curriculum Units & Syllabus Delivery Progress
                </h4>
                <span className="text-[11px] text-slate-500">
                  {completedCount} Completed &bull; {inProgressCount} In Progress &bull; {totalUnits - completedCount - inProgressCount} Not Started
                </span>
              </div>

              {isLoadingSyllabus ? (
                <p className="text-xs text-slate-400 py-6 text-center">Loading syllabus units...</p>
              ) : (
                <div className="space-y-2.5">
                  {units.map((unit) => {
                    const isUpdating = updatingUnitNumber === unit.unitNumber;
                    return (
                      <div
                        key={unit.unitNumber}
                        className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-purple-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{unit.title}</span>
                            {unit.status === 'completed' && <Badge variant="emerald" size="xs">Completed</Badge>}
                            {unit.status === 'in_progress' && <Badge variant="amber" size="xs">In Progress</Badge>}
                            {unit.status === 'not_started' && <Badge variant="slate" size="xs">Not Started</Badge>}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            Planned: {unit.plannedHours || 10} lecture hours
                            {unit.completedAt && ` &bull; Completed on ${new Date(unit.completedAt).toLocaleDateString()}`}
                            {unit.completionRemarks && ` &bull; ${unit.completionRemarks}`}
                          </span>
                        </div>

                        {/* Status Change Buttons */}
                        <div className="flex items-center space-x-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUnitStatusChange(unit.unitNumber, 'not_started')}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              unit.status === 'not_started'
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Not Started
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUnitStatusChange(unit.unitNumber, 'in_progress')}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              unit.status === 'in_progress'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            In Progress
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUnitStatusChange(unit.unitNumber, 'completed')}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1 ${
                              unit.status === 'completed'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Course Learning Materials */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Course Learning Materials & Resources
                  </h4>
                  <p className="text-[11px] text-slate-400">PDF notes, presentation decks, and lab handouts for enrolled students</p>
                </div>
                <Button variant="secondary" size="xs" onClick={handleOpenUploadMaterial} icon={Plus}>
                  Add Resource
                </Button>
              </div>

              {subjectMaterials.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <FileText className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">No learning materials uploaded yet for {activeSubject.code}.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Share lecture notes or revision guides with students.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjectMaterials.map((mat) => (
                    <div
                      key={mat._id || mat.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-purple-200 transition-all flex flex-col justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 block truncate">{mat.title}</span>
                            <span className="text-[11px] text-purple-700 font-medium block mt-0.5">
                              Unit {mat.unitNumber} &bull; {mat.fileName}
                            </span>
                          </div>
                          <Badge variant="teal" size="xs">{formatBytes(mat.fileSize)}</Badge>
                        </div>
                        {mat.description && (
                          <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                            {mat.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <a
                          href={mat.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center space-x-1 text-[11px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Access / Download</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(mat._id || mat.id, mat.title)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Delete material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">No assigned subjects found for this faculty profile.</p>
        )}
      </Card>

      {/* UPLOAD / ADD LEARNING MATERIAL MODAL */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Course Learning Material"
        subtitle="Associate lecture notes, PDF slides, or lab manuals with course curriculum units"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsUploadModalOpen(false)} disabled={isSubmittingMaterial}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleMaterialSubmit} isLoading={isSubmittingMaterial}>
              Publish Resource
            </Button>
          </>
        }
      >
        <form onSubmit={handleMaterialSubmit} className="space-y-4">
          {materialError && <Notification type="error" message={materialError} onClose={() => setMaterialError('')} />}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Resource Title *</label>
            <input
              type="text"
              required
              value={materialForm.title}
              onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
              placeholder="e.g. Unit 2 Lecture Notes & Solved Algorithms"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Subject Course *</label>
              <select
                value={materialForm.subject}
                onChange={(e) => setMaterialForm({ ...materialForm, subject: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
              >
                {assignedSubjects.map((sub) => (
                  <option key={sub._id || sub.id} value={sub._id || sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Curriculum Unit *</label>
              <select
                value={materialForm.unitNumber}
                onChange={(e) => setMaterialForm({ ...materialForm, unitNumber: Number(e.target.value) })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
              >
                <option value="1">Unit 1: Foundations & Principles</option>
                <option value="2">Unit 2: Core Methodologies & Models</option>
                <option value="3">Unit 3: Analytical Algorithms</option>
                <option value="4">Unit 4: Advanced Applications</option>
                <option value="5">Unit 5: Emerging Paradigms</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Document File Name *</label>
            <input
              type="text"
              required
              value={materialForm.fileName}
              onChange={(e) => setMaterialForm({ ...materialForm, fileName: e.target.value })}
              placeholder="e.g. CS301_Unit2_Trees_Handout.pdf"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Secure Resource URL *</label>
            <input
              type="url"
              required
              value={materialForm.fileUrl}
              onChange={(e) => setMaterialForm({ ...materialForm, fileUrl: e.target.value })}
              placeholder="https://storage.college.edu/materials/cs301_handout.pdf"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description / Summary (Optional)</label>
            <textarea
              rows={2}
              value={materialForm.description}
              onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
              placeholder="Summary of topics covered, references, or reading guidance..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SyllabusMaterialsSection;
