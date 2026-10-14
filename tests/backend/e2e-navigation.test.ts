import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { buildServer } from '../../src/api/server.js';

function getBrowserExecutablePath(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_BIN || '',
    process.env.PUPPETEER_EXECUTABLE_PATH || ''
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

describe('E2E UI Navigation Test (Puppeteer Core)', () => {
  let app: any;
  let serverPort: number;
  let browser: any;
  const executablePath = getBrowserExecutablePath();

  beforeAll(async () => {
    app = await buildServer();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const url = new URL(address);
    serverPort = parseInt(url.port);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (app) {
      await app.close().catch(() => {});
    }
  });

  it('navigates seamlessly between all 5 views and tests passage selection', async () => {
    if (!executablePath) {
      console.warn('Skipping live browser test: No Chrome/Edge executable found on this host.');
      // Fallback static verification
      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'src/ui/index.html'), 'utf-8');
      expect(indexHtml).toContain('data-pid="t2_p2"');
      expect(indexHtml).toContain('id="view-roadmap"');
      expect(indexHtml).toContain('id="view-flashcard"');
      expect(indexHtml).toContain('id="view-quiz"');
      expect(indexHtml).toContain('id="view-writing"');
      expect(indexHtml).toContain('id="view-exam"');
      expect(indexHtml).not.toContain('id="pdf-downloads-grid"');
      return;
    }

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const appUrl = `http://127.0.0.1:${serverPort}`;
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Handle 1-Click Guest Welcome Modal if visible
    const guestBtn = await page.$('#btn-auth-guest-quick');
    if (guestBtn) {
      await guestBtn.click();
      await page.waitForTimeout ? page.waitForTimeout(400) : new Promise(r => setTimeout(r, 400));
    }

    // Handle Onboarding placement modal if visible (choose intermediate)
    const levelCard = await page.$('.level-select-card[data-level="intermediate"]');
    if (levelCard) {
      await levelCard.click();
      await new Promise(r => setTimeout(r, 400));
    }

    const views = ['roadmap', 'flashcard', 'quiz', 'writing', 'exam', 'vocab', 'analytics'];

    for (const v of views) {
      const navBtn = await page.$(`.nav-btn[data-view="${v}"]`);
      if (navBtn) {
        await navBtn.click();
        await new Promise(r => setTimeout(r, 150));
        const activeSection = await page.$eval(`#view-${v}`, el => el.classList.contains('active'));
        expect(activeSection).toBe(true);
      }
    }

    // Switch to exam view before testing passage tabs
    const examNav = await page.$('.nav-btn[data-view="exam"]');
    if (examNav) {
      await examNav.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // In Exam view: click tab T2-P2 and verify active state
    const t2p2Tab = await page.$('.pass-tab[data-pid="t2_p2"]');
    expect(t2p2Tab).not.toBeNull();
    if (t2p2Tab) {
      await page.$eval('.pass-tab[data-pid="t2_p2"]', (el: any) => el.click());
      await new Promise(r => setTimeout(r, 200));
      const isT2P2Active = await page.$eval('.pass-tab[data-pid="t2_p2"]', el => el.classList.contains('active'));
      expect(isT2P2Active).toBe(true);
    }
  });
});
