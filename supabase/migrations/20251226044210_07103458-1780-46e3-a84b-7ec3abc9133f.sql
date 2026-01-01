-- Add EEO-related fields to profiles table for autofill functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS hispanic_latino BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.gender IS 'User gender for EEO autofill (Male, Female, Non-binary, Prefer not to answer)';
COMMENT ON COLUMN public.profiles.hispanic_latino IS 'Whether user identifies as Hispanic/Latino for EEO autofill';