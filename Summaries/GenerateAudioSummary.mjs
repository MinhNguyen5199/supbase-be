import { createClient } from "@supabase/supabase-js";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { getUserTier } from "./GetAudioSummary.mjs";

/**

* Strips HTML tags from a string.

* @param {string} html The input string with HTML.

* @returns {string} The text content without HTML.

*/

function stripHtmlToString(html) {
    if (!html) return "";
  
    // Replace common block tags with a placeholder (e.g., `|||`)
    let text = html
      .replace(/<\/(h[1-6]|p|div|section|article)>/gi, "|||")
      .replace(/<[^>]*>/g, "") // Remove all other tags
      .replace(/\s+/g, " ")     // Collapse whitespace
      .trim();
  
    // Split into segments
    const segments = text.split("|||").map(s => s.trim()).filter(Boolean);
  
    // Add periods if missing
    const cleaned = segments.map((s, i) => {
      if (!/[.!?]$/.test(s)) {
        // Add a period to headings or segments that should end sentences
        return s + ".";
      }
      return s;
    });
  
    return cleaned.join(" ");
  }



  function extractWordsFromAlignment(alignment) {
    const words = [];
    let word = '';
    let wordStart = null;
    let wordEnd = null;
  
    const len = alignment.characters.length;
  
    for (let i = 0; i < len; i++) {
      const char = alignment.characters[i];
      const start = alignment.characterStartTimesSeconds[i];
      const end = alignment.characterEndTimesSeconds[i];
  
      if (start == null || end == null || typeof char !== 'string') continue;
  
      const isSpace = char.trim() === '';
      const isPunctuation = /^[.,!?;:'"()\[\]{}\-–]$/.test(char);
  
      if (!isSpace && !isPunctuation) {
        if (word === '') wordStart = start;
        word += char;
        wordEnd = end;
      } else if (word) {
        words.push({ word, start: wordStart, end: wordEnd });
        word = '';
        wordStart = null;
        wordEnd = null;
      }
    }
  
    if (word) {
      words.push({ word, start: wordStart, end: wordEnd });
    }
  
    return words;
  }
  

// --- MAIN HANDLER ---

export const handler = async (event) => {
  const user = event.requestContext?.authorizer;


  if (!user?.uid)
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Unauthorized" }),
    };

    const userTier = await getUserTier(user.uid);
    console.log('User Tier:', userTier);
    if (!userTier.includes('pro') && !userTier.includes('vip')) {
      console.log('Access denied: User is not Pro or VIP');
      return { statusCode: 403, body: JSON.stringify({ message: "Access restricted to Pro or VIP users only." }) };
    }
  const { summary_id } = event.pathParameters || {};

  if (!summary_id)
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing summary_id" }),
    };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  try {
    const { data: summary, error: fetchError } = await supabase

      .from("summaries")

      .select("text_content")

      .eq("summary_id", summary_id)

      .single();

    if (fetchError) throw fetchError;

    const originalText = stripHtmlToString(summary.text_content);

    // Add a guard for empty text to prevent API errors.

    if (!originalText) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Summary text is empty after stripping HTML.",
        }),
      };
    }
    console.log("Original Text:", originalText);

    const stream = await elevenlabs.textToSpeech.streamWithTimestamps(
      process.env.ELEVENLABS_VOICE_ID,

      {
        text: originalText,

        modelId: "eleven_flash_v2_5", // Using a common, reliable model

        outputFormat: "mp3_44100_128",
      }
    );

    const audioChunks = [];

    const wordTimestamps = [];
    for await (const chunk of stream) {
        // console.log(chunk);
        // console.log("123")
      if (chunk.audioBase64) {
        const buffer = Buffer.from(chunk.audioBase64, "base64");

        audioChunks.push(buffer);
      }
    
      const alignment = chunk.normalizedAlignment || chunk.alignment;

      if (alignment) {
        console.log(chunk);
        const words = extractWordsFromAlignment(alignment);
        wordTimestamps.push(...words);
      }
    }

    if (!audioChunks.length) throw new Error("No audio returned from API");
    if (!wordTimestamps.length) throw new Error("No word timestamps returned from API");
    const finalAudio = Buffer.concat(audioChunks);

    const audioPath = `audio-summaries/${summary_id}-${Date.now()}.mp3`;

    await supabase.storage.from("audio").upload(audioPath, finalAudio, {
      contentType: "audio/mpeg",

      upsert: false,
    });

    const { data: audioSummary, error: insertError } = await supabase

      .from("audio_summaries")

      .insert({
        summary_id,

        audio_file_url: audioPath,

        voice_type: process.env.ELEVENLABS_VOICE_ID,

        word_timestamps: wordTimestamps,

        cloned_from_user_id: user.uid,
      })

      .select()

      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 201,

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ message: "Audio generated", data: audioSummary }),
    };
  } catch (error) {
    console.error("An error occurred:", error);

    return {
      statusCode: 500,

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        message: error.message || "An unknown server error occurred",
      }),
    };
  }
};
