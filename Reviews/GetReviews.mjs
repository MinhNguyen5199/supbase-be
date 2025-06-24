import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const { book_id } = event.pathParameters;

    if (!book_id) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Book ID is required.' }) };
    }

    try {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select(`
                *,
                users ( username )
            `)
            .eq('book_id', book_id);

        if (error) throw error;

        // Flatten the user object
        const formattedReviews = reviews.map(r => ({
            ...r,
            username: r.users.username
        }));


        return {
            statusCode: 200,
            body: JSON.stringify({ data: formattedReviews }),
        };

    } catch (error) {
        console.error('GetReviews Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to retrieve reviews.' }) };
    }
};