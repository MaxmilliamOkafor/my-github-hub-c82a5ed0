import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Application {
  id: string;
  job_id: string;
  user_id: string;
  status: 'pending' | 'applied' | 'interviewing' | 'offered' | 'rejected' | null;
  applied_at: string | null;
  tailored_resume: string | null;
  tailored_cover_letter: string | null;
  referral_email: string | null;
  referral_contacts: string[] | null;
  email_sent: boolean | null;
  email_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  job?: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string | null;
    salary: string | null;
  };
}

export function useApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          job:jobs(id, title, company, location, url, salary)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user, fetchApplications]);

  const deleteApplications = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setApplications((prev) => prev.filter((app) => !ids.includes(app.id)));
      toast.success(`Deleted ${ids.length} application(s)`);
    } catch (error) {
      console.error('Error deleting applications:', error);
      toast.error('Failed to delete applications');
    }
  };

  const updateApplicationStatus = async (
    id: string,
    status: Application['status']
  ) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) => (app.id === id ? { ...app, status } : app))
      );
      toast.success('Application status updated');
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
    }
  };

  return {
    applications,
    isLoading,
    fetchApplications,
    deleteApplications,
    updateApplicationStatus,
  };
}
