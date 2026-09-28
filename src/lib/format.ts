const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

// Date columns come back as "YYYY-MM-DD" strings.
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return dateFormat.format(date);
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return `${dateTimeFormat.format(value)} UTC`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number, from = new Date()) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type DueState = "overdue" | "due-today" | "due-soon" | null;

export function dueState(dueDate: string | null, finished: boolean): DueState {
  if (!dueDate || finished) return null;
  const today = todayIso();
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due-today";
  if (dueDate <= addDaysIso(3)) return "due-soon";
  return null;
}

export function formatMoney(minorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minorUnits / 100,
  );
}
