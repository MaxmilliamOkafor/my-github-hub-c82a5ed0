import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { useProfile } from '@/hooks/useProfile';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  CheckCircle2, 
  MessageCircle, 
  Gift, 
  Zap,
  ArrowRight,
  Sparkles,
  Target,
  User,
  LogOut,
  Infinity
} from 'lucide-react';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { jobs } = useJobs();
  const { profile, loadCVData } = useProfile();
  const [stats, setStats] = useState({
    applied: 0,
    interviewing: 0,
    offered: 0,
    pending: 0,
  });

  useEffect(() => {
    const applied = jobs.filter(j => j.status === 'applied').length;
    const interviewing = jobs.filter(j => j.status === 'interviewing').length;
    const offered = jobs.filter(j => j.status === 'offered').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    setStats({ applied, interviewing, offered, pending });
  }, [jobs]);

  const topMatches = jobs
    .filter(j => j.status === 'pending')
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 10);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Your AI job application agent is ready to help
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        {!profile?.first_name && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Complete your profile</p>
                    <p className="text-sm text-muted-foreground">
                      Load your CV data to enable AI-powered applications
                    </p>
                  </div>
                </div>
                <Button onClick={loadCVData}>
                  Load CV Data
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Daily Limit"
            value="∞"
            subtitle="Unlimited applications"
            icon={<Infinity className="h-5 w-5" />}
            valueClassName="text-primary"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            subtitle="Ready to apply"
            icon={<Target className="h-5 w-5" />}
          />
          <StatsCard
            title="Applied"
            value={stats.applied}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatsCard
            title="Interviewing"
            value={stats.interviewing}
            icon={<MessageCircle className="h-5 w-5" />}
          />
          <StatsCard
            title="Offers"
            value={stats.offered}
            icon={<Gift className="h-5 w-5" />}
            valueClassName="text-green-500"
          />
        </div>

        {/* Top Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Top Matches Ready to Apply
            </CardTitle>
            <CardDescription>
              Highest scoring jobs for auto-apply
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topMatches.length > 0 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {topMatches.map(job => (
                    <a 
                      key={job.id}
                      href={job.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted hover:border-primary/30 border border-transparent transition-all cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">{job.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {job.company}{job.salary ? ` • ${job.salary}` : ''} - {job.location}
                        </p>
                      </div>
                      <Badge className="ml-2 bg-primary/10 text-primary shrink-0">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {job.match_score || 0}%
                      </Badge>
                    </a>
                  ))}
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/jobs">
                    View All Jobs
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No jobs yet</p>
                <Button className="mt-4" asChild>
                  <Link to="/jobs">
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Jobs
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link 
                to="/profile" 
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium">Load Your Profile</p>
                  <p className="text-sm text-muted-foreground">
                    Import your CV for AI-tailored applications
                  </p>
                </div>
              </Link>
              <Link 
                to="/jobs" 
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium">Find Jobs</p>
                  <p className="text-sm text-muted-foreground">
                    Search across 60+ ATS platforms instantly
                  </p>
                </div>
              </Link>
              <Link 
                to="/jobs" 
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium">Start Automation</p>
                  <p className="text-sm text-muted-foreground">
                    Let AI apply to jobs while you relax
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
