import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Eye, 
  EyeOff, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Loader2,
  CloudOff,
  Timer,
  AlertTriangle
} from 'lucide-react';
import { Job } from '@/hooks/useJobs';
import { Profile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AutomationPanelProps {
  jobs: Job[];
  profile: Profile | null;
  onJobApplied: (jobId: string) => void;
}

interface AutomationLog {
  id: string;
  timestamp: Date;
  jobTitle: string;
  company: string;
  status: 'pending' | 'tailoring' | 'applied' | 'failed' | 'rate-limited';
  message: string;
}

// OpenAI tier configurations with recommended delays
const OPENAI_TIERS = {
  free: { label: 'Free Tier', delay: 5000, rpm: 3 },
  tier1: { label: 'Tier 1 ($5+)', delay: 3000, rpm: 60 },
  tier2: { label: 'Tier 2 ($50+)', delay: 2000, rpm: 100 },
  tier3: { label: 'Tier 3 ($100+)', delay: 1500, rpm: 200 },
  tier4: { label: 'Tier 4 ($250+)', delay: 1000, rpm: 500 },
  tier5: { label: 'Tier 5 ($1000+)', delay: 500, rpm: 1000 },
};

export function AutomationPanel({ jobs, profile, onJobApplied }: AutomationPanelProps) {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [backgroundCount, setBackgroundCount] = useState(10);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [openaiTier, setOpenaiTier] = useState<keyof typeof OPENAI_TIERS>('free');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [nextRequestCountdown, setNextRequestCountdown] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('automation_settings')
        .select('openai_tier, api_delay_ms')
        .eq('user_id', user.id)
        .single();
      
      if (data?.openai_tier) {
        setOpenaiTier(data.openai_tier as keyof typeof OPENAI_TIERS);
      }
    };
    loadSettings();
  }, [user?.id]);

  // Save tier setting when changed
  const handleTierChange = async (tier: keyof typeof OPENAI_TIERS) => {
    setOpenaiTier(tier);
    if (user?.id) {
      await supabase
        .from('automation_settings')
        .update({ 
          openai_tier: tier,
          api_delay_ms: OPENAI_TIERS[tier].delay 
        })
        .eq('user_id', user.id);
      toast.success(`API delay set to ${OPENAI_TIERS[tier].delay / 1000}s for ${OPENAI_TIERS[tier].label}`);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const startCountdown = (seconds: number, isRateLimit: boolean = false) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    const setter = isRateLimit ? setRateLimitCountdown : setNextRequestCountdown;
    setter(seconds);
    
    countdownIntervalRef.current = setInterval(() => {
      setter(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // All pending jobs are eligible (no match score filter)
  const eligibleJobs = jobs.filter(job => job.status === 'pending');

  const addLog = useCallback((log: Omit<AutomationLog, 'id' | 'timestamp'>) => {
    setLogs(prev => [{
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }, ...prev.slice(0, 49)]);
  }, []);

  const applyToJob = async (job: Job): Promise<boolean> => {
    if (!profile) return false;

    addLog({
      jobTitle: job.title,
      company: job.company,
      status: 'tailoring',
      message: 'AI is tailoring your resume and cover letter...'
    });

    try {
      const { data, error } = await supabase.functions.invoke('tailor-application', {
        body: {
          jobTitle: job.title,
          company: job.company,
          description: job.description || '',
          requirements: job.requirements || [],
          location: job.location,
          userProfile: {
            firstName: profile.first_name,
            lastName: profile.last_name,
            email: profile.email,
            phone: profile.phone,
            linkedin: profile.linkedin,
            github: profile.github,
            portfolio: profile.portfolio,
            coverLetter: profile.cover_letter,
            workExperience: profile.work_experience,
            education: profile.education,
            skills: profile.skills,
            certifications: profile.certifications,
            achievements: profile.achievements,
            atsStrategy: profile.ats_strategy,
            city: profile.city,
            country: profile.country,
          },
          includeReferral: false,
        }
      });

      if (error) throw error;

      // Verify attachment generation status
      const resumeOk = data.resumeGenerationStatus === 'success';
      const coverLetterOk = data.coverLetterGenerationStatus === 'success';
      
      // Warn user if any attachments failed
      if (!resumeOk) {
        toast.warning(`Resume generation failed for ${job.title} at ${job.company}. Please check your profile data.`);
      }
      if (!coverLetterOk) {
        toast.warning(`Cover letter generation failed for ${job.title} at ${job.company}. Please check your profile data.`);
      }

      // Create application record with file naming info
      await supabase.from('applications').insert({
        user_id: profile.user_id,
        job_id: job.id,
        tailored_resume: data.tailoredResume,
        tailored_cover_letter: data.tailoredCoverLetter,
        referral_email: data.referralEmail,
        status: 'applied',
        applied_at: new Date().toISOString(),
      });

      // Update job status with accurate match score
      await supabase.from('jobs').update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        match_score: data.matchScore,
      }).eq('id', job.id);

      onJobApplied(job.id);

      // Show detailed status
      const attachmentStatus = resumeOk && coverLetterOk 
        ? '✓ CV & Cover Letter ready' 
        : resumeOk 
          ? '✓ CV ready, ⚠️ Cover letter issue'
          : coverLetterOk
            ? '⚠️ CV issue, ✓ Cover letter ready'
            : '⚠️ Attachment issues';

      addLog({
        jobTitle: job.title,
        company: job.company,
        status: 'applied',
        message: `${attachmentStatus} | ATS Score: ${data.matchScore}% | Files: ${data.cvFileName}, ${data.coverLetterFileName}`
      });

      return true;
    } catch (error) {
      console.error('Error applying to job:', error);
      addLog({
        jobTitle: job.title,
        company: job.company,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to apply'
      });
      toast.error(`Failed to process ${job.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const startAutomation = async () => {
    if (!profile) {
      toast.error('Please complete your profile first');
      return;
    }

    if (eligibleJobs.length === 0) {
      toast.error('No eligible jobs to apply to');
      return;
    }

    setIsRunning(true);
    setCurrentJobIndex(0);
    setProgress(0);
    abortControllerRef.current = new AbortController();

    const jobsToProcess = eligibleJobs.slice(0, backgroundMode ? backgroundCount : eligibleJobs.length);

    if (backgroundMode) {
      // Background mode - send to edge function
      toast.info(`Starting background processing of ${jobsToProcess.length} jobs...`);
      
      try {
        const { data, error } = await supabase.functions.invoke('background-apply', {
          body: {
            userId: profile.user_id,
            jobIds: jobsToProcess.map(j => j.id),
            userProfile: {
              firstName: profile.first_name,
              lastName: profile.last_name,
              email: profile.email,
              phone: profile.phone,
              linkedin: profile.linkedin,
              github: profile.github,
              portfolio: profile.portfolio,
              coverLetter: profile.cover_letter,
              workExperience: profile.work_experience,
              education: profile.education,
              skills: profile.skills,
              certifications: profile.certifications,
              achievements: profile.achievements,
              atsStrategy: profile.ats_strategy,
            },
            sendConfirmationEmail: true,
            userEmail: profile.email,
          }
        });

        if (error) throw error;

        toast.success(`Background processing started! You'll receive an email when complete.`);
        addLog({
          jobTitle: 'Background Processing',
          company: '',
          status: 'applied',
          message: `Processing ${jobsToProcess.length} jobs in background. Email confirmation will be sent to ${profile.email}`
        });
      } catch (error) {
        console.error('Background apply error:', error);
        toast.error('Failed to start background processing');
      }

      setIsRunning(false);
      return;
    }

    // Visible mode - process one by one with UI updates
    const tierDelay = OPENAI_TIERS[openaiTier].delay;
    
    for (let i = 0; i < jobsToProcess.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      const job = jobsToProcess[i];
      setCurrentJobIndex(i);
      setProgress(((i + 1) / jobsToProcess.length) * 100);

      const success = await applyToJob(job);

      // Use tier-based delay with jitter
      if (i < jobsToProcess.length - 1) {
        const jitter = Math.random() * 1000;
        const totalDelay = tierDelay + jitter;
        const delaySeconds = Math.ceil(totalDelay / 1000);
        
        addLog({
          jobTitle: 'Queue',
          company: '',
          status: 'pending',
          message: `Waiting ${delaySeconds}s before next request (${OPENAI_TIERS[openaiTier].label})...`
        });
        
        startCountdown(delaySeconds, false);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        setNextRequestCountdown(0);
      }
    }

    setIsRunning(false);
    setNextRequestCountdown(0);
    setRateLimitCountdown(0);
    toast.success('Automation complete!');
  };

  const stopAutomation = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    toast.info('Automation stopped');
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Automation Agent
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isVisible && (
        <CardContent className="space-y-4">
          {/* Rate Limit / Countdown Alerts */}
          {rateLimitCountdown > 0 && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-pulse">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Rate Limited</p>
                <p className="text-xs text-muted-foreground">Retrying in {rateLimitCountdown}s...</p>
              </div>
              <Badge variant="destructive" className="text-lg px-3 py-1">
                <Timer className="h-4 w-4 mr-1" />
                {rateLimitCountdown}s
              </Badge>
            </div>
          )}
          
          {nextRequestCountdown > 0 && !rateLimitCountdown && (
            <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <Timer className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Next request in</p>
                <p className="text-xs text-muted-foreground">Spacing requests to avoid rate limits</p>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {nextRequestCountdown}s
              </Badge>
            </div>
          )}


          {/* Controls */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudOff className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="background-mode">Background Mode</Label>
              </div>
              <Switch
                id="background-mode"
                checked={backgroundMode}
                onCheckedChange={setBackgroundMode}
                disabled={isRunning}
              />
            </div>

            {backgroundMode && (
              <div className="space-y-2">
                <Label>Jobs to Process: {backgroundCount}</Label>
                <Slider
                  value={[backgroundCount]}
                  onValueChange={([v]) => setBackgroundCount(v)}
                  min={5}
                  max={100}
                  step={5}
                  disabled={isRunning}
                />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">
                {jobs.length} jobs loaded • {eligibleJobs.length} ready to apply
              </p>
              {isRunning && !backgroundMode && (
                <p className="text-xs text-muted-foreground">
                  Processing job {currentJobIndex + 1} of {eligibleJobs.length}
                </p>
              )}
            </div>
            
            {isRunning ? (
              <Button variant="destructive" onClick={stopAutomation}>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button onClick={startAutomation} disabled={eligibleJobs.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                {backgroundMode ? 'Start Background' : 'Start Automation'}
              </Button>
            )}
          </div>

          {isRunning && !backgroundMode && (
            <Progress value={progress} className="h-2" />
          )}

          {/* Live Logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <Label>Activity Log</Label>
              <ScrollArea className="h-48 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-2">
                  {logs.map(log => (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-2 text-sm animate-fade-in"
                    >
                      {log.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {log.status === 'tailoring' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {log.status === 'applied' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                      {log.status === 'rate-limited' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {log.jobTitle} {log.company && `at ${log.company}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.message}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
