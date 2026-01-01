import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Zap, 
  Globe, 
  RefreshCw, 
  Loader2, 
  Radio,
  Pause,
  Play,
  TrendingUp,
  Clock,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LiveJobsPanelProps {
  onJobsFetched: () => void;
}

const DEFAULT_KEYWORDS = `Technology, Data Scientist, Data Engineer, Technical, Product Analyst, Data Analyst, Business Analyst, Machine Learning Engineer, UX/UI Designer, Full Stack Developer, Customer Service, Customer Success Architect, Solution Engineer, Project Manager, Support, Software Development, Data Science, Data Analysis, Cloud Computing, Cybersecurity, Programming Languages, Agile Methodologies, User Experience (UX), User Interface (UI), DevOps, Continuous Integration (CI), Continuous Deployment (CD), Machine Learning, Project Management, Database Management, Web Development, Cloud Technologies, Data Science & Analytics`;

const DEFAULT_LOCATIONS = `Dublin, Ireland, United Kingdom, United States, United Arab Emirates, Dubai, Switzerland, Germany, Sweden, Spain, Netherlands, France, Belgium, Austria, Czech Republic, Portugal, Italy, Greece, Turkey, Singapore, Japan, Australia, Canada, Mexico, South Africa, Qatar, Norway, New Zealand, Denmark, Luxembourg, Malta, Cyprus, Morocco, Thailand, Serbia, Tanzania, Remote`;

export function LiveJobsPanel({ onJobsFetched }: LiveJobsPanelProps) {
  const { user } = useAuth();
  const [isPolling, setIsPolling] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [jobsFound, setJobsFound] = useState(0);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [timeValue, setTimeValue] = useState(30); // Default 30 minutes
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchLiveJobs = useCallback(async () => {
    if (!user || isFetching) return;
    
    setIsFetching(true);
    
    // Convert time to hours for API
    const hoursFilter = timeUnit === 'hours' ? timeValue : timeValue / 60;
    
    try {
      const { data, error } = await supabase.functions.invoke('live-jobs', {
        body: {
          keywords,
          locations,
          hours: hoursFilter,
          user_id: user.id,
          limit: 100,
          sortBy: 'recent', // Prioritize recently added
        },
      });

      if (error) throw error;

      if (data?.success) {
        setJobsFound(data.totalFiltered || 0);
        setLastFetch(new Date());
        onJobsFetched();
        
        if (data.jobs?.length > 0) {
          toast.success(`Found ${data.jobs.length} new jobs!`, { 
            id: 'live-jobs',
            duration: 3000 
          });
        }
      } else {
        throw new Error(data?.error || 'Fetch failed');
      }
    } catch (error) {
      console.error('Live jobs error:', error);
      toast.error('Failed to fetch jobs', { id: 'live-jobs' });
    } finally {
      setIsFetching(false);
    }
  }, [user, keywords, locations, timeValue, timeUnit, onJobsFetched, isFetching]);

  const startPolling = useCallback(() => {
    if (pollInterval) clearInterval(pollInterval);
    
    setIsPolling(true);
    fetchLiveJobs(); // Initial fetch
    
    // Poll every 2 minutes
    const interval = setInterval(fetchLiveJobs, 2 * 60 * 1000);
    setPollInterval(interval);
    
    toast.success('Live polling started - refreshing every 2 minutes', {
      duration: 3000,
    });
  }, [fetchLiveJobs, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setIsPolling(false);
    toast.info('Live polling stopped');
  }, [pollInterval]);

  // Auto-start polling on mount
  useEffect(() => {
    if (user && !isPolling && !pollInterval) {
      // Delay auto-start slightly to let page settle
      const autoStartTimer = setTimeout(() => {
        startPolling();
      }, 1000);
      return () => clearTimeout(autoStartTimer);
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const keywordCount = keywords.split(',').filter(k => k.trim()).length;
  const locationCount = locations.split(',').filter(l => l.trim()).length;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/10 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPolling ? 'bg-green-500/20 animate-pulse' : 'bg-primary/20'}`}>
              <Radio className={`h-5 w-5 ${isPolling ? 'text-green-500' : 'text-primary'}`} />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Live Tech Jobs
                {isPolling && (
                  <Badge variant="default" className="bg-green-500 text-white animate-pulse">
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                2-minute polling from 60+ tier-1 companies
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isFetching && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <Button
              variant={isPolling ? "destructive" : "default"}
              size="sm"
              onClick={isPolling ? stopPolling : startPolling}
              disabled={isFetching || !user}
            >
              {isPolling ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Live
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLiveJobs}
              disabled={isFetching || !user}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Compact Stats Row */}
        <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Found:</span>
              <span className="font-bold text-lg">{jobsFound.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last:</span>
              {lastFetch ? (
                <span className="text-green-500 font-medium">
                  {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s ago
                </span>
              ) : (
                <span className="text-muted-foreground">Never</span>
              )}
            </div>
          </div>
          
          {/* Time Filter Quick Select */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Posted within:</span>
            <div className="flex gap-1">
              {[
                { value: 15, unit: 'minutes', label: '15m' },
                { value: 30, unit: 'minutes', label: '30m' },
                { value: 1, unit: 'hours', label: '1h' },
                { value: 6, unit: 'hours', label: '6h' },
                { value: 24, unit: 'hours', label: '24h' },
              ].map(preset => (
                <Button
                  key={preset.label}
                  variant={timeValue === preset.value && timeUnit === preset.unit ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setTimeValue(preset.value);
                    setTimeUnit(preset.unit as 'minutes' | 'hours');
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Toggle Advanced - Cleaner */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-medium">Configure Keywords & Locations</span>
            <Badge variant="secondary" className="text-xs">
              {keywordCount} keywords · {locationCount} locations
            </Badge>
          </div>
          <RefreshCw className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {/* Advanced Config - Collapsible */}
        {showAdvanced && (
          <div className="space-y-4 p-4 rounded-lg border bg-card animate-in fade-in-50 slide-in-from-top-2 duration-200">
            {/* Two Column Layout for Keywords and Locations */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Keywords */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-3.5 w-3.5" />
                    Keywords
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setKeywords(DEFAULT_KEYWORDS)}
                  >
                    Reset to defaults
                  </Button>
                </div>
                <Textarea
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Data Scientist, Machine Learning, Python..."
                  className="min-h-[100px] text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {keywordCount} keywords (comma-separated)
                </p>
              </div>

              {/* Locations */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Locations
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setLocations(DEFAULT_LOCATIONS)}
                  >
                    Reset to defaults
                  </Button>
                </div>
                <Textarea
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  placeholder="Dublin, Ireland, Remote, Germany..."
                  className="min-h-[100px] text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {locationCount} locations (comma-separated)
                </p>
              </div>
            </div>

            {/* Custom Time Input */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Label className="text-sm font-medium whitespace-nowrap">Custom time:</Label>
              <Input
                type="number"
                min={1}
                max={timeUnit === 'hours' ? 168 : 10080}
                value={timeValue}
                onChange={(e) => setTimeValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 h-8"
              />
              <Select value={timeUnit} onValueChange={(v: 'minutes' | 'hours') => setTimeUnit(v)}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50">
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">ago</span>
            </div>
          </div>
        )}

        {/* ATS Platforms - Compact */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Sources:</span>
          <div className="flex flex-wrap gap-1.5">
            {['Workday', 'SmartRecruiters', 'Company Website', 'Bullhorn', 'Teamtailor'].map(platform => (
              <Badge key={platform} variant="outline" className="text-xs font-normal">
                {platform}
              </Badge>
            ))}
            <Badge variant="outline" className="text-xs font-normal">+55 more</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
