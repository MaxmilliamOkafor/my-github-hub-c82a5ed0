import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Job } from './useJobs';

interface JobFeedFilters {
  search?: string;
  location?: string;
  company?: string;
  status?: string;
  type?: string;
}

interface UseJobFeedPollingOptions {
  initialLimit?: number;
  filters?: JobFeedFilters;
  enabled?: boolean;
}

interface PollingState {
  interval: number;
  noNewJobsCount: number;
  lastFetchTime: number;
}

// Polling intervals in milliseconds
const POLLING_INTERVALS = {
  FAST: 15000,      // 15 seconds - when new jobs found
  MEDIUM: 30000,    // 30 seconds - after 2 polls with no new jobs
  SLOW: 60000,      // 60 seconds - after 5 polls with no new jobs
  IDLE: 300000,     // 5 minutes - after 10 polls with no new jobs
};

export function useJobFeedPolling(options: UseJobFeedPollingOptions = {}) {
  const { initialLimit = 50, filters = {}, enabled = true } = options;
  const { user } = useAuth();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newJobsCount, setNewJobsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Polling state
  const pollingState = useRef<PollingState>({
    interval: POLLING_INTERVALS.FAST,
    noNewJobsCount: 0,
    lastFetchTime: 0,
  });
  
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const etagRef = useRef<string | null>(null);
  const seenJobIds = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const offsetRef = useRef(0);

  // Calculate next polling interval based on activity
  const getNextPollingInterval = useCallback((foundNewJobs: boolean) => {
    if (foundNewJobs) {
      pollingState.current.noNewJobsCount = 0;
      return POLLING_INTERVALS.FAST;
    }
    
    pollingState.current.noNewJobsCount++;
    const count = pollingState.current.noNewJobsCount;
    
    if (count >= 10) return POLLING_INTERVALS.IDLE;
    if (count >= 5) return POLLING_INTERVALS.SLOW;
    if (count >= 2) return POLLING_INTERVALS.MEDIUM;
    return POLLING_INTERVALS.FAST;
  }, []);

  // Fetch jobs from API
  const fetchJobs = useCallback(async (
    isPolling = false,
    loadMore = false
  ): Promise<{ newJobs: Job[]; hasNewContent: boolean }> => {
    if (!user) return { newJobs: [], hasNewContent: false };

    try {
      const offset = loadMore ? offsetRef.current : 0;
      const params = new URLSearchParams({
        limit: String(initialLimit),
        offset: String(offset),
      });

      // Add filters
      if (filters.search) params.set('search', filters.search);
      if (filters.location) params.set('location', filters.location);
      if (filters.company) params.set('company', filters.company);
      if (filters.status) params.set('status', filters.status);

      // For polling, only get jobs since last update
      if (isPolling && lastUpdated) {
        params.set('since', lastUpdated.toISOString());
      }

      const headers: Record<string, string> = {};
      
      // Add ETag for efficient caching
      if (isPolling && etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const { data, error: fetchError } = await supabase.functions.invoke('live-jobs-feed', {
        body: null,
        headers,
      });

      // Check for 304 Not Modified (handled differently with invoke)
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Fallback to direct fetch for ETag support
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-jobs-feed?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
            ...(etagRef.current && isPolling ? { 'If-None-Match': etagRef.current } : {}),
          },
        }
      );

      // Handle 304 Not Modified
      if (response.status === 304) {
        return { newJobs: [], hasNewContent: false };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Update ETag
      const newEtag = response.headers.get('ETag');
      if (newEtag) {
        etagRef.current = newEtag;
      }

      const fetchedJobs: Job[] = result.jobs.map((job: any) => ({
        ...job,
        requirements: job.requirements || [],
        status: job.status as Job['status'],
      }));

      // Deduplicate and detect new jobs
      const newJobs: Job[] = [];
      
      fetchedJobs.forEach(job => {
        if (!seenJobIds.current.has(job.id)) {
          seenJobIds.current.add(job.id);
          newJobs.push(job);
        }
      });

      if (!mountedRef.current) return { newJobs: [], hasNewContent: false };

      // Update state
      if (loadMore) {
        setJobs(prev => [...prev, ...fetchedJobs]);
        offsetRef.current += fetchedJobs.length;
      } else if (isPolling && newJobs.length > 0) {
        // Prepend new jobs at the top
        setJobs(prev => [...newJobs, ...prev]);
        setNewJobsCount(prev => prev + newJobs.length);
      } else if (!isPolling) {
        setJobs(fetchedJobs);
        offsetRef.current = fetchedJobs.length;
        // Initialize seen IDs
        seenJobIds.current = new Set(fetchedJobs.map(j => j.id));
      }

      setTotalCount(result.total);
      setHasMore(result.hasMore);
      setLastUpdated(new Date(result.lastUpdated));
      setError(null);

      return { newJobs, hasNewContent: newJobs.length > 0 };

    } catch (err) {
      console.error('Error fetching jobs:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      }
      return { newJobs: [], hasNewContent: false };
    }
  }, [user, initialLimit, filters, lastUpdated]);

  // Initial load
  useEffect(() => {
    if (!user || !enabled) return;

    mountedRef.current = true;
    setIsLoading(true);
    
    fetchJobs(false, false).finally(() => {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [user, enabled, filters.search, filters.location, filters.company, filters.status]);

  // Polling loop
  useEffect(() => {
    if (!user || !enabled || isLoading) return;

    const poll = async () => {
      if (!mountedRef.current) return;
      
      setIsPolling(true);
      const { hasNewContent } = await fetchJobs(true, false);
      
      if (!mountedRef.current) return;
      
      setIsPolling(false);
      
      // Calculate next interval
      const nextInterval = getNextPollingInterval(hasNewContent);
      pollingState.current.interval = nextInterval;
      
      // Schedule next poll
      pollingTimeoutRef.current = setTimeout(poll, nextInterval);
    };

    // Start polling after initial load
    pollingTimeoutRef.current = setTimeout(poll, pollingState.current.interval);

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [user, enabled, isLoading, fetchJobs, getNextPollingInterval]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isPolling) return;
    
    setIsLoading(true);
    await fetchJobs(false, true);
    setIsLoading(false);
  }, [hasMore, isLoading, isPolling, fetchJobs]);

  // Manual refresh
  const refresh = useCallback(async () => {
    seenJobIds.current.clear();
    offsetRef.current = 0;
    etagRef.current = null;
    setNewJobsCount(0);
    setIsLoading(true);
    await fetchJobs(false, false);
    setIsLoading(false);
    
    // Reset polling to fast
    pollingState.current = {
      interval: POLLING_INTERVALS.FAST,
      noNewJobsCount: 0,
      lastFetchTime: Date.now(),
    };
  }, [fetchJobs]);

  // Clear new jobs notification
  const clearNewJobsNotification = useCallback(() => {
    setNewJobsCount(0);
  }, []);

  // Get current polling interval for display
  const getCurrentPollingInterval = useCallback(() => {
    return pollingState.current.interval / 1000; // Return in seconds
  }, []);

  return {
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
  };
}
