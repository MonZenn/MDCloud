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

function findBestOccurrenceIndex(
  content: string,
  target: string,
  context?: AnchorContext
): number {
  if (!content || !target) return -1;
  const indices: number[] = [];
  let idx = content.indexOf(target);
  while (idx !== -1) {
    indices.push(idx);
    idx = content.indexOf(target, idx + 1);
  }

  if (indices.length === 0) return -1;
  if (indices.length === 1 || (!context?.prefix && !context?.suffix)) return indices[0];

  let bestIndex = indices[0];
  let highestScore = -1;

  for (const matchIdx of indices) {
    const currentScore = scoreMatch(content, matchIdx, target.length, context?.prefix, context?.suffix);
    if (currentScore > highestScore) {
      highestScore = currentScore;
      bestIndex = matchIdx;
    }
  }

  return bestIndex;
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

  const targetIndex = findBestOccurrenceIndex(content, trimmed, context);
  if (targetIndex === -1) return content;

  const colorAttr = color && color !== 'yellow' ? ` data-color="${escapeHtmlAttr(color)}"` : '';
  const replacement = `<mark${colorAttr}>${trimmed}</mark>`;
  return content.slice(0, targetIndex) + replacement + content.slice(targetIndex + trimmed.length);
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

  const targetIndex = findBestOccurrenceIndex(content, trimmedText, context);
  if (targetIndex === -1) return content;

  const sanitized = escapeHtmlAttr(comment.trim());
  const colorAttr = color && color !== 'yellow' ? ` data-color="${escapeHtmlAttr(color)}"` : '';
  const replacement = `<mark${colorAttr} data-comment="${sanitized}">${trimmedText}</mark>`;
  return content.slice(0, targetIndex) + replacement + content.slice(targetIndex + trimmedText.length);
}

export function removeHighlightFromMarkdown(
  content: string,
  selectedText: string,
  comment?: string,
  context?: AnchorContext
): string {
  const trimmedText = selectedText.trim();
  if (!trimmedText) return content;

  const innerPattern = `(?:\\*\\*|__)?${escapeRegex(trimmedText)}(?:\\*\\*|__)?`;
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

  const innerPattern = `(?:\\*\\*|__)?${escapeRegex(trimmedText)}(?:\\*\\*|__)?`;
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

  const innerPattern = `(?:\\*\\*|__)?${escapeRegex(trimmedText)}(?:\\*\\*|__)?`;
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
