import { describe, expect, it } from "vitest";
import {
  normalizeMathAndChemistry,
  normalizeMatrixMath,
} from "../src/features/shared/components/question-card/rendering/latexNormalize";

describe("normalizeMatrixMath", () => {
  const matrix =
    String.raw`\begin{bmatrix} 2x + 3y &= 7 \\ 4x - y &= 5 \end{bmatrix}`;

  it("promotes a single-dollar matrix to display math", () => {
    expect(normalizeMatrixMath(`$${matrix}$`)).toBe(`$$${matrix}$$`);
  });

  it("repairs a matrix with only one surrounding dollar delimiter", () => {
    expect(normalizeMatrixMath(`$${matrix}`)).toBe(`$$${matrix}$$`);
    expect(normalizeMatrixMath(`${matrix}$`)).toBe(`$$${matrix}$$`);
  });

  it("adds display delimiters when a matrix has no math delimiters", () => {
    expect(normalizeMatrixMath(matrix)).toBe(`$$${matrix}$$`);
  });

  it("repairs single-backslash row breaks only when enabled", () => {
    const corrupted = String.raw`\begin{bmatrix}2x + 3y = 7 \ 4x - y = 5\end{bmatrix}`;
    const repaired = String.raw`\begin{bmatrix}2x + 3y = 7 \\ 4x - y = 5\end{bmatrix}`;

    expect(normalizeMatrixMath(corrupted)).toBe(`$$${corrupted}$$`);
    expect(normalizeMatrixMath(corrupted, true)).toBe(`$$${repaired}$$`);
  });

  it("repairs single-backslash row breaks followed by a newline", () => {
    const corrupted =
      String.raw`\begin{matrix}a+b=c ` + "\\" + "\n" + String.raw`x+y=z\end{matrix}`;
    const repaired =
      String.raw`\begin{matrix}a+b=c ` + "\\\\" + "\n" + String.raw`x+y=z\end{matrix}`;

    expect(normalizeMatrixMath(corrupted, true)).toBe(`$$${repaired}$$`);
  });

  it("reduces repeated column separators to one when enabled", () => {
    const corrupted = String.raw`\begin{bmatrix}a && b \\ c &&& d\end{bmatrix}`;
    const repaired = String.raw`\begin{bmatrix}a & b \\ c & d\end{bmatrix}`;

    expect(normalizeMatrixMath(corrupted)).toBe(`$$${corrupted}$$`);
    expect(normalizeMatrixMath(corrupted, true)).toBe(`$$${repaired}$$`);
  });

  it("repairs rows and columns inside existing display math", () => {
    const corrupted = String.raw`$$\begin{matrix}a && b \ c &&& d\end{matrix}$$`;
    const repaired = String.raw`$$\begin{matrix}a & b \\ c & d\end{matrix}$$`;

    expect(normalizeMatrixMath(corrupted, true)).toBe(repaired);
  });

  it("preserves existing row breaks, LaTeX commands, and escaped ampersands", () => {
    const content = String.raw`\begin{matrix}\alpha && \text{A \& B} \\ x &&& y\end{matrix}`;
    const repaired = String.raw`\begin{matrix}\alpha & \text{A \& B} \\ x & y\end{matrix}`;

    expect(normalizeMatrixMath(content, true)).toBe(`$$${repaired}$$`);
  });

  it("promotes the complete inline expression containing a matrix", () => {
    expect(normalizeMatrixMath(`$${matrix} + x$`)).toBe(`$$${matrix} + x$$`);
  });

  it("preserves an existing display-math matrix unchanged", () => {
    expect(normalizeMatrixMath(`$$${matrix}$$`)).toBe(`$$${matrix}$$`);
  });

  it("leaves non-matrix content unchanged", () => {
    const text = String.raw`$\frac{1}{2} + x$`;
    expect(normalizeMatrixMath(text)).toBe(text);
  });

  it("runs as part of the shared normalization pipeline", () => {
    const normalized = normalizeMathAndChemistry(`$${matrix}$`);

    expect(normalized).toContain(`$$${matrix}$$`);
  });

  it("enables row and column repairs through normalization options", () => {
    const corrupted = String.raw`$\begin{bmatrix}a && b \ c &&& d\end{bmatrix}$`;
    const normalized = normalizeMathAndChemistry(corrupted, {
      shouldRepairRowsAndColumns: true,
    });

    expect(normalized).toContain(
      String.raw`$$\begin{bmatrix}a & b \\ c & d\end{bmatrix}$$`,
    );
  });
});
