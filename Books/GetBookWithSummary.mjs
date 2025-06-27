import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    // const user = event.requestContext.authorizer;
    // if (!user?.uid) {
    //     return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    // }
    console.log(event);

    const { bookId } = event.body; // Assuming bookId is passed in the request body

    if (!bookId) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Book ID is required.' }) };
    }

    try {
        const { data: bookData, error } = await supabase
            .from('books')
            .select(`
                *,
                authors (name),
                genres (name),
                affiliate_links (provider, url),
                summaries (summary_id, text_content)
            `)
            .eq('book_id', bookId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                return { statusCode: 404, body: JSON.stringify({ message: 'Book not found.' }) };
            }
            throw error;
        }

        if (!bookData) {
            return { statusCode: 404, body: JSON.stringify({ message: 'Book not found.' }) };
        }

        // Flatten the author and genre arrays for easier consumption
        const formattedBookData = {
            ...bookData,
            authors: bookData.authors.map(a => a.name),
            genres: bookData.genres.map(g => g.name),
            // Summaries will already be an array of objects
        };

        return {
            statusCode: 200,
            body: JSON.stringify({ data: formattedBookData }),
        };

    } catch (error) {
        console.error('GetBookWithSummary Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to retrieve book details.' }) };
    }
};
