import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QueuedRequest<T = any> {
  id: string;
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rate-limited';
  result?: any;
  error?: string;
  retryCount: number;
}

interface UseApiQueueOptions {
  /** Delay between requests in ms (default: 3000) */
  delayMs?: number;
  /** Maximum retries for rate-limited requests (default: 3) */
  maxRetries?: number;
  /** Delay multiplier after rate limit (default: 2) */
  retryDelayMultiplier?: number;
  /** Base retry delay in ms (default: 5000) */
  baseRetryDelay?: number;
}

interface UseApiQueueReturn<T> {
  queue: QueuedRequest<T>[];
  isProcessing: boolean;
  isPaused: boolean;
  progress: number;
  currentIndex: number;
  addToQueue: (items: T[]) => void;
  removeFromQueue: (ids: string[]) => void;
  clearQueue: () => void;
  startProcessing: (processor: (item: T) => Promise<any>) => Promise<void>;
  pauseProcessing: () => void;
  resumeProcessing: () => void;
  stopProcessing: () => void;
}

export function useApiQueue<T = any>(options: UseApiQueueOptions = {}): UseApiQueueReturn<T> {
  const {
    delayMs = 3000,
    maxRetries = 3,
    retryDelayMultiplier = 2,
    baseRetryDelay = 5000,
  } = options;

  const [queue, setQueue] = useState<QueuedRequest<T>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  const addToQueue = useCallback((items: T[]) => {
    const newItems: QueuedRequest<T>[] = items.map(payload => ({
      id: crypto.randomUUID(),
      payload,
      status: 'pending',
      retryCount: 0,
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const removeFromQueue = useCallback((ids: string[]) => {
    setQueue(prev => prev.filter(item => !ids.includes(item.id)));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setProgress(0);
    setCurrentIndex(0);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<QueuedRequest<T>>) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startProcessing = useCallback(async (processor: (item: T) => Promise<any>) => {
    const pendingItems = queue.filter(q => q.status === 'pending' || q.status === 'rate-limited');
    
    if (pendingItems.length === 0) {
      toast.error('No pending items in queue');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    pauseRef.current = false;
    setProgress(0);
    abortRef.current = new AbortController();

    let processedCount = 0;
    const totalToProcess = pendingItems.length;

    for (const item of pendingItems) {
      // Check for abort
      if (abortRef.current.signal.aborted) break;

      // Wait while paused
      while (pauseRef.current && !abortRef.current.signal.aborted) {
        await sleep(100);
      }

      if (abortRef.current.signal.aborted) break;

      setCurrentIndex(processedCount);
      updateItem(item.id, { status: 'processing' });

      let success = false;
      let lastError: string | undefined;

      // Retry loop for rate limits
      for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
        if (abortRef.current.signal.aborted) break;

        try {
          const result = await processor(item.payload);
          
          // Check if response indicates rate limit
          if (result?.error && (result.error.includes('rate limit') || result.error.includes('Rate limit'))) {
            throw { isRateLimit: true, message: result.error };
          }
          
          updateItem(item.id, { status: 'completed', result });
          success = true;
        } catch (error: any) {
          lastError = error?.message || error?.error || 'Unknown error';
          
          // Check for rate limit (429 or message)
          const isRateLimit = error?.isRateLimit || 
            error?.status === 429 || 
            lastError?.toLowerCase().includes('rate limit');
          
          if (isRateLimit && attempt < maxRetries) {
            const retryDelay = baseRetryDelay * Math.pow(retryDelayMultiplier, attempt);
            console.log(`Rate limit hit, waiting ${retryDelay}ms before retry ${attempt + 1}/${maxRetries}`);
            
            updateItem(item.id, { 
              status: 'rate-limited', 
              retryCount: attempt + 1,
              error: `Rate limited. Retrying in ${Math.round(retryDelay / 1000)}s...`
            });
            
            toast.warning(`Rate limit hit. Waiting ${Math.round(retryDelay / 1000)}s before retry...`);
            
            await sleep(retryDelay);
          } else {
            // Non-retryable error or max retries exceeded
            updateItem(item.id, { 
              status: 'failed', 
              error: lastError,
              retryCount: attempt
            });
          }
        }
      }

      processedCount++;
      setProgress((processedCount / totalToProcess) * 100);

      // Delay between requests to avoid rate limits
      if (processedCount < totalToProcess && !abortRef.current.signal.aborted) {
        console.log(`Waiting ${delayMs}ms before next request...`);
        await sleep(delayMs);
      }
    }

    setIsProcessing(false);
    
    const completed = queue.filter(q => q.status === 'completed').length + 
      pendingItems.filter(q => q.status !== 'failed' && q.status !== 'rate-limited').length;
    const failed = queue.filter(q => q.status === 'failed').length;
    
    if (!abortRef.current.signal.aborted) {
      toast.success(`Queue complete: ${completed} succeeded, ${failed} failed`);
    }
  }, [queue, delayMs, maxRetries, baseRetryDelay, retryDelayMultiplier, updateItem]);

  const pauseProcessing = useCallback(() => {
    pauseRef.current = true;
    setIsPaused(true);
    toast.info('Queue paused');
  }, []);

  const resumeProcessing = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
    toast.info('Queue resumed');
  }, []);

  const stopProcessing = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setIsPaused(false);
    toast.info('Queue stopped');
  }, []);

  return {
    queue,
    isProcessing,
    isPaused,
    progress,
    currentIndex,
    addToQueue,
    removeFromQueue,
    clearQueue,
    startProcessing,
    pauseProcessing,
    resumeProcessing,
    stopProcessing,
  };
}
