export interface Notification {
  id: string;
  bill_name: string;
  amount: number | null;
  due_date: string;
  priority: string;
  type: "overdue" | "due_today" | "upcoming" | "payment_success" | "payment_failed";
  message: string;
}

export async function fetchNotifications(accessToken: string): Promise<Notification[]> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const data = await res.json();
  return data.notifications || [];
}
