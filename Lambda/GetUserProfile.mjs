import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  console.log(user)
  if (!user?.uid) {
    return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
  }

  try {
    // Fetch the user profile and their most recent active/trialing subscription
    // The corrected query using a left join
const { data: profile, error } = await supabase
.from('users')
.select(`
  *, 
  subscriptions!left(*, status, cancel_at_period_end, expires_at)
`)
.eq('id', user.uid)
.in('subscriptions.status', ['active', 'trialing'])
.order('created_at', { foreignTable: 'subscriptions', ascending: false })
.limit(1, { foreignTable: 'subscriptions' })
.maybeSingle();

    if (error) throw error;

    // If a profile for the user already exists...
    if (profile) { 
      // Update the 'lastlogin_at' timestamp for the existing user.
      await supabase
        .from('users')
        .update({ lastlogin_at: new Date().toISOString() })
        .eq('id', user.uid);
      
      // Return the found profile
      return { 
        statusCode: 200, 
        body: JSON.stringify({ data: profile }) 
      };
    }

    // --- If no profile exists, create one ---
    const isStudent = user.email?.includes('edu');
    console.log("Creating new user profile for:", user.uid, "Is student:", isStudent);
    // FIX: Provide a fallback for the username
const usernameFallback = user.email ? user.email.split('@')[0] : 'new_user';

const { data: newProfile, error: insertError } = await supabase
.from('users')
.insert({ 
    id: user.uid, 
    email: user.email, 
    // Use the displayName if it exists, otherwise use the fallback
    username: user.displayName || usernameFallback, 
    is_student: isStudent,
    lastlogin_at: new Date().toISOString()
  })
.select()
.single();

    if (insertError) throw insertError;
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ data: newProfile }) 
    };

  } catch (err) {
    console.error("GetUserProfile RAW Error Object:", err); // Log the original object
    const errorMessage = err.message || 'An unexpected error occurred';
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: errorMessage }) 
    };
}
};