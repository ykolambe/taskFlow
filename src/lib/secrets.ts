const SECRET_REF_MAP_ENV = "TENANT_SECRET_REF_MAP_JSON";

export function resolveSecretRef(secretRef: string | null | undefined): string | null {
  if (!secretRef) return null;

  const byName = process.env[secretRef];
  if (byName) return byName;

  const mapRaw = process.env[SECRET_REF_MAP_ENV];
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw) as Record<string, string>;
      const value = map[secretRef];
      if (value) return value;
    } catch {
      // ignore malformed secret-ref map and fall back below
    }
  }

  // Backward-compatible fallback: allow literal values in config fields.
  // This keeps existing tenants working even when admins enter raw values
  // instead of secret reference keys.
  return secretRef;
}

