import { contentSchema, type ContentFileBundle } from './schema.ts';

export interface ContentBundle extends Omit<ContentFileBundle, 'stats'> {
  stats: ContentFileBundle['stats']['stats'];
}

export function loadContent(input: unknown): ContentBundle {
  const parsed = contentSchema.parse(input);
  return {
    ...parsed,
    stats: parsed.stats.stats,
  };
}
