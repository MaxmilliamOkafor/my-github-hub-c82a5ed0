import { useRef, useCallback, memo, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Job } from '@/hooks/useJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  MapPin, 
  DollarSign, 
  Clock, 
  ExternalLink, 
  Zap,
  CheckCircle,
  Star,
  AlertTriangle,
  Flag,
  Loader2,
  LinkIcon,
  XCircle,
} from 'lucide-react';

// Tier-1 companies for visual highlighting
const TIER1_COMPANIES = [
  'google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix', 'stripe', 'airbnb',
  'uber', 'lyft', 'dropbox', 'salesforce', 'adobe', 'linkedin', 'twitter', 'snap',
  'shopify', 'square', 'paypal', 'coinbase', 'robinhood', 'plaid', 'figma', 'notion',
  'slack', 'zoom', 'datadog', 'snowflake', 'databricks', 'mongodb', 'openai', 'anthropic',
  'revolut', 'stripe', 'canva', 'linear', 'vercel', 'mercury', 'deel',
];

const isTier1Company = (company: string): boolean => {
  const normalized = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TIER1_COMPANIES.some(t1 => normalized.includes(t1) || t1.includes(normalized));
};

const getTimeAgo = (date: string) => {
  const now = Date.now();
  const jobDate = new Date(date).getTime();
  const minutes = Math.floor((now - jobDate) / (1000 * 60));
  
  if (minutes < 0) return 'Just now';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const getMatchScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-500 bg-green-500/10 border-green-500/30';
  if (score >= 65) return 'text-primary bg-primary/10 border-primary/30';
  return 'text-muted-foreground bg-muted border-border';
};

const getUrlStatusBadge = (urlStatus?: string, reportCount?: number) => {
  if (urlStatus === 'broken' || (reportCount && reportCount >= 3)) {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <XCircle className="h-3 w-3" />
        Link may be broken
      </Badge>
    );
  }
  if (reportCount && reportCount > 0) {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-yellow-500/50 text-yellow-600">
        <AlertTriangle className="h-3 w-3" />
        {reportCount} report(s)
      </Badge>
    );
  }
  return null;
};

interface JobCardProps {
  job: Job & { url_status?: string; report_count?: number };
  isSelected: boolean;
  onSelect: (jobId: string, selected: boolean) => void;
  onApply: (jobId: string) => void;
  selectionMode: boolean;
  onReportBrokenLink: (job: Job) => void;
}

const JobCard = memo(({ job, isSelected, onSelect, onApply, selectionMode, onReportBrokenLink }: JobCardProps) => {
  const isTier1 = isTier1Company(job.company);
  const isNew = Date.now() - new Date(job.posted_date).getTime() < 2 * 60 * 60 * 1000;
  const isPending = job.status === 'pending';
  const isBroken = job.url_status === 'broken' || (job.report_count && job.report_count >= 3);

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.url) {
      window.open(job.url, '_blank');
    }
  };

  return (
    <Card 
      className={`overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
          : isBroken
            ? 'border-destructive/40 bg-destructive/5'
            : job.status === 'applied' 
              ? 'border-green-500/40 bg-green-500/5' 
              : isTier1 
                ? 'border-primary/40 bg-gradient-to-r from-primary/5 to-transparent' 
                : 'hover:border-primary/30'
      }`}
      onClick={() => selectionMode && isPending && onSelect(job.id, !isSelected)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Selection checkbox */}
            {selectionMode && isPending && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(job.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-lg truncate">{job.title}</h3>
                {isNew && (
                  <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">NEW</Badge>
                )}
                {job.status === 'applied' && (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {isTier1 && (
                  <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-muted-foreground">{job.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {getUrlStatusBadge(job.url_status, job.report_count)}
            {job.match_score > 0 && (
              <Badge className={`text-xs ${getMatchScoreColor(job.match_score)}`}>
                {job.match_score}% match
              </Badge>
            )}
            {job.platform && (
              <Badge variant="outline" className="text-xs">
                {job.platform}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {job.location}
          </span>
          {job.salary && (
            <span className="flex items-center gap-1 text-green-600">
              <DollarSign className="h-3.5 w-3.5" />
              {job.salary}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Found {getTimeAgo(job.posted_date)}
          </span>
        </div>

        {/* Broken link warning */}
        {isBroken && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">
              This job link may no longer be available. The position may have been filled or removed.
            </span>
          </div>
        )}

        {job.requirements && job.requirements.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.requirements.slice(0, 6).map((req, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {req}
              </Badge>
            ))}
            {job.requirements.length > 6 && (
              <Badge variant="outline" className="text-xs">
                +{job.requirements.length - 6}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          {!selectionMode && isPending ? (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onApply(job.id); }}>
              <Zap className="h-4 w-4 mr-1" />
              Quick Apply
            </Button>
          ) : !isPending ? (
            <Button size="sm" variant="secondary" disabled>
              <CheckCircle className="h-4 w-4 mr-1" />
              Applied
            </Button>
          ) : null}
          
          {job.url && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant={isBroken ? "outline" : "outline"}
                    className={isBroken ? "border-destructive/50 text-destructive hover:bg-destructive/10" : ""}
                    onClick={handleOpenUrl}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Job
                  </Button>
                </TooltipTrigger>
                {isBroken && (
                  <TooltipContent>
                    <p>This link may be broken - the job might be closed</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Report broken link button */}
          {job.url && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onReportBrokenLink(job); }}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Report broken link</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

JobCard.displayName = 'JobCard';

interface VirtualJobListProps {
  jobs: (Job & { url_status?: string; report_count?: number })[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onApply: (jobId: string) => void;
  selectedJobs: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  selectionMode: boolean;
  scrollRef?: React.MutableRefObject<(() => void) | null>;
}

export function VirtualJobList({ 
  jobs, 
  hasMore, 
  isLoading, 
  onLoadMore, 
  onApply,
  selectedJobs,
  onSelectionChange,
  selectionMode,
  scrollRef,
}: VirtualJobListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [jobToReport, setJobToReport] = useState<Job | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  // Expose scroll to bottom function via ref - instant scroll to trigger load more
  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = () => {
        if (parentRef.current) {
          // Instant scroll to bottom to trigger load more immediately
          parentRef.current.scrollTop = parentRef.current.scrollHeight;
        }
      };
    }
  }, [scrollRef]);

  // Handle scroll to load more
  const handleScroll = useCallback(() => {
    if (!parentRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollThreshold = scrollHeight - clientHeight - 500;

    if (scrollTop >= scrollThreshold) {
      onLoadMore();
    }
  }, [isLoading, hasMore, onLoadMore]);

  const handleSelect = useCallback((jobId: string, selected: boolean) => {
    const newSelection = new Set(selectedJobs);
    if (selected) {
      newSelection.add(jobId);
    } else {
      newSelection.delete(jobId);
    }
    onSelectionChange(newSelection);
  }, [selectedJobs, onSelectionChange]);

  const handleReportBrokenLink = useCallback((job: Job) => {
    setJobToReport(job);
    setReportReason('');
    setReportDialogOpen(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!jobToReport) return;
    
    setIsReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('report-broken-link', {
        body: {
          jobId: jobToReport.id,
          url: jobToReport.url,
          reason: reportReason || 'Link not working or job no longer available',
        },
      });

      if (error) throw error;

      if (data?.alreadyReported) {
        toast.info('Already reported', {
          description: 'You have already reported this link. Thank you!',
        });
      } else {
        toast.success('Report submitted', {
          description: 'Thank you for helping improve our job listings.',
        });
      }

      setReportDialogOpen(false);
    } catch (error) {
      console.error('Error reporting broken link:', error);
      toast.error('Failed to submit report', {
        description: 'Please try again later.',
      });
    } finally {
      setIsReporting(false);
    }
  }, [jobToReport, reportReason]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <>
      <div
        ref={parentRef}
        className="h-[calc(100vh-400px)] min-h-[400px] overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const job = jobs[virtualItem.index];
            return (
              <div
                key={job.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
              >
                <div className="pb-3">
                  <JobCard 
                    job={job} 
                    isSelected={selectedJobs.has(job.id)}
                    onSelect={handleSelect}
                    onApply={onApply}
                    selectionMode={selectionMode}
                    onReportBrokenLink={handleReportBrokenLink}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Load more button as fallback */}
        {hasMore && !isLoading && jobs.length > 0 && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={onLoadMore}>
              Load More Jobs
            </Button>
          </div>
        )}
      </div>

      {/* Report Broken Link Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              Report Broken Link
            </DialogTitle>
            <DialogDescription>
              Help us maintain quality job listings by reporting broken or expired links.
            </DialogDescription>
          </DialogHeader>
          
          {jobToReport && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{jobToReport.title}</p>
                <p className="text-sm text-muted-foreground">{jobToReport.company}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate">{jobToReport.url}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  What's wrong with this link? (optional)
                </label>
                <Textarea
                  placeholder="e.g., Job page shows 'position filled', link redirects to careers home, page not found..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={submitReport}
              disabled={isReporting}
            >
              {isReporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
