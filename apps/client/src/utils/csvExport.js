/**
 * CSV Export Utility for ERP Data Tables
 * Generates RFC-4180 compliant CSV files and triggers client-side download.
 */
export function exportToCsv(filename, rows = [], columns = []) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return false;
  }

  const escapeField = (value) => {
    if (value === null || value === undefined) return '""';
    const stringVal = String(value);
    // Escape double quotes by doubling them
    return `"${stringVal.replace(/"/g, '""')}"`;
  };

  const headerLine = columns.map((col) => escapeField(col.header || col.key || '')).join(',');

  const dataLines = rows.map((row) => {
    return columns
      .map((col) => {
        let val = '';
        if (typeof col.accessor === 'function') {
          val = col.accessor(row);
        } else if (col.key && row[col.key] !== undefined) {
          val = row[col.key];
        } else if (col.id && row[col.id] !== undefined) {
          val = row[col.id];
        }
        return escapeField(val);
      })
      .join(',');
  });

  const csvContent = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = (filename || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
  const downloadLink = document.createElement('a');
  downloadLink.setAttribute('href', url);
  downloadLink.setAttribute('download', `${cleanFilename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  return true;
}

export default exportToCsv;
