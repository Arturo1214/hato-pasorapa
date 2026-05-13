import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminReportingPageComponent } from './admin-reporting-page.component';
import { AdminReportsExportService } from './data-access/admin-reports-export';
import { AdminReportsStore } from './data-access/admin-reports.store';
import type { AdminReportId } from './data-access/admin-reports.service';

const exportService = { exportToExcel: vi.fn() };

describe('AdminReportingPageComponent', () => {
  let fixture: ComponentFixture<AdminReportingPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;

  beforeEach(async () => {
    fakeStore = createFakeStore();

    await TestBed.configureTestingModule({
      imports: [AdminReportingPageComponent],
      providers: [
        { provide: AdminReportsStore, useValue: fakeStore },
        { provide: AdminReportsExportService, useValue: exportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportingPageComponent);
    fixture.detectChanges();
  });

  it('should render the three report options without sync or debug controls', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Inventario por Ganadero');
    expect(text).toContain('Actividad Sanitaria');
    expect(text).toContain('Alcance de Notificaciones');
    expect(text).toContain('Ganadero A');
    expect(text).not.toContain('Última sync');
    expect(text).not.toContain('Refrescar ahora');
    expect(text).not.toContain('Ventana activa');
    expect(text).not.toContain('Preset activo');
  });

  it('should switch reports and render filters appropriate to the selected report', async () => {
    const defaultDateFilters = expectedDefaultDateFilters();

    await fixture.componentInstance.selectReport('health-activity');
    fixture.detectChanges();

    expect(fakeStore.loadReport).toHaveBeenLastCalledWith('health-activity', expect.objectContaining(defaultDateFilters));
    expect(fixture.nativeElement.textContent).toContain('Tipo de evento');
    expect(fixture.componentInstance.healthEventTypeOptions.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Vacunación', 'Visita veterinaria de campo'])
    );
    expect(fixture.nativeElement.textContent).toContain('Animal');

    await fixture.componentInstance.selectReport('notification-reach');
    fixture.detectChanges();

    expect(fakeStore.loadReport).toHaveBeenLastCalledWith('notification-reach', expect.objectContaining(defaultDateFilters));
    expect(fixture.nativeElement.textContent).toContain('Desde');
    expect(fixture.nativeElement.textContent).toContain('Hasta');
    expect(fixture.nativeElement.textContent).toContain('Segmentación');
  });

  it('should keep report filters compact and readable', () => {
    expect(fixture.nativeElement.querySelector('.filters-row')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.filter-control--sm')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Filtros');
  });

  it('should format inventory breakdown values with Spanish labels', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Vacas (6)');
    expect(text).not.toContain('VACA: 6');
  });

  it('should validate that Hasta is greater than or equal to Desde before applying filters', async () => {
    await fixture.componentInstance.selectReport('health-activity');
    fakeStore.setFilter({ from: '2026-05-10', to: '2026-05-01' });
    fixture.detectChanges();

    await fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La fecha "Hasta" debe ser mayor o igual a "Desde".');
    expect(fakeStore.loadReport).toHaveBeenCalledTimes(2);
  });

  it('should update date filters from datepicker values', () => {
    fixture.componentInstance.updateDateFilter('from', new Date('2026-05-03T00:00:00'));

    expect(fakeStore.setFilter).toHaveBeenCalledWith({ from: '2026-05-03' });
  });

  it('should export the current report rows with Spanish DataTable columns when enabled', async () => {
    await fixture.componentInstance.exportCurrentReport();

    expect(exportService.exportToExcel).toHaveBeenCalledWith(
      fakeStore.reportData(),
      expect.arrayContaining([expect.objectContaining({ key: 'ganaderoName', label: 'Ganadero' })]),
      'InventarioPorGanadero'
    );
  });

  it('should show loading, error, and empty states while disabling Excel export when unavailable', () => {
    fakeStore.loadingState.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando reporte administrativo…');

    fakeStore.loadingState.set(false);
    fakeStore.errorState.set('No pudimos cargar el reporte administrativo.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el reporte administrativo.');
    expect(fixture.nativeElement.querySelector('[data-testid="export-report"]').disabled).toBe(true);

    fakeStore.errorState.set(null);
    fakeStore.reportDataState.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay datos para los filtros seleccionados');
  });
});

function createFakeStore() {
  const selectedReportState = signal<AdminReportId>('inventory-by-ganadero');
  const filtersState = signal({});
  const reportDataState = signal([
    { ganaderoId: 7, ganaderoName: 'Ganadero A', total: 10, active: 8, inactive: 2, byCategory: { VACA: 6 }, bySex: { HEMBRA: 8 } },
  ]);
  const loadingState = signal(false);
  const errorState = signal<string | null>(null);
  const canExportState = signal(true);

  return {
    selectedReport: selectedReportState.asReadonly(),
    filters: filtersState.asReadonly(),
    reportData: reportDataState.asReadonly(),
    loading: loadingState.asReadonly(),
    error: errorState.asReadonly(),
    canExport: canExportState.asReadonly(),
    loadingState,
    errorState,
    reportDataState,
    loadReport: vi.fn(async (report: 'inventory-by-ganadero' | 'health-activity' | 'notification-reach', filters = {}) => {
      selectedReportState.set(report);
      filtersState.set(filters);
    }),
    setFilter: vi.fn((filter) => filtersState.update((current) => ({ ...current, ...filter }))),
  };
}

function expectedDefaultDateFilters() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: formatDateInput(from), to: formatDateInput(today), limit: 200 };
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
