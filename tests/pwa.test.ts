import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & iOS Configuration', () => {
  it('contains Apple mobile web app capable meta tags in index.html', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="MDCloud"');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it('has required PWA and Apple touch icon files in public directory', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../public/apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../public/favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../public/icons/icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../public/icons/icon-512.png'))).toBe(true);
  });

  it('contains safe-area-inset custom properties in src/index.css', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf-8');
    expect(css).toContain('--sat: env(safe-area-inset-top');
    expect(css).toContain('--sab: env(safe-area-inset-bottom');
    expect(css).toContain('--sal: env(safe-area-inset-left');
    expect(css).toContain('--sar: env(safe-area-inset-right');
  });
});
