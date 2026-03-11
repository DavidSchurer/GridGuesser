/**
 * Google Custom Search API Integration for Image Fetching
 * 
 * Setup Instructions:
 * 1. Go to https://console.developers.google.com
 * 2. Create a new project or select existing
 * 3. Enable "Custom Search API"
 * 4. Create credentials (API Key)
 * 5. Go to https://programmablesearchengine.google.com/
 * 6. Create a new search engine
 * 7. Enable "Image Search" and "Search the entire web"
 * 8. Get your Search Engine ID (cx)
 * 9. Add to .env.local:
 *    GOOGLE_API_KEY=your_api_key
 *    GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
 *    GEMINI_API_KEY=your_gemini_key  (get free at https://aistudio.google.com/apikey)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

interface GoogleImageResult {
  title: string;
  link: string;
  displayLink: string;
  mime: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

interface GoogleSearchResponse {
  items?: GoogleImageResult[];
  error?: {
    code: number;
    message: string;
  };
}

export interface FetchedImage {
  url: string;
  thumbnailUrl: string;
  title: string;
  searchTerm: string;
  category: string;
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

// Predefined categories with search terms
export const CATEGORIES = {
  landmarks: {
    name: "Famous Landmarks",
    searchTerms: [
      "Eiffel Tower Paris",
      "Statue of Liberty New York",
      "Big Ben London",
      "Colosseum Rome",
      "Taj Mahal India",
      "Great Wall of China",
      "Sydney Opera House",
      "Golden Gate Bridge",
      "Burj Khalifa Dubai",
      "Machu Picchu Peru",
      "Christ the Redeemer Brazil",
      "Petra Jordan",
      "Angkor Wat Cambodia",
      "Sagrada Familia Barcelona",
      "Leaning Tower of Pisa",
    ],
  },
  animals: {
    name: "Animals",
    searchTerms: [
      "lion wildlife",
      "elephant savanna",
      "giraffe africa",
      "panda bear",
      "tiger wildlife",
      "penguin antarctic",
      "dolphin ocean",
      "eagle bird",
      "kangaroo australia",
      "zebra wildlife",
      "polar bear arctic",
      "gorilla jungle",
      "cheetah running",
      "koala eucalyptus",
      "flamingo pink",
    ],
  },
  food: {
    name: "Food & Dishes",
    searchTerms: [
      "pizza margherita",
      "sushi platter",
      "hamburger gourmet",
      "pasta carbonara",
      "tacos mexican",
      "ramen bowl",
      "croissant french",
      "paella spanish",
      "dim sum chinese",
      "falafel middle eastern",
      "curry indian",
      "pho vietnamese",
      "burrito mexican",
      "pad thai",
      "fish and chips",
    ],
  },
  nature: {
    name: "Nature & Landscapes",
    searchTerms: [
      "mountain landscape",
      "waterfall forest",
      "beach sunset",
      "desert dunes",
      "forest trees",
      "canyon grand",
      "aurora borealis",
      "volcano eruption",
      "rainbow nature",
      "ocean waves",
      "lake reflection",
      "glacier ice",
      "savanna grassland",
      "coral reef underwater",
      "cave stalactites",
    ],
  },
  vehicles: {
    name: "Vehicles",
    searchTerms: [
      "sports car ferrari",
      "airplane boeing",
      "train bullet",
      "motorcycle harley",
      "sailboat yacht",
      "helicopter rescue",
      "submarine underwater",
      "hot air balloon",
      "space shuttle",
      "cruise ship",
      "tractor farm",
      "fire truck emergency",
      "excavator construction",
      "ambulance emergency",
      "police car",
    ],
  },
  sports: {
    name: "Sports & Activities",
    searchTerms: [
      "soccer football match",
      "basketball game",
      "tennis court",
      "baseball stadium",
      "golf course",
      "swimming pool",
      "skiing snow",
      "surfing wave",
      "cycling race",
      "boxing ring",
      "gymnastics",
      "ice hockey",
      "volleyball beach",
      "skateboarding",
      "rock climbing",
    ],
  },
  technology: {
    name: "Technology",
    searchTerms: [
      "smartphone modern",
      "laptop computer",
      "robot artificial intelligence",
      "drone flying",
      "virtual reality headset",
      "smartwatch wearable",
      "3d printer",
      "solar panels",
      "electric car tesla",
      "tablet device",
      "headphones wireless",
      "camera professional",
      "gaming console",
      "smart speaker",
      "satellite space",
    ],
  },
  music: {
    name: "Music & Instruments",
    searchTerms: [
      "grand piano",
      "electric guitar",
      "drum set",
      "violin orchestra",
      "saxophone jazz",
      "trumpet brass",
      "acoustic guitar",
      "cello classical",
      "harp strings",
      "flute woodwind",
      "accordion folk",
      "banjo bluegrass",
      "ukulele hawaiian",
      "harmonica blues",
      "xylophone percussion",
    ],
  },
};

export type CategoryKey = keyof typeof CATEGORIES;

/**
 * Check if Google API is configured
 */
export function isGoogleApiConfigured(): boolean {
  return !!(GOOGLE_API_KEY && GOOGLE_SEARCH_ENGINE_ID);
}

/**
 * Fetch a random image from Google Images based on category
 */
export async function fetchRandomImageByCategory(
  category: CategoryKey
): Promise<FetchedImage | null> {
  if (!isGoogleApiConfigured()) {
    console.error("Google API not configured");
    return null;
  }

  try {
    const categoryData = CATEGORIES[category];
    const randomTerm =
      categoryData.searchTerms[
        Math.floor(Math.random() * categoryData.searchTerms.length)
      ];

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.append("key", GOOGLE_API_KEY!);
    url.searchParams.append("cx", GOOGLE_SEARCH_ENGINE_ID!);
    url.searchParams.append("q", randomTerm);
    url.searchParams.append("searchType", "image");
    url.searchParams.append("num", "10"); // Get 10 results to choose from
    url.searchParams.append("safe", "active"); // Safe search
    url.searchParams.append("imgSize", "large");

    const response = await fetch(url.toString());
    const data: GoogleSearchResponse = await response.json();

    if (data.error) {
      console.error("Google API error:", data.error);
      return null;
    }

    if (!data.items || data.items.length === 0) {
      console.error("No images found for:", randomTerm);
      return null;
    }

    // Pick a random image from the results
    const randomImage = data.items[Math.floor(Math.random() * data.items.length)];

    // For predefined categories, search terms are crafted so first word is the answer
    // Example: "Eiffel Tower Paris" -> "eiffel", "lion wildlife" -> "lion"
    const simpleName = randomTerm.split(" ")[0].toLowerCase();

    return {
      url: randomImage.link,
      thumbnailUrl: randomImage.image.thumbnailLink,
      title: simpleName,
      searchTerm: randomTerm,
      category,
    };
  } catch (error) {
    console.error("Error fetching image from Google:", error);
    return null;
  }
}

/**
 * Fetch two different random images from the same category
 */
export async function fetchTwoImagesForGame(
  category: CategoryKey
): Promise<[FetchedImage | null, FetchedImage | null]> {
  const [image1, image2] = await Promise.all([
    fetchRandomImageByCategory(category),
    fetchRandomImageByCategory(category),
  ]);

  return [image1, image2];
}

/**
 * Fetch N different random images from the same category (for Grid Royale)
 */
export async function fetchImagesForRoyaleGame(
  category: CategoryKey,
  count: 3 | 4
): Promise<(FetchedImage | null)[]> {
  const promises = Array.from({ length: count }, () =>
    fetchRandomImageByCategory(category)
  );
  return Promise.all(promises);
}

/**
 * Fetch N images for a custom-category royale game
 */
export async function fetchCustomImagesForRoyaleGame(
  customQuery: string,
  count: 3 | 4
): Promise<(FetchedImage | null)[]> {
  const category = customQuery.trim();
  if (!category) return Array(count).fill(null);

  const termPool = await generateTermsWithLLM(category);

  if (termPool.length < count) {
    console.warn(`⚠️  LLM could not generate enough terms for "${category}", using category directly`);
    const promises = Array.from({ length: count }, () =>
      fetchImageForTerm(category, category)
    );
    return Promise.all(promises);
  }

  const shuffled = [...termPool].sort(() => Math.random() - 0.5);
  const selectedTerms = shuffled.slice(0, count);

  console.log(`🎯 Selected ${count} terms for royale "${category}": ${selectedTerms.join(', ')}`);

  return Promise.all(
    selectedTerms.map(term => fetchImageForTerm(term, category))
  );
}

// ─── Custom Category System (LLM-powered via Google Gemini) ─────────────
// Uses Google Gemini (free tier) to generate relevant, specific subtopics
// for any category. Results are cached in memory so repeated requests for
// the same category don't re-call the LLM.
// ────────────────────────────────────────────────────────────────────────

const termsCache = new Map<string, string[]>();

/**
 * Get the Gemini API key. Checks GEMINI_API_KEY first, then falls back
 * to GOOGLE_API_KEY (works if Generative Language API is enabled).
 * Read lazily so dotenv has time to load.
 */
function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

const TERM_GENERATION_PROMPT =
  "You generate word lists for an image guessing game. " +
  "Given a topic, return a JSON array of 25 specific subtopics that:\n" +
  "- Are 1-3 words each\n" +
  "- Are concrete, well-known items/things closely associated with the topic\n" +
  "- Would produce recognizable results in a Google Image search\n" +
  "- Are distinct from each other (no synonyms or near-duplicates)\n" +
  "- Do NOT include generic words, verbs, or adjectives\n" +
  "- Do NOT repeat the topic name itself\n" +
  "Return ONLY a raw JSON array of strings, no markdown, no explanation.";

/**
 * Use Google Gemini to generate specific, image-searchable subtopics for a category.
 */
async function generateTermsWithLLM(category: string): Promise<string[]> {
  const cacheKey = category.toLowerCase().trim();

  if (termsCache.has(cacheKey)) {
    console.log(`💾 Using cached LLM terms for "${category}"`);
    return termsCache.get(cacheKey)!;
  }

  const apiKey = getGeminiKey();
  if (!apiKey) {
    console.error(
      "❌ No Gemini API key found.\n" +
      "   Set GEMINI_API_KEY in .env.local (free at https://aistudio.google.com/apikey)"
    );
    return [];
  }

  console.log(`🤖 Generating terms for "${category}" via Gemini...`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(
      `${TERM_GENERATION_PROMPT}\n\nTopic: "${category}"`
    );
    const raw = result.response.text().trim();

    console.log(`📝 Gemini raw response for "${category}":`, raw.slice(0, 300));

    let terms: string[];
    try {
      const stripped = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      terms = JSON.parse(stripped);
    } catch {
      console.error(`❌ Failed to parse Gemini response as JSON for "${category}":`, raw);
      return [];
    }

    if (!Array.isArray(terms) || terms.length === 0) {
      console.error(`❌ Gemini returned empty or non-array result for "${category}"`);
      return [];
    }

    const cleaned = terms
      .map((t: unknown) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter((t: string) => t.length >= 2 && t.length <= 40);

    console.log(`✅ Gemini generated ${cleaned.length} terms for "${category}":`, cleaned);

    termsCache.set(cacheKey, cleaned);
    return cleaned;
  } catch (error: any) {
    console.error(`❌ Gemini API call failed for "${category}":`, error?.message || error);
    return [];
  }
}

// ─── Image Fetch ────────────────────────────────────────────────────────

/**
 * Fetch a single image for a known specific term.
 * The answer is the term itself – clean and predictable.
 */
async function fetchImageForTerm(
  term: string,
  category: string,
): Promise<FetchedImage | null> {
  if (!isGoogleApiConfigured()) return null;

  try {
    const searchQuery = `${term} ${category}`;

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.append("key", GOOGLE_API_KEY!);
    url.searchParams.append("cx", GOOGLE_SEARCH_ENGINE_ID!);
    url.searchParams.append("q", searchQuery);
    url.searchParams.append("searchType", "image");
    url.searchParams.append("num", "8");
    url.searchParams.append("safe", "active");
    url.searchParams.append("imgSize", "large");

    console.log(`🖼️  Image search: "${searchQuery}"`);
    const response = await fetch(url.toString());
    const data: GoogleSearchResponse = await response.json();

    if (data.error) {
      console.error("Google API image error:", data.error);
      return null;
    }

    if (!data.items || data.items.length === 0) {
      console.error("No images found for term:", searchQuery);
      return null;
    }

    const randomImage = data.items[Math.floor(Math.random() * data.items.length)];
    const answer = term.toLowerCase();

    console.log(`✅ Custom image: "${term}" → answer: "${answer}"`);

    return {
      url: randomImage.link,
      thumbnailUrl: randomImage.image.thumbnailLink,
      title: answer,
      searchTerm: term,
      category: 'custom',
    };
  } catch (error) {
    console.error(`Error fetching image for term "${term}":`, error);
    return null;
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────────

/**
 * Fetch two images for a custom-category game.
 *
 * 1. Ask the LLM to generate relevant subtopics for the category
 * 2. Pick 2 distinct terms, image-search each
 * 3. Fallback: use the category name directly if LLM fails
 */
export async function fetchTwoImagesForCustomGame(
  customQuery: string
): Promise<[FetchedImage | null, FetchedImage | null]> {
  const category = customQuery.trim();
  if (!category) return [null, null];

  // ── Step 1: Generate terms via LLM ──
  const termPool = await generateTermsWithLLM(category);

  if (termPool.length < 2) {
    console.warn(`⚠️  LLM could not generate enough terms for "${category}", using category directly`);
    const [img1, img2] = await Promise.all([
      fetchImageForTerm(category, category),
      fetchImageForTerm(category, category),
    ]);
    return [img1, img2];
  }

  // ── Step 2: Pick 2 distinct random terms ──
  const shuffled = [...termPool].sort(() => Math.random() - 0.5);
  const term1 = shuffled[0];
  let term2 = shuffled[1];

  for (let i = 2; i < shuffled.length; i++) {
    const words1 = new Set(term1.split(' '));
    const words2 = new Set(term2.split(' '));
    const overlap = Array.from(words2).filter(w => words1.has(w)).length;
    if (overlap === 0) break;
    term2 = shuffled[i];
  }

  console.log(`🎯 Selected terms for "${category}": "${term1}" and "${term2}"`);

  // ── Step 3: Image search for each term ──
  const [image1, image2] = await Promise.all([
    fetchImageForTerm(term1, category),
    fetchImageForTerm(term2, category),
  ]);

  return [image1, image2];
}

/**
 * Fallback: Get a default image if Google API fails
 */
export function getDefaultImageByCategory(
  category: CategoryKey
): FetchedImage {
  const categoryData = CATEGORIES[category];
  const randomTerm =
    categoryData.searchTerms[
      Math.floor(Math.random() * categoryData.searchTerms.length)
    ];
  const simpleName = randomTerm.split(" ")[0].toLowerCase();

  // Return a placeholder/default image
  return {
    url: `/images/placeholder-${category}.jpg`,
    thumbnailUrl: `/images/placeholder-${category}.jpg`,
    title: simpleName,
    searchTerm: randomTerm,
    category,
  };
}

