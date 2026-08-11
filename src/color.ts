import { CARD_COLORS } from "./types";

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function hexToRgb(hex: string): RgbColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function closestCardColor(color: RgbColor): string {
  return CARD_COLORS.reduce((closest, candidate) => {
    const candidateRgb = hexToRgb(candidate);
    const closestRgb = hexToRgb(closest);
    const candidateDistance =
      (candidateRgb.red - color.red) ** 2 +
      (candidateRgb.green - color.green) ** 2 +
      (candidateRgb.blue - color.blue) ** 2;
    const closestDistance =
      (closestRgb.red - color.red) ** 2 +
      (closestRgb.green - color.green) ** 2 +
      (closestRgb.blue - color.blue) ** 2;
    return candidateDistance < closestDistance ? candidate : closest;
  }, CARD_COLORS[0] as string);
}

export function averageImageAccent(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let weight = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3] / 255;
          if (alpha < 0.08) continue;
          red += pixels[index] * alpha;
          green += pixels[index + 1] * alpha;
          blue += pixels[index + 2] * alpha;
          weight += alpha;
        }
        resolve(weight > 0 ? closestCardColor({ red: red / weight, green: green / weight, blue: blue / weight }) : null);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
