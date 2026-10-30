function validateAssignmentInput(data = {}) {
  const errors = [];
  const { title, subject, semester, maxMarks, dueDate } = data;

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Assignment title is required');
  }
  if (!subject) {
    errors.push('Subject ID is required');
  }
  if (!semester || isNaN(Number(semester)) || Number(semester) < 1 || Number(semester) > 8) {
    errors.push('Valid semester between 1 and 8 is required');
  }
  if (!maxMarks || isNaN(Number(maxMarks)) || Number(maxMarks) < 1) {
    errors.push('Maximum marks must be at least 1');
  }
  if (!dueDate || isNaN(new Date(dueDate).getTime())) {
    errors.push('Valid due date is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateAssignmentInput
};
