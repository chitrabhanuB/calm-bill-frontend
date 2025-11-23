
// src/pages/Insights.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Reminder, sumDue, sumPaid, upcoming, groupByMonthSum } from "../lib/insights";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#10b981",
};

export type PredictionMethod = "weighted" | "linear" | "average";

function formatCurrency(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${n.toFixed(2)}`;
}

/**
 * Simple prediction based on last two months (older -> newer).
 * Weighted (recommended), linear trend, or simple average.
 */
export function predictNextFromTwoMonths(
  monthly: { month: string; total: number }[] | undefined,
  opts?: { method?: PredictionMethod; weight?: number; clipMaxMultiplier?: number }
): number | null {
  if (!monthly || !Array.isArray(monthly) || monthly.length === 0) return null;
  const method = opts?.method ?? "weighted";
  const w = typeof opts?.weight === "number" ? Math.max(0, Math.min(1, opts.weight)) : 0.6;
  const clipMaxMultiplier = typeof opts?.clipMaxMultiplier === "number" ? opts.clipMaxMultiplier : 2.0;

  const nums = monthly.map((m) => {
    const v = Number(m?.total ?? 0);
    return Number.isFinite(v) ? v : 0;
  });
  const n = nums.length;

  if (n === 1) {
    const v = nums[0];
    return Number.isFinite(v) ? Math.round(Math.max(0, v) * 100) / 100 : null;
  }

  const prev = nums[n - 2];
  const last = nums[n - 1];

  if (prev === 0 && last === 0) return 0;

  let pred: number;
  if (method === "linear") {
    pred = last + (last - prev);
  } else if (method === "average") {
    pred = (prev + last) / 2;
  } else {
    pred = w * last + (1 - w) * prev;
  }

  if (!Number.isFinite(pred)) return null;
  pred = Math.max(0, pred);

  // cap to avoid huge one-off spikes
  if (last >= 0 && clipMaxMultiplier > 0) {
    const cap = Math.max(last * clipMaxMultiplier, 0);
    if (pred > cap) pred = cap;
  }

  return Math.round(pred * 100) / 100;
}

/* ---------- Small UI helpers: spinner + skeleton ---------- */

function Spinner({ size = 36 }: { size?: number }) {
  const s = size;
  const style: React.CSSProperties = {
    width: s,
    height: s,
    borderRadius: "50%",
    border: `${Math.max(2, Math.round(s * 0.12))}px solid rgba(99, 102, 241, 0.15)`,
    borderTop: `${Math.max(2, Math.round(s * 0.12))}px solid #6C5CE7`,
    animation: "spin 1s linear infinite",
  };
  return (
    <div style={{ display: "inline-block", lineHeight: 0 }}>
      <div style={style} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: "linear-gradient(90deg, #f3f4f6 0%, #eceff6 50%, #f3f4f6 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s linear infinite",
        borderRadius: 8,
      }}
    >
      <style>{`@keyframes shimmer{ 0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}

/* ---------- Main component ---------- */

export default function Insights() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budget, setBudget] = useState<number>(10000);
  const [editingBudget, setEditingBudget] = useState<boolean>(false);
  const [budgetInput, setBudgetInput] = useState<string>("");

  // prediction UI
  const PKEY_METHOD = "insights.pred.method";
  const PKEY_WEIGHT = "insights.pred.weight";
  const PKEY_CLIP = "insights.pred.clip";
  const PKEY_HIDE_CHARTS = "insights.hide.charts";

  const [predictionMethod, setPredictionMethod] = useState<PredictionMethod>(() => {
    const v = localStorage.getItem(PKEY_METHOD);
    return (v as PredictionMethod) ?? "weighted";
  });
  const [weightedW, setWeightedW] = useState<number>(() => {
    const s = localStorage.getItem(PKEY_WEIGHT);
    const n = s ? Number(s) : 0.6;
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
  });
  const [clipMultiplier, setClipMultiplier] = useState<number>(() => {
    const s = localStorage.getItem(PKEY_CLIP);
    const n = s ? Number(s) : 2.0;
    return Number.isFinite(n) && n > 0 ? n : 2.0;
  });

  const [hideCharts, setHideCharts] = useState<boolean>(() => {
    const s = localStorage.getItem(PKEY_HIDE_CHARTS);
    return s === "1";
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(PKEY_METHOD, predictionMethod);
  }, [predictionMethod]);
  useEffect(() => {
    localStorage.setItem(PKEY_WEIGHT, String(weightedW));
  }, [weightedW]);
  useEffect(() => {
    localStorage.setItem(PKEY_CLIP, String(clipMultiplier));
  }, [clipMultiplier]);
  useEffect(() => {
    localStorage.setItem(PKEY_HIDE_CHARTS, hideCharts ? "1" : "0");
  }, [hideCharts]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const meta = session?.user?.user_metadata || {};
      const metaVal = meta?.misc ?? meta?.budget;
      if (metaVal) {
        const parsed = Number(metaVal);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setBudget(parsed);
        }
      }

      if (session?.user?.id) {
        try {
          const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("misc,budget")
            .eq("id", session.user.id)
            .single();

          if (!profileErr && profileData) {
            const pval = profileData.misc ?? profileData.budget;
            const parsed = Number(pval);
            if (!Number.isNaN(parsed) && parsed > 0) {
              setBudget(parsed);
            }
          }
        } catch (e) {
          console.debug("profiles query failed:", e);
        }
      }

      const token = session?.access_token;
      const fetchOptions: RequestInit = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };

      let res = await fetch(`${BASE_URL}/api/reminders`, fetchOptions);
      if (res.status === 404 && session?.user?.id) {
        res = await fetch(`${BASE_URL}/api/reminders/${session.user.id}`, fetchOptions);
      }

      if (res.status === 401 || res.status === 403) {
        throw new Error(`Auth error (${res.status}). Please sign in.`);
      }

      if (!res.ok) {
        let body = "";
        try {
          body = await res.text();
        } catch {}
        throw new Error(`${res.status} ${res.statusText} ${body ? "- " + body : ""}`);
      }

      const data = await res.json();
      const list = data?.reminders || data?.data || data || [];
      setReminders(list);
    } catch (e: any) {
      console.error("Insights fetch error:", e);
      setError(String(e.message || e));
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }

  // derived metrics
  const totalDue = sumDue(reminders);
  const totalPaid = sumPaid(reminders);
  const upcomingList = upcoming(reminders, 7);
  const monthly = groupByMonthSum(reminders, 6);

  const predictedNext = predictNextFromTwoMonths(monthly, {
    method: predictionMethod,
    weight: weightedW,
    clipMaxMultiplier: clipMultiplier,
  });

  // small explanation values for UI (kept compact)
  const nums = (monthly || []).map((m) => Number(m.total || 0));
  const prev = nums.length >= 2 ? nums[nums.length - 2] : null;
  const last = nums.length >= 1 ? nums[nums.length - 1] : null;

  function computeDailyTotals(remindersList: Reminder[]) {
    const days = 30;
    const msDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const daily: { date: string; total: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = dayStartDate.getTime() - i * msDay;
      const end = start + msDay;
      const total = remindersList
        .filter((r) => {
          const t = new Date(r.due_date).getTime();
          return t >= start && t < end;
        })
        .reduce((s, r) => s + (r.amount || 0), 0);
      daily.push({ date: format(new Date(start), "yyyy-MM-dd"), total });
    }
    return daily;
  }
  const dailyTotals = computeDailyTotals(reminders);

  // pie data
  const byCategory: Record<string, number> = {};
  reminders.forEach((r) => {
    const k = (r as any).category || (r as any).priority || "unknown";
    byCategory[k] = (byCategory[k] || 0) + (r.amount || 0);
  });
  const pieData = Object.keys(byCategory).map((k, i) => {
    const lower = k.toString().toLowerCase();
    const color = lower === "high" || lower === "medium" || lower === "low" ? PRIORITY_COLORS[lower] : undefined;
    return { name: k, value: byCategory[k], color: color || ["#6C5CE7", "#00B894", "#FD9644", "#FF4757", "#2F3542"][i % 5] };
  });

  // MoM
  function computeMoMChange(monthlyData: { month: string; total: number }[]) {
    if (!monthlyData || monthlyData.length < 2) return null;
    const lastVal = monthlyData[monthlyData.length - 1].total || 0;
    const prevVal = monthlyData[monthlyData.length - 2].total || 0;
    if (prevVal === 0 && lastVal === 0) return 0;
    if (prevVal === 0 && lastVal > 0) return 100;
    const change = ((lastVal - prevVal) / prevVal) * 100;
    return Number(change.toFixed(2));
  }
  const mom = computeMoMChange(monthly);

  async function saveBudget(newBudget: number) {
    setBudget(newBudget);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { error } = await supabase.from("profiles").upsert({ id: session.user.id, misc: newBudget }, { returning: "minimal" });
      if (error) {
        console.debug("profiles upsert failed (maybe table missing):", error);
        try {
          await supabase.auth.updateUser({ data: { misc: newBudget } });
        } catch (e) {
          console.debug("auth.updateUser failed:", e);
        }
      }
    } catch (e) {
      console.debug("saveBudget failed:", e);
    }
  }

  const MetricCard = ({ title, value, small }: { title: string; value: React.ReactNode; small?: string }) => (
    <Card className="shadow-card">
      <CardContent className="pt-6 pb-4 px-4">
        <div className="flex flex-col text-center items-center gap-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-2xl font-semibold text-slate-900">{value}</span>
          {small && <span className="text-xs text-muted-foreground mt-1">{small}</span>}
        </div>
      </CardContent>
    </Card>
  );

  // small helpers for chart labels
  function shortMonth(m?: string) {
    if (!m) return m || "";
    const parts = m.split("-");
    if (parts.length >= 2) return `${parts[1]}-${parts[0].slice(-2)}`;
    return m;
  }

  // Export CSV (simple frontend only)
  function downloadCSV() {
    const header = ["month", "total"];
    const rows = (monthly || []).map((m) => [m.month, String(m.total)]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly_insights_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // UI build
  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-extrabold text-purple-800">Insights</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchData()} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size={18} /> Refreshing…
              </span>
            ) : (
              "Refresh"
            )}
          </Button>

          <Button onClick={downloadCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setHideCharts((s) => !s);
            }}
          >
            {hideCharts ? "Show charts" : "Hide charts"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Due (unpaid)" value={formatCurrency(totalDue)} />
        <MetricCard title="Total Paid" value={formatCurrency(totalPaid)} />
        <MetricCard title="Upcoming (7d)" value={`${upcomingList.length} due`} />
        <Card className="shadow-card">
          <CardContent className="pt-6 pb-4 px-4">
            <div className="flex flex-col text-center items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Budget</span>
                <button
                  onClick={() => {
                    setBudgetInput(String(budget));
                    setEditingBudget(true);
                  }}
                  title="Edit budget"
                  className="ml-2"
                >
                  <Edit className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {!editingBudget ? (
                <>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-2xl font-semibold text-slate-900">{formatCurrency(Math.min(totalDue, budget))}</span>
                    <span className="text-xs text-muted-foreground">/ {formatCurrency(budget)}</span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-3 mt-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (totalDue / budget) * 100)}%`, background: "#6C5CE7" }}
                    />
                  </div>
                </>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <input
                    type="number"
                    className="border rounded-md px-2 py-1"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    aria-label="Budget amount"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={async () => {
                        const n = Number(budgetInput);
                        if (!Number.isNaN(n) && n > 0) {
                          await saveBudget(n);
                          setEditingBudget(false);
                        } else {
                          alert("Enter a valid number");
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingBudget(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + prediction area — improved layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: bigger monthly chart */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Monthly due (last 6 months)</CardTitle>
              <div className="text-sm text-muted-foreground">{monthly?.length ?? 0} months</div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 320 }}>
                {loading ? (
                  <SkeletonCard height={320} />
                ) : hideCharts ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Charts hidden — toggle to view</div>
                ) : !monthly || monthly.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No monthly data to show.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={54}
                        tickFormatter={(m) => shortMonth(m)}
                      />
                      <YAxis domain={[0, "dataMax"]} />
                      <Tooltip formatter={(v: any) => `₹${Number(v).toFixed(2)}`} />
                      <Line type="monotone" dataKey="total" stroke="#6C5CE7" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: pie + prediction compact */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Category / Priority split</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 220 }}>
                {loading ? (
                  <SkeletonCard height={220} />
                ) : hideCharts ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Hidden</div>
                ) : pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={4}>
                        {pieData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `₹${Number(v).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-2 max-h-40 overflow-auto">
                {pieData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span style={{ width: 12, height: 12, background: p.color }} className="rounded-sm inline-block" />
                      <span>{p.name}</span>
                    </div>
                    <div className="text-muted-foreground">₹{p.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Improved prediction card */}
          <Card>
            <CardHeader>
              <CardTitle>Predicted next month</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner size={28} />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Next month (2-month estimate)</div>
                      <div className="text-3xl font-extrabold mt-1" style={{ color: "#111827" }}>{formatCurrency(predictedNext)}</div>
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-xs text-muted-foreground">Last</div>
                      <div className="font-semibold">{formatCurrency(last)}</div>
                      <div className="text-xs text-muted-foreground mt-2">Prev</div>
                      <div className="font-semibold">{formatCurrency(prev)}</div>
                    </div>
                  </div>

                  {/* delta / confidence */}
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: mom != null && mom >= 0 ? "#ecfdf5" : "#fff1f2",
                        color: mom != null && mom >= 0 ? "#059669" : "#b91c1c",
                        fontWeight: 600,
                      }}
                    >
                      {mom == null ? "—" : `${mom > 0 ? "+" : ""}${mom}% MoM`}
                    </div>
                    <div className="text-xs text-muted-foreground">Confidence: <strong>{!last || !prev ? "Low" : "Medium"}</strong></div>
                    <div className="flex-1 text-right">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const txt = `Prediction (${predictionMethod}): ${formatCurrency(predictedNext)} — last=${formatCurrency(
                            last
                          )}, prev=${formatCurrency(prev)}.`;
                          try {
                            navigator.clipboard.writeText(txt);
                            alert("Copied prediction summary to clipboard.");
                          } catch {
                            alert(txt);
                          }
                        }}
                      >
                        Copy summary
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Method</label>
                    <select
                      aria-label="Prediction method"
                      value={predictionMethod}
                      onChange={(e) => setPredictionMethod(e.target.value as PredictionMethod)}
                      className="border rounded px-2 py-1 w-full"
                    >
                      <option value="weighted">Weighted (recent counts more)</option>
                      <option value="linear">Linear / Trend (extrapolate)</option>
                      <option value="average">Average (smooth)</option>
                    </select>
                  </div>

                  {predictionMethod === "weighted" && (
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Recent weight (w)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={weightedW}
                          onChange={(e) => setWeightedW(Number(e.target.value))}
                          className="flex-1"
                          aria-label="Weighted recent weight"
                        />
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={weightedW}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v)) setWeightedW(Math.max(0, Math.min(1, v)));
                          }}
                          className="w-20 border rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Clip multiplier</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        value={clipMultiplier}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v > 0) setClipMultiplier(v);
                        }}
                        className="w-28 border rounded px-2 py-1"
                        aria-label="Clip multiplier"
                      />
                      <div className="text-xs text-muted-foreground">Predicted ≤ multiplier × last month</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lower section: daily sparkline + MoM + recent activity + improved FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Last 30 days — daily totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 180 }}>
                {loading ? (
                  <SkeletonCard height={180} />
                ) : dailyTotals.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No daily data</div>
                ) : hideCharts ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Charts hidden — toggle to view</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTotals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "MMM d")} tick={{ fontSize: 12 }} interval={4} />
                      <YAxis domain={[0, "dataMax"]} />
                      <Tooltip formatter={(v: any) => `₹${Number(v).toFixed(2)}`} />
                      <Line type="monotone" dataKey="total" stroke="#6C5CE7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-md">
                  <div className="text-sm text-muted-foreground">Last month total</div>
                  <div className="text-xl font-semibold">₹{(monthly[monthly.length - 1]?.total || 0).toFixed(2)}</div>
                </div>

                <div className="p-3 rounded-md" style={{ background: mom != null && mom >= 0 ? "#ecfdf5" : "#fff1f2" }}>
                  <div className="text-sm text-muted-foreground">MoM change</div>
                  <div className="text-xl font-semibold" style={{ color: mom != null && mom >= 0 ? "#059669" : "#ef4444" }}>
                    {mom == null ? "—" : `${mom > 0 ? "+" : ""}${mom}%`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <em>{mom === 0 ? "Both months equal or both zero" : mom === 100 ? "Previous month was zero" : ""}</em>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Last 5 activity</h4>
                <div className="flex flex-col gap-3">
                  {reminders
                    .slice()
                    .sort((a, b) => new Date(b.created_at || b.due_date).getTime() - new Date(a.created_at || a.due_date).getTime())
                    .slice(0, 5)
                    .map((r) => (
                      <div key={r._id} className="p-3 rounded-md bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{r.bill_name}</div>
                            <div className="text-xs text-muted-foreground">
                              ₹{r.amount} — Due: {format(new Date(r.due_date), "dd MMM yyyy")} — {r.is_paid ? "Paid" : "Unpaid"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Top 5 upcoming dues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {upcomingList.length === 0 && <div className="text-sm text-muted-foreground">No upcoming dues in the next 7 days.</div>}
                {upcomingList.slice(0, 5).map((r) => {
                  const daysLeft = Math.ceil((new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const priority = (r.priority || "").toString().toLowerCase();
                  const accent = PRIORITY_COLORS[priority] || "#f59e0b";
                  return (
                    <div key={r._id} className="p-3 rounded-md" style={{ background: "#fff8e6", border: `1px solid ${accent}33` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{r.bill_name}</div>
                          <div className="text-xs text-muted-foreground">Due: {format(new Date(r.due_date), "dd MMM yyyy")}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₹{(r.amount || 0).toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">{daysLeft}d</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* improved FAQ / definitions at end */}
          <div className="mt-6">
            <details className="block bg-slate-50 p-3 rounded-md">
              <summary className="font-medium cursor-pointer">Definitions & FAQ</summary>
              <div className="mt-2 text-sm text-muted-foreground space-y-2">
                <div>
                  <strong>Weighted</strong> — prediction = w × last + (1 − w) × previous. Use w closer to 1 to favor the most recent month.
                </div>
                <div>
                  <strong>Linear / Trend</strong> — assumes the recent month-to-month change repeats (fast but can magnify spikes).
                </div>
                <div>
                  <strong>Average</strong> — (prev + last) / 2. Smooth and conservative.
                </div>
                <div>
                  <strong>MoM (Month-over-month)</strong> — compares last month vs previous month. Shows <em>0%</em> when they’re equal (including both zero). Shows <em>100%</em> when previous is zero and last &gt; 0.
                </div>
                <div>
                  <strong>When to trust this?</strong> — this uses only the two most recent months. It’s simple and explainable: great when you want quick, human-readable estimates. For more accurate forecasts over noisy or seasonal data we should use longer history and a model (ARIMA/Holt-Winters) — can add later as a separate option.
                </div>
                <div>
                  <strong>Quick fixes</strong> — if the prediction looks wrong: check that your reminders have correct month/due_date and amounts, or toggle method to see how estimates change.
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
