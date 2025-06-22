import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    }

    // Only allow admins to create/update summaries
    const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.uid)
        .single();

    if (profileError || !userProfile?.is_admin) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Only administrators can manage summaries.' }) };
    }

    const { book_id, text_content } = event.body;

    if (!book_id || !text_content) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Book ID and text_content are required.' }) };
    }

    try {
        // Check if a summary already exists for this book
        const { data: existingSummary, error: fetchError } = await supabase
            .from('summaries')
            .select('summary_id')
            .eq('book_id', book_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
            throw fetchError;
        }

        let result;
        if (existingSummary) {
            // Update existing summary
            result = await supabase
                .from('summaries')
                .update({ text_content: text_content, created_at: new Date().toISOString() }) // Update timestamp on edit
                .eq('summary_id', existingSummary.summary_id)
                .select()
                .single();
            if (result.error) throw result.error;

            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Summary updated successfully.', summary: result.data }),
            };
        } else {
            // Insert new summary
            result = await supabase
                .from('summaries')
                .insert({ book_id: book_id, text_content: text_content })
                .select()
                .single();
            if (result.error) throw result.error;

            return {
                statusCode: 201,
                body: JSON.stringify({ message: 'Summary created successfully.', summary: result.data }),
            };
        }

    } catch (error) {
        console.error('CreateUpdateSummary Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to save summary.' }) };
    }
};
