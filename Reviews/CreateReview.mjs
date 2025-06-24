import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    }
    const { book_id, rating, review_text } = event.body;
    if (!book_id || !rating) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Book ID and rating are required.' }) };
    }

    if (rating < 1 || rating > 5) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Rating must be between 1 and 5.'}) };
    }

    try {
        const { data: newReview, error } = await supabase
            .from('reviews')
            .insert({
                book_id,
                user_id: user.uid,
                rating,
                review_text
            })
            .select()
            .single();

        if (error) {
          // Handle potential unique constraint violation if user already reviewed the book
          if (error.code === '23505') {
            return { statusCode: 409, body: JSON.stringify({ message: 'You have already reviewed this book.' }) };
          }
          throw error;
        }

        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Review created successfully.', review: newReview }),
        };
    } catch (error) {
        console.error('CreateReview Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to create review.' }) };
    }
}
