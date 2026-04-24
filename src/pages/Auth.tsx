// src/pages/Auth.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const Auth = () => {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    monthlyIncome: "",
    miscExpenses: "",
  });

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate("/dashboard");
      }
    };

    checkUser();
  }, [navigate]);

  // ✅ Reusable MongoDB sync function
  const syncUserToMongo = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      const user = session?.user;

      if (!token || !user) return;

      await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || formData.fullName || "",
          monthly_income:
            Number(user.user_metadata?.monthly_income) ||
            Number(formData.monthlyIncome) ||
            0,
          misc_monthly_expenses:
            Number(user.user_metadata?.misc_monthly_expenses) ||
            Number(formData.miscExpenses) ||
            0,
        }),
      });
    } catch (error) {
      console.error("Mongo sync error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ==================================================
      // LOGIN
      // ==================================================
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // ✅ Sync user to Mongo on login
        await syncUserToMongo();

        toast.success("Welcome back!");
        navigate("/dashboard");
      }

      // ==================================================
      // SIGNUP
      // ==================================================
      else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              monthly_income: formData.monthlyIncome,
              misc_monthly_expenses: formData.miscExpenses,
            },
          },
        });

        if (error) throw error;

        // ✅ Wait briefly for session creation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // ✅ Sync user to Mongo after signup
        await syncUserToMongo();

        toast.success("Account created successfully!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-soft flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card border-border/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {isLogin ? "Welcome Back" : "Join Payble"}
          </CardTitle>

          <CardDescription className="text-center">
            {isLogin
              ? "Sign in to manage your bills"
              : "Create an account to start tracking your bills"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fullName: e.target.value,
                      })
                    }
                    required={!isLogin}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="income">Monthly Income</Label>
                    <Input
                      id="income"
                      type="number"
                      placeholder="50000"
                      value={formData.monthlyIncome}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          monthlyIncome: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenses">Misc Expenses</Label>
                    <Input
                      id="expenses"
                      type="number"
                      placeholder="10000"
                      value={formData.miscExpenses}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          miscExpenses: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    password: e.target.value,
                  })
                }
                required
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-accent transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;