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

// ─── Custom Category System ─────────────────────────────────────────────
// Strategy:
//   1. Check CURATED_TERMS for a known category → instant, high quality
//   2. Fallback: Google *web* search + strict NLP extraction
//   3. Pick 2 distinct terms, image-search each; answer = the term itself
// ────────────────────────────────────────────────────────────────────────

/**
 * Curated term banks for popular custom categories.
 * Each term should be 1-2 words, well-known, and easy to depict as an image.
 * Keys are lowercase – we match against the user's query with fuzzy lookup.
 */
const CURATED_TERMS: Record<string, string[]> = {
  'computer science': [
    'algorithm', 'binary tree', 'linked list', 'hashmap', 'recursion',
    'sorting', 'stack', 'queue', 'database', 'encryption',
    'firewall', 'compiler', 'server', 'API', 'blockchain',
    'neural network', 'cloud computing', 'CPU', 'RAM', 'debugging',
    'boolean', 'pixel', 'bandwidth', 'cache', 'router',
    'kernel', 'terminal', 'binary', 'malware', 'proxy',
  ],
  'programming': [
    'python', 'javascript', 'function', 'variable', 'loop',
    'array', 'class', 'debugging', 'compiler', 'git',
    'terminal', 'API', 'database', 'HTML', 'CSS',
    'recursion', 'framework', 'stack overflow', 'binary', 'algorithm',
  ],
  'math': [
    'pi', 'fraction', 'triangle', 'circle', 'graph',
    'algebra', 'geometry', 'calculus', 'probability', 'matrix',
    'equation', 'exponent', 'polygon', 'parabola', 'sine wave',
    'abacus', 'protractor', 'compass', 'ruler', 'cube',
  ],
  'mathematics': [
    'pi', 'fraction', 'triangle', 'circle', 'graph',
    'algebra', 'geometry', 'calculus', 'probability', 'matrix',
    'equation', 'exponent', 'polygon', 'parabola', 'sine wave',
    'abacus', 'protractor', 'compass', 'ruler', 'cube',
  ],
  'physics': [
    'gravity', 'magnet', 'pendulum', 'prism', 'laser',
    'atom', 'electron', 'neutron', 'wave', 'friction',
    'lever', 'pulley', 'tesla coil', 'black hole', 'supernova',
    'lens', 'circuit', 'solenoid', 'turbine', 'satellite',
  ],
  'chemistry': [
    'atom', 'molecule', 'beaker', 'flask', 'periodic table',
    'crystal', 'acid', 'catalyst', 'enzyme', 'polymer',
    'oxygen', 'hydrogen', 'carbon', 'nitrogen', 'helium',
    'litmus', 'burner', 'pipette', 'titration', 'distillation',
  ],
  'biology': [
    'cell', 'DNA', 'mitosis', 'bacteria', 'virus',
    'photosynthesis', 'skeleton', 'brain', 'heart', 'lungs',
    'microscope', 'chromosome', 'amoeba', 'fungus', 'pollen',
    'ecosystem', 'fossil', 'embryo', 'antibody', 'neuron',
  ],
  'space': [
    'mars', 'saturn', 'jupiter', 'nebula', 'asteroid',
    'comet', 'black hole', 'galaxy', 'telescope', 'astronaut',
    'moon', 'eclipse', 'supernova', 'rocket', 'satellite',
    'space station', 'meteor', 'constellation', 'sun', 'mercury',
  ],
  'astronomy': [
    'mars', 'saturn', 'jupiter', 'nebula', 'asteroid',
    'comet', 'black hole', 'galaxy', 'telescope', 'astronaut',
    'moon', 'eclipse', 'supernova', 'rocket', 'satellite',
    'space station', 'meteor', 'constellation', 'sun', 'mercury',
  ],
  'history': [
    'pyramid', 'colosseum', 'gladiator', 'viking', 'samurai',
    'knight', 'castle', 'cannon', 'chariot', 'catapult',
    'sphinx', 'pharaoh', 'toga', 'shield', 'crown',
    'throne', 'scroll', 'armor', 'compass', 'telescope',
  ],
  'geography': [
    'volcano', 'glacier', 'desert', 'island', 'canyon',
    'waterfall', 'mountain', 'river', 'ocean', 'peninsula',
    'rainforest', 'tundra', 'savanna', 'coral reef', 'delta',
    'plateau', 'geyser', 'fjord', 'archipelago', 'oasis',
  ],
  'art': [
    'mona lisa', 'sculpture', 'palette', 'easel', 'canvas',
    'watercolor', 'mosaic', 'pottery', 'origami', 'graffiti',
    'fresco', 'portrait', 'sketch', 'charcoal', 'abstract',
    'oil painting', 'clay', 'mural', 'stencil', 'calligraphy',
  ],
  'movies': [
    'popcorn', 'projector', 'clapperboard', 'red carpet', 'oscar',
    'director', 'screenplay', 'stuntman', 'microphone', 'spotlight',
    'camera', 'film reel', 'theater', 'premiere', 'trailer',
    'green screen', 'costume', 'makeup', 'storyboard', 'soundtrack',
  ],
  'music': [
    'guitar', 'piano', 'drums', 'violin', 'trumpet',
    'saxophone', 'microphone', 'headphones', 'turntable', 'speaker',
    'harp', 'flute', 'cello', 'accordion', 'banjo',
    'metronome', 'tuning fork', 'amplifier', 'synthesizer', 'baton',
  ],
  'cooking': [
    'sushi', 'pizza', 'pasta', 'wok', 'grill',
    'whisk', 'spatula', 'blender', 'oven', 'rolling pin',
    'cutting board', 'ladle', 'colander', 'skillet', 'mortar',
    'tongs', 'apron', 'cupcake', 'sourdough', 'fondue',
  ],
  'medicine': [
    'stethoscope', 'syringe', 'X-ray', 'bandage', 'thermometer',
    'scalpel', 'ambulance', 'wheelchair', 'crutch', 'microscope',
    'pill', 'vaccine', 'surgery', 'defibrillator', 'IV drip',
    'blood pressure', 'cast', 'inhaler', 'prosthetic', 'stretcher',
  ],
  'sports': [
    'basketball', 'football', 'tennis', 'baseball', 'golf',
    'swimming', 'boxing', 'archery', 'hockey', 'surfing',
    'skateboard', 'volleyball', 'badminton', 'fencing', 'javelin',
    'trampoline', 'karate', 'wrestling', 'lacrosse', 'hurdles',
  ],
  'animals': [
    'elephant', 'giraffe', 'penguin', 'dolphin', 'eagle',
    'octopus', 'chameleon', 'flamingo', 'panda', 'koala',
    'cheetah', 'gorilla', 'seahorse', 'jellyfish', 'peacock',
    'armadillo', 'platypus', 'toucan', 'porcupine', 'sloth',
  ],
  'dinosaurs': [
    'triceratops', 'stegosaurus', 'velociraptor', 'pterodactyl', 'brontosaurus',
    'tyrannosaurus', 'fossil', 'ankylosaurus', 'diplodocus', 'spinosaurus',
    'parasaurolophus', 'raptor', 'megalodon', 'mammoth', 'sabertooth',
  ],
  'video games': [
    'mario', 'zelda', 'minecraft', 'tetris', 'pac-man',
    'controller', 'joystick', 'pixel art', 'health bar', 'boss fight',
    'power-up', 'checkpoint', 'leaderboard', 'VR headset', 'arcade',
  ],
  'fashion': [
    'dress', 'sneakers', 'sunglasses', 'handbag', 'bowtie',
    'scarf', 'boots', 'necklace', 'bracelet', 'watch',
    'hat', 'jacket', 'earrings', 'belt', 'ring',
    'tiara', 'vest', 'gloves', 'heels', 'tuxedo',
  ],
  'architecture': [
    'skyscraper', 'dome', 'arch', 'column', 'bridge',
    'lighthouse', 'pagoda', 'cathedral', 'pyramid', 'minaret',
    'staircase', 'balcony', 'tower', 'fortress', 'aqueduct',
    'windmill', 'igloo', 'treehouse', 'gazebo', 'amphitheater',
  ],
  'mythology': [
    'dragon', 'phoenix', 'unicorn', 'minotaur', 'medusa',
    'pegasus', 'kraken', 'cyclops', 'centaur', 'griffin',
    'trident', 'hydra', 'cerberus', 'thunderbolt', 'labyrinth',
    'sphinx', 'mermaid', 'werewolf', 'golem', 'chimera',
  ],
  'ocean': [
    'whale', 'shark', 'coral', 'jellyfish', 'octopus',
    'seahorse', 'starfish', 'stingray', 'lobster', 'dolphin',
    'submarine', 'anchor', 'lighthouse', 'iceberg', 'trident',
    'seashell', 'shipwreck', 'scuba', 'surfboard', 'pearl',
  ],
  'weather': [
    'tornado', 'lightning', 'rainbow', 'blizzard', 'hurricane',
    'cloud', 'hail', 'frost', 'fog', 'tsunami',
    'avalanche', 'drought', 'thermometer', 'barometer', 'umbrella',
    'snowflake', 'sunbeam', 'monsoon', 'dew', 'windmill',
  ],
};

/**
 * Try to match user's custom query to a curated term list.
 * Checks exact match, then checks if category contains or is contained by a key.
 */
function findCuratedTerms(category: string): string[] | null {
  const lower = category.toLowerCase().trim();

  // Exact match
  if (CURATED_TERMS[lower]) return CURATED_TERMS[lower];

  // Containment: "computer science topics" → matches "computer science"
  for (const key of Object.keys(CURATED_TERMS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return CURATED_TERMS[key];
    }
  }

  return null;
}

// ─── Web-Search Fallback (for categories not in curated list) ──────────

interface GoogleWebSearchResponse {
  items?: { title: string; snippet: string; link: string }[];
  error?: { code: number; message: string };
}

/** Massive stopword set – anything that is NOT a real guessable topic */
const STOPWORDS = new Set([
  // Generic
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'its', 'it', 'they', 'them',
  'their', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
  'how', 'when', 'where', 'why', 'not', 'no', 'yes', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than',
  'too', 'very', 'just', 'also', 'about', 'up', 'out', 'so', 'if',
  // Web / snippet noise
  'types', 'type', 'examples', 'example', 'list', 'different', 'various',
  'popular', 'famous', 'best', 'top', 'common', 'overview', 'guide',
  'definition', 'meaning', 'introduction', 'basics', 'names', 'name',
  'important', 'key', 'main', 'major', 'include', 'including',
  'known', 'well', 'image', 'photo', 'picture', 'illustration', 'vector',
  'icon', 'logo', 'wikipedia', 'article', 'page', 'site', 'web', 'click',
  'read', 'learn', 'see', 'view', 'here', 'today', 'new', 'first',
  'last', 'next', 'many', 'much', 'used', 'use', 'using', 'one', 'two',
  'three', 'four', 'five', 'like', 'way', 'make', 'made', 'take',
  'get', 'got', 'set', 'let', 'say', 'said', 'go', 'going', 'come',
  'world', 'work', 'working', 'part', 'based', 'find', 'found',
  'need', 'know', 'thing', 'things', 'look', 'looking', 'good', 'great',
  'right', 'still', 'own', 'same', 'called', 'related', 'people',
  'information', 'data', 'system', 'process', 'form', 'however', 'while',
  'often', 'several', 'must', 'even', 'may', 'usually', 'typically',
  'generally', 'specifically', 'essentially', 'particularly', 'among',
  'between', 'within', 'without', 'through', 'during', 'before', 'after',
  'above', 'below', 'under', 'over', 'into', 'onto', 'upon',
  // Definitely junk from earlier results
  'definitely', 'typed', 'cleared', 'repo', 'github', 'npm', 'yarn',
  'download', 'install', 'update', 'version', 'release', 'source', 'code',
  'file', 'folder', 'readme', 'license', 'docs', 'blog', 'post',
]);

/**
 * Fallback: discover subtopics via Google web search + NLP.
 * Only returns clean 1-2 word terms that appear at least twice across results.
 */
async function discoverSubtopicsFromWeb(category: string): Promise<string[]> {
  if (!isGoogleApiConfigured()) return [];

  const nlp = require('compromise');

  // Build category skip set
  const catWords = new Set<string>();
  category.toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 1) catWords.add(w);
    const s = nlp(w).tag('Noun').nouns().toSingular().text();
    const p = nlp(w).tag('Noun').nouns().toPlural().text();
    if (s) catWords.add(s.toLowerCase());
    if (p) catWords.add(p.toLowerCase());
  });

  const queries = [
    `types of ${category}`,
    `${category} examples`,
  ];

  const allTerms = new Map<string, number>();

  for (const query of queries) {
    try {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.append("key", GOOGLE_API_KEY!);
      url.searchParams.append("cx", GOOGLE_SEARCH_ENGINE_ID!);
      url.searchParams.append("q", query);
      url.searchParams.append("num", "10");

      console.log(`🔍 Subtopic web search: "${query}"`);
      const response = await fetch(url.toString());
      const data: GoogleWebSearchResponse = await response.json();

      if (data.error) {
        console.error("Google API error:", data.error);
        continue;
      }

      for (const item of data.items || []) {
        const text = `${item.title} . ${item.snippet}`;
        const doc = nlp(text);
        const nounPhrases: string[] = doc.nouns().out('array');
        const topics: string[] = doc.topics().out('array');

        for (let raw of [...nounPhrases, ...topics]) {
          // Strip everything except letters, spaces, hyphens
          raw = raw.replace(/[^a-zA-Z\s-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

          if (raw.length < 3) continue;

          const words = raw.split(' ');
          if (words.length > 2) continue;                         // Max 2 words
          if (words.some(w => STOPWORDS.has(w))) continue;        // No stopwords
          if (words.every(w => catWords.has(w))) continue;        // Not the category itself
          if (catWords.has(raw)) continue;
          if (words.some(w => w.length < 2)) continue;            // No single-letter words

          const weight = words.length === 1 ? 2 : 1;
          allTerms.set(raw, (allTerms.get(raw) || 0) + weight);
        }
      }
    } catch (err) {
      console.error("Subtopic search error:", err);
    }
  }

  // Only keep terms that appeared at least twice (across all results)
  const sorted = Array.from(allTerms.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term);

  console.log(`📋 Web-discovered ${sorted.length} subtopics for "${category}":`, sorted.slice(0, 20));
  return sorted;
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
 * 1. Check curated term bank (instant, high-quality)
 * 2. Fallback: web-search + NLP extraction (slower, filtered strictly)
 * 3. Pick 2 distinct terms, image-search each
 */
export async function fetchTwoImagesForCustomGame(
  customQuery: string
): Promise<[FetchedImage | null, FetchedImage | null]> {
  const category = customQuery.trim();
  if (!category) return [null, null];

  // ── Step 1: Try curated terms first ──
  let termPool = findCuratedTerms(category);
  if (termPool && termPool.length >= 2) {
    console.log(`📚 Using curated terms for "${category}" (${termPool.length} available)`);
  } else {
    // ── Step 2: Fallback to web search discovery ──
    console.log(`🌐 No curated terms for "${category}", discovering via web search...`);
    const webTerms = await discoverSubtopicsFromWeb(category);
    if (webTerms.length >= 2) {
      termPool = webTerms;
    } else {
      console.warn(`⚠️  Could not find enough subtopics for "${category}", using category directly`);
      const [img1, img2] = await Promise.all([
        fetchImageForTerm(category, category),
        fetchImageForTerm(category, category),
      ]);
      return [img1, img2];
    }
  }

  // ── Step 3: Pick 2 distinct random terms ──
  const shuffled = [...termPool].sort(() => Math.random() - 0.5);
  const term1 = shuffled[0];
  let term2 = shuffled[1];

  // Try to avoid terms that share words
  for (let i = 2; i < shuffled.length; i++) {
    const words1 = new Set(term1.split(' '));
    const words2 = new Set(term2.split(' '));
    const overlap = Array.from(words2).filter(w => words1.has(w)).length;
    if (overlap === 0) break;
    term2 = shuffled[i];
  }

  console.log(`🎯 Selected terms for "${category}": "${term1}" and "${term2}"`);

  // ── Step 4: Image search for each term ──
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

