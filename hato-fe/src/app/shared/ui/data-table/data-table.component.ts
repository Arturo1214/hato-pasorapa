import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, type TemplateRef, viewChild } from '@angular/core';
import type { ThemePalette } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

export const DATA_TABLE_FILTER_TYPE = {
  DATE: 'date',
  SELECT: 'select',
  TEXT: 'text',
} as const;

export type DataTableFilterType = (typeof DATA_TABLE_FILTER_TYPE)[keyof typeof DATA_TABLE_FILTER_TYPE];
export type DataTableRow = object;

export interface DataTableCellContext {
  $implicit: DataTableRow;
  row: DataTableRow;
  value: unknown;
}

export interface DataTableFilterOption {
  label: string;
  value: string;
}

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterType?: DataTableFilterType;
  filterOptions?: readonly DataTableFilterOption[];
  formatter?: (value: unknown, row: DataTableRow) => string;
  cellTemplate?: TemplateRef<DataTableCellContext>;
}

export interface DataTableAction {
  color?: ThemePalette;
  icon: string;
  id: string;
  label: string;
  visible?: (row: DataTableRow) => boolean;
}

export interface DataTableRowActionEvent {
  actionId: string;
  row: DataTableRow;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [
    {
      provide: MatPaginatorIntl,
      useFactory: createSpanishPaginatorIntl,
    },
  ],
  template: `
    <div class="table-shell">
      @if (loading()) {
        <div class="table-shell__loading" aria-live="polite" aria-label="Cargando datos">
          <mat-spinner diameter="44" />
        </div>
      }

      <div class="table-shell__scroll">
        <table mat-table [dataSource]="dataSource" matSort (matSortChange)="handleSort($event)">
          @for (column of columns(); track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th mat-header-cell *matHeaderCellDef>
                <div class="header-cell">
                  <span class="header-cell__label" [mat-sort-header]="column.key" [disabled]="!column.sortable">
                    {{ column.label }}
                  </span>

                  @if (column.filterType) {
                    <button
                      mat-icon-button
                      class="header-cell__filter"
                      type="button"
                      [class.header-cell__filter--active]="filterValue(column.key)"
                      [matMenuTriggerFor]="filterMenu"
                      [attr.aria-label]="'Filtrar ' + column.label.toLowerCase()"
                      (click)="$event.stopPropagation()"
                    >
                      <mat-icon>filter_list</mat-icon>
                    </button>

                    <mat-menu #filterMenu="matMenu" class="data-table-filter-menu">
                      <div class="filter-menu" (click)="$event.stopPropagation()">
                        @if (column.filterType === dataTableFilterType.TEXT) {
                          <mat-form-field appearance="outline" class="filter-menu__field">
                            <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                            <input
                              matInput
                              [value]="filterValue(column.key)"
                              (input)="updateFilter(column.key, $any($event.target).value)"
                            />
                          </mat-form-field>
                        } @else if (column.filterType === dataTableFilterType.SELECT) {
                          <mat-form-field appearance="outline" class="filter-menu__field">
                            <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                            <mat-select [value]="filterValue(column.key)" (valueChange)="updateFilter(column.key, $event)">
                              <mat-option value="">Todos</mat-option>
                              @for (option of column.filterOptions ?? []; track option.value) {
                                <mat-option [value]="option.value">{{ option.label }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        } @else if (column.filterType === dataTableFilterType.DATE) {
                          <mat-form-field appearance="outline" class="filter-menu__field">
                            <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                            <input
                              matInput
                              type="date"
                              [value]="filterValue(column.key)"
                              (input)="updateFilter(column.key, $any($event.target).value)"
                            />
                          </mat-form-field>
                        }

                        <button mat-button type="button" (click)="updateFilter(column.key, '')">Limpiar</button>
                      </div>
                    </mat-menu>
                  }
                </div>
              </th>
              <td mat-cell *matCellDef="let row">
                @if (column.cellTemplate) {
                  <ng-container
                    [ngTemplateOutlet]="column.cellTemplate"
                    [ngTemplateOutletContext]="cellContext(row, column)"
                  />
                } @else {
                  {{ displayValue(row, column) }}
                }
              </td>
            </ng-container>
          }

          @if (actions().length) {
            <ng-container matColumnDef="__actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Acciones</th>
              <td mat-cell *matCellDef="let row">
                <div class="actions-cell">
                  @for (action of actions(); track action.id) {
                    @if (!action.visible || action.visible(row)) {
                      <button
                        mat-stroked-button
                        type="button"
                        [color]="action.color ?? 'primary'"
                        (click)="rowAction.emit({ actionId: action.id, row })"
                      >
                        <mat-icon>{{ action.icon }}</mat-icon>
                        {{ action.label }}
                      </button>
                    }
                  }
                </div>
              </td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns().length">
              {{ emptyMessage() }}
            </td>
          </tr>
        </table>
      </div>

      <mat-paginator
        [length]="dataSource.filteredData.length"
        [pageSize]="pageSize()"
        [pageSizeOptions]="pageSizeOptions()"
        [showFirstLastButtons]="true"
        (page)="handlePage($event)"
      />
    </div>
  `,
  styles: [
    `
      .table-shell {
        position: relative;
        display: grid;
        gap: 0.75rem;
        overflow: hidden;
      }

      .table-shell__loading {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--mat-sys-surface) 78%, transparent);
      }

      .table-shell__scroll {
        overflow-x: auto;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 1rem;
      }

      table {
        width: 100%;
      }

      .header-cell {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-width: 10rem;
        padding: 0.35rem 0;
      }

      .header-cell__label {
        font-weight: 700;
      }

      .header-cell__filter {
        --mat-icon-button-state-layer-size: 32px;
        width: 32px;
        height: 32px;
      }

      .header-cell__filter mat-icon {
        font-size: 1.125rem;
        width: 1.125rem;
        height: 1.125rem;
      }

      .header-cell__filter--active {
        color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
      }

      .filter-menu {
        display: grid;
        gap: 0.5rem;
        min-width: 16rem;
        padding: 0.75rem;
      }

      .filter-menu__field {
        width: 100%;
      }

      .actions-header {
        min-width: 14rem;
      }

      .actions-cell {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .actions-cell button {
        border-radius: 999px;
      }

      .actions-cell mat-icon {
        margin-inline-end: 0.25rem;
      }

      .empty-cell {
        padding: 2rem 1rem;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
        font-style: italic;
      }
    `,
  ],
})
export class DataTableComponent {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly data = input<readonly DataTableRow[]>([]);
  readonly actions = input<readonly DataTableAction[]>([]);
  readonly loading = input(false);
  readonly emptyMessage = input('No se encontraron datos.');
  readonly pageSize = input(10);
  readonly pageSizeOptions = input<readonly number[]>([10, 25, 50]);
  readonly dataTableFilterType = DATA_TABLE_FILTER_TYPE;

  readonly pageChange = output<PageEvent>();
  readonly sortChange = output<Sort>();
  readonly filterChange = output<Record<string, string>>();
  readonly rowAction = output<DataTableRowActionEvent>();

  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);
  readonly filters = input<Record<string, string>>({});
  dataSource = this.createDataSource([]);

  readonly displayedColumns = computed(() => {
    const keys = this.columns().map((column) => column.key);
    return this.actions().length ? [...keys, '__actions'] : keys;
  });

  constructor() {
    effect(() => {
      const nextDataSource = this.createDataSource([...this.data()]);
      nextDataSource.paginator = this.paginator() ?? null;
      nextDataSource.sort = this.sort() ?? null;
      nextDataSource.filter = JSON.stringify(this.filters());
      nextDataSource.paginator?.firstPage();
      this.dataSource = nextDataSource;
    });

    effect(() => {
      const paginator = this.paginator();
      if (paginator) {
        this.dataSource.paginator = paginator;
      }
    });

    effect(() => {
      const sort = this.sort();
      if (sort) {
        this.dataSource.sort = sort;
      }
    });

    effect(() => {
      this.dataSource.filter = JSON.stringify(this.filters());
      this.dataSource.paginator?.firstPage();
    });
  }

  filterValue(key: string) {
    return this.filters()[key] ?? '';
  }

  displayValue(row: DataTableRow, column: DataTableColumn) {
    const rawValue = (row as Record<string, unknown>)[column.key];
    if (column.formatter) {
      return column.formatter(rawValue, row);
    }

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return '—';
    }

    return String(rawValue);
  }

  cellContext(row: DataTableRow, column: DataTableColumn): DataTableCellContext {
    return {
      $implicit: row,
      row,
      value: (row as Record<string, unknown>)[column.key],
    };
  }

  updateFilter(key: string, value: string) {
    const nextFilters = {
      ...this.filters(),
      [key]: value ?? '',
    };
    this.filterChange.emit(nextFilters);
  }

  handleSort(event: Sort) {
    this.sortChange.emit(event);
  }

  handlePage(event: PageEvent) {
    this.pageChange.emit(event);
  }

  private createDataSource(data: DataTableRow[]) {
    const dataSource = new MatTableDataSource<DataTableRow>(data);
    dataSource.filterPredicate = (row, serializedFilters) => {
      const filters = JSON.parse(serializedFilters || '{}') as Record<string, string>;

      return this.columns().every((column) => {
        const filterValue = filters[column.key]?.trim().toLowerCase();
        if (!filterValue) {
          return true;
        }

        const rawValue = (row as Record<string, unknown>)[column.key];
        return (
          this.displayValue(row, column).toLowerCase().includes(filterValue) ||
          String(rawValue ?? '').toLowerCase().includes(filterValue)
        );
      });
    };
    return dataSource;
  }
}

function createSpanishPaginatorIntl() {
  const paginatorIntl = new MatPaginatorIntl();

  paginatorIntl.itemsPerPageLabel = 'Elementos por página';
  paginatorIntl.nextPageLabel = 'Página siguiente';
  paginatorIntl.previousPageLabel = 'Página anterior';
  paginatorIntl.firstPageLabel = 'Primera página';
  paginatorIntl.lastPageLabel = 'Última página';
  paginatorIntl.getRangeLabel = (page, pageSize, length) => {
    if (length === 0 || pageSize === 0) {
      return `0 de ${length}`;
    }

    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, length);
    return `${startIndex + 1} – ${endIndex} de ${length}`;
  };

  return paginatorIntl;
}
