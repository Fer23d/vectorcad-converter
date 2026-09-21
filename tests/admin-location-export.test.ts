import { describe, expect, it } from "vitest";
import { buildLocationExportRows, getExcelColumnWidths } from "@/lib/admin-location-export";

describe("admin location export formatting", () => {
  it("maps location rows to friendly report columns", () => {
    const rows = buildLocationExportRows([{
      created_at: "2026-09-21T12:34:00.000Z",
      user_id: "user-123",
      ip_address: "203.0.113.10",
      city: "São Paulo",
      region: "SP",
      country: "BR",
    }]);

    expect(rows).toEqual([{
      "Data do Acesso": "21/09/2026 09:34",
      "Usuário ID": "user-123",
      IP: "203.0.113.10",
      Cidade: "São Paulo",
      Estado: "SP",
      País: "BR",
    }]);
  });

  it("calculates Excel column widths from headers and cell values", () => {
    const rows = buildLocationExportRows([{
      created_at: "2026-09-21T12:34:00.000Z",
      user_id: "user-with-a-long-identifier",
      ip_address: "203.0.113.10",
      city: "São Paulo",
      region: "SP",
      country: "Brasil",
    }]);

    expect(getExcelColumnWidths(rows)).toEqual([
      { wch: 18 },
      { wch: 29 },
      { wch: 14 },
      { wch: 11 },
      { wch: 8 },
      { wch: 8 },
    ]);
  });
});
