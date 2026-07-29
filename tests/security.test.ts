import { describe, expect, it } from "vitest";
import { getUserRole, isAdminRole, normalizeAdminRole } from "@/lib/admin";
import { sanitizeSvg } from "@/lib/security/safe-svg";
import { detectImageFormat, MAX_UPLOAD_BYTES } from "@/lib/security/image-validation";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("server-managed admin roles", () => {
  it("accepts only the database role values", () => {
    expect(getUserRole("ADMIN")).toBe("ADMIN");
    expect(getUserRole("USER")).toBe("USER");
    expect(getUserRole("SUPER_ADMIN")).toBe("USER");
    expect(isAdminRole(getUserRole("ADMIN"))).toBe(true);
    expect(isAdminRole(getUserRole("USER"))).toBe(false);
  });

  it("normalizes unknown values to USER", () => {
    expect(normalizeAdminRole(undefined)).toBe("USER");
    expect(normalizeAdminRole("admin<script>")).toBe("USER");
  });
});

describe("safe SVG rendering", () => {
  it("removes malicious layer markup and scripts", () => {
    const result = sanitizeSvg('<svg><path layer="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;" data-layer="\"><script>alert(1)</script>" d="M0 0 L10 10" /></svg>');
    expect(result.status).toBe("sanitized");
    expect(result.svg).not.toContain("script");
    expect(result.svg).not.toContain("onerror");
  });

  it("preserves valid CAD geometry", () => {
    const result = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke="#000"><line x1="0" y1="0" x2="100" y2="100" /></g></svg>');
    expect(result.status).toBe("ok");
    expect(result.svg).toContain("<line");
    expect(result.svg).toContain('x1="0"');
    expect(result.svg).not.toContain("script");
  });
});

describe("image upload validation", () => {
  it("recognizes real image signatures instead of trusting MIME", () => {
    expect(detectImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(detectImageFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageFormat(Uint8Array.from([0x49, 0x49, 0x2a, 0x00]))).toBe("tiff");
    expect(detectImageFormat(Uint8Array.from([0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });

  it("keeps the server-side file limit explicit", () => {
    expect(MAX_UPLOAD_BYTES).toBe(30 * 1024 * 1024);
  });
});

describe("operational security controls", () => {
  it("keeps rate limit decisions bounded", async () => {
    const key = `security-test:${Date.now()}`;
    expect((await consumeRateLimit(key, 1, 60_000)).allowed).toBe(true);
    expect((await consumeRateLimit(key, 1, 60_000)).allowed).toBe(false);
  });

  it("documents owner-only project and storage access", () => {
    const projectsSql = readFileSync(resolve(process.cwd(), "supabase/projects.sql"), "utf8");
    const storageSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260729120000_storage_upload_hardening.sql"), "utf8");
    expect(projectsSql).toContain("auth.uid() = user_id");
    expect(storageSql).toContain("public = false");
    expect(storageSql).toContain("projects.user_id = auth.uid()");
  });
});
