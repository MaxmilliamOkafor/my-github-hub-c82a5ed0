import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AutomationPanel } from '@/components/automation/AutomationPanel';
import { JobFiltersBar } from '@/components/jobs/JobFiltersBar';
import { VirtualJobList } from '@/components/jobs/VirtualJobList';
import { LiveJobsPanel } from '@/components/jobs/LiveJobsPanel';
import { LiveJobFeed } from '@/components/jobs/LiveJobFeed';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useJobScraper } from '@/hooks/useJobScraper';
import { useProfile } from '@/hooks/useProfile';
import { Job } from '@/hooks/useJobs';
import { toast } from 'sonner';
import { 
  Briefcase, 
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  Calendar,
  Upload,
  CheckCircle,
  CheckSquare,
  Square,
  X,
  Loader2,
  LinkIcon,
  StopCircle,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  SkipForward,
  Wifi,
  Play,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Posted within time filter options (based on when job was added to your queue)
const POSTED_WITHIN_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '3d', label: '3d' },
  { value: '1w', label: '1w' },
];

const Jobs = () => {
  const { 
    jobs, 
    isLoading, 
    isScraping,
    hasMore,
    totalCount,
    loadMore, 
    updateJobStatus,
    clearAndRefresh,
    refetch,
    searchJobs,
    filterByLocation,
  } = useJobScraper();
  const { profile } = useProfile();
  const { user } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'uploaded' | 'posted'>('uploaded');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [lastSearchResultCount, setLastSearchResultCount] = useState<number | null>(null);
  const [postedWithinFilter, setPostedWithinFilter] = useState<string>('all');
  const postedWithinFilterRef = useRef<string>('all');
  const [isFetchingNew, setIsFetchingNew] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isValidatingLinks, setIsValidatingLinks] = useState(false);
  
  // Sequential apply state (single mode - opens one tab, user controls pace via extension)
  const [isApplying, setIsApplying] = useState(false);
  const [applyQueue, setApplyQueue] = useState<string[]>([]);
  const [currentApplyIndex, setCurrentApplyIndex] = useState(0);
  const [applyProgress, setApplyProgress] = useState({ current: 0, total: 0, successful: 0, failed: 0 });
  const [failedJobs, setFailedJobs] = useState<{ id: string; title: string; company: string; error: string }[]>([]);
  const abortRef = useRef(false);
  
  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  // Live Feed view toggle
  const [showLiveFeed, setShowLiveFeed] = useState(false);
  
  // Ref to scroll job list to bottom
  const scrollToJobListBottomRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowScrollTop(scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });
  const scrollToJobListBottom = () => {
    if (scrollToJobListBottomRef.current) {
      scrollToJobListBottomRef.current();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleJobApplied = (jobId: string) => updateJobStatus(jobId, 'applied');

  const handleFiltersChange = useCallback((filtered: Job[]) => {
    setFilteredJobs(filtered);
    if (activeSearchQuery) {
      setLastSearchResultCount(filtered.length);
    }
  }, [activeSearchQuery]);

  // Apply time filter and sort jobs
  const sortedJobs = useMemo(() => {
    const now = Date.now();
    
    // Time filter in minutes
    const filterMinutes: Record<string, number> = {
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '3d': 4320,
      '1w': 10080,
    };
    
    // First apply time filter based on created_at (when added to your queue)
    let jobsToSort = filteredJobs;
    if (postedWithinFilter !== 'all' && filterMinutes[postedWithinFilter]) {
      const cutoffTime = now - (filterMinutes[postedWithinFilter] * 60 * 1000);
      jobsToSort = filteredJobs.filter(job => {
        // Use created_at (when added to DB) for filtering
        const jobDate = new Date((job as any).created_at || job.posted_date).getTime();
        return jobDate >= cutoffTime;
      });
    }
    
    // Then sort
    return [...jobsToSort].sort((a, b) => {
      if (sortBy === 'posted') {
        const aDate = new Date(a.posted_date).getTime();
        const bDate = new Date(b.posted_date).getTime();
        return bDate - aDate;
      } else {
        const aCreated = new Date((a as any).created_at || a.posted_date).getTime();
        const bCreated = new Date((b as any).created_at || b.posted_date).getTime();
        return bCreated - aCreated;
      }
    });
  }, [filteredJobs, sortBy, postedWithinFilter]);

  // Get pending jobs for selection
  const pendingJobs = useMemo(() => 
    sortedJobs.filter(job => job.status === 'pending'),
    [sortedJobs]
  );

  // Select all pending jobs
  const handleSelectAll = useCallback(() => {
    const pendingIds = pendingJobs.map(job => job.id);
    setSelectedJobs(new Set(pendingIds));
  }, [pendingJobs]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedJobs(new Set());
  }, []);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedJobs(new Set());
      }
      return !prev;
    });
  }, []);

  // Get current job in apply mode
  const currentApplyJob = useMemo(() => {
    if (!isApplying || currentApplyIndex >= applyQueue.length) return null;
    return jobs.find(j => j.id === applyQueue[currentApplyIndex]);
  }, [isApplying, currentApplyIndex, applyQueue, jobs]);

  // Start sequential apply - immediately opens first job in new tab
  const startApplying = useCallback(async () => {
    if (selectedJobs.size === 0) {
      toast.error('No jobs selected');
      return;
    }
    
    const jobIds = Array.from(selectedJobs);
    const validJobs = jobIds.filter(id => {
      const job = jobs.find(j => j.id === id);
      return job?.url && job.status === 'pending';
    });
    
    if (validJobs.length === 0) {
      toast.error('No valid jobs to apply to');
      return;
    }
    
    setApplyQueue(validJobs);
    setCurrentApplyIndex(0);
    setApplyProgress({ current: 0, total: validJobs.length, successful: 0, failed: 0 });
    setFailedJobs([]);
    setIsApplying(true);
    abortRef.current = false;
    
    // Immediately open the first job in a new tab
    const firstJob = jobs.find(j => j.id === validJobs[0]);
    if (firstJob?.url) {
      window.open(firstJob.url, '_blank');
      toast.success('Opening first job', {
        description: `${validJobs.length} jobs queued. Extension popup will open automatically.`,
      });
    }
  }, [selectedJobs, jobs]);

  // Open current job and mark as applied
  const handleOpenCurrentJob = useCallback(async () => {
    if (!currentApplyJob?.url) return;
    
    // Open in new tab - user initiated so won't be blocked
    window.open(currentApplyJob.url, '_blank');
    
    // Mark as applied
    await updateJobStatus(currentApplyJob.id, 'applied');
    
    const newSuccessful = applyProgress.successful + 1;
    const newCurrent = currentApplyIndex + 1;
    
    setApplyProgress(prev => ({
      ...prev,
      current: newCurrent,
      successful: newSuccessful,
    }));
    
    if (newCurrent >= applyQueue.length || abortRef.current) {
      // All done
      finishApplying(newSuccessful, applyProgress.failed);
    } else {
      setCurrentApplyIndex(newCurrent);
    }
  }, [currentApplyJob, currentApplyIndex, applyQueue, applyProgress, updateJobStatus]);

  // Skip current job
  const handleSkipCurrentJob = useCallback(() => {
    if (!currentApplyJob) return;
    
    const newFailed = applyProgress.failed + 1;
    const newCurrent = currentApplyIndex + 1;
    
    setFailedJobs(prev => [...prev, {
      id: currentApplyJob.id,
      title: currentApplyJob.title,
      company: currentApplyJob.company,
      error: 'Skipped by user',
    }]);
    
    setApplyProgress(prev => ({
      ...prev,
      current: newCurrent,
      failed: newFailed,
    }));
    
    if (newCurrent >= applyQueue.length || abortRef.current) {
      finishApplying(applyProgress.successful, newFailed);
    } else {
      setCurrentApplyIndex(newCurrent);
    }
  }, [currentApplyJob, currentApplyIndex, applyQueue, applyProgress]);

  // Stop applying
  const stopApplying = useCallback(() => {
    abortRef.current = true;
    finishApplying(applyProgress.successful, applyProgress.failed);
    toast.info('Stopped applying');
  }, [applyProgress]);

  // Finish and cleanup
  const finishApplying = (successful: number, failed: number) => {
    setIsApplying(false);
    setApplyQueue([]);
    setSelectedJobs(new Set());
    setSelectionMode(false);
    
    if (successful > 0 || failed > 0) {
      if (failed > 0) {
        toast.warning(`Apply session completed`, {
          description: `${successful} applied, ${failed} skipped`,
          duration: 5000,
        });
      } else {
        toast.success(`Applied to ${successful} job${successful !== 1 ? 's' : ''}!`, {
          duration: 5000,
        });
      }
    }
  };

  // Submit feedback
  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackText.trim()) return;
    
    setIsSubmittingFeedback(true);
    try {
      console.log('User feedback submitted:', {
        feedback: feedbackText,
        timestamp: new Date().toISOString(),
        userId: user?.id,
        failedJobsCount: failedJobs.length,
      });
      
      toast.success('Thank you for your feedback!', {
        description: 'We will use this to improve the experience.',
      });
      
      setFeedbackDialogOpen(false);
      setFeedbackText('');
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [feedbackText, user?.id, failedJobs.length]);

  // Server-side search
  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) {
      await refetch();
      return;
    }
    setIsSearching(true);
    await searchJobs(searchInput);
    setIsSearching(false);
  }, [searchInput, searchJobs, refetch]);

  // Keep a ref so auto-refresh doesn't restart when the user changes the UI filter
  useEffect(() => {
    postedWithinFilterRef.current = postedWithinFilter;
  }, [postedWithinFilter]);

  // Fetch fresh new jobs using live-jobs function
  const handleFetchNewJobs = useCallback(async (silent = false) => {
    if (!user || isFetchingNew) return;

    setIsFetchingNew(true);
    try {
      // Get user's profile for keywords
      const { data: profileData } = await supabase
        .from('profiles')
        .select('skills')
        .eq('user_id', user.id)
        .maybeSingle();

      // Default keywords if no profile skills
      const defaultKeywords =
        'Software Engineer, Data Scientist, Product Manager, UX Designer, Full Stack Developer';
      let keywords = defaultKeywords;

      const skillsRaw = profileData?.skills as any;
      if (skillsRaw) {
        // Supports skills stored as:
        // - array of { name: string }
        // - array of strings
        // - object map
        const skillsArr = Array.isArray(skillsRaw)
          ? skillsRaw
          : typeof skillsRaw === 'object'
            ? Object.values(skillsRaw)
            : [];

        const skillNames = skillsArr
          .map((s: any) => (typeof s === 'string' ? s : s?.name))
          .filter(Boolean)
          .slice(0, 10);

        if (skillNames.length > 0) {
          keywords = skillNames.join(', ');
        }
      }

      const hoursMap: Record<string, number> = {
        '15m': 0.25,
        '30m': 0.5,
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '3d': 72,
        '1w': 168,
      };

      const currentWindow = postedWithinFilterRef.current;
      const hoursToFetch = currentWindow === 'all' ? 24 : (hoursMap[currentWindow] ?? 24);

      const { data, error } = await supabase.functions.invoke('live-jobs', {
        body: {
          keywords,
          locations: 'Remote, United States, United Kingdom',
          hours: hoursToFetch,
          limit: 100,
          user_id: user.id,
          sortBy: 'recent',
        },
      });

      if (error) throw error;

      

      if (data?.success) {
        await refetch();
        const newCount = data.totalFiltered || 0;
        if (newCount > 0) {
          toast.success(`Found ${newCount} new jobs!`, {
            description: 'Fresh listings added to your queue',
          });
          // If user hasn't chosen a window yet, default them to 1h so they immediately see the fresh batch
          if (postedWithinFilterRef.current === 'all') setPostedWithinFilter('1h');
        } else if (!silent) {
          toast.info('No new jobs found', {
            description: `Checked ${data.totalFetched || 0} listings`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching new jobs:', error);
      if (!silent) {
        toast.error('Failed to fetch new jobs');
      }
    } finally {
      setIsFetchingNew(false);
    }
  }, [user, refetch, isFetchingNew]);



  // Validate job URLs
  const handleValidateLinks = useCallback(async () => {
    setIsValidatingLinks(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-job-urls', {
        body: { validateAll: true, batchSize: 20 },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        await refetch();
        toast.success(`Validated ${data.validated} job links`, {
          description: `${data.validCount} valid, ${data.brokenCount} broken`,
        });
      }
    } catch (error) {
      console.error('Error validating links:', error);
      toast.error('Failed to validate links');
    } finally {
      setIsValidatingLinks(false);
    }
  }, [refetch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.length >= 2 || searchInput.length === 0) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);


  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-primary" />
              Job Search
            </h1>
            <p className="text-muted-foreground mt-1">
              Find and apply to jobs from top tech companies
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {jobs.length > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleValidateLinks}
                  disabled={isValidatingLinks}
                >
                  {isValidatingLinks ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  )}
                  Check Links
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearAndRefresh}
                  disabled={isScraping}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Live Jobs Panel Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={!showLiveFeed ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLiveFeed(false)}
          >
            Search Jobs
          </Button>
          <Button
            variant={showLiveFeed ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLiveFeed(true)}
          >
            <Wifi className="h-4 w-4 mr-2" />
            Live Feed
          </Button>
        </div>

        {/* Live Jobs Panel - Conditional */}
        {showLiveFeed ? (
          <Card className="p-4 h-[600px]">
            <LiveJobFeed 
              onApply={(job) => updateJobStatus(job.id, 'applied')}
              onJobSelect={(job) => {
                if (job.url) window.open(job.url, '_blank');
              }}
            />
          </Card>
        ) : (
          <LiveJobsPanel onJobsFetched={refetch} />
        )}

        {/* Filters Bar */}
        {jobs.length > 0 && (
          <JobFiltersBar 
            jobs={jobs} 
            onFiltersChange={handleFiltersChange}
            onLocationChange={async (locations) => {
              await filterByLocation(locations);
            }}
            onSearch={async (keywords, locations, filters) => {
              if (!user) return;
              setIsSearching(true);
              setActiveSearchQuery(keywords);
              try {
                const { data, error } = await supabase.functions.invoke('search-jobs-google', {
                  body: {
                    keywords,
                    location: locations || '',
                    timeFilter: filters?.timeFilter || 'all',
                    jobType: filters?.jobType || 'all',
                    workType: filters?.workType || 'all',
                    experienceLevel: filters?.experienceLevel || 'all',
                  },
                });
                
                if (error) throw error;
                
                if (data?.success) {
                  await refetch();
                  setLastSearchResultCount(data.totalFound || 0);
                  const keywordPreview = keywords.split(',').slice(0, 3).map((k: string) => k.trim()).join(', ');
                  
                  let platformInfo = '';
                  if (data.platforms && Object.keys(data.platforms).length > 0) {
                    const topPlatforms = Object.entries(data.platforms)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 4)
                      .map(([name, count]) => `${name}: ${count}`)
                      .join(', ');
                    platformInfo = topPlatforms;
                  }
                  
                  toast.success(`Found ${data.totalFound || 0} jobs across ${Object.keys(data.platforms || {}).length} platforms`, {
                    description: platformInfo || `Searched: ${keywordPreview}`,
                    duration: 5000,
                  });
                } else {
                  setLastSearchResultCount(0);
                  toast.error('Search returned no results', {
                    description: 'Try different keywords or locations',
                  });
                }
              } catch (error) {
                console.error('Search error:', error);
                setActiveSearchQuery('');
                toast.error('Failed to search jobs', {
                  description: error instanceof Error ? error.message : 'Unknown error',
                });
              } finally {
                setIsSearching(false);
              }
            }}
            isSearching={isSearching}
          />
        )}

        {/* Automation Panel */}
        {filteredJobs.length > 0 && (
          <AutomationPanel 
            jobs={filteredJobs} 
            profile={profile} 
            onJobApplied={handleJobApplied}
          />
        )}

        {/* Bulk Selection Bar */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-muted/50 p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                  disabled={isApplying}
                >
                  {selectionMode ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Exit Selection
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Bulk Select
                    </>
                  )}
                </Button>
                
                {selectionMode && !isApplying && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={pendingJobs.length === 0}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Select All ({pendingJobs.length})
                    </Button>
                    
                    {selectedJobs.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelection}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Start Applying Button - Single CTA */}
                {selectedJobs.size > 0 && !isApplying && (
                  <>
                    <Badge variant="secondary" className="text-sm">
                      {selectedJobs.size} selected
                    </Badge>
                    
                    <Button
                      size="sm"
                      onClick={startApplying}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Start Applying ({selectedJobs.size})
                    </Button>
                  </>
                )}
                
                {/* Feedback button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeedbackDialogOpen(true)}
                  className="gap-2 text-muted-foreground"
                >
                  <MessageSquare className="h-4 w-4" />
                  Report Issue
                </Button>
              </div>
            </div>
            
            {/* Sequential Apply Panel - Shows current job to apply to */}
            {isApplying && currentApplyJob && (
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-primary animate-pulse" />
                    <span className="font-medium text-primary">
                      Applying to Jobs
                    </span>
                    <Badge variant="secondary">
                      Job {currentApplyIndex + 1} of {applyQueue.length}
                    </Badge>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stopApplying}
                    className="gap-2"
                  >
                    <StopCircle className="h-4 w-4" />
                    Stop
                  </Button>
                </div>
                
                {/* Current Job Card */}
                <div className="bg-background p-4 rounded-lg border">
                  <h3 className="font-semibold text-lg">{currentApplyJob.title}</h3>
                  <p className="text-muted-foreground">{currentApplyJob.company}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{currentApplyJob.location}</span>
                    {currentApplyJob.salary && (
                      <span className="text-green-600">{currentApplyJob.salary}</span>
                    )}
                    {currentApplyJob.platform && (
                      <Badge variant="outline" className="text-xs">
                        {currentApplyJob.platform}
                      </Badge>
                    )}
                  </div>
                  {currentApplyJob.url && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      {currentApplyJob.url}
                    </p>
                  )}
                </div>
                
                {/* Progress */}
                <Progress 
                  value={(applyProgress.current / applyProgress.total) * 100} 
                  className="h-2"
                />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      {applyProgress.successful} applied
                    </span>
                    {applyProgress.failed > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <SkipForward className="h-4 w-4" />
                        {applyProgress.failed} skipped
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSkipCurrentJob}
                      className="gap-2"
                    >
                      <SkipForward className="h-4 w-4" />
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOpenCurrentJob}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open & Apply
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  Click "Open & Apply" to open the job. Your extension will handle form filling automatically.
                </p>
              </div>
            )}
            
            {/* Failed Jobs Summary */}
            {failedJobs.length > 0 && !isApplying && (
              <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">
                      {failedJobs.length} job(s) skipped
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFailedJobs([])}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {failedJobs.map((job) => (
                    <div key={job.id} className="flex items-start justify-between gap-2 text-sm bg-background/50 p-2 rounded">
                      <div>
                        <span className="font-medium">{job.title}</span>
                        <span className="text-muted-foreground"> at {job.company}</span>
                        <p className="text-destructive text-xs mt-1">{job.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Results Header */}
        {jobs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20">
            <div className="flex items-center gap-3">
              {isSearching ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Searching...</h2>
                    <p className="text-sm text-muted-foreground">Finding matching jobs</p>
                  </div>
                </div>
              ) : sortedJobs.length === 0 ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">No Jobs Found</h2>
                    <p className="text-sm text-muted-foreground">
                      {activeSearchQuery ? `No results for "${activeSearchQuery}"` : 'Try adjusting your filters'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {activeSearchQuery ? (
                        <>Jobs Found: <span className="text-primary">{sortedJobs.length.toLocaleString()}</span></>
                      ) : (
                        <>All Jobs: <span className="text-primary">{sortedJobs.length.toLocaleString()}</span></>
                      )}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {activeSearchQuery ? (
                        <>Matching "{activeSearchQuery.split(',').slice(0, 2).join(', ').trim()}"
                          {totalCount > sortedJobs.length && ` • ${totalCount.toLocaleString()} total in database`}
                        </>
                      ) : (
                        totalCount > sortedJobs.length 
                          ? `Showing ${sortedJobs.length.toLocaleString()} of ${totalCount.toLocaleString()} total`
                          : `${sortedJobs.length.toLocaleString()} jobs ready to apply`
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {activeSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveSearchQuery('');
                    setLastSearchResultCount(null);
                    refetch();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Search
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Sort: {sortBy === 'uploaded' ? 'Recently Added' : 'Posted Date'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                  <DropdownMenuItem onClick={() => setSortBy('uploaded')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Recently Added
                    {sortBy === 'uploaded' && <CheckCircle className="h-4 w-4 ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('posted')}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Posted Date
                    {sortBy === 'posted' && <CheckCircle className="h-4 w-4 ml-auto text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}



        {sortedJobs.length > 0 && (
          <VirtualJobList
            jobs={sortedJobs}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={loadMore}
            onApply={handleJobApplied}
            selectedJobs={selectedJobs}
            onSelectionChange={setSelectedJobs}
            selectionMode={selectionMode}
            scrollRef={scrollToJobListBottomRef}
          />
        )}

        {/* Loading state for initial load */}
        {(isLoading || isScraping) && jobs.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex gap-4 mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sortedJobs.length === 0 && !isLoading && !isScraping && (
          <div className="text-center py-16">
            <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {jobs.length > 0 ? 'No jobs match your filters' : 'No jobs yet'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {jobs.length > 0 
                ? 'Try adjusting your filters or search query.'
                : 'Use the search above to find jobs from top tech companies.'}
            </p>
          </div>
        )}

        {/* Stats footer */}
        {totalCount > 0 && (
          <div className="text-center text-sm text-muted-foreground py-4 border-t">
            Loaded {jobs.length.toLocaleString()} of {totalCount.toLocaleString()} jobs
            {hasMore && ' • Scroll down to load more'}
          </div>
        )}
      </div>

      {/* Scroll Navigation Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {hasMore && (
          <Button
            onClick={scrollToJobListBottom}
            className="rounded-full h-12 w-12 p-0 shadow-lg"
            size="icon"
            variant="outline"
            title="Scroll to load more jobs"
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        )}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            className="rounded-full h-12 w-12 p-0 shadow-lg"
            size="icon"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Report Issue
            </DialogTitle>
            <DialogDescription>
              Help us improve by reporting any issues you've encountered.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {failedJobs.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-1">
                  Recent skips: {failedJobs.length} job(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Common reasons: {[...new Set(failedJobs.map(j => j.error))].slice(0, 2).join(', ')}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Describe the issue
              </label>
              <Textarea
                placeholder="e.g., Links redirect to login pages, extension not detecting jobs properly..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || isSubmittingFeedback}
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Jobs;
