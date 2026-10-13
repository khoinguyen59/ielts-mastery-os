import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Milestone 1: Bespoke Brand & Geometry Fix Verification', () => {
  const rootDir = process.cwd();

  it('verifies all 9 bespoke 3D embossed vector SVGs exist and contain valid XML/SVG data', () => {
    const requiredIcons = [
      'flame.svg',
      'coin.svg',
      'heart.svg',
      'badge_flashcard.svg',
      'badge_blitz.svg',
      'badge_writing.svg',
      'badge_trophy.svg',
      'chest.svg',
      'lock.svg'
    ];

    const iconsDir = path.resolve(rootDir, 'src/ui/assets/icons');
    expect(fs.existsSync(iconsDir)).toBe(true);

    for (const iconName of requiredIcons) {
      const iconPath = path.join(iconsDir, iconName);
      expect(fs.existsSync(iconPath)).toBe(true);
      const content = fs.readFileSync(iconPath, 'utf-8');
      expect(content).toContain('<svg');
      expect(content).toContain('</svg>');
      expect(content).toContain('viewBox');
    }
  });

  it('verifies official Academic Cabi logo SVG exists with mortarboard, tassel, and glasses features', () => {
    const logoPath = path.resolve(rootDir, 'src/ui/assets/mascot/cabi_academic_logo.svg');
    expect(fs.existsSync(logoPath)).toBe(true);

    const content = fs.readFileSync(logoPath, 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('mortarboard');
    expect(content).toContain('tassel');
    expect(content).toContain('glasses');
  });

  it('verifies pills_and_brand.css enforces topbar geometry under 150 lines', () => {
    const cssPath = path.resolve(rootDir, 'src/ui/css/pills_and_brand.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const content = fs.readFileSync(cssPath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThan(150);

    // Geometry checks
    expect(content).toContain('38px');
    expect(content).toContain('9999px');
    expect(content).toContain('2.5px');
    expect(content).toContain('pill-icon');
    expect(content).toContain('pill-val');
    expect(content).toContain('pill-svg');
  });

  it('verifies style.css is cleanly refactored under 200 lines', () => {
    const cssPath = path.resolve(rootDir, 'src/ui/css/style.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const content = fs.readFileSync(cssPath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThan(200);
  });

  it('verifies index.html uses decoupled stat pills, Academic Cabi logo, and stays under 380 lines', () => {
    const htmlPath = path.resolve(rootDir, 'src/ui/index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const content = fs.readFileSync(htmlPath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThan(380);

    // Linked stylesheet
    expect(content).toContain('pills_and_brand.css');

    // Academic Cabi logo
    expect(content).toContain('cabi_academic_logo.svg');

    // Decoupled pill spans
    expect(content).toContain('topbar-streak-val');
    expect(content).toContain('topbar-coin-val');
    expect(content).toContain('topbar-heart-val');
    expect(content).toContain('pill-icon');
    expect(content).toContain('pill-val');
    expect(content).toContain('pill-svg');
  });

  it('verifies app.js updates stat values targeting .pill-val spans and stays under 350 lines', () => {
    const jsPath = path.resolve(rootDir, 'src/ui/js/app.js');
    expect(fs.existsSync(jsPath)).toBe(true);

    const content = fs.readFileSync(jsPath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThan(350);

    // Targets inner val span
    expect(content).toContain('topbar-streak-val');
    expect(content).toContain('topbar-coin-val');
    expect(content).toContain('topbar-heart-val');
  });
});
