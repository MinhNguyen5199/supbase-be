import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  if (!user?.uid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "User not authenticated." }),
    };
  }

  // Only allow admins to create books
  const { data: userProfile, error: profileError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.uid)
    .single();

  if (profileError || !userProfile?.is_admin) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        message: "Forbidden: Only administrators can create books.",
      }),
    };
  }
  const {
    title,
    description,
    publication_date,
    cover_image_url,
    authors, // Array of author names (string)
    genres, // Array of genre names (string)
    affiliate_links, // Array of { provider: string, url: string }
  } = event.body;

  if (!title || !authors || !genres) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Title, authors, and genres are required.",
      }),
    };
  }

  try {
    // 1. Insert the new book
    const { data: newBook, error: bookError } = await supabase
      .from("books")
      .insert({
        title,
        description,
        publication_date,
        cover_image_url,
      })
      .select()
      .single();

    if (bookError) throw bookError;

    const bookId = newBook.book_id;

    for (const authorName of authors) {
      let authorId;
      // Try to find existing author
      const { data: existingAuthor, error: findAuthorError } = await supabase
        .from("authors")
        .select("author_id")
        .eq("name", authorName)
        .single();

      if (findAuthorError && findAuthorError.code !== "PGRST116") {
        // PGRST116 means no rows found
        throw findAuthorError;
      }

      if (existingAuthor) {
        authorId = existingAuthor.author_id;
      } else {
        // Create new author if not found
        const { data: newAuthor, error: insertAuthorError } = await supabase
          .from("authors")
          .insert({ name: authorName })
          .select("author_id")
          .single();
        if (insertAuthorError) throw insertAuthorError;
        authorId = newAuthor.author_id;
      }

      // Link book to author
      const { error: bookAuthorError } = await supabase
        .from("book_authors")
        .insert({ book_id: bookId, author_id: authorId });
      if (bookAuthorError) throw bookAuthorError;
    }

    // 3. Handle Genres
    for (const genreName of genres) {
      let genreId;
      // Try to find existing genre
      const { data: existingGenre, error: findGenreError } = await supabase
        .from("genres")
        .select("genre_id")
        .eq("name", genreName)
        .single();

      if (findGenreError && findGenreError.code !== "PGRST116") {
        throw findGenreError;
      }

      if (existingGenre) {
        genreId = existingGenre.genre_id;
      } else {
        // Create new genre if not found
        const { data: newGenre, error: insertGenreError } = await supabase
          .from("genres")
          .insert({ name: genreName })
          .select("genre_id")
          .single();
        if (insertGenreError) throw insertGenreError;
        genreId = newGenre.genre_id;
      }

      // Link book to genre
      const { error: bookGenreError } = await supabase
        .from("book_genres")
        .insert({ book_id: bookId, genre_id: genreId });
      if (bookGenreError) throw bookGenreError;
    }

    // 4. Handle Affiliate Links (if provided)
    if (affiliate_links && affiliate_links.length > 0) {
      const linksToInsert = affiliate_links.map((link) => ({
        book_id: bookId,
        provider: link.provider,
        url: link.url,
      }));
      const { error: affiliateLinkError } = await supabase
        .from("affiliate_links")
        .insert(linksToInsert);
      if (affiliateLinkError) throw affiliateLinkError;
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Book created successfully.",
        book: newBook,
      }),
    };
  } catch (error) {
    console.error("CreateBook Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message || "Failed to create book.",
      }),
    };
  }
};
