export type LocationExportRow = {
  created_at: string;
  user_id: string | null;
  ip_address?: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

export type FriendlyLocationExportRow = {
  "Data do Acesso": string;
  "Usuário ID": string;
  IP: string;
  Cidade: string;
  Estado: string;
  País: string;
};

export const LOCATION_EXPORT_COLUMNS: Array<keyof FriendlyLocationExportRow> = [
  "Data do Acesso",
  "Usuário ID",
  "IP",
  "Cidade",
  "Estado",
  "País",
];

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(",", "");
}

export function buildLocationExportRows(rows: LocationExportRow[]): FriendlyLocationExportRow[] {
  return rows.map((row) => ({
    "Data do Acesso": formatReportDate(row.created_at),
    "Usuário ID": row.user_id || "Visitante",
    IP: row.ip_address || "Não informado",
    Cidade: row.city || "Não informado",
    Estado: row.region || "Não informado",
    País: row.country || "Não informado",
  }));
}

export function getExcelColumnWidths(rows: FriendlyLocationExportRow[]) {
  return LOCATION_EXPORT_COLUMNS.map((column) => {
    const maxLength = rows.reduce((max, row) => Math.max(max, String(row[column] || "").length), column.length);
    return { wch: Math.min(Math.max(maxLength + 2, 8), 60) };
  });
}
