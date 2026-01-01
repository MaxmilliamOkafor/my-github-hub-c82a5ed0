import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { maxmilliamProfile } from '@/data/userProfile';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  citizenship: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  current_salary: string | null;
  expected_salary: string | null;
  notice_period: string | null;
  total_experience: string | null;
  highest_education: string | null;
  willing_to_relocate: boolean;
  driving_license: boolean;
  visa_required: boolean;
  authorized_countries: string[];
  veteran_status: boolean;
  disability: boolean;
  race_ethnicity: string | null;
  gender: string | null;
  hispanic_latino: boolean;
  security_clearance: boolean;
  cover_letter: string | null;
  work_experience: any[];
  education: any[];
  skills: any[];
  certifications: string[];
  languages: any[];
  achievements: any[];
  excluded_companies: string[];
  ats_strategy: string | null;
  cv_file_path: string | null;
  cv_file_name: string | null;
  cv_uploaded_at: string | null;
  openai_api_key: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile({
          ...data,
          authorized_countries: (data.authorized_countries as string[]) || [],
          work_experience: Array.isArray(data.work_experience) ? data.work_experience : [],
          education: Array.isArray(data.education) ? data.education : [],
          skills: Array.isArray(data.skills) ? data.skills : [],
          certifications: (data.certifications as string[]) || [],
          languages: Array.isArray(data.languages) ? data.languages : [],
          achievements: Array.isArray(data.achievements) ? data.achievements : [],
          excluded_companies: (data.excluded_companies as string[]) || [],
          cv_file_path: data.cv_file_path || null,
          cv_file_name: data.cv_file_name || null,
          cv_uploaded_at: data.cv_uploaded_at || null,
          gender: data.gender || null,
          hispanic_latino: data.hispanic_latino ?? false,
          openai_api_key: (data as any).openai_api_key || null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Profile updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const loadCVData = async () => {
    if (!user) return;

    try {
      const cvData = {
        first_name: maxmilliamProfile.firstName,
        last_name: maxmilliamProfile.lastName,
        email: maxmilliamProfile.email,
        phone: maxmilliamProfile.phone,
        address: maxmilliamProfile.address,
        city: maxmilliamProfile.city,
        state: maxmilliamProfile.state,
        zip_code: maxmilliamProfile.zipCode,
        country: maxmilliamProfile.country,
        citizenship: maxmilliamProfile.citizenship,
        linkedin: maxmilliamProfile.linkedin,
        github: maxmilliamProfile.github,
        portfolio: maxmilliamProfile.portfolio,
        current_salary: maxmilliamProfile.currentSalary,
        expected_salary: maxmilliamProfile.expectedSalary,
        notice_period: maxmilliamProfile.noticePeriod,
        total_experience: maxmilliamProfile.totalExperience,
        highest_education: maxmilliamProfile.highestEducation,
        willing_to_relocate: maxmilliamProfile.willingToRelocate,
        driving_license: maxmilliamProfile.drivingLicense,
        visa_required: maxmilliamProfile.visaRequired,
        authorized_countries: maxmilliamProfile.authorizedCountries,
        veteran_status: maxmilliamProfile.veteranStatus,
        disability: maxmilliamProfile.disability,
        race_ethnicity: maxmilliamProfile.raceEthnicity,
        security_clearance: maxmilliamProfile.securityClearance,
        cover_letter: maxmilliamProfile.coverLetter,
        work_experience: JSON.parse(JSON.stringify(maxmilliamProfile.workExperience)),
        education: JSON.parse(JSON.stringify(maxmilliamProfile.education)),
        skills: JSON.parse(JSON.stringify(maxmilliamProfile.skills)),
        certifications: maxmilliamProfile.certifications,
        languages: JSON.parse(JSON.stringify(maxmilliamProfile.languages)),
        achievements: JSON.parse(JSON.stringify(maxmilliamProfile.achievements)),
        excluded_companies: maxmilliamProfile.excludedCompanies,
        ats_strategy: maxmilliamProfile.atsStrategy,
      };

      const { error } = await supabase
        .from('profiles')
        .update(cvData)
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...cvData } : null);
      toast.success('CV data loaded successfully!');
    } catch (error) {
      console.error('Error loading CV data:', error);
      toast.error('Failed to load CV data');
    }
  };

  return {
    profile,
    isLoading,
    updateProfile,
    loadCVData,
    refetch: fetchProfile,
  };
}
