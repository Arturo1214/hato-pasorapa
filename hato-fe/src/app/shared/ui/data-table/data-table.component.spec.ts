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

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Admin';
    input.dispatchEvent(new Event('input'));

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

    const dateInput = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    dateInput.value = '2024-04-26';
    dateInput.dispatchEvent(new Event('input'));

    expect(filterChangeSpy).toHaveBeenCalledWith({ birthDate: '2024-04-26' });
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
});
