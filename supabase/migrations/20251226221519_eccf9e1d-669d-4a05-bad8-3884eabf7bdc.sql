-- Add API delay configuration to automation_settings
ALTER TABLE public.automation_settings
ADD COLUMN IF NOT EXISTS api_delay_ms integer DEFAULT 3000,
ADD COLUMN IF NOT EXISTS openai_tier text DEFAULT 'free';

-- Add comment for documentation
COMMENT ON COLUMN public.automation_settings.api_delay_ms IS 'Delay between API calls in milliseconds';
COMMENT ON COLUMN public.automation_settings.openai_tier IS 'OpenAI tier: free, tier1, tier2, tier3, tier4, tier5';