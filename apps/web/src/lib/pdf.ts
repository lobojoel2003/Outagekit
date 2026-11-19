import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { CardContent } from './card';

const INK = rgb(0.043, 0.071, 0.125);
const AMBER = rgb(0.961, 0.647, 0.141);
const RED = rgb(0.74, 0.17, 0.12);
const MUTED = rgb(0.33, 0.36, 0.42);
const PAPER = rgb(0.973, 0.965, 0.945);
const WHITE = rgb(1, 1, 1);
const LINE = rgb(0.85, 0.83, 0.79);

export const PAPER_SIZES = {
  letter: [612, 792],
  a4: [595.28, 841.89],
} as const;

const REPLACEMENTS: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '→': '->',
  '←': '<-',
  '✓': 'v',
  '≈': '~',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
};

// Characters outside Latin-1 that the standard PDF fonts (WinAnsi) can draw.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Make text safe for the built-in PDF fonts, which only cover Western European characters. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (REPLACEMENTS[char] !== undefined) out += REPLACEMENTS[char];
    else if (code === 0x09 || code === 0x0a) out += ' ';
    else if (
      (code >= 0x20 && code < 0x7f) ||
      (code >= 0xa0 && code <= 0xff) ||
      WIN_ANSI_EXTRA.has(char)
    )
      out += char;
    else out += '?';
  }
  return out;
}

/** Split text into lines that fit a width. */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // Break very long words (such as URLs) by character.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let piece = '';
      for (const char of word) {
        if (font.widthOfTextAtSize(piece + char, size) > maxWidth) {
          lines.push(piece);
          piece = char;
        } else piece += char;
      }
      line = piece;
    } else line = word;
  }
  if (line) lines.push(line);
  return lines;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Pen {
  page: PDFPage | null;
  fonts: Fonts;
  x: number;
  width: number;
  y: number;
}

function text(
  pen: Pen,
  value: string,
  size: number,
  font: PDFFont,
  color: RGB,
  indent = 0,
  gap = 1.3,
): void {
  const lines = wrap(value, font, size, pen.width - indent);
  for (const line of lines) {
    pen.y -= size * gap;
    pen.page?.drawText(line, { x: pen.x + indent, y: pen.y + size * 0.25, size, font, color });
  }
}

/**
 * Lay the card out at a scale. With no page it only measures, so we can find
 * the largest scale that fits on one sheet.
 */
function layout(
  content: CardContent,
  fonts: Fonts,
  page: PDFPage | null,
  size: readonly [number, number],
  scale: number,
): number {
  const [width, height] = size;
  const margin = 36;
  const s = (value: number) => value * scale;
  const pen: Pen = { page, fonts, x: margin, width: width - margin * 2, y: height - margin };

  // Header band.
  const bandHeight = s(62);
  page?.drawRectangle({
    x: margin,
    y: pen.y - bandHeight,
    width: pen.width,
    height: bandHeight,
    color: INK,
  });
  page?.drawRectangle({
    x: margin,
    y: pen.y - bandHeight,
    width: s(8),
    height: bandHeight,
    color: AMBER,
  });
  page?.drawText(pdfSafe(content.title.toUpperCase()), {
    x: margin + s(22),
    y: pen.y - s(30),
    size: s(22),
    font: fonts.bold,
    color: WHITE,
  });
  const who = [content.personName, content.address].filter(Boolean).join(' · ');
  if (who) {
    page?.drawText(pdfSafe(who).slice(0, 110), {
      x: margin + s(22),
      y: pen.y - s(50),
      size: s(11),
      font: fonts.regular,
      color: rgb(0.85, 0.87, 0.92),
    });
  }
  pen.y -= bandHeight + s(10);

  if (content.criticalLine) {
    const lines = wrap(content.criticalLine, fonts.bold, s(12), pen.width - s(20));
    const boxHeight = lines.length * s(12) * 1.3 + s(12);
    page?.drawRectangle({
      x: margin,
      y: pen.y - boxHeight,
      width: pen.width,
      height: boxHeight,
      borderColor: RED,
      borderWidth: 2,
      color: rgb(1, 0.95, 0.94),
    });
    pen.y -= s(6);
    for (const line of lines) {
      pen.y -= s(12) * 1.3;
      page?.drawText(line, {
        x: margin + s(10),
        y: pen.y + s(3),
        size: s(12),
        font: fonts.bold,
        color: RED,
      });
    }
    pen.y -= s(6) + s(8);
  }

  if (content.medicalNote || content.phone) {
    const note = [content.medicalNote, content.phone ? `Phone: ${content.phone}` : '']
      .filter(Boolean)
      .join('  ·  ');
    text(pen, note, s(11), fonts.regular, INK);
    pen.y -= s(6);
  }

  // Runtime box.
  const boxTop = pen.y;
  const boxHeight = s(78);
  page?.drawRectangle({
    x: margin,
    y: boxTop - boxHeight,
    width: pen.width,
    height: boxHeight,
    color: PAPER,
    borderColor: LINE,
    borderWidth: 1,
  });
  const columns = content.runtimeMedical ? 3 : 2;
  const colWidth = pen.width / columns;
  const drawStat = (col: number, label: string, value: string, sub: string) => {
    const x = margin + col * colWidth + s(14);
    page?.drawText(pdfSafe(label), {
      x,
      y: boxTop - s(18),
      size: s(9.5),
      font: fonts.bold,
      color: MUTED,
    });
    const valueLines = wrap(value, fonts.bold, s(20), colWidth - s(24));
    valueLines.slice(0, 2).forEach((line, i) => {
      page?.drawText(line, {
        x,
        y: boxTop - s(42) - i * s(20),
        size: s(20),
        font: fonts.bold,
        color: INK,
      });
    });
    if (valueLines.length < 2) {
      page?.drawText(pdfSafe(sub).slice(0, 60), {
        x,
        y: boxTop - s(62),
        size: s(9),
        font: fonts.regular,
        color: MUTED,
      });
    }
  };
  drawStat(0, 'BATTERY LASTS ABOUT', content.runtimeAll, 'with everything on');
  if (content.runtimeMedical)
    drawStat(1, 'MEDICAL EQUIPMENT ONLY', content.runtimeMedical, 'after switching off the rest');
  drawStat(columns - 1, 'WHEN TO LEAVE', content.leaveValue, content.leaveSub);
  pen.y = boxTop - boxHeight;
  text(pen, content.sourceLine, s(9), fonts.regular, MUTED);
  pen.y -= s(8);

  // Steps.
  content.steps.forEach((step, index) => {
    pen.y -= s(4);
    const top = pen.y;
    const circleX = margin + s(11);
    const indent = s(30);
    text(pen, step.title, s(13.5), fonts.bold, step.tone === 'urgent' ? RED : INK, indent);
    page?.drawCircle({
      x: circleX,
      y: top - s(8),
      size: s(10),
      color: step.tone === 'urgent' ? RED : INK,
    });
    const label = String(index + 1);
    page?.drawText(label, {
      x: circleX - fonts.bold.widthOfTextAtSize(label, s(11)) / 2,
      y: top - s(12),
      size: s(11),
      font: fonts.bold,
      color: WHITE,
    });
    if (step.headline) text(pen, step.headline, s(11.5), fonts.bold, INK, indent);
    for (const line of step.lines) {
      const before = pen.y;
      text(pen, line, s(10.5), fonts.regular, INK, indent + s(10));
      page?.drawCircle({
        x: margin + indent + s(3),
        y: before - s(10.5) * 0.9,
        size: s(1.6),
        color: MUTED,
      });
    }
  });

  // Devices.
  if (content.devices.length) {
    pen.y -= s(10);
    page?.drawLine({
      start: { x: margin, y: pen.y },
      end: { x: margin + pen.width, y: pen.y },
      thickness: 1,
      color: LINE,
    });
    text(pen, 'EQUIPMENT ON THE BATTERY', s(9.5), fonts.bold, MUTED);
    pen.y -= s(2);
    for (const device of content.devices) {
      const rowTop = pen.y;
      const name = device.detail ? `${device.name}  (${device.detail})` : device.name;
      const wattsWidth = fonts.regular.widthOfTextAtSize(pdfSafe(device.watts), s(10));
      const saved = pen.width;
      pen.width = saved - wattsWidth - s(12);
      text(pen, name, s(10), fonts.regular, INK, 0, 1.25);
      pen.width = saved;
      page?.drawText(pdfSafe(device.watts), {
        x: margin + pen.width - wattsWidth,
        y: rowTop - s(10) * 1.25 + s(2.5),
        size: s(10),
        font: fonts.regular,
        color: MUTED,
      });
    }
  }

  if (content.extraNotes) {
    pen.y -= s(8);
    text(pen, 'NOTES', s(9.5), fonts.bold, MUTED);
    text(pen, content.extraNotes, s(10.5), fonts.regular, INK);
  }

  // Footer.
  pen.y -= s(10);
  text(pen, content.footer, s(8), fonts.regular, MUTED);
  return height - margin - pen.y;
}

/** Find the largest scale at which the card fits one page. */
export function fitScale(measure: (scale: number) => number, available: number): number {
  for (let scale = 1.15; scale >= 0.55; scale -= 0.05) {
    if (measure(scale) <= available) return scale;
  }
  return 0.55;
}

export async function buildCardPdf(
  content: CardContent,
  paper: keyof typeof PAPER_SIZES = 'letter',
): Promise<Uint8Array> {
  const size = PAPER_SIZES[paper];
  const doc = await PDFDocument.create();
  doc.setTitle(
    pdfSafe(`${content.title}${content.personName ? ` for ${content.personName}` : ''}`),
  );
  doc.setSubject('Power outage plan for electric medical equipment');
  doc.setCreator('Outagekit');
  doc.setProducer('Outagekit (pdf-lib)');
  doc.setKeywords(['power outage', 'medical equipment', 'emergency plan']);
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const available = size[1] - 72;
  const scale = fitScale((s) => layout(content, fonts, null, size, s), available);
  const page = doc.addPage([size[0], size[1]]);
  layout(content, fonts, page, size, scale);
  return doc.save();
}

export function cardFileName(personName: string): string {
  const slug = personName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `outage-plan-${slug}.pdf` : 'outage-plan.pdf';
}
