export interface AnchorContext {
  prefix?: string;
  suffix?: string;
}

const escapeHtmlAttr = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

function scoreMatch(
  content: string,
  startIndex: number,
  length: number,
  prefix?: string,
  suffix?: string
): number {
  let score = 0;
  if (prefix) {
    const actualPrefix = content.slice(Math.max(0, startIndex - prefix.length), startIndex);
    let commonChars = 0;
    const minLen = Math.min(prefix.length, actualPrefix.length);
    for (let i = 1; i <= minLen; i++) {
      if (prefix[prefix.length - i] === actualPrefix[actualPrefix.length - i]) {
        commonChars++;
      } else {
        break;
      }
    }
    score += commonChars * 2;
  }
  if (suffix) {
    const actualSuffix = content.slice(startIndex + length, startIndex + length + suffix.length);
    let commonChars = 0;
    const minLen = Math.min(suffix.length, actualSuffix.length);
    for (let i = 0; i < minLen; i++) {
      if (suffix[i] === actualSuffix[i]) {
        commonChars++;
      } else {
        break;
      }
    }
    score += commonChars * 2;
  }
  return score;
}

export function normalizeText(str: string): string {
  return str
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

export interface MatchedOccurrence {
  index: number;
  length: number;
  matchedText: string;
}

export function findOccurrence(
  content: string,
  target: string,
  context?: AnchorContext
): MatchedOccurrence | null {
  if (!content || !target) return null;

  const normalizedTarget = normalizeText(target).trim();
  if (!normalizedTarget) return null;

  // 1. Direct search with original target
  const directIndices: number[] = [];
  let idx = content.indexOf(target);
  while (idx !== -1) {
    directIndices.push(idx);
    idx = content.indexOf(target, idx + 1);
  }

  // 2. Direct search with normalized target if different
  if (directIndices.length === 0 && normalizedTarget !== target) {
    let normIdx = content.indexOf(normalizedTarget);
    while (normIdx !== -1) {
      directIndices.push(normIdx);
      normIdx = content.indexOf(normalizedTarget, normIdx + 1);
    }
  }

  if (directIndices.length > 0) {
    let bestIndex = directIndices[0];
    let highestScore = -1;
    for (const matchIdx of directIndices) {
      const currentScore = scoreMatch(content, matchIdx, normalizedTarget.length, context?.prefix, context?.suffix);
      if (currentScore > highestScore) {
        highestScore = currentScore;
        bestIndex = matchIdx;
      }
    }
    const matchedText = content.slice(bestIndex, bestIndex + normalizedTarget.length);
    return {
      index: bestIndex,
      length: normalizedTarget.length,
      matchedText,
    };
  }

  // 3. Flexible regex matching: handles newlines, extra spaces, and inline markdown styling
  const tokens = normalizedTarget.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const pattern = tokens.map(escapeRegex).join('(?:\\s+|\\s*[*_~`]+\\s*)');
  let regex = new RegExp(pattern, 'g');
  let matches = Array.from(content.matchAll(regex));

  if (matches.length === 0) {
    // Try case-insensitive fallback
    regex = new RegExp(pattern, 'gi');
    matches = Array.from(content.matchAll(regex));
  }

  if (matches.length === 0) return null;

  let bestMatch = matches[0];
  let highestScore = -1;

  for (const m of matches) {
    const matchIdx = m.index ?? 0;
    const matchLen = m[0].length;
    const currentScore = scoreMatch(content, matchIdx, matchLen, context?.prefix, context?.suffix);
    if (currentScore > highestScore) {
      highestScore = currentScore;
      bestMatch = m;
    }
  }

  return {
    index: bestMatch.index ?? 0,
    length: bestMatch[0].length,
    matchedText: bestMatch[0],
  };
}

export function findBestOccurrenceIndex(
  content: string,
  target: string,
  context?: AnchorContext
): number {
  const occ = findOccurrence(content, target, context);
  return occ ? occ.index : -1;
}

export type HighlightColor = 'yellow' | 'red' | 'green' | 'blue' | 'orange' | 'pink' | 'purple';

export function addHighlightToMarkdown(
  content: string,
  selectedText: string,
  context?: AnchorContext,
  color?: string
): string {
  const trimmed = selectedText.trim();
  if (!trimmed) return content;

  const occ = findOccurrence(content, trimmed, context);
  if (!occ) return content;

  const colorAttr = color && color !== 'yellow' ? ` data-color="${escapeHtmlAttr(color)}"` : '';
  const replacement = `<mark${colorAttr}>${occ.matchedText}</mark>`;
  return content.slice(0, occ.index) + replacement + content.slice(occ.index + occ.length);
}

export function addCommentToMarkdown(
  content: string,
  selectedText: string,
  comment: string,
  context?: AnchorContext,
  color?: string
): string {
  const trimmedText = selectedText.trim();
  if (!trimmedText) return content;

  const occ = findOccurrence(content, trimmedText, context);
  if (!occ) return content;

  const sanitized = escapeHtmlAttr(comment.trim());
  const colorAttr = color && color !== 'yellow' ? ` data-color="${escapeHtmlAttr(color)}"` : '';
  const replacement = `<mark${colorAttr} data-comment="${sanitized}">${occ.matchedText}</mark>`;
  return content.slice(0, occ.index) + replacement + content.slice(occ.index + occ.length);
}

function makeInnerPattern(text: string): string {
  const norm = normalizeText(text).trim();
  const tokens = norm.split(/\s+/).filter(Boolean);
  const tokenPattern = tokens.length > 0 ? tokens.map(escapeRegex).join('(?:\\s+|\\s*[*_~`]+\\s*)') : escapeRegex(norm);
  const escapedOrig = escapeRegex(text.trim());
  const body = escapedOrig === tokenPattern ? tokenPattern : `(?:${tokenPattern}|${escapedOrig})`;
  return `(?:\\*\\*|__)?${body}(?:\\*\\*|__)?`;
}

export function removeHighlightFromMarkdown(
  content: string,
  selectedText: string,
  comment?: string,
  context?: AnchorContext
): string {
  const trimmedText = selectedText.trim();
  if (!trimmedText) return content;

  const innerPattern = makeInnerPattern(trimmedText);
  let candidateMatches: RegExpExecArray[] = [];

  if (comment !== undefined && comment.trim() !== '') {
    const escapedComment = escapeRegex(escapeHtmlAttr(comment.trim()));
    const commentRegex = new RegExp(
      `<mark(?:\\s+[^>]*)?\\s+data-comment="${escapedComment}"[^>]*>(${innerPattern})<\\/mark>`,
      'g'
    );
    const commentMatches = Array.from(content.matchAll(commentRegex));
    if (commentMatches.length > 0) {
      candidateMatches = commentMatches;
    }
  }

  if (candidateMatches.length === 0) {
    const markRegex = new RegExp(`<mark(?:\\s+[^>]*)?>(${innerPattern})<\\/mark>`, 'g');
    const equalRegex = new RegExp(`==(${innerPattern})==`, 'g');
    candidateMatches = [
      ...Array.from(content.matchAll(markRegex)),
      ...Array.from(content.matchAll(equalRegex)),
    ];
    candidateMatches.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  if (candidateMatches.length === 0) return content;

  let chosenMatch = candidateMatches[0];
  if (candidateMatches.length > 1 && (context?.prefix || context?.suffix)) {
    let highest = -1;
    for (const m of candidateMatches) {
      const idx = m.index ?? 0;
      const score = scoreMatch(content, idx, m[0].length, context?.prefix, context?.suffix);
      if (score > highest) {
        highest = score;
        chosenMatch = m;
      }
    }
  }

  const matchIndex = chosenMatch.index ?? 0;
  const innerContent = chosenMatch[1] || trimmedText;
  return content.slice(0, matchIndex) + innerContent + content.slice(matchIndex + chosenMatch[0].length);
}

export function updateCommentInMarkdown(
  content: string,
  selectedText: string,
  oldComment: string,
  newComment: string,
  context?: AnchorContext
): string {
  const trimmedText = selectedText.trim();
  if (!trimmedText) return content;

  const innerPattern = makeInnerPattern(trimmedText);
  let targetMatches: RegExpExecArray[] = [];

  if (oldComment && oldComment.trim() !== '') {
    const escapedOld = escapeRegex(escapeHtmlAttr(oldComment.trim()));
    const regex = new RegExp(
      `<mark(?:\\s+[^>]*)?\\s+data-comment="${escapedOld}"[^>]*>(${innerPattern})<\\/mark>`,
      'g'
    );
    targetMatches = Array.from(content.matchAll(regex));
  }

  if (targetMatches.length === 0) {
    // If not found with exact comment attribute, search for any mark or ==text== with innerPattern
    const fallbackRegex = new RegExp(`<mark(?:\\s+[^>]*)?>(${innerPattern})<\\/mark>`, 'g');
    const equalRegex = new RegExp(`==(${innerPattern})==`, 'g');
    targetMatches = [
      ...Array.from(content.matchAll(fallbackRegex)),
      ...Array.from(content.matchAll(equalRegex)),
    ];
    targetMatches.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (targetMatches.length === 0) return content;
  }

  let chosen = targetMatches[0];
  if (targetMatches.length > 1 && (context?.prefix || context?.suffix)) {
    let highest = -1;
    for (const m of targetMatches) {
      const idx = m.index ?? 0;
      const score = scoreMatch(content, idx, m[0].length, context?.prefix, context?.suffix);
      if (score > highest) {
        highest = score;
        chosen = m;
      }
    }
  }

  const matchIndex = chosen.index ?? 0;
  const fullMatched = chosen[0];
  const innerContent = chosen[1] || trimmedText;
  const colorMatch = fullMatched.match(/data-color="([^"]*)"/);
  const colorAttr = colorMatch ? ` data-color="${colorMatch[1]}"` : '';
  const sanitized = escapeHtmlAttr(newComment.trim());
  const replacement = `<mark${colorAttr} data-comment="${sanitized}">${innerContent}</mark>`;
  return content.slice(0, matchIndex) + replacement + content.slice(matchIndex + fullMatched.length);
}

export function updateHighlightColorInMarkdown(
  content: string,
  selectedText: string,
  newColor: string,
  oldColor?: string,
  comment?: string,
  context?: AnchorContext
): string {
  const trimmedText = selectedText.trim();
  if (!trimmedText) return content;

  const innerPattern = makeInnerPattern(trimmedText);
  let candidateMatches: RegExpExecArray[] = [];

  if (oldColor) {
    const escapedOldColor = escapeRegex(escapeHtmlAttr(oldColor.trim()));
    const colorRegex = new RegExp(
      `<mark(?:\\s+[^>]*)?\\s+data-color="${escapedOldColor}"[^>]*>(${innerPattern})<\\/mark>`,
      'g'
    );
    const colorMatches = Array.from(content.matchAll(colorRegex));
    if (colorMatches.length > 0) {
      candidateMatches = colorMatches;
    }
  }

  if (candidateMatches.length === 0) {
    const markRegex = new RegExp(`<mark(?:\\s+[^>]*)?>(${innerPattern})<\\/mark>`, 'g');
    const equalRegex = new RegExp(`==(${innerPattern})==`, 'g');
    candidateMatches = [
      ...Array.from(content.matchAll(markRegex)),
      ...Array.from(content.matchAll(equalRegex)),
    ];
    candidateMatches.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (candidateMatches.length === 0) return content;
  }

  let chosen = candidateMatches[0];
  if (candidateMatches.length > 1 && (context?.prefix || context?.suffix)) {
    let highest = -1;
    for (const m of candidateMatches) {
      const idx = m.index ?? 0;
      const score = scoreMatch(content, idx, m[0].length, context?.prefix, context?.suffix);
      if (score > highest) {
        highest = score;
        chosen = m;
      }
    }
  }

  const fullMatched = chosen[0];
  const matchIndex = chosen.index ?? 0;
  const innerContent = chosen[1] || trimmedText;

  // Preserve existing comment if present
  let existingComment = comment;
  if (!existingComment) {
    const commentMatch = fullMatched.match(/data-comment="([^"]*)"/);
    if (commentMatch) {
      existingComment = commentMatch[1];
    }
  }

  const colorAttr = newColor && newColor !== 'yellow' ? ` data-color="${escapeHtmlAttr(newColor)}"` : '';
  const commentAttr = existingComment ? ` data-comment="${escapeHtmlAttr(existingComment)}"` : '';
  const replacement = `<mark${colorAttr}${commentAttr}>${innerContent}</mark>`;
  return content.slice(0, matchIndex) + replacement + content.slice(matchIndex + fullMatched.length);
}
