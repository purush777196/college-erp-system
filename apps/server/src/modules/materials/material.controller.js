const LearningMaterial = require('./material.model');
const Faculty = require('../faculty/faculty.model');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

async function getFacultyDocId(user) {
  if (!user) return null;
  if (mongoose.connection.readyState === 1 && user.role === ROLES.FACULTY) {
    const profile = await Faculty.findOne({ user: user._id });
    if (profile) return profile._id;
  }
  return user._id;
}

/**
 * List learning materials
 * GET /api/v1/materials
 */
async function listMaterials(req, res, next) {
  try {
    const query = {};
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.unitNumber) query.unitNumber = Number(req.query.unitNumber);

    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      query.faculty = facId;
    }

    const materials = await LearningMaterial.find(query)
      .populate('subject', 'name code semester credits')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, {
      message: 'Learning materials retrieved successfully',
      data: materials,
      meta: { count: materials.length }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload / create new learning material
 * POST /api/v1/materials
 */
async function createMaterial(req, res, next) {
  try {
    const {
      title,
      description = '',
      subject,
      unitNumber = 1,
      fileName,
      fileUrl,
      fileType = 'application/pdf',
      fileSize = 1048576
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

    if (!fileName || !fileUrl) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'File name and file URL are required',
        code: 'MISSING_FILE'
      });
    }

    // Validate size (max 25MB = 26214400 bytes)
    const MAX_FILE_SIZE = 26214400;
    if (Number(fileSize) > MAX_FILE_SIZE) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'File size exceeds maximum permitted limit (25 MB)',
        code: 'FILE_TOO_LARGE'
      });
    }

    const facId = await getFacultyDocId(req.user);

    const material = await LearningMaterial.create({
      title: title.trim(),
      description: description.trim(),
      subject,
      faculty: facId,
      unitNumber: Number(unitNumber) || 1,
      fileName: fileName.trim(),
      fileUrl: fileUrl.trim(),
      fileType,
      fileSize: Number(fileSize) || 1048576
    });

    await recordAuditLog({
      req,
      action: 'MATERIAL_UPLOADED',
      entityType: 'LearningMaterial',
      entityId: String(material._id),
      details: { title, subject, fileName, fileSize }
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

    const { title, description, unitNumber, fileName, fileUrl } = req.body;
    if (title !== undefined) material.title = title.trim();
    if (description !== undefined) material.description = description.trim();
    if (unitNumber !== undefined) material.unitNumber = Number(unitNumber);
    if (fileName !== undefined) material.fileName = fileName.trim();
    if (fileUrl !== undefined) material.fileUrl = fileUrl.trim();

    await material.save();

    await recordAuditLog({
      req,
      action: 'MATERIAL_UPDATED',
      entityType: 'LearningMaterial',
      entityId: String(material._id),
      details: { title: material.title }
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

module.exports = {
  listMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial
};
