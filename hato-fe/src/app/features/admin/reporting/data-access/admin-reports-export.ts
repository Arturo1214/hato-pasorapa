import { Injectable } from '@angular/core';
import type { DataTableColumn, DataTableRow } from '../../../../shared/ui/data-table/data-table.component';

export interface ExcelExportPayload {
  fileName: string;
  rows: Record<string, string | number | boolean>[];
  sheetName: string;
}

export function buildExcelExport(rows: readonly DataTableRow[], columns: readonly DataTableColumn[], reportName: string): ExcelExportPayload {
  const sheetName = sanitizeSheetName(reportName);

  return {
    fileName: `Reporte_${sanitizeReportName(reportName)}_${formatDateStamp(new Date())}.xlsx`,
    sheetName,
    rows: rows.map((row) => toSpanishRow(row, columns)),
  };
}

export async function exportToExcel(rows: readonly DataTableRow[], columns: readonly DataTableColumn[], reportName: string) {
  const XLSX = await import('xlsx');
  const payload = buildExcelExport(rows, columns, reportName);
  const worksheet = XLSX.utils.json_to_sheet(payload.rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, payload.sheetName);
  XLSX.writeFile(workbook, payload.fileName);
}

@Injectable({ providedIn: 'root' })
export class AdminReportsExportService {
  exportToExcel(rows: readonly DataTableRow[], columns: readonly DataTableColumn[], reportName: string) {
    return exportToExcel(rows, columns, reportName);
  }
}

function toSpanishRow(row: DataTableRow, columns: readonly DataTableColumn[]) {
  return columns.reduce<Record<string, string | number | boolean>>((accumulator, column) => {
    const rawValue = (row as Record<string, unknown>)[column.key];
    const displayValue = column.formatter ? column.formatter(rawValue, row) : normalizeCellValue(rawValue);
    accumulator[column.label] = displayValue;
    return accumulator;
  }, {});
}

function normalizeCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return JSON.stringify(value);
}

function formatDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function sanitizeReportName(reportName: string) {
  return reportName.replace(/[^\p{L}\p{N}]/gu, '');
}

function sanitizeSheetName(reportName: string) {
  return sanitizeReportName(reportName).slice(0, 31) || 'Reporte';
}
