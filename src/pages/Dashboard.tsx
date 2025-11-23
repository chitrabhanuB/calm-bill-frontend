// import { useState, useEffect, useMemo } from "react";
// import { useNavigate } from "react-router-dom";
// import { supabase } from "@/integrations/supabase/client";
// import { Button } from "@/components/ui/button";
// import { Calendar } from "react-calendar";
// import "react-calendar/dist/Calendar.css";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { LogOut, Plus, Calendar as CalendarIcon, Bell } from "lucide-react";
// import { format, isSameDay, isBefore, addDays } from "date-fns";
// import { fetchNotifications, Notification } from "@/api/notificationsApi";

// interface Reminder {
//   _id: string;
//   bill_name: string;
//   amount: number | null;
//   due_date: string;
//   priority: string;
//   is_paid: boolean;
// }

// const normalizeDate = (dateString: string) => {
//   const date = new Date(dateString);
//   return new Date(date.getFullYear(), date.getMonth(), date.getDate());
// };

// const Dashboard = () => {
//   const navigate = useNavigate();
//   const [user, setUser] = useState<any>(null);
//   const [reminders, setReminders] = useState<Reminder[]>([]);
//   const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
//   const [loading, setLoading] = useState(true);
//   const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
//   const [showPopup, setShowPopup] = useState(false);
//   const [selectedReminders, setSelectedReminders] = useState<Reminder[]>([]);

//   // 🔔 New: notification count in navbar (only unseen)
//   const [notificationCount, setNotificationCount] = useState<number>(0);
//   const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false);

//   const fetchReminders = async (userId: string) => {
//     try {
//       // ✅ Get Supabase session token
//       const {
//         data: { session },
//       } = await supabase.auth.getSession();
//       const token = session?.access_token;

//       const response = await fetch(
//         `http://localhost:5001/api/reminders/${userId}`,
//         {
//           headers: token ? { Authorization: `Bearer ${token}` } : undefined,
//         }
//       );

//       const data = await response.json();
//       console.log("✅ Fetched reminders from backend:", data);

//       if (response.ok && data.success) {
//         setReminders(data.reminders);
//         setLoading(false);
//         console.log("✅ Reminders stored in state:", data.reminders);
//       } else {
//         console.error("❌ Failed to fetch reminders:", data);
//         setLoading(false);
//       }
//     } catch (error) {
//       console.error("Error fetching reminders:", error);
//       setLoading(false);
//     }
//   };

//   // 🔔 Fetch notifications from backend and compute *unseen* count using localStorage
//   const loadNotifications = async () => {
//     try {
//       setNotificationsLoading(true);
//       const {
//         data: { session },
//       } = await supabase.auth.getSession();

//       if (!session) {
//         setNotificationsLoading(false);
//         return;
//       }

//       const token = session.access_token;
//       const notifs: Notification[] = (await fetchNotifications(token)).sort((a, b) => a.id > b.id ? -1 : 1);

//       // Read seen keys from localStorage
//       const seenKey = "seenNotificationKeys";
//       let seenIds: string[] = [];
//       try {
//         const raw = localStorage.getItem(seenKey);
//         if (raw) {
//           seenIds = JSON.parse(raw);
//         }
//       } catch (e) {
//         console.warn("Failed to parse seenNotificationKeys from localStorage", e);
//       }
//       const seenSet = new Set(seenIds);

//       // Use composite key id:type so different notification types for same bill are separate
//       const unseenCount = notifs.filter((n) => {
//         const key = `${n.id}:${n.type}`;
//         return !seenSet.has(key);
//       }).length;

//       setNotificationCount(unseenCount);
//     } catch (error) {
//       console.error("Error fetching notifications:", error);
//     } finally {
//       setNotificationsLoading(false);
//     }
//   };

//   // derive nearing and overdue reminders (only unpaid) and keep todayReminders for calendar popup
//   const nearingAndOverdue = useMemo(() => {
//     const today = new Date();
//     const startOfToday = new Date(
//       today.getFullYear(),
//       today.getMonth(),
//       today.getDate()
//     );
//     const endOfWindow = addDays(startOfToday, 3); // include today, tomorrow, day after, and 3 days ahead

//     const upcoming = reminders
//       .filter((r) => !r.is_paid)
//       .filter((r) => {
//         const d = new Date(r.due_date);
//         return d >= startOfToday && d <= endOfWindow;
//       })
//       .sort(
//         (a, b) =>
//           new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
//       );

//     const overdue = reminders
//       .filter((r) => !r.is_paid)
//       .filter((r) => new Date(r.due_date) < startOfToday)
//       .sort(
//         (a, b) =>
//           new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
//       );

//     return [...upcoming, ...overdue];
//   }, [reminders]);

//   useEffect(() => {
//     const checkAuth = async () => {
//       const {
//         data: { session },
//       } = await supabase.auth.getSession();

//       if (!session) {
//         navigate("/auth");
//         return;
//       }

//       setUser(session.user);
//       await fetchReminders(session.user.id);
//       await loadNotifications(); // 🔔 also fetch unseen notification count
//     };

//     checkAuth();

//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange((event, session) => {
//       if (event === "SIGNED_OUT") {
//         navigate("/auth");
//       } else if (session) {
//         setUser(session.user);
//       }
//     });

//     return () => subscription.unsubscribe();
//   }, [navigate]);

//   const handleSignOut = async () => {
//     await supabase.auth.signOut();
//     navigate("/");
//   };

//   const getStatusColor = (dueDate: string, isPaid: boolean) => {
//     if (isPaid) return "bg-green-100 border-green-300";

//     const due = new Date(dueDate);
//     const today = new Date();
//     const threeDaysFromNow = addDays(today, 3);

//     if (isBefore(due, today)) return "bg-red-100 border-red-300";
//     if (isBefore(due, threeDaysFromNow))
//       return "bg-yellow-100 border-yellow-300";
//     return "bg-green-100 border-green-300";
//   };

//   // ✅ Handle calendar date click → show popup
//   const handleDateClick = (date: Date) => {
//     setSelectedDate(date);
//     const remindersForDay = reminders.filter((r) =>
//       isSameDay(new Date(r.due_date), date)
//     );
//     setSelectedReminders(remindersForDay);
//     setShowPopup(true);
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen gradient-soft flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
//           <p className="text-muted-foreground">Loading your dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen gradient-soft">
//       {/* Header */}
//       <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-10">
//         <div className="container mx-auto px-4 py-4 flex justify-between items-center">
//           <div className="flex items-center">
//             <img
//               src="/logo.png"
//               alt="Payble logo"
//               className="h-10 w-10 mr-3 object-cover"
//             />
//             <h1 className="text-3xl font-extrabold bg-gradient-to-r from-black-600 to-blue-600 bg-clip-text">
//               Payble
//             </h1>
//           </div>

//           <div className="flex gap-2">
//             <Button variant="outline" onClick={() => navigate("/reminders")}>
//               <Bell className="mr-2 h-4 w-4" />
//               Reminders
//             </Button>

//             <Button variant="outline" onClick={() => navigate("/notifications")}>
//               <Bell className="mr-2 h-4 w-4" />
//               Notifications
//               {!notificationsLoading && notificationCount > 0 && (
//                 <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-2 py-0.5">
//                   {notificationCount > 9 ? "9+" : notificationCount}
//                 </span>
//               )}
//             </Button>

//             <Button variant="outline" onClick={() => navigate("/profile")}>
//               Profile
//             </Button>
//             <Button variant="ghost" onClick={handleSignOut}>
//               <LogOut className="mr-2 h-4 w-4" />
//               Sign Out
//             </Button>
//           </div>
//         </div>
//       </header>

//       {/* Main */}
//       <main className="container mx-auto px-4 py-8">
//         <div className="grid md:grid-cols-2 gap-6">
//           {/* 🗓️ Calendar Section */}
//           <Card className="shadow-card border-border/50">
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <CalendarIcon className="h-5 w-5 text-primary" />
//                 Bill Calendar
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Calendar
//                 onClickDay={handleDateClick}
//                 value={selectedDate}
//                 tileClassName={({ date, view }) => {
//                   if (view === "month") {
//                     const remindersForDate = reminders.filter((r) => {
//                       const reminderDate = new Date(r.due_date);
//                       return (
//                         reminderDate.getFullYear() === date.getFullYear() &&
//                         reminderDate.getMonth() === date.getMonth() &&
//                         reminderDate.getDate() === date.getDate()
//                       );
//                     });

//                     if (remindersForDate.length > 0) {
//                       const isPaid = remindersForDate.some((r) => r.is_paid);
//                       let color = "";

//                       if (isPaid) color = "text-green-400 font-semibold";
//                       else {
//                         const priorities = remindersForDate.map((r) =>
//                           r.priority.toLowerCase()
//                         );

//                         if (priorities.includes("high")) {
//                           color = "text-red-800 font-semibold";
//                         } else if (priorities.includes("medium")) {
//                           color = "text-orange-400 font-semibold";
//                         } else if (priorities.includes("low")) {
//                           color = "text-yellow-900 font-semibold";
//                         } else {
//                           color = "text-green-400 font-semibold";
//                         }
//                       }

//                       return color;
//                     }
//                   }
//                   return "";
//                 }}
//                 tileContent={({ date, view }) => {
//                   if (view === "month") {
//                     const remindersForDate = reminders.filter((r) => {
//                       const reminderDate = new Date(r.due_date);
//                       return (
//                         reminderDate.getFullYear() === date.getFullYear() &&
//                         reminderDate.getMonth() === date.getMonth() &&
//                         reminderDate.getDate() === date.getDate()
//                       );
//                     });

//                     if (remindersForDate.length > 0) {
//                       const isPaid = remindersForDate.some((r) => r.is_paid);
//                       let indicatorColor = "";

//                       if (isPaid) indicatorColor = "#22c55e"; // green
//                       else {
//                         const priorities = remindersForDate.map((r) =>
//                           r.priority.toLowerCase()
//                         );
//                         if (priorities.includes("high"))
//                           indicatorColor = "#ef4444"; // red
//                         else if (priorities.includes("medium"))
//                           indicatorColor = "#f97316"; // orange
//                         else indicatorColor = "#facc15"; // yellow
//                       }

//                       return (
//                         <div
//                           style={{
//                             width: "25px",
//                             height: "4px",
//                             borderTopLeftRadius: "80px",
//                             borderTopRightRadius: "80px",
//                             backgroundColor: indicatorColor,
//                             margin: "0 auto",
//                             marginTop: "2px",
//                           }}
//                         ></div>
//                       );
//                     }
//                   }
//                   return null;
//                 }}
//               />

//               {/* 🔹 Legend */}
//               <div className="flex justify-center gap-6 mt-4 text-sm text-gray-300">
//                 <div className="flex items-center gap-2">
//                   <span className="w-3 h-3 bg-green-400 rounded-md"></span> Paid
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <span className="w-3 h-3 bg-yellow-400 rounded-md"></span> Low
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <span className="w-3 h-3 bg-orange-400 rounded-md"></span>{" "}
//                   Medium
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <span className="w-3 h-3 bg-red-500 rounded-md"></span> High
//                 </div>
//               </div>

//               {/* 🔹 Popup for selected date */}
//               {showPopup && (
//                 <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
//                   <div className="bg-white p-6 rounded-xl shadow-lg w-[400px]">
//                     <h3 className="text-xl font-semibold mb-3 text-center">
//                       Reminders for {selectedDate?.toDateString()}
//                     </h3>

//                     {selectedReminders.length > 0 ? (
//                       selectedReminders.map((r) => (
//                         <div
//                           key={r._id}
//                           className="p-3 border rounded-lg mb-2 flex flex-col gap-1"
//                         >
//                           <span className="font-medium">{r.bill_name}</span>
//                           {r.amount && <span>Amount: ₹{r.amount}</span>}
//                           <span>Priority: {r.priority}</span>
//                           <span>
//                             Status: {r.is_paid ? "✅ Paid" : "⏰ Pending"}
//                           </span>
//                           <span>
//                             Due:{" "}
//                             {new Date(r.due_date).toLocaleDateString("en-IN")}
//                           </span>
//                         </div>
//                       ))
//                     ) : (
//                       <p className="text-center text-gray-600">
//                         No reminders on this date.
//                       </p>
//                     )}

//                     <div className="text-center mt-4">
//                       <Button onClick={() => setShowPopup(false)}>Close</Button>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </CardContent>
//           </Card>

//           {/* Right side: Nearing bills only */}
//           <Card className="shadow-card border-border/50">
//             <CardHeader>
//               <div className="flex justify-between items-center">
//                 <CardTitle>
//                   {selectedDate
//                     ? format(selectedDate, "MMMM d, yyyy")
//                     : "Select a date"}
//                 </CardTitle>
//                 <Button
//                   variant="gradient"
//                   size="sm"
//                   onClick={() => navigate("/reminders")}
//                 >
//                   <Plus className="mr-2 h-4 w-4" />
//                   Add Bill
//                 </Button>
//               </div>
//             </CardHeader>
//             <CardContent>
//               <h4 className="text-lg font-medium mb-3">
//                 Nearing bills ({nearingAndOverdue.length})
//               </h4>
//               {nearingAndOverdue.length === 0 ? (
//                 <p className="text-muted-foreground">
//                   No nearing bills or all bills are paid.
//                 </p>
//               ) : (
//                 nearingAndOverdue.map((r) => {
//                   const due = new Date(r.due_date);
//                   const today = new Date();
//                   const startOfToday = new Date(
//                     today.getFullYear(),
//                     today.getMonth(),
//                     today.getDate()
//                   );
//                   const daysDiff = Math.ceil(
//                     (due.getTime() - startOfToday.getTime()) /
//                       (1000 * 60 * 60 * 24)
//                   );
//                   const isOverdue = due < startOfToday;
//                   let badge = "";
//                   if (isOverdue) {
//                     const overdueDays = Math.ceil(
//                       (startOfToday.getTime() - due.getTime()) /
//                         (1000 * 60 * 60 * 24)
//                     );
//                     badge = `Overdue ${overdueDays}d`;
//                   } else if (daysDiff === 0) badge = "Due Today";
//                   else if (daysDiff === 1) badge = "Due Tomorrow";
//                   else badge = `Due in ${daysDiff}d`;

//                   return (
//                     <div
//                       key={r._id}
//                       className={`p-3 rounded-lg mb-3 border ${getStatusColor(
//                         r.due_date,
//                         r.is_paid
//                       )}`}
//                     >
//                       <div className="flex justify_between items-start">
//                         <div>
//                           <h3 className="font-semibold">{r.bill_name}</h3>
//                           {r.amount && (
//                             <p className="text-sm text-muted-foreground">
//                               ₹{r.amount.toFixed(2)}
//                             </p>
//                           )}
//                           <p className="text-xs text-muted-foreground mt-1 capitalize">
//                             {r.priority} priority
//                           </p>
//                           <p className="text-xs text-muted-foreground mt-1">
//                             Due:{" "}
//                             {new Date(r.due_date).toLocaleDateString()}
//                           </p>
//                         </div>
//                         <span
//                           className={`text-xs px-2 py-1 rounded-full ${
//                             isOverdue
//                               ? "bg-red-500 text-white"
//                               : "bg-yellow-500 text-white"
//                           }`}
//                         >
//                           {badge}
//                         </span>
//                       </div>
//                     </div>
//                   );
//                 })
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default Dashboard;



// src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Plus, Calendar as CalendarIcon, Bell, PieChart } from "lucide-react";
import { format, isSameDay, isBefore, addDays } from "date-fns";
import { fetchNotifications, Notification } from "@/api/notificationsApi";

interface Reminder {
  _id: string;
  bill_name: string;
  amount: number | null;
  due_date: string;
  priority: string;
  is_paid: boolean;
}

const normalizeDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState<Reminder[]>([]);

  //  New: notification count in navbar (only unseen)
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false);

  const fetchReminders = async (userId: string) => {
    try {
      //  Get Supabase session token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `http://localhost:5001/api/reminders/${userId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      const data = await response.json();
      console.log(" Fetched reminders from backend:", data);

      if (response.ok && data.success) {
        setReminders(data.reminders);
        setLoading(false);
        console.log(" Reminders stored in state:", data.reminders);
      } else {
        console.error("Failed to fetch reminders:", data);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
      setLoading(false);
    }
  };

  // Fetch notifications from backend and compute *unseen* count using localStorage
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setNotificationsLoading(false);
        return;
      }

      const token = session.access_token;
      const notifs: Notification[] = (await fetchNotifications(token)).sort((a, b) => a.id > b.id ? -1 : 1);

      // Read seen keys from localStorage
      const seenKey = "seenNotificationKeys";
      let seenIds: string[] = [];
      try {
        const raw = localStorage.getItem(seenKey);
        if (raw) {
          seenIds = JSON.parse(raw);
        }
      } catch (e) {
        console.warn("Failed to parse seenNotificationKeys from localStorage", e);
      }
      const seenSet = new Set(seenIds);

      // Use composite key id:type so different notification types for same bill are separate
      const unseenCount = notifs.filter((n) => {
        const key = `${n.id}:${n.type}`;
        return !seenSet.has(key);
      }).length;

      setNotificationCount(unseenCount);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // derive nearing and overdue reminders (only unpaid) and keep todayReminders for calendar popup
  const nearingAndOverdue = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfWindow = addDays(startOfToday, 3); // include today, tomorrow, day after, and 3 days ahead

    const upcoming = reminders
      .filter((r) => !r.is_paid)
      .filter((r) => {
        const d = new Date(r.due_date);
        return d >= startOfToday && d <= endOfWindow;
      })
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );

    const overdue = reminders
      .filter((r) => !r.is_paid)
      .filter((r) => new Date(r.due_date) < startOfToday)
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );

    return [...upcoming, ...overdue];
  }, [reminders]);

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
      await loadNotifications(); // 🔔 also fetch unseen notification count
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusColor = (dueDate: string, isPaid: boolean) => {
    if (isPaid) return "bg-green-100 border-green-300";

    const due = new Date(dueDate);
    const today = new Date();
    const threeDaysFromNow = addDays(today, 3);

    if (isBefore(due, today)) return "bg-red-100 border-red-300";
    if (isBefore(due, threeDaysFromNow))
      return "bg-yellow-100 border-yellow-300";
    return "bg-green-100 border-green-300";
  };

  // ✅ Handle calendar date click → show popup
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const remindersForDay = reminders.filter((r) =>
      isSameDay(new Date(r.due_date), date)
    );
    setSelectedReminders(remindersForDay);
    setShowPopup(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-soft flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-soft">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Payble logo"
              className="h-10 w-10 mr-3 object-cover"
            />
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-black-600 to-blue-600 bg-clip-text">
              Payble
            </h1>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/reminders")}>
              <Bell className="mr-2 h-4 w-4" />
              Reminders
            </Button>

            {/* INSIGHTS BUTTON - ADDED */}
            <Button variant="outline" onClick={() => navigate("/insights")}>
              <PieChart className="mr-2 h-4 w-4" />
              Insights
            </Button>

            <Button variant="outline" onClick={() => navigate("/notifications")}>
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              {!notificationsLoading && notificationCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-2 py-0.5">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Button>

            <Button variant="outline" onClick={() => navigate("/profile")}>
              Profile
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 🗓️ Calendar Section */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Bill Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                onClickDay={handleDateClick}
                value={selectedDate}
                tileClassName={({ date, view }) => {
                  if (view === "month") {
                    const remindersForDate = reminders.filter((r) => {
                      const reminderDate = new Date(r.due_date);
                      return (
                        reminderDate.getFullYear() === date.getFullYear() &&
                        reminderDate.getMonth() === date.getMonth() &&
                        reminderDate.getDate() === date.getDate()
                      );
                    });

                    if (remindersForDate.length > 0) {
                      const isPaid = remindersForDate.some((r) => r.is_paid);
                      let color = "";

                      if (isPaid) color = "text-green-400 font-semibold";
                      else {
                        const priorities = remindersForDate.map((r) =>
                          r.priority.toLowerCase()
                        );

                        if (priorities.includes("high")) {
                          color = "text-red-800 font-semibold";
                        } else if (priorities.includes("medium")) {
                          color = "text-orange-400 font-semibold";
                        } else if (priorities.includes("low")) {
                          color = "text-yellow-900 font-semibold";
                        } else {
                          color = "text-green-400 font-semibold";
                        }
                      }

                      return color;
                    }
                  }
                  return "";
                }}
                tileContent={({ date, view }) => {
                  if (view === "month") {
                    const remindersForDate = reminders.filter((r) => {
                      const reminderDate = new Date(r.due_date);
                      return (
                        reminderDate.getFullYear() === date.getFullYear() &&
                        reminderDate.getMonth() === date.getMonth() &&
                        reminderDate.getDate() === date.getDate()
                      );
                    });

                    if (remindersForDate.length > 0) {
                      const isPaid = remindersForDate.some((r) => r.is_paid);
                      let indicatorColor = "";

                      if (isPaid) indicatorColor = "#22c55e"; // green
                      else {
                        const priorities = remindersForDate.map((r) =>
                          r.priority.toLowerCase()
                        );
                        if (priorities.includes("high"))
                          indicatorColor = "#ef4444"; // red
                        else if (priorities.includes("medium"))
                          indicatorColor = "#f97316"; // orange
                        else indicatorColor = "#facc15"; // yellow
                      }

                      return (
                        <div
                          style={{
                            width: "25px",
                            height: "4px",
                            borderTopLeftRadius: "80px",
                            borderTopRightRadius: "80px",
                            backgroundColor: indicatorColor,
                            margin: "0 auto",
                            marginTop: "2px",
                          }}
                        ></div>
                      );
                    }
                  }
                  return null;
                }}
              />

              {/* 🔹 Legend */}
              <div className="flex justify-center gap-6 mt-4 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-400 rounded-md"></span> Paid
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-400 rounded-md"></span> Low
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-400 rounded-md"></span>{" "}
                  Medium
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-md"></span> High
                </div>
              </div>

              {/* 🔹 Popup for selected date */}
              {showPopup && (
                <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
                  <div className="bg-white p-6 rounded-xl shadow-lg w-[400px]">
                    <h3 className="text-xl font-semibold mb-3 text-center">
                      Reminders for {selectedDate?.toDateString()}
                    </h3>

                    {selectedReminders.length > 0 ? (
                      selectedReminders.map((r) => (
                        <div
                          key={r._id}
                          className="p-3 border rounded-lg mb-2 flex flex-col gap-1"
                        >
                          <span className="font-medium">{r.bill_name}</span>
                          {r.amount && <span>Amount: ₹{r.amount}</span>}
                          <span>Priority: {r.priority}</span>
                          <span>
                            Status: {r.is_paid ? "✅ Paid" : "⏰ Pending"}
                          </span>
                          <span>
                            Due:{" "}
                            {new Date(r.due_date).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-600">
                        No reminders on this date.
                      </p>
                    )}

                    <div className="text-center mt-4">
                      <Button onClick={() => setShowPopup(false)}>Close</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right side: Nearing bills only */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {selectedDate
                    ? format(selectedDate, "MMMM d, yyyy")
                    : "Select a date"}
                </CardTitle>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => navigate("/reminders")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Bill
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <h4 className="text-lg font-medium mb-3">
                Nearing bills ({nearingAndOverdue.length})
              </h4>
              {nearingAndOverdue.length === 0 ? (
                <p className="text-muted-foreground">
                  No nearing bills or all bills are paid.
                </p>
              ) : (
                nearingAndOverdue.map((r) => {
                  const due = new Date(r.due_date);
                  const today = new Date();
                  const startOfToday = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  );
                  const daysDiff = Math.ceil(
                    (due.getTime() - startOfToday.getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  const isOverdue = due < startOfToday;
                  let badge = "";
                  if (isOverdue) {
                    const overdueDays = Math.ceil(
                      (startOfToday.getTime() - due.getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    badge = `Overdue ${overdueDays}d`;
                  } else if (daysDiff === 0) badge = "Due Today";
                  else if (daysDiff === 1) badge = "Due Tomorrow";
                  else badge = `Due in ${daysDiff}d`;

                  return (
                    <div
                      key={r._id}
                      className={`p-3 rounded-lg mb-3 border ${getStatusColor(
                        r.due_date,
                        r.is_paid
                      )}`}
                    >
                      <div className="flex justify_between items-start">
                        <div>
                          <h3 className="font-semibold">{r.bill_name}</h3>
                          {r.amount && (
                            <p className="text-sm text-muted-foreground">
                              ₹{r.amount.toFixed(2)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 capitalize">
                            {r.priority} priority
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Due:{" "}
                            {new Date(r.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isOverdue
                              ? "bg-red-500 text-white"
                              : "bg-yellow-500 text-white"
                          }`}
                        >
                          {badge}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;