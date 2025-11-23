import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * This component checks if the user is logged in.
 * If not, it redirects to /auth.
 */
export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        toast.error("Error checking session");
        setIsAuthenticated(false);
      } else if (data?.session) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkSession();

    // Listen for session changes (sign-in / sign-out)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // While loading, you can show a spinner or blank screen
  if (isAuthenticated === null) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};
