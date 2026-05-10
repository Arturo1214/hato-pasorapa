import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent, DATA_TABLE_FILTER_TYPE, type DataTableAction, type DataTableColumn } from './data-table.component';

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent>;
  let component: DataTableComponent;

  const columns: DataTableColumn[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'ADMIN', value: 'ADMIN' },
        { label: 'GANADERO', value: 'GANADERO' },
      ],
    },
    {
      key: 'birthDate',
      label: 'Nacimiento',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.DATE,
    },
  ];

  const actions: DataTableAction[] = [{ id: 'view', label: 'Ver', icon: 'visibility' }];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('data', [
      { id: '1', name: 'Admin Root', role: 'ADMIN' },
      { id: '2', name: 'Campo Sur', role: 'GANADERO', birthDate: '2024-04-26' },
    ]);
    fixture.detectChanges();
  });

  it('should emit filter changes when a header filter is updated', () => {
    const filterChangeSpy = vi.fn();
    component.filterChange.subscribe(filterChangeSpy);

    component.updateFilter('name', 'Admin');

    expect(filterChangeSpy).toHaveBeenCalledWith({ name: 'Admin' });
  });

  it('should emit sort changes when a sortable header is triggered', () => {
    const sortChangeSpy = vi.fn();
    component.sortChange.subscribe(sortChangeSpy);

    component.handleSort({ active: 'name', direction: 'asc' });

    expect(sortChangeSpy).toHaveBeenCalledWith({ active: 'name', direction: 'asc' });
  });

  it('should emit date filter changes when a date header filter is updated', () => {
    const filterChangeSpy = vi.fn();
    component.filterChange.subscribe(filterChangeSpy);

    component.updateFilter('birthDate', '2024-04-26');

    expect(filterChangeSpy).toHaveBeenCalledWith({ birthDate: '2024-04-26' });
  });

  it('should render integrated empty state', () => {
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('emptyMessage', 'Sin registros para mostrar.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin registros para mostrar.');
  });

  it('should render loading overlay when requested', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.table-shell__loading')).not.toBeNull();
  });

  it('should emit page changes when pagination moves', () => {
    const pageChangeSpy = vi.fn();
    component.pageChange.subscribe(pageChangeSpy);

    component.handlePage({ length: 2, pageIndex: 1, pageSize: 10, previousPageIndex: 0 });

    expect(pageChangeSpy).toHaveBeenCalledWith({
      length: 2,
      pageIndex: 1,
      pageSize: 10,
      previousPageIndex: 0,
    });
  });

  it('should render paginator labels in Spanish', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Elementos por página');
    expect(fixture.nativeElement.textContent).toContain('1 – 2 de 2');
  });
});
