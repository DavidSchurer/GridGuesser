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

    // Extract the simple name from the search term
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

