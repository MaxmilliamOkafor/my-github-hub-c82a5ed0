-- Create table for tracking broken/reported job URLs
CREATE TABLE public.broken_link_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  report_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'fixed', 'dismissed')),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add url_status column to jobs table to track link health
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS url_status TEXT DEFAULT 'unknown' CHECK (url_status IN ('unknown', 'valid', 'broken', 'expired'));

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS url_last_checked TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- Enable RLS on broken_link_reports
ALTER TABLE public.broken_link_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can report broken links"
ON public.broken_link_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.broken_link_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_broken_link_reports_job_id ON public.broken_link_reports(job_id);
CREATE INDEX idx_broken_link_reports_status ON public.broken_link_reports(status);
CREATE INDEX idx_jobs_url_status ON public.jobs(url_status);

-- Trigger to update updated_at
CREATE TRIGGER update_broken_link_reports_updated_at
BEFORE UPDATE ON public.broken_link_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();