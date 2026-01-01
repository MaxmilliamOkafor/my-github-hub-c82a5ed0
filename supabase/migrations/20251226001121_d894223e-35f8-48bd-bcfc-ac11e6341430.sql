-- Add DELETE policy for email_integrations table to allow users to disconnect their email integration
CREATE POLICY "Users can delete their own email integration" 
ON public.email_integrations 
FOR DELETE 
USING (auth.uid() = user_id);