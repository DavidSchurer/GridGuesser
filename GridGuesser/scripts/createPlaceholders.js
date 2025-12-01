// Simple script to create placeholder images for testing
// Run with: node scripts/createPlaceholders.js

const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');

// Ensure images directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Create an SVG placeholder for each image
const images = [
  { id: 'eiffel-tower', name: 'Eiffel Tower', color: '#8B7355' },
  { id: 'golden-gate-bridge', name: 'Golden Gate Bridge', color: '#C0362C' },
  { id: 'statue-of-liberty', name: 'Statue of Liberty', color: '#81C784' },
  { id: 'taj-mahal', name: 'Taj Mahal', color: '#F5F5F5' },
  { id: 'great-wall', name: 'Great Wall', color: '#A1887F' },
  { id: 'sydney-opera', name: 'Sydney Opera House', color: '#E0E0E0' },
  { id: 'big-ben', name: 'Big Ben', color: '#D4AF37' },
  { id: 'colosseum', name: 'Colosseum', color: '#CD853F' },
];

console.log('Creating placeholder images...\n');

images.forEach(img => {
  const svg = `
    <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="1000" fill="${img.color}"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            text-anchor="middle" fill="rgba(0,0,0,0.3)">${img.name}</text>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="32" 
            text-anchor="middle" fill="rgba(0,0,0,0.2)">Placeholder Image</text>
    </svg>
  `.trim();

  const filePath = path.join(imagesDir, `${img.id}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`✓ Created ${img.id}.svg`);
});

console.log('\n✨ All placeholder images created!');
console.log('\n📝 Note: Replace these with real images for the final version.');
console.log('   Download high-quality landmark photos (1000x1000+) and save as .jpg files.');

