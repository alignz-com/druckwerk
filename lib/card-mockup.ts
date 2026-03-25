/**
 * Generate a business card mockup image from front + back PNG thumbnails.
 * Composites both cards onto a clean background with slight rotation and shadow.
 * Used for order confirmation emails.
 */
import sharp from "sharp";

interface MockupOptions {
  /** Output width in pixels */
  width?: number;
  /** Background color (hex) */
  bgColor?: string;
  /** Rotation angle for back card in degrees */
  backRotation?: number;
}

const DEFAULTS: Required<MockupOptions> = {
  width: 600,
  bgColor: "transparent",
  backRotation: 5,
};

/**
 * Create a card image with a natural drop shadow by:
 * 1. Adding transparent padding around the card
 * 2. Creating a shadow layer from the card silhouette
 * 3. Compositing card on top of shadow
 */
async function cardWithShadow(
  cardPng: Buffer,
  cardW: number,
  cardH: number,
  shadowBlur: number,
  shadowAlpha: number,
  offsetX: number,
  offsetY: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const pad = shadowBlur + Math.max(Math.abs(offsetX), Math.abs(offsetY));
  const totalW = cardW + pad * 2;
  const totalH = cardH + pad * 2;

  // Create shadow: take the card, tint it black, make semi-transparent, blur
  const shadowLayer = await sharp(cardPng)
    .resize(cardW, cardH, { fit: "fill" })
    .ensureAlpha()
    .tint({ r: 0, g: 0, b: 0 })
    .modulate({ brightness: 0 })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .blur(shadowBlur)
    .png()
    .toBuffer();

  // Reduce shadow opacity
  const shadow = await sharp(shadowLayer)
    .composite([{
      input: Buffer.from(
        `<svg width="${totalW}" height="${totalH}"><rect width="${totalW}" height="${totalH}" fill="rgba(0,0,0,${shadowAlpha})"/></svg>`
      ),
      blend: "dest-in",
    }])
    .png()
    .toBuffer();

  // Composite: shadow (offset) + card (centered)
  const canvas = await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, left: offsetX, top: offsetY },
      {
        input: await sharp(cardPng).resize(cardW, cardH, { fit: "fill" }).png().toBuffer(),
        left: pad,
        top: pad,
      },
    ])
    .png()
    .toBuffer();

  return { buffer: canvas, width: totalW, height: totalH };
}

export async function generateCardMockup(
  frontPng: Buffer,
  backPng: Buffer | null,
  options?: MockupOptions,
): Promise<Buffer> {
  const { width: outputWidth, bgColor, backRotation } = { ...DEFAULTS, ...options };

  // Get front card dimensions to determine aspect ratio
  const frontMeta = await sharp(frontPng).metadata();
  const frontW = frontMeta.width ?? 600;
  const frontH = frontMeta.height ?? 388;
  const cardAspect = frontW / frontH;

  // Card size within the mockup (65% of output width)
  const cardW = Math.round(outputWidth * 0.65);
  const cardH = Math.round(cardW / cardAspect);

  const shadowBlur = 8;
  const shadowOffsetX = 2;
  const shadowOffsetY = 3;

  // Output canvas with padding
  const paddingX = Math.round(outputWidth * 0.1);
  const paddingY = Math.round(cardH * 0.2);
  const outputHeight = cardH + paddingY * 2 + (backPng ? Math.round(cardH * 0.1) : 0);

  const composites: sharp.OverlayOptions[] = [];

  if (backPng) {
    // Back card: rotated, offset to the right
    const backResized = await sharp(backPng)
      .resize(cardW, cardH, { fit: "fill" })
      .png()
      .toBuffer();

    const backWithShadow = await cardWithShadow(
      backResized, cardW, cardH,
      shadowBlur, 0.3, shadowOffsetX, shadowOffsetY,
    );

    // Rotate the entire back card + shadow
    const backRotated = await sharp(backWithShadow.buffer)
      .rotate(backRotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const backRotMeta = await sharp(backRotated).metadata();
    const backRotW = backRotMeta.width ?? backWithShadow.width;
    const backRotH = backRotMeta.height ?? backWithShadow.height;

    const backX = Math.round((outputWidth - backRotW) / 2 + cardW * 0.1);
    const backY = Math.round((outputHeight - backRotH) / 2 - cardH * 0.03);

    composites.push({ input: backRotated, left: Math.max(0, backX), top: Math.max(0, backY) });
  }

  // Front card with shadow, positioned left of center
  const frontWithShadow = await cardWithShadow(
    frontPng, cardW, cardH,
    shadowBlur, 0.35, shadowOffsetX, shadowOffsetY,
  );

  const frontX = Math.round((outputWidth - frontWithShadow.width) / 2 - (backPng ? cardW * 0.1 : 0));
  const frontY = Math.round((outputHeight - frontWithShadow.height) / 2 + (backPng ? cardH * 0.05 : 0));

  composites.push({ input: frontWithShadow.buffer, left: Math.max(0, frontX), top: Math.max(0, frontY) });

  const bg = bgColor === "transparent"
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : parseBgColor(bgColor);

  return sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 4,
      background: bg,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function parseBgColor(hex: string): { r: number; g: number; b: number; alpha: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    alpha: 1,
  };
}
