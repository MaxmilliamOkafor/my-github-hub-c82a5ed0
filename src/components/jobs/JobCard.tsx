import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Job } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  ExternalLink,
  Zap,
  CheckCircle2,
  MessageCircle,
  Gift,
  XCircle,
  Hourglass,
  Flag,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface JobCardProps {
  job: Job;
  onApply?: (job: Job) => void;
  onViewDetails?: (job: Job) => void;
  onReportBrokenLink?: (job: Job) => void;
}

const statusConfig = {
  new: { label: 'New', icon: Zap, className: 'bg-primary/10 text-primary border-primary/20' },
  pending: { label: 'Pending', icon: Hourglass, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  applied: { label: 'Applied', icon: CheckCircle2, className: 'status-applied' },
  interviewing: { label: 'Interviewing', icon: MessageCircle, className: 'status-interviewing' },
  offered: { label: 'Offered', icon: Gift, className: 'status-offered' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'status-rejected' },
};

// Extract salary from description if not provided
function extractSalary(salary: string | null | undefined, description: string | null | undefined): string {
  if (salary && salary.trim()) return salary;
  
  if (!description) return 'Not specified';
  
  // Common salary patterns
  const patterns = [
    // $100,000 - $150,000 or $100k - $150k
    /\$[\d,]+(?:k|K)?\s*[-–—to]+\s*\$?[\d,]+(?:k|K)?(?:\s*(?:per\s+)?(?:year|yr|annum|annually|pa))?/gi,
    // $100,000/year or $100k/yr
    /\$[\d,]+(?:k|K)?(?:\s*\/\s*(?:year|yr|annum|annually|hour|hr))?/gi,
    // 100,000 - 150,000 USD/EUR/GBP
    /[\d,]+\s*[-–—to]+\s*[\d,]+\s*(?:USD|EUR|GBP|CAD|AUD)/gi,
    // £50,000 - £70,000
    /[£€][\d,]+(?:k|K)?\s*[-–—to]+\s*[£€]?[\d,]+(?:k|K)?/gi,
    // Salary: $X or Compensation: $X
    /(?:salary|compensation|pay|wage)[:\s]+\$?[\d,]+(?:k|K)?/gi,
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return 'Not specified';
}

// Format relative time with short labels
function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Recently';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    
    return formatDistanceToNow(date, { addSuffix: true })
      .replace('about ', '')
      .replace('less than a minute ago', 'just now')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd');
  } catch {
    return 'Recently';
  }
}

// Extract domain from job URL for logo fetching
function extractDomainForLogo(url: string | null | undefined, company: string): string | null {
  if (!url) return null;
  
  try {
    // Try to extract company domain from various ATS URL patterns
    const patterns = [
      /https?:\/\/([^\.]+)\.wd\d+\.myworkdayjobs\.com/i, // Workday
      /https?:\/\/boards\.greenhouse\.io\/([^\/]+)/i, // Greenhouse
      /https?:\/\/([^\.]+)\.workable\.com/i, // Workable
      /https?:\/\/jobs\.smartrecruiters\.com\/([^\/]+)/i, // SmartRecruiters
      /https?:\/\/([^\.]+)\.teamtailor\.com/i, // Teamtailor
      /https?:\/\/careers-?([^\.]+)\.icims\.com/i, // ICIMS
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const companySlug = match[1].toLowerCase();
        // Common company domain mappings
        const domainMap: Record<string, string> = {
          'stripe': 'stripe.com',
          'figma': 'figma.com',
          'notion': 'notion.so',
          'coinbase': 'coinbase.com',
          'databricks': 'databricks.com',
          'plaid': 'plaid.com',
          'discord': 'discord.com',
          'airbnb': 'airbnb.com',
          'disney': 'disney.com',
          'netflix': 'netflix.com',
          'google': 'google.com',
          'microsoft': 'microsoft.com',
          'apple': 'apple.com',
          'amazon': 'amazon.com',
          'meta': 'meta.com',
          'tesla': 'tesla.com',
          'nvidia': 'nvidia.com',
          'adobe': 'adobe.com',
          'salesforce': 'salesforce.com',
          'oracle': 'oracle.com',
          'ibm': 'ibm.com',
          'intel': 'intel.com',
          'cisco': 'cisco.com',
          'dell': 'dell.com',
          'hp': 'hp.com',
          'spotify': 'spotify.com',
          'uber': 'uber.com',
          'lyft': 'lyft.com',
          'doordash': 'doordash.com',
          'instacart': 'instacart.com',
          'pinterest': 'pinterest.com',
          'reddit': 'reddit.com',
          'twitter': 'twitter.com',
          'linkedin': 'linkedin.com',
          'snap': 'snap.com',
          'tiktok': 'tiktok.com',
          'zoom': 'zoom.us',
          'slack': 'slack.com',
          'dropbox': 'dropbox.com',
          'canva': 'canva.com',
          'revolut': 'revolut.com',
          'wise': 'wise.com',
          'klarna': 'klarna.com',
          'mongodb': 'mongodb.com',
          'snowflake': 'snowflake.com',
          'datadog': 'datadoghq.com',
          'cloudflare': 'cloudflare.com',
          'twilio': 'twilio.com',
          'hashicorp': 'hashicorp.com',
          'gitlab': 'gitlab.com',
          'github': 'github.com',
          'atlassian': 'atlassian.com',
          'sysco': 'sysco.com',
          'abbott': 'abbott.com',
          'peraton': 'peraton.com',
        };
        
        if (domainMap[companySlug]) {
          return domainMap[companySlug];
        }
        
        // Guess the domain
        return `${companySlug}.com`;
      }
    }
    
    // Fallback: try to extract domain from the URL directly
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    
    // Skip ATS domains
    if (host.includes('greenhouse.io') || host.includes('workday') || 
        host.includes('smartrecruiters') || host.includes('icims') ||
        host.includes('workable') || host.includes('teamtailor')) {
      return null;
    }
    
    return host;
  } catch {
    return null;
  }
}

// Get company initials for fallback
function getCompanyInitials(company: string, url?: string | null): string {
  const cleanName = cleanCompanyName(company, url);
  return cleanName
    .split(' ')
    .filter(word => word.length > 0)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('') || '?';
}

// Clean company name by removing URL prefixes
function cleanCompanyName(company: string, url?: string | null): string {
  // First, clean the raw company value
  let cleaned = company
    .replace(/^https?:\/\//i, '') // Remove http:// or https://
    .replace(/^www\./i, ''); // Remove www.
  
  // Check if the cleaned name is a generic ATS subdomain
  const genericNames = ['apply', 'careers', 'jobs', 'hire', 'recruiting', 'talent', 'unknown company', 'unknown'];
  const firstPart = cleaned.split('.')[0].toLowerCase();
  
  if (genericNames.includes(firstPart) || cleaned.toLowerCase().includes('unknown')) {
    // Try to extract company from URL
    if (url) {
      const extracted = extractCompanyFromJobUrl(url);
      if (extracted && !genericNames.includes(extracted.toLowerCase())) {
        return extracted;
      }
    }
    return 'Unknown Company';
  }
  
  // Format the company name nicely
  return cleaned
    .split('.')[0] // Take first part before any dots
    .replace(/-/g, ' ') // Replace dashes with spaces
    .replace(/_/g, ' ') // Replace underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Unknown Company';
}

// Extract company name from job URL
function extractCompanyFromJobUrl(url: string): string | null {
  try {
    // Workable pattern: apply.workable.com/company-name/
    const workableMatch = url.match(/apply\.workable\.com\/([^\/]+)/i);
    if (workableMatch && workableMatch[1] && workableMatch[1] !== 'j') {
      return formatName(workableMatch[1]);
    }
    
    // Workday pattern: company.wd5.myworkdayjobs.com
    const workdayMatch = url.match(/https?:\/\/([^\.]+)\.wd\d+\.myworkdayjobs\.com/i);
    if (workdayMatch && workdayMatch[1]) {
      return formatName(workdayMatch[1]);
    }
    
    // Greenhouse pattern: boards.greenhouse.io/company
    const greenhouseMatch = url.match(/boards\.greenhouse\.io\/([^\/]+)/i);
    if (greenhouseMatch && greenhouseMatch[1]) {
      return formatName(greenhouseMatch[1]);
    }
    
    // SmartRecruiters pattern: jobs.smartrecruiters.com/Company
    const smartMatch = url.match(/jobs\.smartrecruiters\.com\/([^\/]+)/i);
    if (smartMatch && smartMatch[1]) {
      return formatName(smartMatch[1]);
    }
    
    // ICIMS pattern: careers-company.icims.com
    const icimsMatch = url.match(/careers-?([^\.]+)\.icims\.com/i);
    if (icimsMatch && icimsMatch[1]) {
      return formatName(icimsMatch[1]);
    }
    
    // Teamtailor pattern: company.teamtailor.com
    const teamtailorMatch = url.match(/([^\.]+)\.teamtailor\.com/i);
    if (teamtailorMatch && teamtailorMatch[1] && teamtailorMatch[1] !== 'career') {
      return formatName(teamtailorMatch[1]);
    }
    
    return null;
  } catch {
    return null;
  }
}

function formatName(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function JobCard({ job, onApply, onViewDetails, onReportBrokenLink }: JobCardProps) {
  const [isReporting, setIsReporting] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { toast } = useToast();
  
  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  
  // Use posted_date or postedDate (handle both naming conventions)
  const dateField = (job as any).posted_date || (job as any).postedDate || (job as any).created_at;
  const postedTime = formatRelativeTime(dateField);
  
  // Extract salary from description if not in dedicated field
  const displaySalary = extractSalary(job.salary, (job as any).description || job.description);
  
  // Clean and format company name
  const displayCompany = cleanCompanyName(job.company, job.url);
  
  // Get company logo URL
  const logoDomain = extractDomainForLogo(job.url, displayCompany);
  const logoUrl = logoDomain && !logoError ? `https://logo.clearbit.com/${logoDomain}` : null;
  const companyInitials = getCompanyInitials(displayCompany, job.url);

  const handleReportBrokenLink = async () => {
    if (!job.url || hasReported) return;
    
    setIsReporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not logged in",
          description: "Please log in to report broken links.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from('broken_link_reports').insert({
        user_id: user.id,
        job_id: job.id,
        url: job.url,
        report_reason: 'User reported as broken or redirecting to careers page',
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already reported",
            description: "This link has already been reported.",
          });
        } else {
          throw error;
        }
      } else {
        // Increment report count on the job
        await supabase
          .from('jobs')
          .update({ report_count: (job as any).report_count ? (job as any).report_count + 1 : 1 })
          .eq('id', job.id);

        toast({
          title: "Link reported",
          description: "Thanks for helping improve job quality!",
        });
        setHasReported(true);
        onReportBrokenLink?.(job);
      }
    } catch (error) {
      console.error('Error reporting broken link:', error);
      toast({
        title: "Error",
        description: "Failed to report link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReporting(false);
    }
  };

  // Check if URL might be problematic
  const isPotentiallyBrokenUrl = job.url && (
    (job as any).url_status === 'broken' ||
    // Workable company page without job ID
    /apply\.workable\.com\/[a-zA-Z0-9-]+\/?$/.test(job.url) ||
    // Greenhouse board without job ID
    /boards\.greenhouse\.io\/[a-zA-Z0-9-]+\/?$/.test(job.url)
  );

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30 animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                {/* Company Logo */}
                <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/50">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt={`${job.company} logo`}
                      className="w-full h-full object-contain p-1"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {companyInitials}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-muted-foreground font-medium mt-0.5">{displayCompany}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {isPotentiallyBrokenUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This link may not go directly to the job listing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Badge variant="outline" className={cn(status.className)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
              <span className="flex items-center gap-1" title={displaySalary}>
                <DollarSign className="h-4 w-4" />
                <span className="max-w-[150px] truncate">{displaySalary}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {postedTime}
              </span>
            </div>

            {/* Match Score */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    job.matchScore >= 90 ? 'bg-success' :
                    job.matchScore >= 80 ? 'bg-primary' :
                    job.matchScore >= 70 ? 'bg-warning' : 'bg-muted-foreground'
                  )}
                  style={{ width: `${job.matchScore}%` }}
                />
              </div>
              <span className={cn(
                'text-sm font-semibold',
                job.matchScore >= 90 ? 'text-success' :
                job.matchScore >= 80 ? 'text-primary' :
                job.matchScore >= 70 ? 'text-warning' : 'text-muted-foreground'
              )}>
                {job.matchScore}% Match
              </span>
            </div>

            {/* Requirements */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {job.requirements.slice(0, 4).map((req, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {req}
                </Badge>
              ))}
              {job.requirements.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{job.requirements.length - 4} more
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {job.status === 'new' && onApply && (
                <Button 
                  size="sm" 
                  className="gap-1.5"
                  onClick={() => onApply(job)}
                >
                  <Zap className="h-4 w-4" />
                  Auto Apply
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1.5"
                onClick={() => onViewDetails?.(job)}
              >
                View Details
              </Button>
              
              {/* Report Broken Link Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        hasReported && "text-amber-500"
                      )}
                      onClick={handleReportBrokenLink}
                      disabled={isReporting || hasReported || !job.url}
                    >
                      {isReporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Flag className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{hasReported ? 'Link reported' : 'Report broken link'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-auto"
                onClick={() => window.open(job.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
