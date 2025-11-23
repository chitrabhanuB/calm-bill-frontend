import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Bell, TrendingUp, Shield } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative min-h-[80vh] flex items-center justify-center text-white overflow-hidden"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-accent/80"></div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
            Never Miss a Payment
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto opacity-90">
            Your calm, intelligent companion for managing bills, tracking payments, and gaining
            financial peace of mind.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              Get Started Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 gradient-soft">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Everything You Need, Nothing You Don't
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Calendar</h3>
              <p className="text-muted-foreground">
                Visual bill tracking with color-coded due dates for instant clarity
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Gentle Reminders</h3>
              <p className="text-muted-foreground">
                Never forget a payment with timely, non-intrusive notifications
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Financial Insights</h3>
              <p className="text-muted-foreground">
                Understand your spending patterns and savings potential
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-card shadow-card hover:shadow-hover transition-shadow">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
              <p className="text-muted-foreground">
                Your financial data is encrypted and never shared
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-accent text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Take Control?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Join thousands who've found financial peace with Payble
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate("/auth")}
            className="text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            Start Your Journey
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Payble. Your financial companion for peace of mind.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
