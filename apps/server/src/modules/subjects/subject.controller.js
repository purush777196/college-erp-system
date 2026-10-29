const Subject = require('./subject.model');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');
const { ROLES } = require('@college-erp/shared');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

async function listSubjects(req, res, next) {
  try {
    const query = {};
    if (req.query.course) query.course = req.query.course;
    if (req.query.semester) query.semester = parseInt(req.query.semester, 10);
    if (req.query.department) query.department = req.query.department;

    if (req.user && req.user.role === ROLES.HOD) {
      const dept = await Department.findOne({
        $or: [
          { hod: req.user._id },
          ...(req.user.department
            ? [
                ...(mongoose.Types.ObjectId.isValid(req.user.department) ? [{ _id: req.user.department }] : []),
                { name: req.user.department },
                { code: String(req.user.department).toUpperCase() }
              ]
            : [])
        ]
      });
      if (dept) query.department = dept._id;
    }

    const subjects = await Subject.find(query).populate('course', 'name code degreeType').populate('department', 'name code');
    return sendSuccess(res, {
      message: 'Subjects retrieved successfully',
      data: subjects,
      meta: { count: subjects.length }
    });
  } catch (error) {
    next(error);
  }
}

async function createSubject(req, res, next) {
  try {
    const { name, code, course, department, semester, credits, isLab, syllabusUrl } = req.body;
    const existing = await Subject.findOne({ code: code?.toUpperCase()?.trim() });
    if (existing) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Subject code already exists',
        code: 'DUPLICATE_RESOURCE'
      });
    }

    const subject = await Subject.create({
      name: name?.trim(),
      code: code?.toUpperCase()?.trim(),
      course,
      department,
      semester,
      credits,
      isLab,
      syllabusUrl
    });

    await recordAuditLog({
      req,
      action: 'SUBJECT_CREATED',
      entityType: 'Subject',
      entityId: subject._id,
      details: { code: subject.code, name: subject.name }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Subject created successfully',
      data: subject
    });
  } catch (error) {
    next(error);
  }
}

async function updateSubject(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, course, department, semester, credits, isLab, syllabusUrl } = req.body;

    const subject = await Subject.findById(id);
    if (!subject) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Subject not found',
        code: 'NOT_FOUND'
      });
    }

    if (code) {
      const formattedCode = code.toUpperCase().trim();
      if (formattedCode !== subject.code) {
        const existing = await Subject.findOne({ code: formattedCode, _id: { $ne: id } });
        if (existing) {
          return sendError(res, {
            statusCode: HTTP_STATUS.CONFLICT,
            message: `Subject with code '${formattedCode}' already exists`,
            code: 'DUPLICATE_RESOURCE'
          });
        }
        subject.code = formattedCode;
      }
    }

    if (name) subject.name = name.trim();
    if (course) subject.course = course;
    if (department !== undefined) subject.department = department || undefined;
    if (semester !== undefined) subject.semester = Number(semester);
    if (credits !== undefined) subject.credits = Number(credits);
    if (isLab !== undefined) subject.isLab = Boolean(isLab);
    if (syllabusUrl !== undefined) subject.syllabusUrl = syllabusUrl;

    await subject.save();
    await subject.populate('course', 'name code');
    if (subject.department) {
      await subject.populate('department', 'name code');
    }

    await recordAuditLog({
      req,
      action: 'SUBJECT_UPDATED',
      entityType: 'Subject',
      entityId: subject._id,
      details: { code: subject.code, name: subject.name }
    });

    return sendSuccess(res, {
      message: 'Subject updated successfully',
      data: subject
    });
  } catch (error) {
    next(error);
  }
}

async function deleteSubject(req, res, next) {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndDelete(id);
    if (!subject) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Subject not found',
        code: 'NOT_FOUND'
      });
    }

    await recordAuditLog({
      req,
      action: 'SUBJECT_DELETED',
      entityType: 'Subject',
      entityId: id,
      details: { code: subject.code, name: subject.name }
    });

    return sendSuccess(res, {
      message: 'Subject deleted successfully',
      data: { id }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject
};
