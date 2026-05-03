import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, viewChild } from '@angular/core';
import type { ThemePalette } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
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
}

export interface DataTableAction {
  color?: ThemePalette;
  icon: string;
  id: string;
  label: string;
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
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="table-shell">
      <div class="table-shell__scroll">
        <table mat-table [dataSource]="dataSource" matSort (matSortChange)="handleSort($event)">
          @for (column of columns(); track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th mat-header-cell *matHeaderCellDef>
                <div class="header-cell">
                  <button
                    class="header-cell__sort"
                    type="button"
                    [mat-sort-header]="column.key"
                    [disabled]="!column.sortable"
                  >
                    {{ column.label }}
                  </button>

                  @if (column.filterType === dataTableFilterType.TEXT) {
                    <mat-form-field appearance="outline" class="header-filter">
                      <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                      <input
                        matInput
                        [value]="filterValue(column.key)"
                        (input)="updateFilter(column.key, $any($event.target).value)"
                      />
                    </mat-form-field>
                  } @else if (column.filterType === dataTableFilterType.SELECT) {
                    <mat-form-field appearance="outline" class="header-filter">
                      <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                      <mat-select [value]="filterValue(column.key)" (valueChange)="updateFilter(column.key, $event)">
                        <mat-option value="">Todos</mat-option>
                        @for (option of column.filterOptions ?? []; track option.value) {
                          <mat-option [value]="option.value">{{ option.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  } @else if (column.filterType === dataTableFilterType.DATE) {
                    <mat-form-field appearance="outline" class="header-filter">
                      <mat-label>Filtrar {{ column.label.toLowerCase() }}</mat-label>
                      <input
                        matInput
                        type="date"
                        [value]="filterValue(column.key)"
                        (input)="updateFilter(column.key, $any($event.target).value)"
                      />
                    </mat-form-field>
                  }
                </div>
              </th>
              <td mat-cell *matCellDef="let row">{{ displayValue(row, column) }}</td>
            </ng-container>
          }

          @if (actions().length) {
            <ng-container matColumnDef="__actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Acciones</th>
              <td mat-cell *matCellDef="let row">
                <div class="actions-cell">
                  @for (action of actions(); track action.id) {
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
                </div>
              </td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
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
        display: grid;
        gap: 1rem;
      }

      .table-shell__scroll {
        overflow-x: auto;
      }

      table {
        width: 100%;
      }

      .header-cell {
        display: grid;
        gap: 0.75rem;
        min-width: 12rem;
        padding: 0.75rem 0;
      }

      .header-cell__sort {
        all: unset;
        font-weight: 700;
        cursor: pointer;
      }

      .header-filter {
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
    `,
  ],
})
export class DataTableComponent {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly data = input<readonly DataTableRow[]>([]);
  readonly actions = input<readonly DataTableAction[]>([]);
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
  readonly dataSource = new MatTableDataSource<DataTableRow>([]);

  readonly displayedColumns = computed(() => {
    const keys = this.columns().map((column) => column.key);
    return this.actions().length ? [...keys, '__actions'] : keys;
  });

  constructor() {
    this.dataSource.filterPredicate = (row, serializedFilters) => {
      const filters = JSON.parse(serializedFilters || '{}') as Record<string, string>;

      return this.columns().every((column) => {
        const filterValue = filters[column.key]?.trim().toLowerCase();
        if (!filterValue) {
          return true;
        }

        return this.displayValue(row, column).toLowerCase().includes(filterValue);
      });
    };

    effect(() => {
      this.dataSource.data = [...this.data()];
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
}
