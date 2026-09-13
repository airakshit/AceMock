import { describe, it, expect } from "vitest";
import { mergeOcrResults } from "../src/inngest/functions/extract-questions/merge-ocr-results";
import type { OcrPageResult } from "../src/inngest/functions/extract-questions/ocr-types";

describe("Order-based multi-page passage assignment system", () => {
  const PASSAGE_1 =
    "In ancient Mesopotamia, the Sumerians developed one of the earliest systems of writing known as cuneiform. They constructed massive stepped towers called ziggurats and developed sophisticated irrigation canals along the Tigris and Euphrates rivers.";

  const PASSAGE_2 =
    "Quantum computing leverages the fundamental principles of quantum mechanics such as superposition and entanglement. Unlike classical bits that represent either 0 or 1, qubits can exist in a linear combination of both states simultaneously.";

  it("assigns passage ID ONLY to comprehension questions on a page containing both Maths and Comprehension questions", () => {
    // Scenario: Page 4 has 4 Maths questions, 1 passage, and 5 comprehension questions
    const page4: OcrPageResult = {
      pageNo: 4,
      pageId: "page-4",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_1,
        data: [
          // 4 Maths questions
          {
            serialNo: 37,
            subject: "maths",
            question: "Find the roots of $x^2 - 5x + 6 = 0$.",
            options: { A: "2, 3", B: "1, 6", C: "-2, -3", D: "0, 5" },
            answerKey: "A",
          },
          {
            serialNo: 38,
            subject: "maths",
            question: "Compute the definite integral $\\int_0^1 x^2 dx$.",
            options: { A: "1/3", B: "1/2", C: "1/4", D: "1" },
            answerKey: "A",
          },
          {
            serialNo: 39,
            subject: "maths",
            question: "Find the determinant of matrix $A$.",
            options: { A: "5", B: "10", C: "0", D: "-3" },
            answerKey: "B",
          },
          {
            serialNo: 40,
            subject: "maths",
            question: "What is the slope of the line $2x + 3y = 6$?",
            options: { A: "-2/3", B: "2/3", C: "3/2", D: "-3/2" },
            answerKey: "A",
          },
          // 5 Comprehension questions
          {
            serialNo: 41,
            subject: "comprehension",
            question: "What was the writing system invented by the Sumerians?",
            options: { A: "Cuneiform", B: "Hieroglyphs", C: "Alphabet", D: "Linear B" },
            answerKey: "A",
          },
          {
            serialNo: 42,
            subject: "comprehension",
            question: "What were the massive stepped towers called?",
            options: { A: "Pyramids", B: "Ziggurats", C: "Colosseum", D: "Parthenon" },
            answerKey: "B",
          },
          {
            serialNo: 43,
            subject: "comprehension",
            question: "Which two rivers are mentioned in the passage?",
            options: { A: "Nile and Amazon", B: "Tigris and Euphrates", C: "Danube and Rhine", D: "Indus and Ganges" },
            answerKey: "B",
          },
          {
            serialNo: 44,
            subject: "comprehension",
            question: "According to the passage, the irrigation canals were used for...",
            options: { A: "Trade", B: "Farming/Irrigation", C: "Defense", D: "Mining" },
            answerKey: "B",
          },
          {
            serialNo: 45,
            subject: "comprehension",
            question: "The tone of the passage can best be described as...",
            options: { A: "Informative", B: "Satirical", C: "Argumentative", D: "Pessimistic" },
            answerKey: "A",
          },
        ],
      },
    };

    const resolved = mergeOcrResults([page4]);

    expect(resolved).toHaveLength(9);

    // Assert 4 Maths questions have NO passage
    const mathsQuestions = resolved.filter((q) => q.serialNo <= 40);
    expect(mathsQuestions).toHaveLength(4);
    for (const q of mathsQuestions) {
      expect(q.passageContent).toBeNull();
      expect(q.subject).toBe("maths");
    }

    // Assert 5 Comprehension questions have the exact Passage 1
    const compQuestions = resolved.filter((q) => q.serialNo >= 41);
    expect(compQuestions).toHaveLength(5);
    for (const q of compQuestions) {
      expect(q.passageContent).toBe(PASSAGE_1);
      expect(q.subject).toBe("comprehension");
    }
  });

  it("propagates active passage across multiple continuous pages (Page 4 and Page 5)", () => {
    // Page 4 contains the passage and questions 41-43
    const page4: OcrPageResult = {
      pageNo: 4,
      pageId: "page-4",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_1,
        sectionLabel: "Reading Comprehension (Q. 41 to 48)",
        sectionStart: 41,
        sectionEnd: 48,
        data: [
          {
            serialNo: 41,
            subject: "comprehension",
            question: "Question 41 from Page 4",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "A",
          },
          {
            serialNo: 42,
            subject: "comprehension",
            question: "Question 42 from Page 4",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "B",
          },
          {
            serialNo: 43,
            subject: "comprehension",
            question: "Question 43 from Page 4",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "C",
          },
        ],
      },
    };

    // Page 5 has NO paragraph, continues questions 44-48, then switches to Maths Q49-50
    const page5: OcrPageResult = {
      pageNo: 5,
      pageId: "page-5",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        data: [
          {
            serialNo: 44,
            subject: "comprehension",
            question: "Question 44 continued on Page 5",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "D",
          },
          {
            serialNo: 45,
            subject: "comprehension",
            question: "Question 45 on Page 5",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "A",
          },
          {
            serialNo: 46,
            subject: "comprehension",
            question: "Question 46 on Page 5",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "B",
          },
          {
            serialNo: 47,
            subject: "comprehension",
            question: "Question 47 on Page 5",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "C",
          },
          {
            serialNo: 48,
            subject: "comprehension",
            question: "Question 48 on Page 5",
            options: { A: "Opt A", B: "Opt B", C: "Opt C", D: "Opt D" },
            answerKey: "D",
          },
          // Maths section begins
          {
            serialNo: 49,
            subject: "maths",
            question: "Solve $3x + 7 = 22$.",
            options: { A: "5", B: "6", C: "7", D: "8" },
            answerKey: "A",
          },
          {
            serialNo: 50,
            subject: "maths",
            question: "Find $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.",
            options: { A: "1", B: "0", C: "\\infty", D: "-1" },
            answerKey: "A",
          },
        ],
      },
    };

    const resolved = mergeOcrResults([page4, page5]);

    expect(resolved).toHaveLength(10);

    // Q41..Q48 must ALL have Passage 1
    const comprehensionSubset = resolved.filter((q) => q.serialNo >= 41 && q.serialNo <= 48);
    expect(comprehensionSubset).toHaveLength(8);
    for (const q of comprehensionSubset) {
      expect(q.passageContent).toBe(PASSAGE_1);
    }

    // Q49 and Q50 (Maths) must NOT have any passage
    const mathsSubset = resolved.filter((q) => q.serialNo >= 49);
    expect(mathsSubset).toHaveLength(2);
    for (const q of mathsSubset) {
      expect(q.passageContent).toBeNull();
    }
  });

  it("switches to new passage on Page 6 without assigning Page 4 passage to Page 6 questions", () => {
    // Page 4: Passage 1 with Q41-43
    const page4: OcrPageResult = {
      pageNo: 4,
      pageId: "page-4",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_1,
        data: [
          {
            serialNo: 41,
            subject: "comprehension",
            question: "Question 41 for Passage 1",
            options: { A: "A", B: "B", C: "C", D: "D" },
            answerKey: "A",
          },
          {
            serialNo: 42,
            subject: "comprehension",
            question: "Question 42 for Passage 1",
            options: { A: "A", B: "B", C: "C", D: "D" },
            answerKey: "B",
          },
        ],
      },
    };

    // Page 5: Continuation of Passage 1 with Q43-45
    const page5: OcrPageResult = {
      pageNo: 5,
      pageId: "page-5",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        data: [
          {
            serialNo: 43,
            subject: "comprehension",
            question: "Question 43 for Passage 1 on Page 5",
            options: { A: "A", B: "B", C: "C", D: "D" },
            answerKey: "C",
          },
        ],
      },
    };

    // Page 6: New Passage 2 with Q46-48 (Comprehension) and Q49-50 (Grammar)
    const page6: OcrPageResult = {
      pageNo: 6,
      pageId: "page-6",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_2,
        data: [
          {
            serialNo: 46,
            subject: "comprehension",
            question: "What is quantum superposition?",
            options: { A: "A", B: "B", C: "C", D: "D" },
            answerKey: "A",
          },
          {
            serialNo: 47,
            subject: "comprehension",
            question: "How do qubits differ from classical bits?",
            options: { A: "A", B: "B", C: "C", D: "D" },
            answerKey: "B",
          },
          // Grammar questions after Passage 2
          {
            serialNo: 48,
            subject: "grammar",
            question: "Choose the correct preposition: He is proficient ___ physics.",
            options: { A: "in", B: "at", C: "with", D: "on" },
            answerKey: "A",
          },
          {
            serialNo: 49,
            subject: "grammar",
            question: "Select the synonym of 'entanglement':",
            options: { A: "intertwining", B: "separation", C: "clarity", D: "freedom" },
            answerKey: "A",
          },
        ],
      },
    };

    const resolved = mergeOcrResults([page4, page5, page6]);

    // Q41..Q43 must have PASSAGE_1
    const p1Questions = resolved.filter((q) => q.serialNo <= 43);
    expect(p1Questions).toHaveLength(3);
    for (const q of p1Questions) {
      expect(q.passageContent).toBe(PASSAGE_1);
    }

    // Q46 and Q47 must have PASSAGE_2 (NEVER PASSAGE_1!)
    const p2Questions = resolved.filter((q) => q.serialNo === 46 || q.serialNo === 47);
    expect(p2Questions).toHaveLength(2);
    for (const q of p2Questions) {
      expect(q.passageContent).toBe(PASSAGE_2);
      expect(q.passageContent).not.toBe(PASSAGE_1);
    }

    // Q48 and Q49 (Grammar) must have NO passage
    const grammarQuestions = resolved.filter((q) => q.serialNo >= 48);
    expect(grammarQuestions).toHaveLength(2);
    for (const q of grammarQuestions) {
      expect(q.passageContent).toBeNull();
    }
  });

  it("preserves passage assignments when merging answer keys from a later page", () => {
    // Page 4: Passage 1 and Q41
    const page4: OcrPageResult = {
      pageNo: 4,
      pageId: "page-4",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_1,
        data: [
          {
            serialNo: 41,
            subject: "comprehension",
            question: "What is cuneiform?",
            options: { A: "A", B: "B", C: "C", D: "D" },
          },
        ],
      },
    };

    // Page 8: Answer Key table with no paragraph
    const page8: OcrPageResult = {
      pageNo: 8,
      pageId: "page-8",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        data: [
          {
            serialNo: 41,
            answerKey: "C",
          },
        ],
      },
    };

    const resolved = mergeOcrResults([page4, page8]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].serialNo).toBe(41);
    expect(resolved[0].correctOption).toBe("C");
    expect(resolved[0].passageContent).toBe(PASSAGE_1);
  });

  it("does not assign passage to math question even if subject is omitted but question has LaTeX math", () => {
    const page4: OcrPageResult = {
      pageNo: 4,
      pageId: "page-4",
      fileId: "doc-file-1",
      rawText: "raw ocr text",
      status: "completed",
      survivedValidation: true,
      isRelevant: true,
      parsedData: {
        isRelevant: true,
        paragraph: PASSAGE_1,
        data: [
          {
            serialNo: 1,
            // subject omitted
            question: "Evaluate $\\frac{\\sqrt{x^2 + 1}}{2x}$ when $x = 3$.",
            options: { A: "1", B: "2", C: "3", D: "4" },
            answerKey: "A",
          },
          {
            serialNo: 2,
            subject: "comprehension",
            question: "According to the passage, the Sumerians were known for...",
            options: { A: "Writing", B: "Navigating", C: "Flying", D: "Painting" },
            answerKey: "A",
          },
        ],
      },
    };

    const resolved = mergeOcrResults([page4]);
    expect(resolved[0].passageContent).toBeNull();
    expect(resolved[1].passageContent).toBe(PASSAGE_1);
  });
});
