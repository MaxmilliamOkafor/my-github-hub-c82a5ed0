-- Add DELETE policy for profiles table to allow users to remove their sensitive data
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);