import sharp from 'sharp';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const TILES_DIR = path.join(process.cwd(), 'public', 'tiles');
const TILE_SIZE = 100; // Each tile will be 100x100 pixels
const GRID_SIZE = 10; // 10x10 grid

// Ensure tiles directory exists
if (!fs.existsSync(TILES_DIR)) {
  fs.mkdirSync(TILES_DIR, { recursive: true });
}

// Generate a unique hash for the image URL
function generateImageHash(imageUrl: string): string {
  return createHash('md5').update(imageUrl).digest('hex');
}

// Download image from URL with proper headers and redirect handling
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      }
    };
    
    client.get(url, options, (response) => {
      // Handle redirects (301, 302, 307, 308)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`Following redirect to: ${response.headers.location}`);
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Split image into 100 tiles (10x10 grid)
export async function generateTiles(imageUrl: string): Promise<{ success: boolean; imageHash: string; error?: string }> {
  try {
    const imageHash = generateImageHash(imageUrl);
    const imageDir = path.join(TILES_DIR, imageHash);

    // Check if tiles already exist
    if (fs.existsSync(imageDir)) {
      const files = fs.readdirSync(imageDir);
      if (files.length === 100) {
        console.log(`Tiles already exist for image: ${imageHash}`);
        return { success: true, imageHash };
      }
    }

    // Create directory for this image's tiles
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Download the image
    console.log(`Downloading image from: ${imageUrl}`);
    const imageBuffer = imageUrl.startsWith('http') 
      ? await downloadImage(imageUrl)
      : fs.readFileSync(path.join(process.cwd(), 'public', imageUrl));

    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    // Resize image to 1000x1000 (10 tiles * 100px each) maintaining aspect ratio with cover
    const resizedImage = await image
      .resize(1000, 1000, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    console.log(`Generating 100 tiles for image: ${imageHash}`);

    // Generate all 100 tiles
    const tilePromises: Promise<void>[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tileIndex = row * GRID_SIZE + col;
        const tilePath = path.join(imageDir, `${tileIndex}.jpg`);

        // Extract this tile from the image
        const tilePromise = sharp(resizedImage)
          .extract({
            left: col * TILE_SIZE,
            top: row * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE,
          })
          .jpeg({ quality: 85 })
          .toFile(tilePath);

        tilePromises.push(tilePromise.then(() => {}));
      }
    }

    await Promise.all(tilePromises);
    console.log(`Successfully generated 100 tiles for image: ${imageHash}`);

    return { success: true, imageHash };
  } catch (error) {
    console.error('Error generating tiles:', error);
    return { 
      success: false, 
      imageHash: '', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Clean up old tiles (optional - for memory management)
export function cleanupTiles(imageHash: string): void {
  try {
    const imageDir = path.join(TILES_DIR, imageHash);
    if (fs.existsSync(imageDir)) {
      fs.rmSync(imageDir, { recursive: true, force: true });
      console.log(`Cleaned up tiles for image: ${imageHash}`);
    }
  } catch (error) {
    console.error('Error cleaning up tiles:', error);
  }
}

// Get tile path for serving
export function getTilePath(imageHash: string, tileIndex: number): string | null {
  const tilePath = path.join(TILES_DIR, imageHash, `${tileIndex}.jpg`);
  return fs.existsSync(tilePath) ? tilePath : null;
}



