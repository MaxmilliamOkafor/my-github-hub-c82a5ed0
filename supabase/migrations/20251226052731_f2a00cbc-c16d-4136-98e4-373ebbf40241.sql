-- Create user_memories table for storing Q&A pairs with similarity matching
CREATE TABLE public.user_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query_hash TEXT NOT NULL,
  question_normalized TEXT NOT NULL,
  question_keywords TEXT[] NOT NULL DEFAULT '{}',
  answer JSONB NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  used_count INTEGER NOT NULL DEFAULT 1,
  confidence TEXT NOT NULL DEFAULT 'high',
  ats_score INTEGER DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_user_memories_user_hash ON public.user_memories(user_id, query_hash);
CREATE INDEX idx_user_memories_keywords ON public.user_memories USING GIN(question_keywords);
CREATE INDEX idx_user_memories_user_id ON public.user_memories(user_id);

-- Enable RLS
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own memories
CREATE POLICY "Users can view their own memories" 
ON public.user_memories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories" 
ON public.user_memories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories" 
ON public.user_memories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories" 
ON public.user_memories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_user_memories_updated_at
BEFORE UPDATE ON public.user_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add learned_preferences JSONB column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS learned_preferences JSONB DEFAULT '{}'::jsonb;

-- Function to prune old memories (keeps max 200 per user)
CREATE OR REPLACE FUNCTION public.prune_user_memories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  memory_count INTEGER;
BEGIN
  -- Count memories for this user
  SELECT COUNT(*) INTO memory_count 
  FROM public.user_memories 
  WHERE user_id = NEW.user_id;
  
  -- If over 200, delete oldest/lowest confidence entries
  IF memory_count > 200 THEN
    DELETE FROM public.user_memories 
    WHERE id IN (
      SELECT id FROM public.user_memories 
      WHERE user_id = NEW.user_id
      ORDER BY 
        CASE confidence 
          WHEN 'low' THEN 0 
          WHEN 'medium' THEN 1 
          WHEN 'high' THEN 2 
        END,
        used_count ASC,
        last_used_at ASC
      LIMIT (memory_count - 200)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-prune after insert
CREATE TRIGGER trigger_prune_user_memories
AFTER INSERT ON public.user_memories
FOR EACH ROW
EXECUTE FUNCTION public.prune_user_memories();