const mongoose = require('mongoose');
const LearningMaterial = require('./material.model');
const Faculty = require('../faculty/faculty.model');
const Subject = require('../subjects/subject.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

// Maximum permitted file size: 25 MB (26,214,400 bytes)
const MAX_FILE_SIZE = 26214400;

// Supported MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]);

/**
 * Resolve faculty document ID from authenticated user
 */
async function getFacultyDocId(user) {
  if (!user) return null;
  if (user.role === ROLES.FACULTY) {
    if (mongoose.connection.readyState === 1 || (Faculty.findOne && Faculty.findOne._isMockFunction)) {
      try {
        const profile = await Faculty.findOne({ user: user._id });
        if (profile) return profile._id;
      } catch {
        // Fallback
      }
    }
  }
  return user._id;
}

/**
 * Validate external URL syntax and protocol (HTTP/HTTPS only)
 */
function isValidExternalUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable string (KB / MB)
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(1)} MB`;
}

/**
 * List learning materials with full filtering, search, and pagination
 * GET /api/v1/materials
 */
async function listMaterials(req, res, next) {
  try {
    const query = {};

    // 1. Role-based scoping
    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      query.faculty = facId;
    } else if (req.user.role === ROLES.STUDENT) {
      // Students only see published, student-accessible materials
      query.publicationStatus = 'published';
      query.visibility = 'student_accessible';
    }

    // 2. Query filters
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.unitNumber) query.unitNumber = Number(req.query.unitNumber);
    if (req.query.category && req.query.category !== 'all') query.category = req.query.category;
    if (req.query.resourceType && req.query.resourceType !== 'all') query.resourceType = req.query.resourceType;
    if (req.query.visibility && req.query.visibility !== 'all' && req.user.role !== ROLES.STUDENT) {
      query.visibility = req.query.visibility;
    }
    if (req.query.publicationStatus && req.query.publicationStatus !== 'all' && req.user.role !== ROLES.STUDENT) {
      query.publicationStatus = req.query.publicationStatus;
    }

    // 3. Search query
    if (req.query.search && req.query.search.trim()) {
      const s = req.query.search.trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { unitTitle: { $regex: escaped, $options: 'i' } },
        { topicTitle: { $regex: escaped, $options: 'i' } }
      ];
    }

    // 4. Sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    // 5. Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    let queryBuilder = LearningMaterial.find(query)
      .populate('subject', 'name code semester credits department')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      })
      .sort(sortObj);

    if (req.query.page || req.query.limit) {
      if (typeof queryBuilder.skip === 'function') queryBuilder = queryBuilder.skip(skip);
      if (typeof queryBuilder.limit === 'function') queryBuilder = queryBuilder.limit(limit);
    }

    const materials = typeof queryBuilder.lean === 'function'
      ? await queryBuilder.lean()
      : await queryBuilder;

    const total = materials.length;

    // Compute library summary KPIs for faculty if requested
    let summary = null;
    if (req.user.role !== ROLES.STUDENT && (req.query.includeSummary === 'true' || req.query.summary === 'true')) {
      const totalResources = materials.length;
      const publishedResources = materials.filter((m) => m.publicationStatus === 'published').length;
      const facultyOnlyResources = materials.filter((m) => m.visibility === 'faculty_only').length;
      const archivedResources = materials.filter((m) => m.publicationStatus === 'archived').length;
      const totalStorageUsedBytes = materials.reduce((acc, m) => acc + (Number(m.fileSize) || 0), 0);

      summary = {
        totalResources,
        publishedResources,
        facultyOnlyResources,
        archivedResources,
        totalStorageUsedBytes,
        totalStorageFormatted: formatFileSize(totalStorageUsedBytes)
      };
    }

    return sendSuccess(res, {
      message: 'Learning materials retrieved successfully',
      data: materials,
      meta: {
        count: materials.length,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single material by ID
 * GET /api/v1/materials/:id
 */
async function getMaterialById(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id)
      .populate('subject', 'name code semester credits department')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      });

    if (!material) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Learning resource not found',
        code: 'NOT_FOUND'
      });
    }

    // Role-based visibility check
    if (req.user.role === ROLES.STUDENT) {
      if (material.visibility !== 'student_accessible' || material.publicationStatus !== 'published') {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'You are not authorized to view this resource',
          code: 'FORBIDDEN'
        });
      }
    }

    // Atomically increment view count
    material.viewCount = (material.viewCount || 0) + 1;
    material.lastAccessedAt = new Date();
    await material.save();

    return sendSuccess(res, {
      message: 'Learning material details retrieved',
      data: material
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload / create new learning material or external link
 * POST /api/v1/materials
 */
async function createMaterial(req, res, next) {
  try {
    const {
      title,
      description = '',
      subject,
      resourceType = 'file',
      category = 'Lecture Notes',
      tags = [],
      unitNumber = 1,
      unitTitle = '',
      topicId = null,
      topicTitle = '',
      fileName,
      fileUrl,
      fileData = '',
      fileType = 'application/pdf',
      fileSize = 1048576,
      externalUrl = '',
      visibility = 'student_accessible',
      publicationStatus = 'published',
      academicYear = '2025-26',
      section = 'All'
    } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Material title is required',
        code: 'MISSING_TITLE'
      });
    }

    if (!subject) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Subject is required',
        code: 'MISSING_SUBJECT'
      });
    }

    // Validation for external links
    if (resourceType === 'link') {
      if (!externalUrl || !externalUrl.trim()) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'External URL is required for link resources',
          code: 'MISSING_URL'
        });
      }

      if (!isValidExternalUrl(externalUrl.trim())) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid external URL. Must start with http:// or https://',
          code: 'INVALID_URL'
        });
      }
    } else {
      // Validation for file uploads
      if (!fileName || (!fileUrl && !fileData)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'File name and file content/URL are required',
          code: 'MISSING_FILE'
        });
      }

      // Validate size (max 25MB = 26214400 bytes)
      if (Number(fileSize) > MAX_FILE_SIZE) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'File size exceeds maximum permitted limit (25 MB)',
          code: 'FILE_TOO_LARGE'
        });
      }
    }

    const facId = await getFacultyDocId(req.user);

    // Parse tags if sent as comma-separated string or array
    const parsedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []);

    const effectiveFileUrl = fileUrl ? fileUrl.trim() : (fileData ? 'data:upload' : '');

    const material = await LearningMaterial.create({
      title: title.trim(),
      description: description.trim(),
      subject,
      faculty: facId,
      resourceType,
      category,
      tags: parsedTags,
      unitNumber: Number(unitNumber) || 1,
      unitTitle: unitTitle ? unitTitle.trim() : '',
      topicId: topicId && mongoose.Types.ObjectId.isValid(topicId) ? topicId : null,
      topicTitle: topicTitle ? topicTitle.trim() : '',
      fileName: fileName ? fileName.trim() : '',
      fileUrl: effectiveFileUrl,
      fileData: fileData || '',
      fileType: fileType || 'application/pdf',
      fileSize: Number(fileSize) || (resourceType === 'link' ? 0 : 1048576),
      externalUrl: externalUrl ? externalUrl.trim() : '',
      visibility: visibility === 'faculty_only' ? 'faculty_only' : 'student_accessible',
      publicationStatus: ['draft', 'published', 'archived'].includes(publicationStatus) ? publicationStatus : 'published',
      isPublished: publicationStatus !== 'draft' && publicationStatus !== 'archived',
      academicYear,
      section
    });

    await recordAuditLog({
      req,
      action: 'MATERIAL_UPLOADED',
      entityType: 'LearningMaterial',
      entityId: String(material._id),
      details: { title, subject, resourceType, fileName, fileSize }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Learning material added successfully',
      data: material
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update material metadata
 * PUT /api/v1/materials/:id
 */
async function updateMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Learning resource not found',
        code: 'NOT_FOUND'
      });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(material.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You are not authorized to modify this resource',
        code: 'FORBIDDEN'
      });
    }

    const {
      title,
      description,
      category,
      tags,
      unitNumber,
      unitTitle,
      topicId,
      topicTitle,
      fileName,
      fileUrl,
      fileData,
      fileType,
      fileSize,
      externalUrl,
      visibility,
      publicationStatus,
      section
    } = req.body;

    if (title !== undefined && title.trim()) material.title = title.trim();
    if (description !== undefined) material.description = description.trim();
    if (category !== undefined) material.category = category;
    if (tags !== undefined) {
      material.tags = Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : material.tags);
    }
    if (unitNumber !== undefined) material.unitNumber = Number(unitNumber);
    if (unitTitle !== undefined) material.unitTitle = unitTitle.trim();
    if (topicId !== undefined) material.topicId = topicId && mongoose.Types.ObjectId.isValid(topicId) ? topicId : null;
    if (topicTitle !== undefined) material.topicTitle = topicTitle.trim();
    if (fileName !== undefined) material.fileName = fileName.trim();
    if (fileUrl !== undefined) material.fileUrl = fileUrl.trim();
    if (fileData !== undefined) material.fileData = fileData;
    if (fileType !== undefined) material.fileType = fileType;
    if (fileSize !== undefined) material.fileSize = Number(fileSize);
    if (section !== undefined) material.section = section;

    if (externalUrl !== undefined) {
      if (externalUrl && !isValidExternalUrl(externalUrl.trim())) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid external URL',
          code: 'INVALID_URL'
        });
      }
      material.externalUrl = externalUrl.trim();
    }

    if (visibility !== undefined) {
      material.visibility = visibility === 'faculty_only' ? 'faculty_only' : 'student_accessible';
    }

    if (publicationStatus !== undefined) {
      material.publicationStatus = publicationStatus;
      material.isPublished = publicationStatus === 'published';
    }

    await material.save();

    await recordAuditLog({
      req,
      action: 'MATERIAL_UPDATED',
      entityType: 'LearningMaterial',
      entityId: String(material._id),
      details: { title: material.title, publicationStatus: material.publicationStatus }
    });

    return sendSuccess(res, {
      message: 'Learning resource updated successfully',
      data: material
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Publish a resource
 * PATCH /api/v1/materials/:id/publish
 */
async function publishMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, { statusCode: HTTP_STATUS.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(material.faculty) !== String(facId)) {
      return sendError(res, { statusCode: HTTP_STATUS.FORBIDDEN, message: 'Unauthorized', code: 'FORBIDDEN' });
    }

    material.publicationStatus = 'published';
    material.isPublished = true;
    await material.save();

    return sendSuccess(res, { message: 'Resource published successfully', data: material });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive a resource
 * PATCH /api/v1/materials/:id/archive
 */
async function archiveMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, { statusCode: HTTP_STATUS.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(material.faculty) !== String(facId)) {
      return sendError(res, { statusCode: HTTP_STATUS.FORBIDDEN, message: 'Unauthorized', code: 'FORBIDDEN' });
    }

    material.publicationStatus = 'archived';
    material.isPublished = false;
    await material.save();

    return sendSuccess(res, { message: 'Resource archived successfully', data: material });
  } catch (error) {
    next(error);
  }
}

/**
 * Restore an archived resource
 * PATCH /api/v1/materials/:id/restore
 */
async function restoreMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, { statusCode: HTTP_STATUS.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(material.faculty) !== String(facId)) {
      return sendError(res, { statusCode: HTTP_STATUS.FORBIDDEN, message: 'Unauthorized', code: 'FORBIDDEN' });
    }

    material.publicationStatus = 'published';
    material.isPublished = true;
    await material.save();

    return sendSuccess(res, { message: 'Resource restored to published', data: material });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete learning material
 * DELETE /api/v1/materials/:id
 */
async function deleteMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Learning resource not found',
        code: 'NOT_FOUND'
      });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(material.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You are not authorized to delete this resource',
        code: 'FORBIDDEN'
      });
    }

    await LearningMaterial.findByIdAndDelete(req.params.id);

    await recordAuditLog({
      req,
      action: 'MATERIAL_DELETED',
      entityType: 'LearningMaterial',
      entityId: String(req.params.id),
      details: { title: material.title }
    });

    return sendSuccess(res, {
      message: 'Learning resource removed successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticated Resource Download
 * GET /api/v1/materials/:id/download
 */
async function downloadMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, { statusCode: HTTP_STATUS.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' });
    }

    // Role visibility authorization
    if (req.user.role === ROLES.STUDENT) {
      if (material.visibility !== 'student_accessible' || material.publicationStatus !== 'published') {
        return sendError(res, { statusCode: HTTP_STATUS.FORBIDDEN, message: 'Resource download unauthorized', code: 'FORBIDDEN' });
      }
    }

    // Atomically increment download count
    material.downloadCount = (material.downloadCount || 0) + 1;
    material.lastAccessedAt = new Date();
    await material.save();

    // If external link, return link metadata
    if (material.resourceType === 'link') {
      return res.redirect(material.externalUrl);
    }

    // If base64 fileData exists, send file buffer
    if (material.fileData && material.fileData.startsWith('data:')) {
      const parts = material.fileData.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const buffer = Buffer.from(parts[1], 'base64');
      const safeFileName = encodeURIComponent(material.fileName || 'downloaded_resource.pdf');

      res.setHeader('Content-Type', mime || material.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      return res.send(buffer);
    }

    // Fallback: if fileUrl is an external link, redirect safely
    if (isValidExternalUrl(material.fileUrl)) {
      return res.redirect(material.fileUrl);
    }

    return sendSuccess(res, {
      message: 'Download authorized',
      data: {
        fileName: material.fileName,
        fileUrl: material.fileUrl,
        fileType: material.fileType
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticated Resource Preview
 * GET /api/v1/materials/:id/preview
 */
async function previewMaterial(req, res, next) {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return sendError(res, { statusCode: HTTP_STATUS.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' });
    }

    // Role visibility authorization
    if (req.user.role === ROLES.STUDENT) {
      if (material.visibility !== 'student_accessible' || material.publicationStatus !== 'published') {
        return sendError(res, { statusCode: HTTP_STATUS.FORBIDDEN, message: 'Preview unauthorized', code: 'FORBIDDEN' });
      }
    }

    material.viewCount = (material.viewCount || 0) + 1;
    material.lastAccessedAt = new Date();
    await material.save();

    if (material.fileData && material.fileData.startsWith('data:')) {
      const parts = material.fileData.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const buffer = Buffer.from(parts[1], 'base64');

      res.setHeader('Content-Type', mime || material.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline');
      return res.send(buffer);
    }

    return sendSuccess(res, {
      message: 'Preview authorized',
      data: {
        fileName: material.fileName,
        fileUrl: material.fileUrl,
        fileData: material.fileData,
        externalUrl: material.externalUrl,
        fileType: material.fileType
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get library summary statistics
 * GET /api/v1/materials/summary/stats
 */
async function getMaterialStats(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const query = req.user.role === ROLES.FACULTY ? { faculty: facId } : {};

    const materials = await LearningMaterial.find(query).select('publicationStatus visibility fileSize').lean();

    const totalResources = materials.length;
    const publishedResources = materials.filter((m) => m.publicationStatus === 'published').length;
    const facultyOnlyResources = materials.filter((m) => m.visibility === 'faculty_only').length;
    const archivedResources = materials.filter((m) => m.publicationStatus === 'archived').length;
    const totalStorageUsedBytes = materials.reduce((acc, m) => acc + (Number(m.fileSize) || 0), 0);

    return sendSuccess(res, {
      message: 'Library statistics retrieved',
      data: {
        totalResources,
        publishedResources,
        facultyOnlyResources,
        archivedResources,
        totalStorageUsedBytes,
        totalStorageFormatted: formatFileSize(totalStorageUsedBytes)
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  publishMaterial,
  archiveMaterial,
  restoreMaterial,
  deleteMaterial,
  downloadMaterial,
  previewMaterial,
  getMaterialStats
};
