import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    monthly_income: "",
    misc_monthly_expenses: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        toast.error("Failed to load profile");
      } else if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || "",
          monthly_income: data.monthly_income?.toString() || "",
          misc_monthly_expenses: data.misc_monthly_expenses?.toString() || "",
        });
      }
    };

    fetchProfile();
  }, [navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const updates = {
      id: session.user.id,
      full_name: profile.full_name,
      monthly_income: profile.monthly_income ? parseFloat(profile.monthly_income) : 0,
      misc_monthly_expenses: profile.misc_monthly_expenses
        ? parseFloat(profile.misc_monthly_expenses)
        : 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(updates);

    if (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully!");
    }

    setLoading(false);
  };


  return (
    <div className="min-h-screen gradient-soft">
      <header className="bg-card border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Your Profile
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly_income">Monthly Income</Label>
                <Input
                  id="monthly_income"
                  type="number"
                  step="0.01"
                  value={profile.monthly_income}
                  onChange={(e) => setProfile({ ...profile, monthly_income: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="misc_expenses">Miscellaneous Monthly Expenses</Label>
                <Input
                  id="misc_expenses"
                  type="number"
                  step="0.01"
                  value={profile.misc_monthly_expenses}
                  onChange={(e) =>
                    setProfile({ ...profile, misc_monthly_expenses: e.target.value })
                  }
                />
              </div>

              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
