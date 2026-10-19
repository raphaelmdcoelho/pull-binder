// Renders the PWA icons from assets/icons/*.svg into public/. Run with `npm run icons` after
// changing the artwork; the PNGs are committed so a normal build needs no image tooling.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (name) => readFileSync(join(root, 'assets/icons', name), 'utf8');
const out = join(root, 'public');

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// Old placeholder sizes are not referenced any more.
rmSync(join(out, 'icons'), { recursive: true, force: true });
mkdirSync(join(out, 'icons'), { recursive: true });

const any = source('icon.svg');
const maskable = source('icon-maskable.svg');
for (const size of [192, 512]) {
  writeFileSync(join(out, 'icons', `icon-${size}.png`), png(any, size));
  writeFileSync(join(out, 'icons', `icon-maskable-${size}.png`), png(maskable, size));
}
// iOS applies its own rounding, so it gets the full-bleed artwork.
writeFileSync(join(out, 'icons', 'apple-touch-icon.png'), png(maskable, 180));
writeFileSync(join(out, 'favicon.svg'), any);

// favicon.ico: an ICO container holding PNG images.
const sizes = [16, 32, 48];
const images = sizes.map((size) => png(any, size));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
});
writeFileSync(join(out, 'favicon.ico'), Buffer.concat([header, ...images]));
console.log('Icons written to public/.');
