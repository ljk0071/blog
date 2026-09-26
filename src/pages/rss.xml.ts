import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { getPosts } from '../lib';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      categories: p.data.tags,
      link: `/blog/${p.id}`,
    })),
  });
};
