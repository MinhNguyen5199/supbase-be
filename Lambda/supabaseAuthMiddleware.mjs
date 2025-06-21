import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const supabaseAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ message: `Unauthorized: ${error?.message || 'Invalid token'}` });
  }

  // --- ADDED LOGIC ---
  // This line matches the logic from your FirebaseAuthorizer.
  // It checks if the user has a confirmed email before allowing access.
  if (!user.email_confirmed_at) {
    return res.status(403).json({ message: 'Forbidden: Please verify your email address.' });
  }

  req.user = user;
  next();
};