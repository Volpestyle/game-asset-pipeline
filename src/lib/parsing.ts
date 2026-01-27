export function parseBoolean(
  value: FormDataEntryValue | string | number | boolean | null | undefined
): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}
