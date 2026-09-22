const CHAR_EM = 0.72;
const LABEL_FONT_SIZE = 13;

export function responsiveFieldMinWidth(options: {
  chrome: number;
  fontScale: number;
  fontSize?: number;
  label?: string;
  maxWidth: number;
  text: string;
}): number {
  const fontSize = options.fontSize ?? 15;
  const scale = options.fontScale > 0 ? options.fontScale : 1;
  const sample = options.text.length > 0 ? options.text : '0';
  const textWidth = Math.ceil(sample.length * fontSize * CHAR_EM * scale);
  const labelWidth = longestWordWidth(options.label ?? '', scale);
  const needed = Math.max(textWidth, labelWidth) + options.chrome;
  const cap = Math.max(1, options.maxWidth);
  return Math.min(needed, cap);
}

/** Shrink the input only when the full string cannot fit on its own row. */
export function responsiveInputFontSize(options: {
  chrome: number;
  fontScale: number;
  fontSize?: number;
  maxWidth: number;
  text: string;
}): number {
  const fontSize = options.fontSize ?? 15;
  const scale = options.fontScale > 0 ? options.fontScale : 1;
  if (options.text.length === 0) {
    return fontSize;
  }

  const natural = Math.ceil(options.text.length * fontSize * CHAR_EM * scale);
  const available = options.maxWidth - options.chrome;
  if (available <= 0 || natural <= available) {
    return fontSize;
  }

  return Math.max(11, (fontSize * available) / natural);
}

function longestWordWidth(label: string, scale: number): number {
  const words = label.split(/\s+/).filter((word) => word.length > 0);
  return words.reduce((max, word) => {
    return Math.max(max, Math.ceil(word.length * LABEL_FONT_SIZE * CHAR_EM * scale));
  }, 0);
}
