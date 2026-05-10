import type { DataTableColumn } from '../../../../shared/ui/data-table/data-table.component';
import { buildExcelExport, exportToExcel } from './admin-reports-export';

const writeFile = vi.fn();
const jsonToSheet = vi.fn((rows: unknown[]) => ({ rows }));
const bookNew = vi.fn(() => ({ sheets: [] }));
const bookAppendSheet = vi.fn();

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jsonToSheet,
    book_new: bookNew,
    book_append_sheet: bookAppendSheet,
  },
  writeFile,
}));

describe('admin reports Excel export', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('should build Spanish sheet rows and a date-stamped filename for inventory export', () => {
    const columns: DataTableColumn[] = [
      { key: 'ganaderoName', label: 'Ganadero' },
      { key: 'total', label: 'Total' },
      { key: 'byCategory', label: 'Por categoría', formatter: (value) => Object.entries(value as Record<string, number>).map(([key, count]) => `${key}: ${count}`).join(', ') },
    ];

    const exportPayload = buildExcelExport(
      [{ ganaderoName: 'Don Arturo', total: 5, byCategory: { VACA: 3, TORO: 2 } }],
      columns,
      'InventarioPorGanadero'
    );

    expect(exportPayload.fileName).toBe('Reporte_InventarioPorGanadero_20260510.xlsx');
    expect(exportPayload.sheetName).toBe('InventarioPorGanadero');
    expect(exportPayload.rows).toEqual([{ Ganadero: 'Don Arturo', Total: 5, 'Por categoría': 'VACA: 3, TORO: 2' }]);
  });

  it('should lazily import xlsx and write only the currently filtered DataTable rows', async () => {
    const columns: DataTableColumn[] = [
      { key: 'title', label: 'Notificación' },
      { key: 'readRate', label: 'Tasa lectura', formatter: (value) => `${value}%` },
    ];

    await exportToExcel([{ title: 'Campaña fiebre aftosa', readRate: 70 }], columns, 'AlcanceNotificaciones');

    expect(jsonToSheet).toHaveBeenCalledWith([{ Notificación: 'Campaña fiebre aftosa', 'Tasa lectura': '70%' }]);
    expect(bookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'AlcanceNotificaciones');
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), 'Reporte_AlcanceNotificaciones_20260510.xlsx');
  });
});
