import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Dashboard — Overview" },
      { name: "description", content: "Clean analytics dashboard with key metrics, activity, and insights." },
    ],
  }),
});

const stats = [
  { label: "Total Revenue", value: "$48,294", change: "+12.5%", trend: "up", icon: DollarSign },
  { label: "Active Users", value: "2,847", change: "+8.2%", trend: "up", icon: Users },
  { label: "Conversions", value: "1,294", change: "-3.1%", trend: "down", icon: TrendingUp },
  { label: "Active Now", value: "184", change: "+24.0%", trend: "up", icon: Activity },
];

const activity = [
  { name: "Olivia Martin", action: "Created a new project", time: "2m ago" },
  { name: "Jackson Lee", action: "Updated billing details", time: "14m ago" },
  { name: "Isabella Nguyen", action: "Invited 3 team members", time: "1h ago" },
  { name: "William Kim", action: "Completed onboarding", time: "3h ago" },
  { name: "Sofia Davis", action: "Upgraded to Pro plan", time: "5h ago" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary" />
            <span className="font-semibold tracking-tight">Acme</span>
          </div>
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a className="text-foreground" href="#">Overview</a>
            <a href="#">Customers</a>
            <a href="#">Products</a>
            <a href="#">Settings</a>
          </nav>
          <Button size="sm">New Report</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back. Here's what's happening today.</p>
          </div>
          <Badge variant="secondary">Last 30 days</Badge>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            const TrendIcon = s.trend === "up" ? ArrowUpRight : ArrowDownRight;
            return (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{s.label}</CardDescription>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{s.value}</div>
                  <div className={`mt-1 flex items-center gap-1 text-xs ${s.trend === "up" ? "text-emerald-600" : "text-destructive"}`}>
                    <TrendIcon className="h-3 w-3" />
                    {s.change} from last month
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Daily revenue over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-end gap-1.5">
                {Array.from({ length: 30 }).map((_, i) => {
                  const h = 30 + ((i * 37) % 70);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-primary/80 transition-all hover:bg-primary"
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest team updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity.map((a) => (
                <div key={a.name} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {a.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground">{a.action}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
