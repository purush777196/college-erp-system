import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen,
  FolderKanban,
  UploadCloud,
  Link2,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Download,
  Eye,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
  CheckCircle2,
  Clock,
  Lock,
  Globe,
  HardDrive,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Sparkles,
  Tag,
  Share2,
  X,
  File
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import api from '../../../api/apiClient';

const CATEGORIES = [
  'Lecture Notes',
  'Presentations',
  'Reference Books',
  'Practice Problems',
  'Previous Question Papers',
  'Lab Manuals',
  'Tutorials',
  'Videos',
  'Assignments Reference',
  'Other'
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx',
  '.xls', '.xlsx', '.txt', '.png', '.jpg',
  '.jpeg', '.webp', '.mp4'
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getFileIcon(type, ext) {
  const t = (type || '').toLowerCase();
  const e = (ext || '').toLowerCase();
  if (t === 'pdf' || e.includes('pdf')) return <FileText className="w-5 h-5 text-rose-600" />;
  if (t === 'image' || ['png', 'jpg', 'jpeg', 'webp'].some(x => e.includes(x))) {
    return <ImageIcon className="w-5 h-5 text-emerald-600" />;
  }
  if (t === 'video' || e.includes('mp4')) return <Video className="w-5 h-5 text-purple-600" />;
  if (t === 'presentation' || ['ppt', 'pptx'].some(x => e.includes(x))) {
    return <Layers className="w-5 h-5 text-amber-600" />;
  }
  if (t === 'spreadsheet' || ['xls', 'xlsx'].some(x => e.includes(x))) {
    return <FileSpreadsheet className="w-5 h-5 text-teal-600" />;
  }
  if (t === 'link') return <Link2 className="w-5 h-5 text-blue-600" />;
  return <File className="w-5 h-5 text-indigo-600" />;
}

export const LearningResourceLibrarySection = ({
  assignedSubjects = [],
  onAddToast = () => {}
}) => {
  // Active subject filter & list controls
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState('');
  const [selectedVisibility, setSelectedVisibility] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Data states
  const [resources, setResources] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: itemsPerPage, totalPages: 1 });
  const [summaryStats, setSummaryStats] = useState({
    totalResources: 0,
    publishedResources: 0,
    facultyOnlyResources: 0,
    archivedResources: 0,
    totalStorageBytes: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subject syllabus cache (for unit and topic selectors)
  const [syllabusMap, setSyllabusMap] = useState({});

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Active resource for preview / edit / delete
  const [activeResource, setActiveResource] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    category: 'Lecture Notes',
    resourceType: 'file',
    visibility: 'student_accessible',
    publicationStatus: 'published',
    unitNumber: '',
    unitTitle: '',
    topicId: '',
    topicTitle: '',
    tags: '',
    externalUrl: '',
    file: null,
    fileBase64: '',
    fileName: '',
    fileType: '',
    fileSize: 0
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch syllabus for a subject when needed
  const fetchSubjectSyllabus = useCallback(async (subjectId) => {
    if (!subjectId || syllabusMap[subjectId]) return;
    try {
      const res = await api.getSubjectSyllabus(subjectId);
      if (res?.data) {
        setSyllabusMap(prev => ({ ...prev, [subjectId]: res.data }));
      }
    } catch (err) {
      console.warn('Could not load syllabus for subject:', err.message);
    }
  }, [syllabusMap]);

  // Load Resources and Stats
  const loadResources = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        sortBy: sortBy === 'recent' || sortBy === 'oldest' ? 'createdAt' : sortBy === 'title' ? 'title' : 'fileSize',
        sortOrder: sortBy === 'oldest' ? 'asc' : 'desc'
      };

      if (selectedSubjectId) params.subject = selectedSubjectId;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedResourceType) params.resourceType = selectedResourceType;
      if (selectedVisibility) params.visibility = selectedVisibility;
      if (selectedStatus) params.publicationStatus = selectedStatus;

      const [resList, resStats] = await Promise.all([
        api.getMaterials(params),
        api.getMaterialStats({ subject: selectedSubjectId || undefined })
      ]);

      if (resList?.data) {
        setResources(resList.data);
        if (resList.pagination) {
          setPagination(resList.pagination);
        }
      }

      if (resStats?.data) {
        setSummaryStats(resStats.data);
      }
    } catch (err) {
      console.error('Failed to load resources:', err);
      onAddToast('Failed to load learning resources: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearch,
    selectedSubjectId,
    selectedCategory,
    selectedResourceType,
    selectedVisibility,
    selectedStatus,
    sortBy,
    onAddToast
  ]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Pre-fetch syllabus for assigned subjects
  useEffect(() => {
    if (assignedSubjects.length > 0) {
      assignedSubjects.forEach(s => {
        const sid = s._id || s.id;
        if (sid) fetchSubjectSyllabus(sid);
      });
    }
  }, [assignedSubjects, fetchSubjectSyllabus]);

  // Handle Refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadResources();
  };

  // Reset Form
  const resetForm = (type = 'file') => {
    const defaultSub = selectedSubjectId || (assignedSubjects[0]?._id || assignedSubjects[0]?.id || '');
    setFormData({
      title: '',
      description: '',
      subject: defaultSub,
      category: 'Lecture Notes',
      resourceType: type,
      visibility: 'student_accessible',
      publicationStatus: 'published',
      unitNumber: '',
      unitTitle: '',
      topicId: '',
      topicTitle: '',
      tags: '',
      externalUrl: '',
      file: null,
      fileBase64: '',
      fileName: '',
      fileType: '',
      fileSize: 0
    });
    setFormError('');
    setUploadProgress(0);
  };

  // Open Upload Modal
  const handleOpenUploadModal = () => {
    resetForm('file');
    setIsUploadModalOpen(true);
  };

  // Open Link Modal
  const handleOpenLinkModal = () => {
    resetForm('link');
    setIsLinkModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (resource) => {
    setActiveResource(resource);
    const subId = typeof resource.subject === 'object' ? resource.subject._id : resource.subject;
    setFormData({
      title: resource.title || '',
      description: resource.description || '',
      subject: subId || '',
      category: resource.category || 'Lecture Notes',
      resourceType: resource.resourceType || 'file',
      visibility: resource.visibility || 'student_accessible',
      publicationStatus: resource.publicationStatus || 'published',
      unitNumber: resource.unitNumber || '',
      unitTitle: resource.unitTitle || '',
      topicId: resource.topicId || '',
      topicTitle: resource.topicTitle || '',
      tags: Array.isArray(resource.tags) ? resource.tags.join(', ') : (resource.tags || ''),
      externalUrl: resource.externalUrl || '',
      fileName: resource.fileName || '',
      fileType: resource.fileType || '',
      fileSize: resource.fileSize || 0
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Handle Subject change in forms (loads syllabus)
  const handleFormSubjectChange = (subjectId) => {
    setFormData(prev => ({
      ...prev,
      subject: subjectId,
      unitNumber: '',
      unitTitle: '',
      topicId: '',
      topicTitle: ''
    }));
    if (subjectId) {
      fetchSubjectSyllabus(subjectId);
    }
  };

  // Handle Unit change in forms
  const handleFormUnitChange = (unitNumStr) => {
    if (!unitNumStr) {
      setFormData(prev => ({ ...prev, unitNumber: '', unitTitle: '', topicId: '', topicTitle: '' }));
      return;
    }
    const unitNum = parseInt(unitNumStr, 10);
    const subjectSyllabus = syllabusMap[formData.subject];
    const unit = subjectSyllabus?.units?.find(u => u.unitNumber === unitNum);
    setFormData(prev => ({
      ...prev,
      unitNumber: unitNum,
      unitTitle: unit?.title || `Unit ${unitNum}`,
      topicId: '',
      topicTitle: ''
    }));
  };

  // Handle Topic change in forms
  const handleFormTopicChange = (topicId) => {
    if (!topicId) {
      setFormData(prev => ({ ...prev, topicId: '', topicTitle: '' }));
      return;
    }
    const subjectSyllabus = syllabusMap[formData.subject];
    const unit = subjectSyllabus?.units?.find(u => u.unitNumber === formData.unitNumber);
    const topic = unit?.topics?.find(t => (t._id || t.id) === topicId);
    setFormData(prev => ({
      ...prev,
      topicId,
      topicTitle: topic?.title || ''
    }));
  };

  // File selection & validation
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setFormError(`File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of 25MB.`);
      return;
    }

    // Validate extension
    const name = file.name || '';
    const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFormError(`File type "${ext}" is not supported. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    setFormError('');
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 90);
        setUploadProgress(percent);
      }
    };

    reader.onload = () => {
      setUploadProgress(100);
      setFormData(prev => ({
        ...prev,
        file,
        fileBase64: reader.result,
        fileName: file.name,
        fileSize: file.size,
        fileType: ext.replace('.', ''),
        title: prev.title || file.name.replace(/\.[^/.]+$/, '')
      }));
    };

    reader.onerror = () => {
      setFormError('Failed to read file. Please try selecting again.');
      setUploadProgress(0);
    };

    reader.readAsDataURL(file);
  };

  // Submit File Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Resource title is required.');
      return;
    }
    if (!formData.subject) {
      setFormError('Please select a subject.');
      return;
    }
    if (!formData.fileBase64) {
      setFormError('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        subject: formData.subject,
        category: formData.category,
        resourceType: 'file',
        visibility: formData.visibility,
        publicationStatus: formData.publicationStatus,
        fileName: formData.fileName,
        fileType: formData.fileType,
        fileSize: formData.fileSize,
        fileData: formData.fileBase64,
        unitNumber: formData.unitNumber ? parseInt(formData.unitNumber, 10) : undefined,
        unitTitle: formData.unitTitle || undefined,
        topicId: formData.topicId || undefined,
        topicTitle: formData.topicTitle || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      await api.createMaterial(payload);
      onAddToast('Learning resource uploaded successfully!', 'success');
      setIsUploadModalOpen(false);
      resetForm();
      loadResources();
    } catch (err) {
      console.error('Upload failed:', err);
      setFormError(err.message || 'Failed to upload resource. Please check file size and format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit External Link
  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Resource title is required.');
      return;
    }
    if (!formData.subject) {
      setFormError('Please select a subject.');
      return;
    }
    if (!formData.externalUrl.trim()) {
      setFormError('External URL is required.');
      return;
    }
    if (!/^https?:\/\/.+/i.test(formData.externalUrl.trim())) {
      setFormError('URL must start with http:// or https://');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        subject: formData.subject,
        category: formData.category,
        resourceType: 'link',
        externalUrl: formData.externalUrl.trim(),
        fileName: `${formData.title.trim()}.url`,
        fileUrl: formData.externalUrl.trim(),
        fileType: 'link',
        fileSize: 0,
        visibility: formData.visibility,
        publicationStatus: formData.publicationStatus,
        unitNumber: formData.unitNumber ? parseInt(formData.unitNumber, 10) : undefined,
        unitTitle: formData.unitTitle || undefined,
        topicId: formData.topicId || undefined,
        topicTitle: formData.topicTitle || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      await api.createMaterial(payload);
      onAddToast('External resource link added successfully!', 'success');
      setIsLinkModalOpen(false);
      resetForm();
      loadResources();
    } catch (err) {
      console.error('Failed to add link:', err);
      setFormError(err.message || 'Failed to add link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Metadata
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Resource title is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        visibility: formData.visibility,
        publicationStatus: formData.publicationStatus,
        unitNumber: formData.unitNumber ? parseInt(formData.unitNumber, 10) : undefined,
        unitTitle: formData.unitTitle || undefined,
        topicId: formData.topicId || undefined,
        topicTitle: formData.topicTitle || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      if (formData.resourceType === 'link') {
        if (!/^https?:\/\/.+/i.test(formData.externalUrl.trim())) {
          setFormError('URL must start with http:// or https://');
          setIsSubmitting(false);
          return;
        }
        payload.externalUrl = formData.externalUrl.trim();
      }

      await api.updateMaterial(activeResource._id, payload);
      onAddToast('Resource updated successfully!', 'success');
      setIsEditModalOpen(false);
      loadResources();
    } catch (err) {
      console.error('Update failed:', err);
      setFormError(err.message || 'Failed to update resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Publish / Archive Toggle
  const handleTogglePublish = async (resource) => {
    try {
      if (resource.publicationStatus === 'published') {
        await api.updateMaterial(resource._id, { publicationStatus: 'draft' });
        onAddToast(`Resource moved to drafts.`, 'info');
      } else {
        await api.publishMaterial(resource._id);
        onAddToast(`Resource published successfully!`, 'success');
      }
      loadResources();
    } catch (err) {
      onAddToast('Status update failed: ' + err.message, 'error');
    }
  };

  const handleToggleArchive = async (resource) => {
    try {
      if (resource.publicationStatus === 'archived') {
        await api.restoreMaterial(resource._id);
        onAddToast(`Resource restored from archive.`, 'success');
      } else {
        await api.archiveMaterial(resource._id);
        onAddToast(`Resource archived.`, 'info');
      }
      loadResources();
    } catch (err) {
      onAddToast('Archive operation failed: ' + err.message, 'error');
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (resource) => {
    setActiveResource(resource);
    setIsPreviewModalOpen(true);
    setIsLoadingPreview(true);
    setPreviewContent(null);

    if (resource.resourceType === 'link') {
      setIsLoadingPreview(false);
      return;
    }

    try {
      // Fetch fresh material detail with base64 data
      const res = await api.getMaterialById(resource._id);
      if (res?.data) {
        setPreviewContent(res.data);
      }
    } catch (err) {
      console.warn('Could not load preview content:', err.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Authenticated Download
  const handleDownload = async (resource) => {
    try {
      onAddToast(`Initiating download for ${resource.fileName || resource.title}...`, 'info');
      await api.downloadMaterialBlob(resource._id, resource.fileName || `${resource.title}.${resource.fileType || 'dat'}`);
      onAddToast('Download completed successfully!', 'success');
      // Update local download count
      setResources(prev => prev.map(r => r._id === resource._id ? { ...r, downloadCount: (r.downloadCount || 0) + 1 } : r));
    } catch (err) {
      console.error('Download error:', err);
      onAddToast('Download failed: ' + (err.message || 'Permission denied or file missing'), 'error');
    }
  };

  // Delete Resource
  const handleDeleteConfirm = async () => {
    if (!activeResource) return;
    setIsSubmitting(true);
    try {
      await api.deleteMaterial(activeResource._id);
      onAddToast('Resource deleted successfully.', 'success');
      setIsDeleteModalOpen(false);
      setActiveResource(null);
      loadResources();
    } catch (err) {
      console.error('Delete failed:', err);
      onAddToast('Delete failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available units & topics for form modal based on currently selected form subject
  const currentFormSyllabus = syllabusMap[formData.subject];
  const formUnits = currentFormSyllabus?.units || [];
  const formSelectedUnit = formUnits.find(u => u.unitNumber === formData.unitNumber);
  const formTopics = formSelectedUnit?.topics || [];

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <FolderKanban className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">Learning Resource Library</h2>
            <Badge variant="purple" size="xs">Phase 4</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Central repository for lecture notes, presentations, lab manuals, reference materials, and educational links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenLinkModal}
            className="flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Link2 className="w-4 h-4 text-blue-600" />
            <span>Add External Link</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenUploadModal}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Resource</span>
          </Button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Resources</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{summaryStats.totalResources}</h3>
            <span className="text-[11px] text-slate-400">In your library</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Published</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-0.5">{summaryStats.publishedResources}</h3>
            <span className="text-[11px] text-emerald-600 font-medium">Live & accessible</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Faculty Only</p>
            <h3 className="text-2xl font-bold text-purple-700 mt-0.5">{summaryStats.facultyOnlyResources}</h3>
            <span className="text-[11px] text-purple-600 font-medium">Restricted view</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Archived</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{summaryStats.archivedResources}</h3>
            <span className="text-[11px] text-slate-400">Past terms</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Archive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-xs font-medium text-slate-500">Storage Used</p>
            <h3 className="text-2xl font-bold text-sky-700 mt-0.5">{formatBytes(summaryStats.totalStorageBytes)}</h3>
            <span className="text-[11px] text-slate-400">25MB max per file</span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <Card className="p-4 border-slate-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, subject code, unit, topic, tags..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Selector */}
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Subjects</option>
              {assignedSubjects.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>

            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Resource Type */}
            <select
              value={selectedResourceType}
              onChange={(e) => {
                setSelectedResourceType(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Types</option>
              <option value="file">Files Only</option>
              <option value="link">Links Only</option>
            </select>

            {/* Visibility */}
            <select
              value={selectedVisibility}
              onChange={(e) => {
                setSelectedVisibility(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Visibility</option>
              <option value="student_accessible">Student Accessible</option>
              <option value="faculty_only">Faculty Only</option>
            </select>

            {/* Publication Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="recent">Recently Uploaded</option>
              <option value="oldest">Oldest Uploaded</option>
              <option value="title">Title A-Z</option>
              <option value="fileSize">File Size</option>
            </select>

            {/* Clear All */}
            {(selectedSubjectId || selectedCategory || selectedResourceType || selectedVisibility || selectedStatus || debouncedSearch) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedSubjectId('');
                  setSelectedCategory('');
                  setSelectedResourceType('');
                  setSelectedVisibility('');
                  setSelectedStatus('');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* RESOURCE LIST / EXPLORER */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading learning resources...</p>
        </div>
      ) : resources.length === 0 ? (
        <div className="py-16 px-4 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="p-4 rounded-full bg-purple-50 text-purple-600 mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Learning Resources Found</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
            {debouncedSearch || selectedCategory || selectedSubjectId || selectedStatus
              ? 'No materials matched your filter criteria. Try clearing some filters or searching with different terms.'
              : 'You have not uploaded any learning materials or external links yet. Upload lecture notes, syllabus materials, or reference links to get started.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenUploadModal}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <UploadCloud className="w-4 h-4 mr-1.5" />
              Upload First Resource
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenLinkModal}
            >
              <Link2 className="w-4 h-4 mr-1.5" />
              Add External Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {resources.map((item) => {
              const subCode = item.subject?.code || '';
              const subName = item.subject?.name || '';
              const isLink = item.resourceType === 'link';
              const isFacultyOnly = item.visibility === 'faculty_only';
              const isDraft = item.publicationStatus === 'draft';
              const isArchived = item.publicationStatus === 'archived';

              return (
                <div
                  key={item._id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {/* Top Row: Icon + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">
                        {getFileIcon(item.fileType, item.fileName || item.fileType)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        {/* Visibility Badge */}
                        {isFacultyOnly ? (
                          <Badge variant="purple" size="xs" className="flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Faculty Only</span>
                          </Badge>
                        ) : (
                          <Badge variant="teal" size="xs" className="flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            <span>Students</span>
                          </Badge>
                        )}

                        {/* Status Badge */}
                        {isArchived ? (
                          <Badge variant="neutral" size="xs">Archived</Badge>
                        ) : isDraft ? (
                          <Badge variant="warning" size="xs">Draft</Badge>
                        ) : (
                          <Badge variant="success" size="xs">Published</Badge>
                        )}
                      </div>
                    </div>

                    {/* Title & Subject */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1 title={item.title}">
                        {item.title}
                      </h4>
                      <p className="text-[11px] font-medium text-purple-700 mt-0.5">
                        {subCode ? `${subCode} — ` : ''}{subName || 'General Subject'}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Syllabus Association */}
                    {(item.unitNumber || item.topicTitle) && (
                      <div className="p-2 rounded-lg bg-purple-50/60 border border-purple-100/80 text-[11px] space-y-0.5">
                        {item.unitNumber && (
                          <div className="font-semibold text-purple-900 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-purple-600" />
                            <span>Unit {item.unitNumber}: {item.unitTitle || ''}</span>
                          </div>
                        )}
                        {item.topicTitle && (
                          <p className="text-slate-600 pl-4 truncate">
                            Topic: {item.topicTitle}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Category & Tags */}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                        {item.category || 'Lecture Notes'}
                      </span>
                      {Array.isArray(item.tags) && item.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          #{tag}
                        </span>
                      ))}
                      {Array.isArray(item.tags) && item.tags.length > 2 && (
                        <span className="text-[10px] text-slate-400">+{item.tags.length - 2}</span>
                      )}
                    </div>

                    {/* File Size / Date / Analytics */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{isLink ? 'External Link' : formatBytes(item.fileSize)}</span>
                      <div className="flex items-center gap-2">
                        <span title="Views count" className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3 text-slate-400" />
                          {item.viewCount || 0}
                        </span>
                        {!isLink && (
                          <span title="Downloads count" className="flex items-center gap-0.5">
                            <Download className="w-3 h-3 text-slate-400" />
                            {item.downloadCount || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Preview / Open */}
                      <button
                        onClick={() => handleOpenPreview(item)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition"
                        title={isLink ? 'Open External Link' : 'Preview Document'}
                      >
                        {isLink ? <ExternalLink className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Download File */}
                      {!isLink && (
                        <button
                          onClick={() => handleDownload(item)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Publish / Unpublish */}
                      <button
                        onClick={() => handleTogglePublish(item)}
                        className={`p-1.5 rounded-lg transition ${
                          item.publicationStatus === 'published'
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                        title={item.publicationStatus === 'published' ? 'Unpublish to Draft' : 'Publish Resource'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Archive / Restore */}
                      <button
                        onClick={() => handleToggleArchive(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                        title={item.publicationStatus === 'archived' ? 'Restore Resource' : 'Archive Resource'}
                      >
                        {item.publicationStatus === 'archived' ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => {
                          setActiveResource(item);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} resources
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
                <span className="text-xs font-semibold px-2 text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: FILE UPLOAD */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Learning Resource"
        subtitle="Share lecture notes, presentations, lab manuals, or documents with your classes"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUploadSubmit}
              isLoading={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Upload Resource
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Subject & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Assigned Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.subject}
                onChange={(e) => handleFormSubjectChange(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                required
              >
                <option value="">Select subject...</option>
                {assignedSubjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Resource Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Syllabus Unit & Topic (Optional) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                Attach to Smart Syllabus Tracker (Optional)
              </span>
              <span className="text-[10px] text-slate-400">Phase 3 Integration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Syllabus Unit</label>
                <select
                  value={formData.unitNumber}
                  onChange={(e) => handleFormUnitChange(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  disabled={!formData.subject || formUnits.length === 0}
                >
                  <option value="">None (General Material)</option>
                  {formUnits.map(u => (
                    <option key={u.unitNumber} value={u.unitNumber}>
                      Unit {u.unitNumber}: {u.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Syllabus Topic</label>
                <select
                  value={formData.topicId}
                  onChange={(e) => handleFormTopicChange(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  disabled={!formData.unitNumber || formTopics.length === 0}
                >
                  <option value="">None (Whole Unit)</option>
                  {formTopics.map(t => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Resource Title & Description */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Resource Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Unit 3 - Tree Traversal & Binary Search Trees Lecture Slides"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Provide a brief summary or instructions for students..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* File Upload Zone */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Select File <span className="text-rose-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-4 text-center bg-slate-50/50 hover:bg-purple-50/20 transition cursor-pointer relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.mp4"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              {formData.fileName ? (
                <div>
                  <p className="text-xs font-bold text-slate-800">{formData.fileName}</p>
                  <p className="text-[11px] text-slate-500">{formatBytes(formData.fileSize)} — Click or drag to replace</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Click to browse or drag and drop your document
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, PNG, JPG, WEBP, MP4 (Max 25MB)
                  </p>
                </div>
              )}
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2 space-y-1">
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-right text-slate-500">{uploadProgress}% processed</p>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g. Trees, Algorithms, Midterm, Notes"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Visibility & Publication Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Access Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="student_accessible">Student Accessible (Enrolled students)</option>
                <option value="faculty_only">Faculty Only (Private to faculty)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Publication State</label>
              <select
                value={formData.publicationStatus}
                onChange={(e) => setFormData(prev => ({ ...prev, publicationStatus: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="published">Published Immediately</option>
                <option value="draft">Save as Draft</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD EXTERNAL LINK */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Add External Learning Link"
        subtitle="Add YouTube tutorials, official documentation, reference articles, or web resources"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsLinkModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleLinkSubmit}
              isLoading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Add Link Resource
            </Button>
          </>
        }
      >
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Assigned Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.subject}
                onChange={(e) => handleFormSubjectChange(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                required
              >
                <option value="">Select subject...</option>
                {assignedSubjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              External URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={formData.externalUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, externalUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=... or https://docs.oracle.com/..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Must begin with http:// or https://</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Resource Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. MIT OpenCourseWare - Introduction to Algorithms"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Why this link is useful for students..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="student_accessible">Student Accessible</option>
                <option value="faculty_only">Faculty Only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
              <select
                value={formData.publicationStatus}
                onChange={(e) => setFormData(prev => ({ ...prev, publicationStatus: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: EDIT RESOURCE METADATA */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Learning Resource"
        subtitle="Update title, description, category, tags, or syllabus associations"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSubmit}
              isLoading={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="student_accessible">Student Accessible</option>
                <option value="faculty_only">Faculty Only</option>
              </select>
            </div>
          </div>

          {/* Unit & Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Syllabus Unit</label>
              <select
                value={formData.unitNumber}
                onChange={(e) => handleFormUnitChange(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="">None</option>
                {formUnits.map(u => (
                  <option key={u.unitNumber} value={u.unitNumber}>
                    Unit {u.unitNumber}: {u.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Syllabus Topic</label>
              <select
                value={formData.topicId}
                onChange={(e) => handleFormTopicChange(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
                disabled={!formData.unitNumber}
              >
                <option value="">None</option>
                {formTopics.map(t => (
                  <option key={t._id || t.id} value={t._id || t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 4: IN-APP DOCUMENT & LINK PREVIEW */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={activeResource?.title || 'Resource Preview'}
        subtitle={
          activeResource?.resourceType === 'link'
            ? 'External Educational Link'
            : `${activeResource?.fileName || 'Document'} (${formatBytes(activeResource?.fileSize)})`
        }
        maxWidth="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Uploaded: {formatDate(activeResource?.createdAt)}
            </div>
            <div className="flex items-center gap-2">
              {activeResource?.resourceType !== 'link' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownload(activeResource)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </Button>
              )}
              {activeResource?.resourceType === 'link' && activeResource?.externalUrl && (
                <a
                  href={activeResource.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {isLoadingPreview ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mb-2" />
              <p className="text-xs text-slate-500">Loading secure preview...</p>
            </div>
          ) : activeResource?.resourceType === 'link' ? (
            <div className="p-6 rounded-2xl bg-blue-50/60 border border-blue-200 text-center space-y-3">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 w-fit mx-auto">
                <Link2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">{activeResource.title}</h4>
              {activeResource.description && (
                <p className="text-xs text-slate-600 max-w-lg mx-auto">{activeResource.description}</p>
              )}
              <div className="p-2.5 rounded-xl bg-white border border-blue-200 font-mono text-xs text-blue-800 break-all max-w-xl mx-auto">
                {activeResource.externalUrl}
              </div>
              <div className="pt-2">
                <a
                  href={activeResource.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Launch Educational Resource
                </a>
              </div>
            </div>
          ) : (
            <div>
              {/* Image Preview */}
              {['png', 'jpg', 'jpeg', 'webp'].includes((activeResource?.fileType || '').toLowerCase()) && (
                <div className="flex justify-center bg-slate-900 rounded-xl p-4 overflow-hidden max-h-[500px]">
                  <img
                    src={previewContent?.fileData || api.getMaterialDownloadUrl(activeResource._id)}
                    alt={activeResource.title}
                    className="max-h-[460px] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* PDF Preview */}
              {(activeResource?.fileType || '').toLowerCase() === 'pdf' && (
                <div className="w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <iframe
                    src={previewContent?.fileData || api.getMaterialDownloadUrl(activeResource._id)}
                    title={activeResource.title}
                    className="w-full h-full"
                  />
                </div>
              )}

              {/* Text Preview */}
              {(activeResource?.fileType || '').toLowerCase() === 'txt' && (
                <div className="max-h-[450px] overflow-auto p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
                  <pre className="whitespace-pre-wrap">
                    {previewContent?.fileData?.includes('base64,')
                      ? atob(previewContent.fileData.split(',')[1])
                      : 'Text preview ready. Click Download to save full document.'}
                  </pre>
                </div>
              )}

              {/* Office Docs (DOC, DOCX, PPT, PPTX, XLS, XLSX) / Others */}
              {!['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt'].includes((activeResource?.fileType || '').toLowerCase()) && (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <div className="p-3 rounded-2xl bg-purple-100 text-purple-700 w-fit mx-auto">
                    {getFileIcon(activeResource?.fileType, activeResource?.fileName)}
                  </div>
                  <h4 className="text-base font-bold text-slate-800">{activeResource?.fileName || activeResource?.title}</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    In-browser rendering is not supported for .{activeResource?.fileType?.toUpperCase()} files.
                    Please download the file to view it in its native application.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownload(activeResource)}
                    className="bg-purple-600 hover:bg-purple-700 text-white mt-2"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download .{activeResource?.fileType?.toUpperCase()} File ({formatBytes(activeResource?.fileSize)})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Metadata Card below preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Category</span>
              <span className="font-semibold text-slate-700">{activeResource?.category || 'Lecture Notes'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Visibility</span>
              <span className="font-semibold text-slate-700">
                {activeResource?.visibility === 'faculty_only' ? 'Faculty Only' : 'Student Accessible'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Total Views</span>
              <span className="font-semibold text-purple-700">{activeResource?.viewCount || 0} views</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Downloads</span>
              <span className="font-semibold text-emerald-700">{activeResource?.downloadCount || 0} downloads</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Learning Resource"
        subtitle="This action cannot be undone"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isSubmitting}
            >
              Delete Resource
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm Permanent Deletion</p>
              <p className="mt-0.5 text-rose-700">
                Are you sure you want to delete <span className="font-bold">{activeResource?.title}</span>?
                The file will be permanently removed from storage.
              </p>
            </div>
          </div>

          {(activeResource?.unitNumber || activeResource?.topicTitle) && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Warning:</strong> This resource is linked to Unit {activeResource.unitNumber} in the syllabus tracker.
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LearningResourceLibrarySection;
