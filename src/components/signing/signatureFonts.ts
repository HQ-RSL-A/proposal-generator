import { Caveat, Dancing_Script, Great_Vibes, Sacramento } from "next/font/google";

const dancingScript = Dancing_Script({ subsets: ["latin"], weight: "500", display: "swap" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: "500", display: "swap" });
const sacramento = Sacramento({ subsets: ["latin"], weight: "400", display: "swap" });

export interface SignatureFont {
  /** Stable id stored on the Signature record */
  id: string;
  label: string;
  className: string;
  /** CSS font-family string usable in canvas ctx.font */
  cssFamily: string;
  /** Canvas font size that renders the family legibly */
  canvasSize: number;
}

export const SIGNATURE_FONTS: SignatureFont[] = [
  {
    id: "Dancing Script",
    label: "Flowing",
    className: dancingScript.className,
    cssFamily: dancingScript.style.fontFamily,
    canvasSize: 64,
  },
  {
    id: "Great Vibes",
    label: "Elegant",
    className: greatVibes.className,
    cssFamily: greatVibes.style.fontFamily,
    canvasSize: 62,
  },
  {
    id: "Caveat",
    label: "Casual",
    className: caveat.className,
    cssFamily: caveat.style.fontFamily,
    canvasSize: 68,
  },
  {
    id: "Sacramento",
    label: "Script",
    className: sacramento.className,
    cssFamily: sacramento.style.fontFamily,
    canvasSize: 58,
  },
];

/** Renders a typed name to a transparent PNG data URL via an offscreen canvas. */
export async function typedNameToPng(name: string, font: SignatureFont): Promise<string> {
  await document.fonts.ready;
  const scale = 2;
  const width = 600;
  const height = 180;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#111827";
  ctx.textBaseline = "middle";

  let size = font.canvasSize;
  do {
    ctx.font = `${size}px ${font.cssFamily}`;
    if (ctx.measureText(name).width <= width - 40) break;
    size -= 4;
  } while (size > 24);

  ctx.fillText(name, 20, height / 2);
  return canvas.toDataURL("image/png");
}
