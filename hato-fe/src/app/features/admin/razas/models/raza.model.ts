export type RazaTipo = 'BEEF' | 'DAIRY' | 'DUAL_PURPOSE' | 'UNCLASSIFIED';

export interface RazaItem {
  uuid: string;
  nombre: string;
  descripcion: string | null;
  origen: string | null;
  tipo: RazaTipo;
  activo: boolean;
  sortOrder: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RazaOption {
  uuid: string;
  nombre: string;
  origen: string | null;
  tipo: RazaTipo;
  sortOrder: number | null;
}

export interface RazaCreatePayload {
  nombre: string;
  descripcion: string | null;
  origen: string | null;
  sortOrder: number | null;
  tipo: RazaTipo;
}

export interface RazaUpdatePayload extends RazaCreatePayload {
  activo: boolean;
}

export interface RazaListResponse<T> {
  items: T[];
}
