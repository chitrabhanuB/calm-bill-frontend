// src/lib/insights.ts
import { format, startOfMonth } from "date-fns";

export type Reminder = {
  _id: string;
  user_id?: string;
  bill_name: string;
  amount: number;
  due_date: string; // ISO
  is_paid: boolean;
  paid_at?: string | null;
  category?: string;
  created_at?: string;
};

export function sumDue(reminders: Reminder[]) {
  return reminders
    .filter((r) => !r.is_paid)
    .reduce((s, r) => s + (r.amount || 0), 0);
}

export function sumPaid(reminders: Reminder[]) {
  return reminders
    .filter((r) => r.is_paid)
    .reduce((s, r) => s + (r.amount || 0), 0);
}

export function upcoming(reminders: Reminder[], days = 7) {
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return reminders
    .filter((r) => !r.is_paid)
    .filter((r) => {
      const d = new Date(r.due_date).getTime();
      return d >= now && d <= now + ms;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export function groupByMonthSum(reminders: Reminder[], monthsBack = 6) {
  const out: { month: string; total: number }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = format(m, "yyyy-MM");
    const monthLabel = format(m, "MMM yyyy");
    const monthStart = startOfMonth(m).getTime();
    const nextMonth = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
    const total = reminders
      .filter((r) => {
        const d = new Date(r.due_date).getTime();
        return d >= monthStart && d < nextMonth;
      })
      .reduce((s, r) => s + (r.amount || 0), 0);
    out.push({ month: monthLabel, total });
  }
  return out;
}

export function rollingAverage30(reminders: Reminder[]) {
  // compute daily totals for last 30 days, then rolling average
  const days = 30;
  const msDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  const arr: { date: string; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * msDay);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end = start + msDay;
    const total = reminders
      .filter((r) => {
        const t = new Date(r.due_date).getTime();
        return t >= start && t < end;
      })
      .reduce((s, r) => s + (r.amount || 0), 0);
    arr.push({ date: format(d, "yyyy-MM-dd"), total });
  }

  // compute simple moving average with window 7 to smooth (can be adjusted)
  const window = 7;
  const ma = arr.map((_, idx) => {
    const from = Math.max(0, idx - window + 1);
    const slice = arr.slice(from, idx + 1);
    const avg = slice.reduce((s, x) => s + x.total, 0) / slice.length;
    return { date: arr[idx].date, avg };
  });
  return { daily: arr, ma };
}
