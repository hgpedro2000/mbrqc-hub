-- Allow co-inspector lookup: switch public_profiles view to SECURITY DEFINER
-- so authenticated users can list other active users' non-sensitive fields.
-- The view already excludes email/phone/PII.
ALTER VIEW public.public_profiles SET (security_invoker = off);
GRANT SELECT ON public.public_profiles TO authenticated;