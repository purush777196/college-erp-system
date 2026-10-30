const express = require('express');
const {
  getFacultyAvailability,
  updateFacultyAvailability,
  getAvailableSlots,
  listFacultyAppointments,
  getFacultyAppointmentSummary,
  getFacultyCalendarAppointments,
  getAppointmentById,
  approveAppointment,
  rejectAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  saveAppointmentNotes,
  createStudentAppointment,
  listStudentAppointments,
  getStudentAppointmentSummary,
  getStudentAssociatedFaculty,
  getStudentFacultyAvailableSlots
} = require('./appointment.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

// Faculty Appointments Router
const facultyRouter = express.Router();
facultyRouter.use(authenticate);
facultyRouter.use(authorizeRoles(ROLES.FACULTY, ROLES.SUPER_ADMIN));

// Availability
facultyRouter.get('/availability', getFacultyAvailability);
facultyRouter.put('/availability', updateFacultyAvailability);
facultyRouter.get('/availability/slots', getAvailableSlots);

// Summary & Calendar
facultyRouter.get('/summary', getFacultyAppointmentSummary);
facultyRouter.get('/calendar', getFacultyCalendarAppointments);

// Appointment Collections & Actions
facultyRouter.get('/', listFacultyAppointments);
facultyRouter.get('/:id', getAppointmentById);
facultyRouter.patch('/:id/approve', approveAppointment);
facultyRouter.patch('/:id/reject', rejectAppointment);
facultyRouter.patch('/:id/reschedule', rescheduleAppointment);
facultyRouter.patch('/:id/cancel', cancelAppointment);
facultyRouter.patch('/:id/complete', completeAppointment);
facultyRouter.post('/:id/notes', saveAppointmentNotes);

// Student Appointments Router
const studentRouter = express.Router();
studentRouter.use(authenticate);
studentRouter.use(authorizeRoles(ROLES.STUDENT, ROLES.SUPER_ADMIN));

studentRouter.get('/summary', getStudentAppointmentSummary);
studentRouter.get('/faculty', getStudentAssociatedFaculty);
studentRouter.get('/faculty/:facultyId/availability/:date/slots', getStudentFacultyAvailableSlots);
studentRouter.get('/faculty/:facultyId/availability', getStudentFacultyAvailableSlots);
studentRouter.get('/', listStudentAppointments);
studentRouter.post('/', createStudentAppointment);
studentRouter.get('/:id', getAppointmentById);
studentRouter.patch('/:id/cancel', cancelAppointment);

// Unified Router
const unifiedRouter = express.Router();
unifiedRouter.use('/faculty/me/appointments', facultyRouter);
unifiedRouter.use('/student/appointments', studentRouter);

module.exports = {
  facultyRouter,
  studentRouter,
  unifiedRouter
};
