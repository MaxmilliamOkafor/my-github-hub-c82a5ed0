-- Add unique constraint for deduplication (URL-based for same user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_user_url_unique 
ON public.jobs(user_id, url) 
WHERE url IS NOT NULL;

-- Add unique constraint for title+company combo when URL is null
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_user_title_company_unique 
ON public.jobs(user_id, title, company) 
WHERE url IS NULL;