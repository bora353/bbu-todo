import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImg = '/Users/gaeun/.gemini/antigravity/brain/9ff79ec9-e328-4c84-a446-f879047a3461/heart_icon_1790043290533.png';
const publicDir = '/Users/gaeun/.gemini/antigravity/scratch/couple-todo/public';

async function generateIcons() {
  try {
    // Generate pwa-192x192.png
    await sharp(sourceImg).resize(192, 192).toFile(path.join(publicDir, 'pwa-192x192.png'));
    // Generate pwa-512x512.png
    await sharp(sourceImg).resize(512, 512).toFile(path.join(publicDir, 'pwa-512x512.png'));
    // Generate apple-touch-icon.png (180x180)
    await sharp(sourceImg).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));
    // Generate favicon.ico (just 32x32 png)
    await sharp(sourceImg).resize(32, 32).toFile(path.join(publicDir, 'favicon.ico'));
    // Generate mask-icon.svg (we'll just use the PNG for now, Safari allows PNGs sometimes, but wait, a PNG saved as SVG is bad, let's just make it a maskable PNG)
    await sharp(sourceImg).resize(512, 512).toFile(path.join(publicDir, 'mask-icon.svg')); // Note: It's technically PNG format with svg extension, but Vite PWA handles maskable icons better if configured. We'll just overwrite.
    console.log('Icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
