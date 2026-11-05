/** Mongolian plate, e.g. "1234 ДАА". Empty is never valid. */
export function normalizePlate(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLocaleUpperCase("mn-MN");
}

export function plateError(raw: string): string | null {
  const compact = normalizePlate(raw).replace(/\s/g, "");
  if (!compact) return "Машины дугаар оруулна уу";
  if (compact.length < 6 || compact.length > 10 || !/\d/.test(compact)) {
    return "Дугаар буруу байна. Жишээ: 1234 УБА";
  }
  return null;
}

export function plateOk(raw: string | null | undefined): boolean {
  return !plateError(raw || "");
}
