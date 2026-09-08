import katex from "katex";

/**
 * Render LaTeX string to HTML string using KaTeX.
 * Wraps $...$ for inline and $$...$$ for display math.
 */
export function renderMath(text, displayMode = false) {
  try {
    return katex.renderToString(text, {
      throwOnError: false,
      displayMode,
      output: "html",
      trust: true,
    });
  } catch (e) {
    return `<span style="color:red">${text}</span>`;
  }
}

/**
 * Parse text with mixed LaTeX/text and return HTML.
 * Supports $...$ inline and $$...$$ display math.
 */
export function renderMixedMath(text) {
  if (!text) return "";

  // Handle display math $$...$$
  let result = text.replace(/\$\$([^$]+)\$\$/g, (_, math) =>
    `<span class="math-display">${renderMath(math.trim(), true)}</span>`
  );

  // Handle inline math $...$
  result = result.replace(/\$([^$]+)\$/g, (_, math) =>
    `<span class="math-inline">${renderMath(math.trim(), false)}</span>`
  );

  // Convert newlines to <br>
  result = result.replace(/\n/g, "<br>");

  return result;
}

/**
 * Convert KaTeX-rendered HTML to a data URL (via SVG foreignObject)
 * for embedding into Fabric.js canvas as an image.
 */
export async function mathToDataUrl(latex, color = "#000000", fontSize = 24) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: true,
    output: "html",
  });

  const style = `
    <style>
      @import url("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css");
      body { margin: 8px; }
      .katex { font-size: ${fontSize}px; color: ${color}; }
    </style>
  `;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="120">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${style}
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;

  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
}

export const COMMON_SYMBOLS = [
  { label: "½", latex: "\\frac{1}{2}" },
  { label: "√", latex: "\\sqrt{x}" },
  { label: "π", latex: "\\pi" },
  { label: "∞", latex: "\\infty" },
  { label: "∫", latex: "\\int" },
  { label: "∑", latex: "\\sum" },
  { label: "∂", latex: "\\partial" },
  { label: "≤", latex: "\\leq" },
  { label: "≥", latex: "\\geq" },
  { label: "≠", latex: "\\neq" },
  { label: "±", latex: "\\pm" },
  { label: "×", latex: "\\times" },
  { label: "÷", latex: "\\div" },
  { label: "α", latex: "\\alpha" },
  { label: "β", latex: "\\beta" },
  { label: "θ", latex: "\\theta" },
  { label: "Δ", latex: "\\Delta" },
  { label: "x²", latex: "x^2" },
  { label: "xⁿ", latex: "x^n" },
  { label: "logₐ", latex: "\\log_a" },
];