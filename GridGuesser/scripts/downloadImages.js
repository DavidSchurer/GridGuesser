// Script to help download sample images from Unsplash
// Run with: node scripts/downloadImages.js

const https = require('https');
const fs = require('fs');
const path = require('path');

// Unsplash photo IDs for famous landmarks (free to use)
const images = [
  { id: 'eiffel-tower', unsplashId: 'Q0-fOL2nqZc', name: 'Eiffel Tower' },
  { id: 'golden-gate-bridge', unsplashId: 'Lq6rcifGjOU', name: 'Golden Gate Bridge' },
  { id: 'statue-of-liberty', unsplashId: 'a2hV5bjum_o', name: 'Statue of Liberty' },
  { id: 'taj-mahal', unsplashId: 'SQZ_6ljGAhk', name: 'Taj Mahal' },
  { id: 'great-wall', unsplashId: '51f8lPEGRGo', name: 'Great Wall' },
  { id: 'sydney-opera', unsplashId: 'tDqsfVPgDYY', name: 'Sydney Opera House' },
  { id: 'big-ben', unsplashId: 'FVu0eY0EmcU', name: 'Big Ben' },
  { id: 'colosseum', unsplashId: 'DLKutw7jvqg', name: 'Colosseum' },
];

const imagesDir = path.join(__dirname, '..', 'public', 'images');

// Ensure images directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

console.log('To download images for GridGuesser:');
console.log('\n1. Visit Unsplash.com and search for each landmark');
console.log('2. Download high-quality images (1000x1000+ recommended)');
console.log('3. Save them in public/images/ with these names:\n');

images.forEach(img => {
  console.log(`   - ${img.id}.jpg (${img.name})`);
});

console.log('\nAlternatively, use these Unsplash URLs:');
images.forEach(img => {
  console.log(`   ${img.name}: https://unsplash.com/photos/${img.unsplashId}`);
});

console.log('\n💡 Tip: Right-click and "Save Image As" with the correct filename');

