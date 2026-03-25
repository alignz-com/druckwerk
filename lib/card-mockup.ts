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
  bgColor: "#f1f5f9", // slate-100
  backRotation: 6,
};

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

  // Card size within the mockup (70% of output width)
  const cardW = Math.round(outputWidth * 0.7);
  const cardH = Math.round(cardW / cardAspect);

  // Output canvas height with padding
  const padding = Math.round(outputWidth * 0.12);
  const outputHeight = cardH + padding * 2 + (backPng ? Math.round(cardH * 0.15) : 0);

  // Resize front card with rounded corners and shadow
  const frontResized = await sharp(frontPng)
    .resize(cardW, cardH, { fit: "fill" })
    .png()
    .toBuffer();

  // Create shadow (slightly larger, blurred, offset)
  const shadowOffset = 4;
  const shadowBlur = 12;
  const shadowCard = await sharp({
    create: {
      width: cardW + shadowBlur * 2,
      height: cardH + shadowBlur * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.15 },
    },
  })
    .blur(shadowBlur)
    .png()
    .toBuffer();

  // Compose the mockup
  const composites: sharp.OverlayOptions[] = [];

  if (backPng) {
    // Resize back card
    const backResized = await sharp(backPng)
      .resize(cardW, cardH, { fit: "fill" })
      .rotate(backRotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const backMeta = await sharp(backResized).metadata();
    const backW = backMeta.width ?? cardW;
    const backH = backMeta.height ?? cardH;

    // Back card shadow
    const backShadow = await sharp({
      create: {
        width: backW + shadowBlur * 2,
        height: backH + shadowBlur * 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.1 },
      },
    })
      .blur(shadowBlur)
      .png()
      .toBuffer();

    // Position back card offset to the right and slightly down
    const backX = Math.round((outputWidth - backW) / 2 + cardW * 0.08);
    const backY = Math.round(padding - cardH * 0.02);

    composites.push(
      { input: backShadow, left: backX - shadowBlur + shadowOffset, top: backY - shadowBlur + shadowOffset },
      { input: backResized, left: backX, top: backY },
    );
  }

  // Front card centered, slightly below
  const frontX = Math.round((outputWidth - cardW) / 2 - (backPng ? cardW * 0.08 : 0));
  const frontY = Math.round(padding + (backPng ? cardH * 0.15 : 0));

  composites.push(
    { input: shadowCard, left: frontX - shadowBlur + shadowOffset, top: frontY - shadowBlur + shadowOffset },
    { input: frontResized, left: frontX, top: frontY },
  );

  // Parse background color
  const bg = parseBgColor(bgColor);

  const mockup = await sharp({
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

  return mockup;
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
