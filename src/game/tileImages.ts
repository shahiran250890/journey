const tileUrls = import.meta.glob('../../content/maps/tiles/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

/** Bundled URL for a file in content/maps/tiles. Vite applies BASE_PATH. */
export function tileUrl(fileName: string): string {
  const match = Object.entries(tileUrls).find(([key]) => key.endsWith(`/${fileName}`));
  if (!match || typeof match[1] !== 'string') throw new Error(`Missing tile image ${fileName}`);
  return match[1];
}
