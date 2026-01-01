import { useState, useCallback, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Play,
  Pause,
  Square,
  Trash2,
  Link,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  ListChecks,
  Zap,
  ExternalLink,
  RefreshCw,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

interface QueueItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title?: string;
  company?: string;
  error?: string;
}

const JobQueuePage = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate job URL
  const isValidJobUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      const validDomains = [
        'greenhouse.io',
        'lever.co',
        'workday.com',
        'myworkdayjobs.com',
        'ashbyhq.com',
        'smartrecruiters.com',
        'icims.com',
        'jobvite.com',
        'linkedin.com',
        'workable.com',
      ];
      return validDomains.some((d) => parsed.hostname.includes(d));
    } catch {
      return false;
    }
  };

  // Add URLs
  const addUrls = useCallback(() => {
    if (!urlInput.trim()) return;

    const urls = urlInput
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter((u) => u && isValidJobUrl(u));

    if (urls.length === 0) {
      toast.error('No valid job URLs found');
      return;
    }

    // Check for duplicates
    const existingUrls = new Set(queue.map((q) => q.url));
    const newUrls = urls.filter((url) => !existingUrls.has(url));

    if (newUrls.length === 0) {
      toast.info('All URLs already in queue');
      return;
    }

    const newItems: QueueItem[] = newUrls.map((url) => ({
      id: crypto.randomUUID(),
      url,
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...newItems]);
    setUrlInput('');
    toast.success(`Added ${newItems.length} job(s) to queue`);
  }, [urlInput, queue]);

  // Process CSV
  const processCSV = useCallback(
    (text: string) => {
      const urls: string[] = [];
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const urlMatch = line.match(/https?:\/\/[^\s,"\\'<>]+/gi);
        if (urlMatch) {
          urlMatch.forEach((url) => {
            if (isValidJobUrl(url) && !urls.includes(url)) {
              urls.push(url);
            }
          });
        }
      }

      if (urls.length === 0) {
        toast.error('No valid job URLs found in CSV');
        return;
      }

      const existingUrls = new Set(queue.map((q) => q.url));
      const newUrls = urls.filter((url) => !existingUrls.has(url));

      if (newUrls.length === 0) {
        toast.info('All URLs already in queue');
        return;
      }

      const newItems: QueueItem[] = newUrls.map((url) => ({
        id: crypto.randomUUID(),
        url,
        status: 'pending',
      }));

      setQueue((prev) => [...prev, ...newItems]);
      toast.success(`Imported ${newItems.length} job(s) from CSV`);
    },
    [queue]
  );

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a CSV or TXT file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
  };

  // Handle drag/drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Select all
  const handleSelectAll = () => {
    if (selectedIds.length === queue.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(queue.map((q) => q.id));
    }
  };

  // Select one
  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Delete selected
  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setQueue((prev) => prev.filter((q) => !selectedIds.includes(q.id)));
    setSelectedIds([]);
    toast.success(`Removed ${selectedIds.length} item(s)`);
  };

  // Clear all
  const clearAll = () => {
    setQueue([]);
    setSelectedIds([]);
    toast.success('Queue cleared');
  };

  // Start automation
  const startAutomation = async () => {
    if (!profile) {
      toast.error('Please complete your profile first');
      return;
    }

    const pendingItems = queue.filter((q) => q.status === 'pending');
    if (pendingItems.length === 0) {
      toast.error('No pending jobs in queue');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    pauseRef.current = false;
    setProgress(0);
    abortRef.current = new AbortController();

    for (let i = 0; i < pendingItems.length; i++) {
      // Check for abort
      if (abortRef.current.signal.aborted) break;

      // Wait while paused
      while (pauseRef.current && !abortRef.current.signal.aborted) {
        await new Promise((r) => setTimeout(r, 100));
      }

      // Check abort again after pause
      if (abortRef.current.signal.aborted) break;

      const item = pendingItems[i];
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'processing' } : q))
      );

      try {
        const { data, error } = await supabase.functions.invoke('tailor-application', {
          body: {
            jobUrl: item.url,
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
          },
        });

        if (error) throw error;

        if (data.jobTitle) {
          await supabase.from('jobs').insert({
            user_id: user?.id,
            title: data.jobTitle || 'Unknown Position',
            company: data.company || 'Unknown Company',
            location: data.location || 'Remote',
            description: data.description,
            url: item.url,
            match_score: data.matchScore || 0,
            status: 'applied',
            applied_at: new Date().toISOString(),
          });
        }

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'completed',
                  title: data.jobTitle,
                  company: data.company,
                }
              : q
          )
        );
      } catch (error: any) {
        console.error('Queue processing error:', error);
        
        // Check for rate limit and add retry logic
        const errorMsg = error?.message || error?.error || 'Failed';
        const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || error?.status === 429;
        
        if (isRateLimit) {
          // Wait longer and retry once
          toast.warning('Rate limit hit, waiting 10 seconds before retry...');
          await new Promise((r) => setTimeout(r, 10000));
          
          try {
            const { data: retryData, error: retryError } = await supabase.functions.invoke('tailor-application', {
              body: {
                jobUrl: item.url,
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
              },
            });
            
            if (!retryError && retryData.jobTitle) {
              await supabase.from('jobs').insert({
                user_id: user?.id,
                title: retryData.jobTitle || 'Unknown Position',
                company: retryData.company || 'Unknown Company',
                location: retryData.location || 'Remote',
                description: retryData.description,
                url: item.url,
                match_score: retryData.matchScore || 0,
                status: 'applied',
                applied_at: new Date().toISOString(),
              });
              
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id
                    ? { ...q, status: 'completed', title: retryData.jobTitle, company: retryData.company }
                    : q
                )
              );
            } else {
              throw retryError || new Error('Retry failed');
            }
          } catch (retryErr) {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: 'failed', error: 'Rate limit exceeded after retry' }
                  : q
              )
            );
          }
        } else {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'failed', error: errorMsg }
                : q
            )
          );
        }
      }

      setProgress(((i + 1) / pendingItems.length) * 100);
      
      // Longer delay between requests to avoid rate limits (3-5 seconds with jitter)
      const baseDelay = 3000;
      const jitter = Math.random() * 2000;
      await new Promise((r) => setTimeout(r, baseDelay + jitter));
    }

    setIsProcessing(false);
    setIsPaused(false);
    pauseRef.current = false;
    const completed = queue.filter((q) => q.status === 'completed').length;
    toast.success(`Completed ${completed} applications!`);
  };

  // Pause automation
  const pauseAutomation = () => {
    pauseRef.current = true;
    setIsPaused(true);
    toast.info('Automation paused');
  };

  // Resume automation
  const resumeAutomation = () => {
    pauseRef.current = false;
    setIsPaused(false);
    toast.success('Automation resumed');
  };

  // Stop automation
  const stopAutomation = () => {
    abortRef.current?.abort();
    pauseRef.current = false;
    setIsProcessing(false);
    setIsPaused(false);
    // Reset any currently processing items back to pending
    setQueue((prev) =>
      prev.map((q) => (q.status === 'processing' ? { ...q, status: 'pending' } : q))
    );
    toast.info('Automation stopped');
  };

  // Select all pending jobs for quick start
  const selectAllPending = () => {
    const pendingIds = queue.filter((q) => q.status === 'pending').map((q) => q.id);
    if (pendingIds.length === selectedIds.length && pendingIds.every(id => selectedIds.includes(id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  // Clear completed
  const clearCompleted = () => {
    setQueue((prev) => prev.filter((q) => q.status !== 'completed'));
    toast.success('Cleared completed jobs');
  };

  // Retry failed
  const retryFailed = () => {
    setQueue((prev) =>
      prev.map((q) => (q.status === 'failed' ? { ...q, status: 'pending', error: undefined } : q))
    );
    toast.success('Failed jobs reset to pending');
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;
  const processingCount = queue.filter((q) => q.status === 'processing').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Job Queue</h1>
            <p className="text-muted-foreground mt-1">
              Import job URLs and process applications in bulk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{queue.length} total</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/30">
              {pendingCount} pending
            </Badge>
            {completedCount > 0 && (
              <Badge className="bg-success/10 text-success border-success/30">
                {completedCount} done
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                {failedCount} failed
              </Badge>
            )}
          </div>
        </div>

        {/* Add URLs Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Add Jobs to Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Paste job URL(s) - separate multiple with commas or new lines"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUrls()}
                className="flex-1"
              />
              <Button onClick={addUrls}>
                <Link className="h-4 w-4 mr-2" />
                Add URL(s)
              </Button>
            </div>

            {/* CSV Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag & drop a CSV file with job URLs
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supports Workday, SmartRecruiters, iCIMS, Bullhorn, Teamtailor, LinkedIn
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Queue Actions */}
        {queue.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAllPending} disabled={isProcessing}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All Pending ({pendingCount})
              </Button>
              {selectedIds.length > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={isProcessing}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete ({selectedIds.length})
                </Button>
              )}
              {completedCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearCompleted} disabled={isProcessing}>
                  Clear Completed
                </Button>
              )}
              {failedCount > 0 && (
                <Button variant="outline" size="sm" onClick={retryFailed} disabled={isProcessing}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry Failed
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={isProcessing}>
                Clear All
              </Button>
            </div>

            <div className="flex gap-2">
              {isProcessing ? (
                <>
                  {isPaused ? (
                    <Button onClick={resumeAutomation} variant="default">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseAutomation} variant="secondary">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button variant="destructive" onClick={stopAutomation}>
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              ) : (
                <Button onClick={startAutomation} disabled={pendingCount === 0} size="lg">
                  <Zap className="h-4 w-4 mr-2" />
                  Start Automation ({pendingCount} jobs)
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <Card className={isPaused ? 'border-warning' : ''}>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                {isPaused ? (
                  <Pause className="h-5 w-5 text-warning" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <div className="flex-1">
                  <Progress value={progress} className="h-2" />
                </div>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {isPaused 
                  ? 'Automation paused. Click Resume to continue.' 
                  : `Processing ${processingCount} job(s)... Do not close this page.`
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Queue Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="h-5 w-5 text-primary" />
              Queue ({queue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {queue.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === queue.length && queue.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Job Details</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={() => handleSelectOne(item.id)}
                            disabled={item.status === 'processing'}
                          />
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {item.url}
                          </p>
                        </TableCell>
                        <TableCell>
                          {item.title ? (
                            <div>
                              <p className="font-medium text-sm">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.company}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {item.status === 'processing' && (
                            <Badge className="bg-primary/10 text-primary border-primary/30">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {item.status === 'completed' && (
                            <Badge className="bg-success/10 text-success border-success/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                          {item.status === 'failed' && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(item.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-16">
                <Link className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold mb-2">No jobs in queue</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Add job URLs above or import a CSV file to start building your queue.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default JobQueuePage;
