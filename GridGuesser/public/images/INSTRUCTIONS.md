# Custom Images Setup

To use your custom images in GridGuesser:

1. **Save your two images** to this directory (`public/images/`) with these exact names:
   - `image-1.jpg`
   - `image-2.jpg`

2. **Image Requirements:**
   - Format: JPG, PNG, or SVG
   - Recommended size: At least 1000x1000 pixels
   - Square aspect ratio works best

3. **Current Setup:**
   - The game now uses only TWO images (instead of 8 landmarks)
   - Player 1 gets `image-1.jpg`
   - Player 2 gets `image-2.jpg`
   - Each player sees the OTHER player's image as tiles to reveal

## Important Notes:

- Make sure both image files exist in this folder
- The images will be split into a 10x10 grid (100 tiles)
- Players reveal tiles to guess what the image is
- For best results, use high-contrast images with recognizable features

## To Revert to Original Images:

If you want to go back to the landmark placeholders, restore the original `images.json` file.

