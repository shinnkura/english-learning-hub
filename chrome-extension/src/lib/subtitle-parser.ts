import type { SubtitleCue, SubtitleTrack } from '@/types';

/**
 * Parse time string to seconds
 * Supports formats: HH:MM:SS,mmm (SRT) and HH:MM:SS.mmm (VTT)
 */
function parseTime(timeStr: string): number {
  const cleanTime = timeStr.trim().replace(',', '.');
  const parts = cleanTime.split(':');

  if (parts.length === 3) {
    const [hours, minutes, secondsMs] = parts;
    const [seconds, ms = '0'] = secondsMs.split('.');
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseFloat(`${seconds}.${ms}`)
    );
  } else if (parts.length === 2) {
    const [minutes, secondsMs] = parts;
    const [seconds, ms = '0'] = secondsMs.split('.');
    return parseInt(minutes, 10) * 60 + parseFloat(`${seconds}.${ms}`);
  }

  return 0;
}

/**
 * Parse SRT subtitle format
 */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    // First line is the cue number
    const id = lines[0].trim();

    // Second line is the timing
    const timingMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/
    );
    if (!timingMatch) continue;

    const startTime = parseTime(timingMatch[1]);
    const endTime = parseTime(timingMatch[2]);

    // Remaining lines are the text
    const text = lines.slice(2).join('\n').trim();

    cues.push({
      id,
      startTime,
      endTime,
      text,
    });
  }

  return cues;
}

/**
 * Parse VTT (WebVTT) subtitle format
 */
export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // Remove the WEBVTT header and any metadata
  const lines = content.split('\n');
  let startIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('-->')) {
      // Found first timing line, start from previous line (cue id or empty)
      startIndex = i > 0 && lines[i - 1].trim() ? i - 1 : i;
      break;
    }
  }

  const blocks = lines.slice(startIndex).join('\n').trim().split(/\n\n+/);

  for (const block of blocks) {
    const blockLines = block.split('\n').filter((l) => l.trim());
    if (blockLines.length < 2) continue;

    let id: string;
    let timingLine: string;
    let textStartIndex: number;

    // Check if first line is timing or cue id
    if (blockLines[0].includes('-->')) {
      id = `cue-${cues.length + 1}`;
      timingLine = blockLines[0];
      textStartIndex = 1;
    } else {
      id = blockLines[0].trim();
      timingLine = blockLines[1];
      textStartIndex = 2;
    }

    // Parse timing (can have optional position/alignment info after times)
    const timingMatch = timingLine.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/
    );
    if (!timingMatch) continue;

    const startTime = parseTime(timingMatch[1]);
    const endTime = parseTime(timingMatch[2]);

    // Get text lines
    const text = blockLines
      .slice(textStartIndex)
      .join('\n')
      .replace(/<[^>]+>/g, '') // Remove HTML tags like <c.speaker>
      .trim();

    cues.push({
      id,
      startTime,
      endTime,
      text,
    });
  }

  return cues;
}

/**
 * Auto-detect format and parse subtitle file
 */
export function parseSubtitle(content: string, filename?: string): SubtitleCue[] {
  // Detect format by content or filename
  const isVTT =
    content.trim().startsWith('WEBVTT') ||
    filename?.toLowerCase().endsWith('.vtt');

  if (isVTT) {
    return parseVTT(content);
  }
  return parseSRT(content);
}

/**
 * Create a subtitle track from parsed cues
 */
export function createSubtitleTrack(
  cues: SubtitleCue[],
  language = 'en',
  label = 'Custom Subtitles'
): SubtitleTrack {
  return {
    id: `track-${Date.now()}`,
    language,
    label,
    cues,
  };
}

/**
 * Find the current cue based on video time
 */
export function findCurrentCue(
  cues: SubtitleCue[],
  currentTime: number
): SubtitleCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
      return cue;
    }
  }
  return null;
}

/**
 * Apply time offset to all cues
 */
export function applyTimeOffset(
  cues: SubtitleCue[],
  offsetSeconds: number
): SubtitleCue[] {
  return cues.map((cue) => ({
    ...cue,
    startTime: Math.max(0, cue.startTime + offsetSeconds),
    endTime: Math.max(0, cue.endTime + offsetSeconds),
  }));
}
