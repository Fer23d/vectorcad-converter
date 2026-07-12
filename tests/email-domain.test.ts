import { describe, expect, it } from "vitest";
import { isTemporaryEmail, temporaryEmailMessage } from "@/lib/auth/email-domain";

describe("temporary email validation", () => {
  it.each([
    "user@tempmail.com",
    "user@10minutemail.com",
    "user@guerrillamail.com",
    "user@mailinator.com",
    "user@yopmail.com",
  ])("blocks %s", (email) => {
    expect(isTemporaryEmail(email)).toBe(true);
  });

  it.each(["user@gmail.com", "engineering@empresa.com.br", "user@outlook.com"])("allows %s", (email) => {
    expect(isTemporaryEmail(email)).toBe(false);
  });

  it("uses the signup validation message", () => {
    expect(temporaryEmailMessage()).toBe("Por favor, utilize um e-mail válido e permanente.");
  });
});
