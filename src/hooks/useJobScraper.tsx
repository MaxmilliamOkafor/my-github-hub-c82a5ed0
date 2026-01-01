import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Job } from './useJobs';
import { toast } from 'sonner';

// Reasonable page size to prevent browser crashes
const PAGE_SIZE = 200;
const INITIAL_LOAD = 500;

export function useJobScraper() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [keywords, setKeywords] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const offsetRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadedCountRef = useRef(0);

  // Fetch jobs with pagination - NOT all at once
  const fetchExistingJobs = useCallback(async (append = false, search = '', locations: string[] = []) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const from = append ? loadedCountRef.current : 0;
      const to = from + (append ? PAGE_SIZE : INITIAL_LOAD) - 1;

      let query = supabase
        .from('jobs')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .neq('status', 'applied')
        .order('created_at', { ascending: false });

      // Server-side location filter - expand countries to include their cities
      if (locations.length > 0) {
        const locationExpansions: Record<string, string[]> = {
          'Ireland': ['Ireland', 'Dublin', 'Cork', 'Galway', 'Limerick'],
          'United Kingdom': ['United Kingdom', 'UK', 'London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Bristol', 'Leeds', 'Cambridge', 'Oxford'],
          'Germany': ['Germany', 'Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart'],
          'Netherlands': ['Netherlands', 'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht'],
          'France': ['France', 'Paris', 'Lyon', 'Marseille', 'Toulouse'],
          'United States': ['United States', 'USA', 'US', 'New York', 'San Francisco', 'Seattle', 'Austin', 'Boston', 'Chicago', 'Los Angeles'],
          'Canada': ['Canada', 'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary'],
        };
        
        // Expand selected locations to include related cities/variations
        const expandedLocations: string[] = [];
        locations.forEach(loc => {
          if (locationExpansions[loc]) {
            expandedLocations.push(...locationExpansions[loc]);
          } else {
            expandedLocations.push(loc);
          }
        });
        
        const uniqueLocations = [...new Set(expandedLocations)];
        const locationFilters = uniqueLocations.map(loc => `location.ilike.%${loc}%`).join(',');
        query = query.or(locationFilters);
        console.log('Filtering by locations:', locations, '→', uniqueLocations.length, 'terms');
      }
      
      // Server-side search if provided (only if no location filter - otherwise they conflict)
      if (search.trim() && locations.length === 0) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`title.ilike.${searchTerm},company.ilike.${searchTerm},location.ilike.${searchTerm}`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      // Filter out invalid job listings (error pages, not found, etc.)
      const INVALID_PATTERNS = [
        /page.*(?:you.*(?:looking|requested)|doesn'?t|does not).*exist/i,
        /not found/i,
        /404/i,
        /no longer available/i,
        /position.*(?:has been|is).*(?:filled|closed)/i,
        /job.*(?:has been|is).*(?:removed|deleted)/i,
        /this job is no longer/i,
        /expired/i,
        /error loading/i,
      ];

      const isInvalidJob = (job: any): boolean => {
        const textToCheck = [job.title, job.description, job.company].filter(Boolean).join(' ');
        return INVALID_PATTERNS.some(pattern => pattern.test(textToCheck));
      };

      const formattedJobs: Job[] = (data || [])
        .filter(job => !isInvalidJob(job))
        .map(job => ({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary || '',
          description: job.description || '',
          requirements: job.requirements || [],
          platform: job.platform || '',
          url: job.url || '',
          posted_date: job.posted_date || job.created_at || new Date().toISOString(),
          match_score: job.match_score || 0,
          status: job.status || 'pending',
          applied_at: job.applied_at,
          url_status: (job as any).url_status,
          report_count: (job as any).report_count,
        }));

      if (append) {
        // Dedupe when appending
        setJobs(prev => {
          const map = new Map<string, Job>();
          for (const j of prev) map.set(j.id, j);
          for (const j of formattedJobs) map.set(j.id, j);
          return Array.from(map.values());
        });
        loadedCountRef.current += formattedJobs.length;
      } else {
        setJobs(formattedJobs);
        loadedCountRef.current = formattedJobs.length;
      }

      setTotalCount(count || 0);
      setHasMore((count || 0) > (append ? loadedCountRef.current : formattedJobs.length));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Search jobs with server-side filtering
  const searchJobs = useCallback(async (query: string, locations: string[] = []) => {
    setSearchQuery(query);
    loadedCountRef.current = 0;
    await fetchExistingJobs(false, query, locations);
  }, [fetchExistingJobs]);
  
  // Filter by location only (for location dropdown changes)
  const filterByLocation = useCallback(async (locations: string[]) => {
    loadedCountRef.current = 0;
    await fetchExistingJobs(false, searchQuery, locations);
  }, [fetchExistingJobs, searchQuery]);

  // Scrape new jobs from edge function
  const scrapeJobs = useCallback(async (keywordString: string, append = false) => {
    if (!user) return;
    
    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-jobs', {
        body: {
          keywords: keywordString,
          offset: append ? offsetRef.current : 0,
          limit: 100,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        offsetRef.current = data.nextOffset;
        setHasMore(data.hasMore);
        
        // Refresh from database
        await fetchExistingJobs(append, searchQuery);
        
        if (!append) {
          toast.success(`Found ${data.jobs?.length || 0} new jobs`);
        }
      }
    } catch (error) {
      console.error('Error scraping jobs:', error);
      toast.error('Failed to scrape jobs');
    } finally {
      setIsScraping(false);
    }
  }, [user, fetchExistingJobs, searchQuery]);

  // Start continuous scraping with progress updates
  const startContinuousScraping = useCallback((keywordString: string) => {
    setKeywords(keywordString);
    setIsScraping(true);
    offsetRef.current = 0;

    (async () => {
      let totalScraped = 0;
      let hasMoreJobs = true;
      
      while (hasMoreJobs) {
        try {
          const { data } = await supabase.functions.invoke('scrape-jobs', {
            body: {
              keywords: keywordString,
              offset: offsetRef.current,
              limit: 100,
              user_id: user?.id,
            },
          });
          
          if (data?.success && data.jobs?.length > 0) {
            offsetRef.current = data.nextOffset;
            totalScraped += data.jobs.length;
            hasMoreJobs = data.hasMore;
            
            // Refresh the visible jobs (not ALL)
            await fetchExistingJobs(false, searchQuery);
            
            toast.info(`Scraped ${totalScraped} jobs...`, { id: 'scrape-progress' });
          } else {
            hasMoreJobs = false;
          }
          
          // Pause between batches
          await new Promise((r) => setTimeout(r, 500));
        } catch (error) {
          console.error('Scraping error:', error);
          hasMoreJobs = false;
        }
      }
      
      toast.success(`Finished! ${totalScraped} jobs added to your queue.`, { id: 'scrape-progress' });
      setIsScraping(false);
    })();

    // Set up interval for continuous updates
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      scrapeJobs(keywordString, true);
    }, 600000);
  }, [scrapeJobs, user, fetchExistingJobs, searchQuery]);

  // Stop continuous scraping
  const stopScraping = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Load more jobs (paginated)
  const loadMore = useCallback(async () => {
    if (isLoading || isScraping) return;
    await fetchExistingJobs(true, searchQuery);
  }, [isLoading, isScraping, fetchExistingJobs, searchQuery]);

  // Update job status
  const updateJobStatus = useCallback(async (jobId: string, status: Job['status']) => {
    if (!user) return;

    try {
      const updates: any = { status };
      if (status === 'applied') {
        updates.applied_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', jobId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (status === 'applied') {
        setJobs(prev => prev.filter(job => job.id !== jobId));
        setTotalCount(prev => prev - 1);
      } else {
        setJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, ...updates } : job
        ));
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job');
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      loadedCountRef.current = 0;
      fetchExistingJobs();
    }
  }, [user]);

  // Clear all jobs and re-scrape fresh
  const clearAndRefresh = useCallback(async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setJobs([]);
      setTotalCount(0);
      offsetRef.current = 0;
      loadedCountRef.current = 0;
      setHasMore(true);
      
      toast.success('Cleared old jobs.');
      
      if (keywords) {
        startContinuousScraping(keywords);
      }
    } catch (error) {
      console.error('Error clearing jobs:', error);
      toast.error('Failed to clear jobs');
    }
  }, [user, keywords, startContinuousScraping]);

  return {
    jobs,
    isLoading,
    isScraping,
    hasMore,
    keywords,
    totalCount,
    searchQuery,
    loadMore,
    scrapeJobs,
    searchJobs,
    filterByLocation,
    startContinuousScraping,
    stopScraping,
    updateJobStatus,
    clearAndRefresh,
    refetch: () => fetchExistingJobs(false, searchQuery),
  };
}
