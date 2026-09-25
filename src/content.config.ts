import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    resumo: z.string(),
    publicadoEm: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
