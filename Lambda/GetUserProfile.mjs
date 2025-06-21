import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;

  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select(`*, subscriptions(*, status, cancel_at_period_end, expires_at)`)
      .eq('id', user.uid)
      .maybeSingle();

    if (error) throw error;

    if (profile) {
      return { statusCode: 200, body: JSON.stringify({ data: profile }) };
    }

    const isStudent = user.email?.includes('.edu');
    const { data: newProfile, error: insertError } = await supabase
      .from('users')
      .insert({ id: user.uid, email: user.email, username: user.displayName, is_student: isStudent })
      .select()
      .single();

    if (insertError) throw insertError;
    
    return { statusCode: 200, body: JSON.stringify({ data: newProfile }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};