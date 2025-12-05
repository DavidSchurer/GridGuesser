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
 * 9. Add both to .env.local:
 *    GOOGLE_API_KEY=your_api_key
 *    GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
 */

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
 * Check if a word is a nominal modifier (e.g., "computer" in "computer science")
 */
function isNominalModifier(word: string, sentence: string): boolean {
  const nlp = require('compromise');
  const w = word.toLowerCase();
  const CLAUSE_SPLIT = /[|,/\\\-:;]+/;

  // Break into clauses
  const clauses = sentence.split(CLAUSE_SPLIT).map(c => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    const doc = nlp(clause).normalize();
    const terms = doc.json()[0]?.terms ?? [];

    for (let i = 0; i < terms.length; i++) {
      const t1 = terms[i];
      
      if(!t1) continue;

      const text1 = t1.normal.toLowerCase();

      // Singularize plurals
      const lemma1 = nlp(text1).tag('Noun').nouns().toSingular().text();
      const lemmaTarget = nlp(w).tag('Noun').nouns().toSingular().text();
      if (lemma1 === lemmaTarget && lemma1.length > 0) {
        
        if(i >= terms.length - 1){
            return false;
        }
        
        const t2 = terms[i + 1];
        if (t2.tags?.includes("Noun")) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Fetch images from Google based on a custom search query
 * Uses NLP (compromise) with nominal modifier detection
 */
export async function fetchImagesByCustomQuery(
  customQuery: string
): Promise<FetchedImage | null> {
  if (!isGoogleApiConfigured()) {
    console.error("Google API not configured");
    return null;
  }

  if (!customQuery || customQuery.trim().length === 0) {
    console.error("Custom query is empty");
    return null;
  }

  try {
    const nlp = require('compromise');
    const category = customQuery.trim();
    
    // Use compromise NLP to analyze the category
    const doc = nlp(category);
    const nouns = doc.nouns().out('array');
    
    // Identify head nouns (not modifiers) for search
    const headNouns: string[] = [];
    const modifiers: string[] = [];
    
    for (const noun of nouns) {
      if (isNominalModifier(noun, category)) {
        modifiers.push(noun);
      } else {
        headNouns.push(noun);
      }
    }
    
    console.log(`Category analysis: "${category}"`);
    console.log(`  Modifiers: [${modifiers.join(', ')}]`);
    console.log(`  Head nouns: [${headNouns.join(', ')}]`);
    
    // Build comprehensive list of ALL category-related terms to avoid in searches
    const allCategoryTerms = new Set<string>();
    
    // Add all nouns and their variations
    for (const noun of [...modifiers, ...headNouns]) {
      const nounLower = noun.toLowerCase();
      allCategoryTerms.add(nounLower);
      
      // Add singular/plural variations
      const singular = nlp(nounLower).tag('Noun').nouns().toSingular().text();
      const plural = nlp(nounLower).tag('Noun').nouns().toPlural().text();
      if (singular) allCategoryTerms.add(singular.toLowerCase());
      if (plural) allCategoryTerms.add(plural.toLowerCase());
    }
    
    // Add all words from the category phrase
    category.toLowerCase().split(/\s+/).forEach(w => allCategoryTerms.add(w));
    
    const termsToAvoidArray = Array.from(allCategoryTerms);
    console.log(`  Terms to avoid: [${termsToAvoidArray.join(', ')}]`);
    
    // Generate search queries that find SPECIFIC EXAMPLES, not the category itself
    // Strategy: Search for items/concepts that EXIST WITHIN the category domain
    const searchVariations: string[] = [];
    
    // Use only head nouns for context, but search for specific items
    const contextTerm = headNouns.length > 0 ? headNouns[0] : category;
    const contextPlural = nlp(contextTerm).nouns().toPlural().text() || contextTerm;
    const contextSingular = nlp(contextTerm).nouns().toSingular().text() || contextTerm;
    
    // These search patterns find SPECIFIC THINGS in the domain, not the domain itself
    searchVariations.push(
      // List-based searches (gets specific examples)
      `list of ${contextPlural}`,
      `${contextPlural} names`,
      `${contextSingular} name examples`,
      
      // Brand/type searches (gets specific instances)
      `${contextPlural} brands`,
      `${contextPlural} types list`,
      
      // Popular/famous searches (gets well-known specific items)
      `popular ${contextSingular} name`,
      `famous ${contextPlural} names`,
      `well known ${contextPlural}`,
      
      // Example-based searches (explicitly asks for instances)
      `specific ${contextPlural}`,
      `individual ${contextSingular}`,
      `${contextSingular} examples with names`
    );
    
    // Pick a random search variation to get diverse results
    const searchQuery = searchVariations[Math.floor(Math.random() * searchVariations.length)];
    
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.append("key", GOOGLE_API_KEY!);
    url.searchParams.append("cx", GOOGLE_SEARCH_ENGINE_ID!);
    url.searchParams.append("q", searchQuery);
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
      console.error("No images found for custom query:", searchQuery);
      return null;
    }

    // Pick a random image from the results
    const randomImage = data.items[Math.floor(Math.random() * data.items.length)];

    // Extract title from the image itself using NLP
    let imageTitle = randomImage.title || "";
    
    // Remove common noise words and clean up the title
    imageTitle = imageTitle
      .replace(/\s*[-–—|:]\s*/g, ' ') // Remove separators
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .trim();
    
    console.log(`  Raw image title: "${imageTitle}"`);
    
    // Use compromise to extract the most relevant noun from the title
    const titleDoc = nlp(imageTitle);
    const titleNouns = titleDoc.nouns().out('array');
    const titleTopics = titleDoc.topics().out('array');
    const titleProperNouns = titleDoc.people().out('array').concat(titleDoc.places().out('array'));
    
    console.log(`  Extracted nouns: [${titleNouns.join(', ')}]`);
    console.log(`  Extracted topics: [${titleTopics.join(', ')}]`);
    console.log(`  Extracted proper nouns: [${titleProperNouns.join(', ')}]`);
    
    // Build comprehensive skip list - NOTHING from the category should be the answer
    const baseSkipWords = [
      'types', 'examples', 'different', 'various', 'popular', 'famous', 
      'best', 'top', 'common', 'varieties', 'brands', 'notable', 'list',
      'names', 'name', 'specific', 'individual', 'well', 'known',
      'image', 'photo', 'picture', 'illustration', 'vector', 'icon', 'logo'
    ];
    
    // Combine all category terms we computed earlier
    const skipWordsWithVariations = new Set<string>(baseSkipWords);
    
    // Add ALL category terms and their variations
    for (const term of Array.from(allCategoryTerms)) {
      skipWordsWithVariations.add(term);
    }
    
    // Function to check if a word is too similar to any category term
    const isTooSimilarToCategory = (word: string): boolean => {
      const wordLower = word.toLowerCase();
      const wordSingular = nlp(wordLower).tag('Noun').nouns().toSingular().text();
      const wordPlural = nlp(wordLower).tag('Noun').nouns().toPlural().text();
      
      // Check exact matches
      if (skipWordsWithVariations.has(wordLower)) return true;
      if (wordSingular && skipWordsWithVariations.has(wordSingular.toLowerCase())) return true;
      if (wordPlural && skipWordsWithVariations.has(wordPlural.toLowerCase())) return true;
      
      // Check if word contains any category term or vice versa
      for (const categoryTerm of Array.from(allCategoryTerms)) {
        if (wordLower.includes(categoryTerm) || categoryTerm.includes(wordLower)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Find the first relevant noun that is COMPLETELY DIFFERENT from the category
    let simpleName = 'unknown';
    
    // PRIORITY 1: Try proper nouns first (brand names, specific names)
    // These are almost always specific examples, not categories
    for (const properNoun of titleProperNouns) {
      if (properNoun.length > 2 && !isTooSimilarToCategory(properNoun)) {
        simpleName = properNoun.toLowerCase().split(/\s+/)[0];
        console.log(`  ✓ Found proper noun answer: "${simpleName}"`);
        break;
      }
    }
    
    // PRIORITY 2: Try topics (specific subjects)
    if (simpleName === 'unknown') {
      for (const topic of titleTopics) {
        const topicWords = topic.split(/\s+/);
        for (const word of topicWords) {
          if (word.length > 2 && !isTooSimilarToCategory(word)) {
            simpleName = word.toLowerCase();
            console.log(`  ✓ Found topic answer: "${simpleName}"`);
            break;
          }
        }
        if (simpleName !== 'unknown') break;
      }
    }
    
    // PRIORITY 3: Try regular nouns
    if (simpleName === 'unknown') {
      for (const noun of titleNouns) {
        if (noun.length > 2 && !isTooSimilarToCategory(noun)) {
          simpleName = noun.toLowerCase();
          console.log(`  ✓ Found noun answer: "${simpleName}"`);
          break;
        }
      }
    }
    
    // PRIORITY 4: Fallback to any word that's not similar to category
    if (simpleName === 'unknown') {
      const words = imageTitle.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && !isTooSimilarToCategory(word)) {
          simpleName = word;
          console.log(`  ✓ Found fallback answer: "${simpleName}"`);
          break;
        }
      }
    }

    console.log(`✓ Custom category "${category}" → searched "${searchQuery}" → ANSWER: "${simpleName}"`);

    return {
      url: randomImage.link,
      thumbnailUrl: randomImage.image.thumbnailLink,
      title: simpleName,
      searchTerm: category, // Store the original category for reference
      category: 'custom',
    };
  } catch (error) {
    console.error("Error fetching image from Google with custom query:", error);
    return null;
  }
}

/**
 * Fetch two images for a game using a custom category/query
 */
export async function fetchTwoImagesForCustomGame(
  customQuery: string
): Promise<[FetchedImage | null, FetchedImage | null]> {
  // Fetch two different images with the same custom query
  const [image1, image2] = await Promise.all([
    fetchImagesByCustomQuery(customQuery),
    fetchImagesByCustomQuery(customQuery),
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

