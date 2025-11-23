import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ArrowLeft } from "lucide-react";
import { fetchNotifications, Notification } from "@/api/notificationsApi";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🕒 store per-notification "received at" timestamps (keyed by id:type)
  const [notificationTimes, setNotificationTimes] = useState<{
    [key: string]: string;
  }>({});

  // ⭐ which notifications are "New" on this visit (keyed by id:type)
  const [newFlags, setNewFlags] = useState<{ [key: string]: boolean }>({});

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const token = session.access_token;
      const notifs = await fetchNotifications(token);

      // 🔹 Sort newest first (by id – assuming time-based IDs)
      const sorted = [...notifs].sort((a, b) => (a.id > b.id ? -1 : 1));

      const seenKey = "seenNotificationKeys";
      const timeKey = "notificationTimes";
      const clearedKey = "clearedNotificationKeys";

      // 🔹 Load existing seen + times + cleared from localStorage
      let seenIds: string[] = [];
      let timeMap: { [key: string]: string } = {};
      let clearedIds: string[] = [];

      try {
        const rawSeen = localStorage.getItem(seenKey);
        if (rawSeen) {
          seenIds = JSON.parse(rawSeen);
        }
      } catch (e) {
        console.warn("Failed to parse seenNotificationKeys from localStorage", e);
      }

      try {
        const rawTimes = localStorage.getItem(timeKey);
        if (rawTimes) {
          timeMap = JSON.parse(rawTimes);
        }
      } catch (e) {
        console.warn("Failed to parse notificationTimes from localStorage", e);
      }

      try {
        const rawCleared = localStorage.getItem(clearedKey);
        if (rawCleared) {
          clearedIds = JSON.parse(rawCleared);
        }
      } catch (e) {
        console.warn("Failed to parse clearedNotificationKeys from localStorage", e);
      }

      const seenSet = new Set(seenIds);
      const clearedSet = new Set(clearedIds);
      const nowIso = new Date().toISOString();

      const newFlagsLocal: { [key: string]: boolean } = {};

      // 🔹 Filter out cleared notifications (Clear all)
      const visible = sorted.filter((n) => {
        const key = `${n.id}:${n.type}`;
        return !clearedSet.has(key);
      });

      // 🔔 For each visible notification, ensure it has a timestamp & mark as seen
      visible.forEach((n) => {
        const key = `${n.id}:${n.type}`;

        if (!timeMap[key]) {
          // First time we are seeing this notification → store "received at"
          timeMap[key] = nowIso;
        }

        // "New" = wasn't in seenSet before this visit
        if (!seenSet.has(key)) {
          seenSet.add(key);
          newFlagsLocal[key] = true;
        }
      });

      // 🔹 Save back to localStorage
      localStorage.setItem(seenKey, JSON.stringify(Array.from(seenSet)));
      localStorage.setItem(timeKey, JSON.stringify(timeMap));

      // 🔹 Store in state for rendering
      setNotificationTimes(timeMap);
      setNewFlags(newFlagsLocal);
      setNotifications(visible);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // 🧹 Clear all notifications (for this user on this device)
  const handleClearAll = () => {
    const clearedKey = "clearedNotificationKeys";
    let clearedIds: string[] = [];

    try {
      const rawCleared = localStorage.getItem(clearedKey);
      if (rawCleared) {
        clearedIds = JSON.parse(rawCleared);
      }
    } catch (e) {
      console.warn("Failed to parse clearedNotificationKeys from localStorage", e);
    }

    const clearedSet = new Set(clearedIds);

    // Add all currently visible notifications to cleared list
    notifications.forEach((n) => {
      const key = `${n.id}:${n.type}`;
      clearedSet.add(key);
    });

    localStorage.setItem(clearedKey, JSON.stringify(Array.from(clearedSet)));

    // Clear UI state
    setNotifications([]);
    setNewFlags({});
  };

  // 🕒 Helper to format "2 hrs ago", "5 min ago", etc.
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    const then = new Date(isoString);
    const now = new Date();

    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 30) return "Just now";
    if (diffMin < 1) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
    return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  };

  return (
    <div className="min-h-screen gradient-soft">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
              {!loading && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({notifications.length} total)
                </span>
              )}
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/reminders")}>
            Go to Reminders
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card border-border/50 max-w-2xl mx-auto">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Notifications</CardTitle>
            {notifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re all caught up. No notifications right now.
              </p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => {
                  const key = `${n.id}:${n.type}`;
                  const timeLabel = formatTimeAgo(notificationTimes[key]);
                  const isNew = !!newFlags[key];

                  return (
                    <div
                      key={key}
                      onClick={() => navigate("/reminders")}
                      className={`p-3 rounded-md border text-sm flex flex-col gap-1 cursor-pointer transition hover:shadow-md ${
                        n.type === "overdue"
                          ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                          : n.type === "due_today"
                          ? "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                          : n.type === "payment_success"
                          ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                          : n.type === "payment_failed"
                          ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                          : "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{n.bill_name}</span>
                        <div className="flex items-center gap-2">
                          {isNew && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                              New
                            </span>
                          )}
                          {timeLabel && (
                            <span className="text-[10px] text-muted-foreground">
                              {timeLabel}
                            </span>
                          )}
                          {n.amount != null && (
                            <span className="text-xs font-semibold">
                              ₹{n.amount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs">{n.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NotificationsPage;
