import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    resumo: z.string(),
    autor: z.string(),
    categoria: z.enum(['aviso', 'guia', 'time', 'update']),
    capa: z.string().optional(),
    destaque: z.boolean().default(false),
    publicadoEm: z.coerce.date(),
  }),
});

export const collections = { blog };
