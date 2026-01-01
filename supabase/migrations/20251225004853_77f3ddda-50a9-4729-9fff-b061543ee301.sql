-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'applied', 'interviewing', 'offered', 'rejected');

-- Create enum for email type
CREATE TYPE public.email_type AS ENUM ('application', 'referral', 'follow_up');

-- Create enum for email detection type
CREATE TYPE public.email_detection_type AS ENUM ('interview', 'rejection', 'offer', 'follow_up');

-- Jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  salary TEXT,
  description TEXT,
  requirements TEXT[],
  platform TEXT,
  url TEXT,
  posted_date TIMESTAMPTZ DEFAULT now(),
  match_score INTEGER DEFAULT 0,
  status application_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Applications table (tracks each application with AI-generated content)
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  tailored_resume TEXT,
  tailored_cover_letter TEXT,
  referral_email TEXT,
  referral_contacts TEXT[],
  status application_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email integrations table
CREATE TABLE public.email_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email detections table (tracks interview/rejection/offer emails)
CREATE TABLE public.email_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  email_subject TEXT NOT NULL,
  email_from TEXT NOT NULL,
  email_body TEXT,
  detection_type email_detection_type NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sent emails table
CREATE TABLE public.sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  email_type email_type NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Automation settings table
CREATE TABLE public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  auto_apply_enabled BOOLEAN DEFAULT false,
  min_match_score INTEGER DEFAULT 70,
  apply_within_minutes INTEGER DEFAULT 2,
  background_apply_enabled BOOLEAN DEFAULT false,
  background_apply_count INTEGER DEFAULT 10,
  send_referral_emails BOOLEAN DEFAULT true,
  platforms TEXT[] DEFAULT ARRAY['Workday', 'Greenhouse', 'Lever', 'SAP SuccessFactors', 'iCIMS'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Keyword monitors table
CREATE TABLE public.keyword_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  roles TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  min_match_score INTEGER DEFAULT 70,
  auto_apply BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  citizenship TEXT,
  linkedin TEXT,
  github TEXT,
  portfolio TEXT,
  current_salary TEXT,
  expected_salary TEXT,
  notice_period TEXT,
  total_experience TEXT,
  highest_education TEXT,
  willing_to_relocate BOOLEAN DEFAULT false,
  driving_license BOOLEAN DEFAULT false,
  visa_required BOOLEAN DEFAULT false,
  authorized_countries TEXT[] DEFAULT '{}',
  veteran_status BOOLEAN DEFAULT false,
  disability BOOLEAN DEFAULT false,
  race_ethnicity TEXT,
  security_clearance BOOLEAN DEFAULT false,
  cover_letter TEXT,
  work_experience JSONB DEFAULT '[]',
  education JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  certifications TEXT[] DEFAULT '{}',
  languages JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  excluded_companies TEXT[] DEFAULT '{}',
  ats_strategy TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Users can view their own jobs" ON public.jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for applications
CREATE POLICY "Users can view their own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for email_integrations
CREATE POLICY "Users can view their own email integration" ON public.email_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own email integration" ON public.email_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email integration" ON public.email_integrations FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for email_detections
CREATE POLICY "Users can view their own email detections" ON public.email_detections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own email detections" ON public.email_detections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email detections" ON public.email_detections FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for sent_emails
CREATE POLICY "Users can view their own sent emails" ON public.sent_emails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sent emails" ON public.sent_emails FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for automation_settings
CREATE POLICY "Users can view their own automation settings" ON public.automation_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own automation settings" ON public.automation_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automation settings" ON public.automation_settings FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for keyword_monitors
CREATE POLICY "Users can view their own keyword monitors" ON public.keyword_monitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own keyword monitors" ON public.keyword_monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own keyword monitors" ON public.keyword_monitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own keyword monitors" ON public.keyword_monitors FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_integrations_updated_at BEFORE UPDATE ON public.email_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_automation_settings_updated_at BEFORE UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_keyword_monitors_updated_at BEFORE UPDATE ON public.keyword_monitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.automation_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();