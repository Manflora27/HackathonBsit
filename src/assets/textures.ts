// Procedural SVG textures as data URIs. No image files, so they work offline and stay tiny.
const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22")}")`;

/** Fine paper grain. */
export const GRAIN = enc(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .12 0 0 0 0 .17 0 0 0 0 .15 0 0 0 .09 0'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>`,
);

/** Long paper fibers: stretched low-frequency noise. */
export const FIBER = enc(
  `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.012 .35' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .2 0 0 0 .22 -.04'/></filter><rect width='400' height='400' filter='url(#f)'/></svg>`,
);

/** Contour lines, like soil strata or a topographic map. */
export const CONTOUR = enc(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420' fill='none' stroke='#1e2b27' stroke-width='1' stroke-opacity='.10'>
<path d='M-10 70C60 30 120 100 190 62S330 30 430 80'/><path d='M-10 104C64 66 126 134 192 98S334 66 430 116'/>
<path d='M-10 138C68 102 130 168 194 134S338 102 430 152'/><path d='M-10 172C72 138 134 202 196 170S342 138 430 188'/>
<path d='M-10 206C76 174 138 236 198 206S346 174 430 224'/><path d='M-10 240C80 210 142 270 200 242S350 210 430 260'/>
<path d='M-10 274C84 246 146 304 202 278S354 246 430 296'/><path d='M-10 308C88 282 150 338 204 314S358 282 430 332'/>
<path d='M-10 342C92 318 154 372 206 350S362 318 430 368'/><path d='M-10 376C96 354 158 406 208 386S366 354 430 404'/>
</svg>`,
);

/** A rough, dry-brush stroke for underlines. */
export const BRUSH = enc(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 14' preserveAspectRatio='none'><filter id='r'><feTurbulence type='fractalNoise' baseFrequency='.9 .08' numOctaves='2' seed='3'/><feDisplacementMap in='SourceGraphic' scale='5'/></filter><path d='M3 8C40 4 80 11 120 7S175 6 197 8' stroke='#d9532b' stroke-width='6' stroke-linecap='round' fill='none' filter='url(#r)'/></svg>`,
);
