/**
 * Cinescape Kuwait (KNCC). Le site est une application React : le HTML brut est vide, il faut la page APRÈS
 * chargement (navigateur sans interface, voir renderPage). Les tuiles « now-showing-preview » donnent
 * titre, classification et lien /moviesessions/<slug>/<code>. La salle n'est pas indiquée par film : un seul
 * « cinéma » couvre l'enseigne (Avenues, 360, Al Kout, Assima, Ajial, 1954 Film House, Al-Bairaq).
 */
import { cleanTitle } from './sky.mjs';

const BASE = 'https://www.cinescape.com.kw';
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function parseCinescape(html, status) {
  return [...html.matchAll(/<div class="now-showing-preview">([\s\S]*?)(?=<div class="now-showing-preview">|<\/section>)/g)].map((m) => {
    const link = /href="https?:\/\/[^"/]*cinescape\.com\.kw\/moviesessions\/([^/"]+)\/([A-Z0-9]+)"/.exec(m[1]);
    const alt = /alt="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const age = decode(/class="age-highlight"[^>]*>([^<]*)/.exec(m[1])?.[1] ?? '');
    return { slug: link?.[2] ?? '', title: cleanTitle(alt), rating: age, status };
  }).filter((f) => f.slug && f.title);
}

export function cinescapeToFeed(films) {
  return {
    'cinescape-kw': {
      name: 'Cinescape Kuwait',
      films: films.map((f) => ({ slug: f.slug, title: f.title, rating: f.rating, language: '', releaseDate: null, url: `${BASE}/#nowshowing`, status: f.status })),
    },
  };
}

/** Charge une page comme un visiteur (Playwright, installé seulement dans GitHub Actions) et renvoie son HTML final. */
export async function renderPage(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (compatible; cinema-data/1.0)' });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForSelector('.now-showing-preview', { timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function fetchCinescape(render = renderPage) {
  const now = parseCinescape(await render(`${BASE}/`), 'now_showing');
  if (now.length === 0) throw new Error('Cinescape : aucun film lu');
  let soon = [];
  try { soon = parseCinescape(await render(`${BASE}/comingsoon`), 'coming_soon'); } catch { /* « bientôt » est un plus */ }
  const seen = new Set(now.map((f) => f.slug));
  return cinescapeToFeed([...now, ...soon.filter((f) => !seen.has(f.slug))]);
}
