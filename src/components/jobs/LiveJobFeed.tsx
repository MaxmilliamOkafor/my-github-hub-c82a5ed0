import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useJobFeedPolling } from '@/hooks/useJobFeedPolling';
import { Job } from '@/hooks/useJobs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  RefreshCw, 
  Briefcase, 
  MapPin, 
  Building2, 
  Clock, 
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
  Sparkles,
  Wifi,
  Bell,
  X,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface LiveJobFeedProps {
  onJobSelect?: (job: Job) => void;
  onApply?: (job: Job) => void;
  className?: string;
}

// Format relative time like LinkedIn/Indeed
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if job is new (less than 5 minutes old)
function isNewJob(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return (now.getTime() - date.getTime()) < 5 * 60 * 1000;
}

// Job Card Component with animations
function JobFeedCard({ 
  job, 
  isNew, 
  onSelect, 
  onApply,
  index 
}: { 
  job: Job; 
  isNew: boolean;
  onSelect?: (job: Job) => void;
  onApply?: (job: Job) => void;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Animation on mount for new jobs
  useEffect(() => {
    if (isNew && cardRef.current) {
      cardRef.current.classList.add('animate-slide-in-new');
    }
  }, [isNew]);

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.url) {
      window.open(job.url, '_blank');
    }
    onApply?.(job);
  };

  return (
    <Card
      ref={cardRef}
      className={cn(
        'group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border-border/50',
        isNew && 'ring-2 ring-primary/30 bg-primary/5',
        isHovered && 'border-primary/50',
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(job)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isNew && (
                <Badge 
                  variant="default" 
                  className="animate-pulse-badge bg-primary text-primary-foreground text-[10px] px-1.5 py-0"
                >
                  <Sparkles className="w-3 h-3 mr-0.5" />
                  NEW
                </Badge>
              )}
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {job.title}
              </h3>
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1 truncate">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                {job.company}
              </span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {job.location}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {job.salary && (
                <Badge variant="secondary" className="text-xs">
                  {job.salary}
                </Badge>
              )}
              {job.platform && (
                <Badge variant="outline" className="text-xs">
                  {job.platform}
                </Badge>
              )}
              {job.match_score > 0 && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs',
                    job.match_score >= 80 && 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950',
                    job.match_score >= 60 && job.match_score < 80 && 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950',
                    job.match_score < 60 && 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950',
                  )}
                >
                  {job.match_score}% match
                </Badge>
              )}
            </div>
          </div>

          {/* Right: Time + Actions */}
          <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(job.created_at || job.posted_date)}
            </span>
            
            <Button
              size="sm"
              variant={job.status === 'applied' ? 'secondary' : 'default'}
              className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleApply}
              disabled={job.status === 'applied'}
            >
              {job.status === 'applied' ? 'Applied' : (
                <>
                  Apply
                  <ExternalLink className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function JobFeedSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LiveJobFeed({ onJobSelect, onApply, className }: LiveJobFeedProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    jobs,
    isLoading,
    isPolling,
    hasMore,
    totalCount,
    lastUpdated,
    newJobsCount,
    error,
    loadMore,
    refresh,
    clearNewJobsNotification,
    getCurrentPollingInterval,
  } = useJobFeedPolling({
    filters: {
      search: debouncedSearch,
      location,
      status,
    },
  });

  // Auto-refresh timestamps every 60 seconds
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreTriggerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  // Scroll to top when new jobs notification is clicked
  const handleNewJobsClick = useCallback(() => {
    feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    clearNewJobsNotification();
  }, [clearNewJobsNotification]);

  const handleApply = useCallback((job: Job) => {
    onApply?.(job);
  }, [onApply]);

  // Track which jobs are "new" (less than 5 min old)
  const jobsWithNewStatus = useMemo(() => {
    return jobs.map(job => ({
      ...job,
      _isNew: isNewJob(job.created_at || job.posted_date),
    }));
  }, [jobs]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Live Jobs
          </h2>
          {isPolling && (
            <Badge variant="outline" className="animate-pulse">
              <Wifi className="w-3 h-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalCount} jobs • Updates every {getCurrentPollingInterval()}s
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* New Jobs Notification Banner */}
      {newJobsCount > 0 && (
        <Button
          variant="default"
          size="sm"
          className="mb-3 animate-bounce-subtle"
          onClick={handleNewJobsClick}
        >
          <Bell className="w-4 h-4 mr-2" />
          {newJobsCount} new job{newJobsCount !== 1 ? 's' : ''} - Click to view
        </Button>
      )}

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearch('')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              Filters
              <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform', filtersOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                <Input
                  placeholder="Any location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="interviewing">Interviewing</SelectItem>
                    <SelectItem value="offered">Offered</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Error State */}
      {error && (
        <Card className="mb-4 border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive flex items-center justify-between">
            <span>Failed to load jobs: {error}</span>
            <Button variant="ghost" size="sm" onClick={refresh}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      <div 
        ref={feedContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1"
      >
        {isLoading && jobs.length === 0 ? (
          // Initial loading
          Array.from({ length: 5 }).map((_, i) => (
            <JobFeedSkeleton key={i} />
          ))
        ) : jobs.length === 0 ? (
          // Empty state
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No jobs found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try adjusting your filters or check back later
              </p>
            </CardContent>
          </Card>
        ) : (
          // Jobs list
          <>
            {jobsWithNewStatus.map((job, index) => (
              <JobFeedCard
                key={job.id}
                job={job}
                isNew={job._isNew}
                onSelect={onJobSelect}
                onApply={handleApply}
                index={index}
              />
            ))}

            {/* Load more trigger */}
            <div ref={loadMoreTriggerRef} className="py-2">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && jobs.length > 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  You've reached the end
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Last Updated Footer */}
      {lastUpdated && (
        <div className="pt-2 mt-2 border-t text-xs text-muted-foreground text-center">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
