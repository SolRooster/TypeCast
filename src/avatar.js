import { TYPE_COLORS } from './type-utils.js';

const AVATAR_SIZE = 512; // Perfect for Discord (512x512) and iOS (crops well)

/**
 * Generate a clean profile pic: type-colored background + Pokémon artwork.
 * Returns a Promise that resolves to a Blob (PNG).
 */
export async function generateAvatar(spirit, types) {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');

  // Draw type-colored background
  if (types.length === 1) {
    ctx.fillStyle = TYPE_COLORS[types[0]]?.bg || '#888';
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  } else {
    // Diagonal gradient for dual types
    const gradient = ctx.createLinearGradient(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    gradient.addColorStop(0, TYPE_COLORS[types[0]]?.bg || '#888');
    gradient.addColorStop(0.45, TYPE_COLORS[types[0]]?.bg || '#888');
    gradient.addColorStop(0.55, TYPE_COLORS[types[1]]?.bg || '#888');
    gradient.addColorStop(1, TYPE_COLORS[types[1]]?.bg || '#888');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  }

  // Subtle darkening vignette for depth
  const vignette = ctx.createRadialGradient(
    AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE * 0.25,
    AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE * 0.7
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // Load and draw the Pokémon artwork
  const imgUrl = spirit.officialArtwork || spirit.sprite;
  if (imgUrl) {
    try {
      // Fetch as blob to avoid CORS canvas tainting
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const bitmapUrl = URL.createObjectURL(blob);

      const img = await loadImage(bitmapUrl);
      URL.revokeObjectURL(bitmapUrl);

      // Center the Pokémon, sized to ~80% of canvas with padding
      const padding = AVATAR_SIZE * 0.08;
      const maxSize = AVATAR_SIZE - padding * 2;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (AVATAR_SIZE - w) / 2;
      const y = (AVATAR_SIZE - h) / 2 + padding * 0.3; // slight downward shift

      // Drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8;

      ctx.drawImage(img, x, y, w, h);
      ctx.shadowColor = 'transparent';
    } catch (err) {
      console.warn('Failed to load Pokémon image for avatar:', err);
    }
  }

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

/**
 * Download the avatar as a PNG file.
 */
export async function downloadAvatar(spirit, types) {
  const blob = await generateAvatar(spirit, types);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `typecast-${spirit.name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
