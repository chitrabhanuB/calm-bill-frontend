// src/pages/Reminders.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface Reminder {
  _id: string;
  bill_name: string;
  amount: number | null;
  due_date: string;
  priority: string;
  frequency: string;
  is_paid: boolean;
  paid_at?: string | null;
}

// ✅ Single source of truth for backend URL
const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const Reminders = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [formData, setFormData] = useState({
    bill_name: "",
    amount: "",
    due_date: "",
    priority: "medium",
    frequency: "monthly",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchReminders(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchReminders = async (userId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_BASE}/api/reminders/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await response.json();
      console.log("Fetched reminders response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (response.ok) {
        setReminders(data.reminders || []);
      } else {
        toast.error(
          data?.message || data?.error || "Failed to load reminders from backend"
        );
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
      toast.error("Backend connection failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const userEmail = session?.user?.email || user.email;

      console.log("🔐 Creating reminder for:", {
        user_id: user.id,
        user_email: userEmail,
      });

      const response = await fetch(`${API_BASE}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          user_email: userEmail,
          bill_name: formData.bill_name,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          due_date: formData.due_date,
          priority: formData.priority,
          frequency: formData.frequency,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Reminder created!");
        setFormData({
          bill_name: "",
          amount: "",
          due_date: "",
          priority: "medium",
          frequency: "monthly",
        });
        await fetchReminders(user.id);
      } else {
        toast.error(data.error || "Failed to create reminder");
      }
    } catch (err) {
      console.error("Error connecting to backend:", err);
      toast.error("Backend connection failed");
    }
  };

  // ✅ Razorpay flow WITH email support
  const handleRazorpayPayment = async (reminder: Reminder) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: reminder.amount || 100, // in INR
          reminderId: reminder._id,
        }),
      });

      const orderData = await response.json();
      if (!orderData.success) {
        toast.error("Failed to create Razorpay order");
        return;
      }

      const options = {
        key: orderData.key || "",
        amount:
          orderData.order?.amount ||
          (reminder.amount ? Math.round(reminder.amount * 100) : 100 * 100),
        currency: "INR",
        name: "Payble",
        description: `Payment for ${reminder.bill_name}`,
        order_id: orderData.order?.id || orderData.order_id,
        handler: async function (resp: any) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const userEmail = session?.user?.email;

            const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                reminderId: reminder._id,
                userEmail,
                billName: reminder.bill_name,
                amount: reminder.amount,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              toast.success("Payment successful!");
              setReminders((prev) =>
                prev.map((r) =>
                  r._id === reminder._id
                    ? { ...r, is_paid: true, paid_at: new Date().toISOString() }
                    : r
                )
              );
            } else {
              console.error("Verify failed:", verifyData);
              toast.error("Payment verification failed");
            }
          } catch (e) {
            console.error("Error in Razorpay handler:", e);
            toast.error("Something went wrong after payment");
          }
        },
        theme: { color: "#3399cc" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Razorpay error:", error);
      toast.error("Something went wrong with Razorpay");
    }
  };

  const handleMarkPaid = async (_id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_BASE}/api/reminders/${_id}/mark-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch (e) {
        payload = null;
      }

      if (!res.ok) {
        console.error("Mark-paid failed:", res.status, payload);
        toast.error(
          payload?.message || `Failed to mark as paid (${res.status})`
        );
        return;
      }

      setReminders((prev) =>
        prev.map((r) =>
          r._id === _id
            ? { ...r, is_paid: true, paid_at: new Date().toISOString() }
            : r
        )
      );
      toast.success("Marked as paid!");
    } catch (error) {
      console.error("❌ Error marking reminder as paid:", error);
      toast.error("Something went wrong while marking as paid");
    }
  };

  // ✅ FIXED DELETE HANDLER (uses API_BASE + logs errors)
  const handleDelete = async (_id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_BASE}/api/reminders/${_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        console.error("Delete failed:", res.status, payload);
        toast.error(payload?.message || `Failed to delete (${res.status})`);
        return;
      }

      setReminders((prev) => prev.filter((r) => r._id !== _id));
      toast.success("Reminder deleted successfully!");
    } catch (error) {
      console.error("❌ Delete error:", error);
      toast.error("Something went wrong while deleting reminder");
    }
  };

  function handleRazorPay(_id: string): void {
    handleMarkPaid(_id).catch((err) => {
      console.error("handleRazorPay wrapper error:", err);
      (toast as any)?.error?.("Failed to mark as paid");
    });
  }

  const dueReminders = reminders.filter((r) => !r.is_paid);
  const paidReminders = reminders.filter((r) => r.is_paid);

  return (
    <div className="min-h-screen gradient-soft">
      <header className="bg-card border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items together gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Manage Reminders
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add New Reminder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bill_name">Bill Name</Label>
                  <Input
                    id="bill_name"
                    placeholder="Electricity Bill"
                    value={formData.bill_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bill_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (Optional)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="1500"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                >
                  Add Reminder
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle>Your Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="due">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="due">
                    Due ({dueReminders.length})
                  </TabsTrigger>
                  <TabsTrigger value="paid">
                    Paid ({paidReminders.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="due" className="space-y-3 mt-4">
                  {dueReminders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No pending reminders
                    </p>
                  ) : (
                    dueReminders.map((reminder) => (
                      <div
                        key={reminder._id}
                        className="p-4 rounded-xl bg-card border border-border shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">
                              {reminder.bill_name}
                            </h3>
                            {reminder.amount && (
                              <p className="text-sm text-muted-foreground">
                                ₹{reminder.amount.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full capitalize">
                            {reminder.priority}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Due:{" "}
                          {format(new Date(reminder.due_date), "MMM d, yyyy")}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRazorpayPayment(reminder)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Pay now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRazorPay(reminder._id)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Mark Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(reminder._id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="paid" className="space-y-3 mt-4">
                  {paidReminders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No paid bills yet
                    </p>
                  ) : (
                    paidReminders.map((reminder) => (
                      <div
                        key={reminder._id}
                        className="p-4 rounded-xl bg-card border border-border shadow-sm opacity-60"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">
                              {reminder.bill_name}
                            </h3>
                            {reminder.amount && (
                              <p className="text-sm text-muted-foreground">
                                ₹{reminder.amount.toFixed(2)}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Was due:{" "}
                              {format(
                                new Date(reminder.due_date),
                                "MMM d, yyyy"
                              )}
                            </p>
                            {reminder.paid_at && (
                              <p className="text-sm text-green-600">
                                Paid on{" "}
                                {new Date(
                                  reminder.paid_at
                                ).toLocaleDateString("en-IN", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            )}
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            Paid
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Reminders;
