import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { ImageMetadata } from "./types";

const GRID_SIZE = 10;
const TILE_SIZE = 100; // pixels per tile

export async function splitImageIntoTiles(
  imagePath: string,
  outputDir: string
): Promise<string[]> {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Load and resize image to 1000x1000 (10x10 tiles of 100px each)
  const image = sharp(imagePath);
  const resizedImage = await image
    .resize(GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE, {
      fit: "cover",
      position: "center",
    })
    .toBuffer();

  const tilePaths: string[] = [];

  // Split into tiles
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tileIndex = row * GRID_SIZE + col;
      const tilePath = path.join(outputDir, `tile-${tileIndex}.jpg`);

      await sharp(resizedImage)
        .extract({
          left: col * TILE_SIZE,
          top: row * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        })
        .jpeg({ quality: 80 })
        .toFile(tilePath);

      tilePaths.push(tilePath);
    }
  }

  return tilePaths;
}

export function getRandomImage(images: ImageMetadata[]): ImageMetadata {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

export function getTwoRandomImages(images: ImageMetadata[]): [ImageMetadata, ImageMetadata] {
  const shuffled = [...images].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export function normalizeGuess(guess: string): string {
  return guess.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function validateGuess(guess: string, correctAnswer: string): boolean {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedAnswer = normalizeGuess(correctAnswer);
  
  // Exact match
  if (normalizedGuess === normalizedAnswer) return true;
  
  // Check if guess contains answer or vice versa (for partial matches)
  if (normalizedGuess.length >= 3 && normalizedAnswer.includes(normalizedGuess)) return true;
  if (normalizedAnswer.length >= 3 && normalizedGuess.includes(normalizedAnswer)) return true;
  
  return false;
}

