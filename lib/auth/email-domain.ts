const TEMPORARY_EMAIL_PATTERNS = [
  "tempmail",
  "10minutemail",
  "guerrillamail",
  "mailinator",
  "yopmail",
];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string) {
  const normalized = normalizeEmail(email);
  const [, domain = ""] = normalized.split("@");
  return domain;
}

export function isTemporaryEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return true;
  return TEMPORARY_EMAIL_PATTERNS.some((pattern) => domain.includes(pattern));
}

export function temporaryEmailMessage() {
  return "Por favor, utilize um e-mail válido e permanente.";
}
