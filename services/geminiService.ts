

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { LyricsResult, GroundingSource, LyricsMetadata } from "../types";

// Lazy initialization of the API client to prevent immediate crashes if env is missing
let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches lyrics using the gemini-3-flash-preview model with Google Search grounding.
 */
export const fetchLyrics = async (query: string): Promise<LyricsResult> => {
  const maxRetries = 2; // Reduced retries for speed
  let attempt = 0;
  const ai = getAiClient();

  while (attempt < maxRetries) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash", 
        contents: `You are the world's most advanced music knowledge engine. Your goal is to provide 100% accurate, complete lyrics and rich metadata by searching the entire internet.
        
        **INPUT**: "${query}"

        **PHASE 0: DEEP INTERNET SEARCH & INTENT ANALYSIS**
        1.  **Search the entire internet** (Genius, Musixmatch, AZLyrics, Official Artist Sites, etc.) to identify the song.
        2.  **NO HALLUCINATION**: If you cannot find a definitive match for the input on the internet, do NOT guess. Return a message stating that the song could not be found.
        3.  **Snippet Matching**: If the input is a snippet (even from the middle of a song), find the exact song it belongs to.
        4.  **Identify**: Is it a specific song, a snippet, or a collection (album/movie)?
            -   *Song*: "Bohemian Rhapsody", "song by Adele".
            -   *Snippet*: "is this the real life is this just fantasy", "never gonna give you up".
            -   *Collection*: "Thriller Album", "Barbie Movie Songs".
        4.  **Normalize**: Correct typos or vague terms. If it's a snippet, identify the official Title and Artist.

        **PHASE 1: FULL LYRICS RETRIEVAL**
        -   **Retrieve**: Find the COMPLETE, UNABBREVIATED lyrics.
        -   **Verify**: Ensure NO lines are missing. Do NOT summarize. Repeat the full chorus every time it is sung.
        -   **Format**: Use standard stanza spacing. Use headers like [Verse 1], [Chorus], [Bridge].

        **PHASE 2: METADATA ENRICHMENT**
        -   **Title**: Official, properly capitalized song title.
        -   **Artist**: Main artist(s).
        -   **Image**: Find a valid URL for the **High-Res Official Album Art**.
        -   **YouTube ID**: The ID of the official music video or official audio.
        -   **Snippet**: If searched by snippet, include the matched text.

        **PHASE 3: COLLECTION HANDLING**
        -   If it's a Movie or Album, return a list of songs in \`relatedSongs\`.
        -   Set \`isCollection\` to true.

        **OUTPUT FORMAT (Strict JSON inside XML tags)**
        
        <metadata>
        {
          "title": "Song Title",
          "artist": "Artist Name",
          "image": "https://url.to/image.jpg",
          "youtubeId": "video_id",
          "isCollection": false,
          "collectionType": null, 
          "matchedSnippet": "string or null",
          "relatedSongs": ["Song A - Artist", "Song B - Artist"] 
        }
        </metadata>

        [Insert Full Lyrics Here OR Collection Description Here]
        `,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      let text = response.text || "No lyrics found.";
      let metadata: LyricsMetadata = {};

      // Extract Metadata from the specific XML-like tags
      const metadataMatch = text.match(/<metadata>([\s\S]*?)<\/metadata>/);
      if (metadataMatch) {
        try {
          // Clean up the string to remove markdown code blocks if the AI added them
          const jsonStr = metadataMatch[1]
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          
          metadata = JSON.parse(jsonStr);
          // Remove the metadata block from the visible lyrics text
          text = text.replace(metadataMatch[0], '').trim();
        } catch (e) {
          console.warn("Failed to parse metadata JSON", e);
        }
      }
      
      // Extract grounding sources if available
      const sources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({
              title: chunk.web.title || "Web Source",
              uri: chunk.web.uri,
            });
          }
        });
      }

      return { text, sources, metadata };

    } catch (error: any) {
      attempt++;
      console.warn(`Fetch lyrics attempt ${attempt} failed:`, error.message);
      
      if (attempt >= maxRetries) {
        console.error("All fetch attempts failed.");
        throw new Error("Failed to find lyrics due to a connection error. Please try again.");
      }
      
      // Exponential backoff: 0.5s, 1s
      await delay(500 * Math.pow(2, attempt - 1));
    }
  }

  throw new Error("Unexpected error occurred.");
};

/**
 * Fetches lyrics with chords using the gemini-3.1-pro-preview model.
 */
export const fetchLyricsWithChords = async (query: string): Promise<LyricsResult> => {
  const ai = getAiClient();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are a professional musician and transcriber. Your goal is to provide accurate lyrics with guitar chords for the song: "${query}".
      
      **PHASE 0: SEARCH & IDENTIFICATION**
      1. **Search the entire internet** to identify the song, especially if the input is a snippet.
      2. **NO HALLUCINATION**: If you cannot find a definitive match for the input on the internet, do NOT guess. Return a message stating that the song could not be found.
      3. Find the official Title and Artist.

      **PHASE 1: TRANSCRIPTION**
      1. Provide the FULL lyrics.
      2. Place the chords ABOVE the lyrics or INLINE using brackets like [C], [G], [Am], etc.
      3. Ensure the chords are musically accurate and placed exactly where they should be played.
      4. Include standard headers like [Verse 1], [Chorus], [Bridge].
      5. Provide metadata in the same JSON format as the standard fetch.

      **OUTPUT FORMAT (Strict JSON inside XML tags)**
      
      <metadata>
      {
        "title": "Song Title",
        "artist": "Artist Name",
        "image": "https://url.to/image.jpg",
        "youtubeId": "video_id",
        "isCollection": false,
        "collectionType": null, 
        "matchedSnippet": null,
        "relatedSongs": [] 
      }
      </metadata>

      [Insert Lyrics with Chords Here]
      `,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "No lyrics found.";
    let metadata: LyricsMetadata = {};

    const metadataMatch = text.match(/<metadata>([\s\S]*?)<\/metadata>/);
    if (metadataMatch) {
      try {
        const jsonStr = metadataMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
        metadata = JSON.parse(jsonStr);
        text = text.replace(metadataMatch[0], '').trim();
      } catch (e) {
        console.warn("Failed to parse metadata JSON", e);
      }
    }
    
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title || "Web Source", uri: chunk.web.uri });
        }
      });
    }

    return { text, sources, metadata };
  } catch (error: any) {
    console.error("Fetch chords failed", error);
    return fetchLyrics(query); // Fallback to standard lyrics
  }
};

/**
 * Fetches lyrics with timestamps for karaoke.
 */
export const fetchTimedLyrics = async (query: string): Promise<LyricsResult> => {
  const ai = getAiClient();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an elite Synchronized Lyrics (LRC) Architect. Your task is to generate a PERFECTLY TIMED karaoke file for the song: "${query}".

      **STEP 1: IDENTIFICATION**
      - Find the official YouTube video for this song. 
      - Note its EXACT duration.
      - **CRITICAL**: Distinguish between "Music Video" (often has long cinematic intros) and "Official Audio". Ensure the YouTube ID you provide MATCHES the timestamps.

      **STEP 2: RESEARCH DATA (MANDATORY)**
      - SEARCH for "[Song Name] [Artist] YouTube Transcript" to get per-second timings.
      - SEARCH for "[Song Name] [Artist] LRC line-timed lyrics" or "ID3 lyrics tags".
      - Identify if the video has a non-musical intro. Calculate the EXACT start of the vocals (e.g. "Vocals start at 0:24.5").

      **STEP 3: TRIPLE-CHECK ALIGNMENT**
      - Timestamps MUST be in absolute seconds (e.g. 15.429) relative to the START of the video (0.0).
      - If there is an intro of 10 seconds, the first lyric should NOT be at 0.0, but at 10.0+.
      - Ensure lyrics are complete. Do not skip segments.
      - Include "syncSource" in metadata (e.g. "YouTube Transcript", "LRC File", "Manual Calculation").

      **OUTPUT FORMAT (Strict JSON inside XML tags)**
      
      <metadata>
      {
        "title": "Song Title",
        "artist": "Artist Name",
        "image": "https://url.to/image.jpg",
        "youtubeId": "video_id",
        "syncConfidence": 0.99,
        "syncSource": "Transcript",
        "timedLyrics": [
           {"startTime": 12.456, "text": "First line of the song"},
           {"startTime": 15.123, "text": "Second line..."}
        ]
      }
      </metadata>

      [Insert Full Lyrics Here (without timestamps)]
      `,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are a precise audio-to-text alignment engine. You use external search data (Transcripts, LRC files) to provide millisecond-accurate timestamps for YouTube videos.",
      },
    });

    let text = response.text || "No lyrics found.";
    let metadata: any = {};
    let timedLyrics: any[] = [];

    const metadataMatch = text.match(/<metadata>([\s\S]*?)<\/metadata>/);
    if (metadataMatch) {
      try {
        const jsonStr = metadataMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
        metadata = JSON.parse(jsonStr);
        timedLyrics = metadata.timedLyrics || [];
        text = text.replace(metadataMatch[0], '').trim();
      } catch (e) {
        console.warn("Failed to parse metadata JSON", e);
      }
    }

    return { text, sources: [], metadata, timedLyrics };
  } catch (error: any) {
    console.error("Fetch timed lyrics failed", error);
    return fetchLyrics(query); // Fallback
  }
};

/**
 * Translates lyrics using gemini-flash-latest for stability.
 */
export const translateLyrics = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate the following song lyrics into ${targetLanguage}.
      
      CRITICAL RULES:
      1. Maintain the exact line-by-line structure and stanza breaks.
      2. Keep all headers like [Chorus], [Verse], etc., in English.
      3. Poetic translation, not just literal.
      4. No greetings or introductory text. Just the translated lyrics.

      Lyrics to translate:
      ${text}`,
    });

    const translatedText = response.text?.trim();
    if (!translatedText || translatedText === text) {
      throw new Error("Translation failed to change text");
    }
    return translatedText;
  } catch (error) {
    console.error("Translation failed", error);
    throw new Error(`Failed to translate lyrics into ${targetLanguage}.`);
  }
};

/**
 * Transliterates song lyrics into Tanglish (phonetic Latin script).
 */
export const transliterateToTanglish = async (text: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Transliterate the following song lyrics into Tanglish (phonetic Latin script).
      If the text is in Tamil, convert it to readable English script (Tanglish).
      If it is already in Latin script, return it as is.

      CRITICAL RULES:
      1. Maintain the exact line-by-line structure and stanza breaks.
      2. Do NOT translate the meaning. Only convert the script.
      3. Keep headers like [Chorus], [Verse], etc., in English.

      Lyrics to transliterate:
      ${text}`,
    });
    
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Transliteration failed", error);
    return text;
  }
};

