-- Add OpenAI API key column to profiles table
-- This allows each user to store their own OpenAI API key
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.openai_api_key IS 'User provided OpenAI API key for AI-powered resume tailoring';