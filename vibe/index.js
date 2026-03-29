#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const inputUrl = args.find(a => a.startsWith('http'));

function getFlag(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const val = args[idx + 1];
  if (!val || val.startsWith('-')) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return val;
}

const format = getFlag('--format') || 'json';
const outputPath = getFlag('-o');

if (!inputUrl) {
  console.error('Usage: node index.js <URL> [--format css|json] [-o output]');
  process.exit(1);
}

if (!['css', 'json'].includes(format)) {
  console.error(`Unknown format: ${format}. Use css or json.`);
  process.exit(1);
}

function mostFrequent(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

async function extractTokens(url) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const tokens = await page.evaluate(() => {
      const body = document.body;
      const bodyStyle = getComputedStyle(body);
      const htmlStyle = getComputedStyle(document.documentElement);

      function sampleElements(selector, limit = 50) {
        return Array.from(document.querySelectorAll(selector)).slice(0, limit);
      }

      function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb;
        const [, r, g, b] = match;
        return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      }

      function tally(elements, extractor) {
        const counts = new Map();
        elements.forEach(el => {
          const val = extractor(el);
          if (val) counts.set(val, (counts.get(val) || 0) + 1);
        });
        return counts;
      }

      const colors = {};
      colors.background = rgbToHex(bodyStyle.backgroundColor) || rgbToHex(htmlStyle.backgroundColor) || '#ffffff';
      colors.text = rgbToHex(bodyStyle.color) || '#000000';

      const headings = sampleElements('h1, h2, h3');
      const headingStyle = headings.length ? getComputedStyle(headings[0]) : null;
      if (headingStyle) colors.headings = rgbToHex(headingStyle.color);

      const links = sampleElements('a[href]');
      const linkStyle0 = links.length ? getComputedStyle(links[0]) : null;
      if (linkStyle0) colors.links = rgbToHex(linkStyle0.color);

      const textColorCounts = tally(sampleElements('p, span, li'), el => {
        const c = rgbToHex(getComputedStyle(el).color);
        return (c && c !== colors.text) ? c : null;
      });
      const topTextColor = [...textColorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topTextColor) colors.textSecondary = topTextColor[0];

      const borderColorCounts = tally(
        sampleElements('div, section, article, aside, header, footer, nav'),
        el => {
          const bc = rgbToHex(getComputedStyle(el).borderTopColor);
          return (bc && bc !== colors.text && bc !== colors.background) ? bc : null;
        }
      );
      const topBorderColor = [...borderColorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topBorderColor) colors.border = topBorderColor[0];

      const typography = {
        fontFamily: bodyStyle.fontFamily,
        fontSize: bodyStyle.fontSize,
        fontWeight: bodyStyle.fontWeight,
        lineHeight: bodyStyle.lineHeight,
        letterSpacing: bodyStyle.letterSpacing,
      };

      if (headingStyle) {
        typography.headingFontFamily = headingStyle.fontFamily;
        typography.headingFontWeight = headingStyle.fontWeight;
        typography.headingFontSize = headingStyle.fontSize;
        typography.headingLetterSpacing = headingStyle.letterSpacing;
        typography.headingLineHeight = headingStyle.lineHeight;
      }

      const codeEls = sampleElements('code, pre');
      if (codeEls.length) {
        typography.codeFontFamily = getComputedStyle(codeEls[0]).fontFamily;
      }

      const fontImports = [];
      document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"]').forEach(link => {
        if (link.href) fontImports.push(link.href);
      });
      document.querySelectorAll('style').forEach(style => {
        const imports = style.textContent.match(/@import\s+url\(['"]?([^'")\s]+)['"]?\)/g);
        if (imports) fontImports.push(...imports.map(i => i.match(/url\(['"]?([^'")\s]+)/)?.[1]).filter(Boolean));
        const faces = style.textContent.match(/@font-face\s*\{[^}]*font-family:\s*['"]?([^'";]+)/g);
        if (faces) fontImports.push(...faces);
      });

      const mainContent = document.querySelector('main, article, .content, [role="main"]') || body;
      const ms = getComputedStyle(mainContent);
      const spacing = {
        containerMaxWidth: ms.maxWidth,
        containerPadding: ms.padding,
        contentMargin: ms.margin,
      };
      const paragraphs = sampleElements('p');
      if (paragraphs.length) {
        const ps = getComputedStyle(paragraphs[0]);
        spacing.paragraphMarginTop = ps.marginTop;
        spacing.paragraphMarginBottom = ps.marginBottom;
      }

      const allEls = sampleElements('div, section, article, button, input, img, a, nav, header, footer, aside, ul, form', 100);
      const radii = new Map();
      const boxShadows = new Map();
      allEls.forEach(el => {
        const s = getComputedStyle(el);
        if (s.borderRadius && s.borderRadius !== '0px') radii.set(s.borderRadius, (radii.get(s.borderRadius) || 0) + 1);
        if (s.boxShadow && s.boxShadow !== 'none') boxShadows.set(s.boxShadow, (boxShadows.get(s.boxShadow) || 0) + 1);
      });
      const effects = {
        borderRadius: [...radii.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
        boxShadows: [...boxShadows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
      };

      const linkStyle = {};
      if (linkStyle0) {
        linkStyle.color = rgbToHex(linkStyle0.color);
        linkStyle.textDecoration = linkStyle0.textDecorationLine;
        linkStyle.textDecorationStyle = linkStyle0.textDecorationStyle;
        linkStyle.textUnderlineOffset = linkStyle0.textUnderlineOffset;
      }

      return { colors, typography, spacing, effects, linkStyle, fontImports };
    });

    return tokens;
  } finally {
    await browser.close();
  }
}

function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function toCSS(tokens) {
  const lines = [':root {'];

  for (const [key, val] of Object.entries(tokens.colors)) {
    if (val) lines.push(`  --color-${camelToKebab(key)}: ${val};`);
  }

  lines.push(`  --font-family: ${tokens.typography.fontFamily};`);
  const optionalTypo = ['headingFontFamily:font-family-heading', 'codeFontFamily:font-family-code',
    'headingFontSize:heading-font-size', 'headingFontWeight:heading-font-weight'];
  for (const entry of optionalTypo) {
    const [key, varName] = entry.split(':');
    if (tokens.typography[key]) lines.push(`  --${varName}: ${tokens.typography[key]};`);
  }
  lines.push(`  --font-size: ${tokens.typography.fontSize};`);
  lines.push(`  --font-weight: ${tokens.typography.fontWeight};`);
  lines.push(`  --line-height: ${tokens.typography.lineHeight};`);
  if (tokens.typography.letterSpacing) lines.push(`  --letter-spacing: ${tokens.typography.letterSpacing};`);

  if (tokens.spacing.containerMaxWidth) lines.push(`  --container-max-width: ${tokens.spacing.containerMaxWidth};`);
  if (tokens.effects.borderRadius.length) lines.push(`  --border-radius: ${tokens.effects.borderRadius[0]};`);

  lines.push('}');
  return lines.join('\n');
}

try {
  console.error(`Extracting tokens from ${inputUrl}...`);
  const tokens = await extractTokens(inputUrl);
  const output = format === 'css' ? toCSS(tokens) : JSON.stringify(tokens, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, output);
    console.error(`Written to ${outputPath}`);
  } else {
    console.log(output);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
