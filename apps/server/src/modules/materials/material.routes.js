const express = require('express');
const {
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
} = require('./material.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

// 1. Library Summary Statistics
router.get(
  '/summary/stats',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  getMaterialStats
);

// 2. List learning materials
router.get(
  '/',
  authorizeRoles(
    ROLES.SUPER_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.HOD,
    ROLES.FACULTY,
    ROLES.STUDENT
  ),
  listMaterials
);

// 3. Create learning material or link
router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  createMaterial
);

// 4. Single material details
router.get(
  '/:id',
  authorizeRoles(
    ROLES.SUPER_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.HOD,
    ROLES.FACULTY,
    ROLES.STUDENT
  ),
  getMaterialById
);

// 5. Update material metadata
router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  updateMaterial
);

// 6. Delete material
router.delete(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  deleteMaterial
);

// 7. Publication & Archival State Toggles
router.patch(
  '/:id/publish',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  publishMaterial
);

router.patch(
  '/:id/archive',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  archiveMaterial
);

router.patch(
  '/:id/restore',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  restoreMaterial
);

// 8. Download & Preview
router.get(
  '/:id/download',
  authorizeRoles(
    ROLES.SUPER_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.HOD,
    ROLES.FACULTY,
    ROLES.STUDENT
  ),
  downloadMaterial
);

router.get(
  '/:id/preview',
  authorizeRoles(
    ROLES.SUPER_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.HOD,
    ROLES.FACULTY,
    ROLES.STUDENT
  ),
  previewMaterial
);

module.exports = router;
