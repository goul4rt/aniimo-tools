import type { APIContext } from 'astro';
import { aniimos, porSlug } from '../../../../data.ts';

export const getStaticPaths = () => aniimos.map((a) => ({ params: { slug: a.slug } }));
export const GET = ({ params }: APIContext) => Response.json(porSlug.get(params.slug!));
