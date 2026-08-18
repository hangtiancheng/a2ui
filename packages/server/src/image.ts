import type { Request, Response } from "express";

// Deterministic identicon-style placeholders generated at request time, so the
// repo ships no binary image assets (see /static/:name in index.ts).

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function xorShift32(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export function genSvg(seed: string): string {
  const rand = xorShift32(fnv1a(seed));

  const GRID = 5;
  const CELL = 40;
  const MARGIN = 28;
  const SIZE = GRID * CELL + MARGIN * 2; // 256

  const hue = Math.floor(rand() * 360);
  const saturation = 55 + Math.floor(rand() * 15); // 55% ~ 70%
  const lightness = 45 + Math.floor(rand() * 15); // 45% ~ 60%
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  const cells: string[] = [];
  const cell = (col: number, row: number) =>
    `<rect x="${MARGIN + col * CELL}" y="${MARGIN + row * CELL}" width="${CELL}" height="${CELL}"/>`;

  for (let col = 0; col < Math.ceil(GRID / 2); col++) {
    for (let row = 0; row < GRID; row++) {
      if (rand() >= 0.5) {
        cells.push(cell(col, row));
        const mirrorCol = GRID - 1 - col;
        if (mirrorCol !== col) {
          cells.push(cell(mirrorCol, row));
        }
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="#f0f0f0"/>` +
    `<g fill="${color}">${cells.join("")}</g>` +
    `</svg>`
  );
}

export function serveImage(req: Request, res: Response): void {
  const name = String(req.params.name || "placeholder");
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(genSvg(name));
}
