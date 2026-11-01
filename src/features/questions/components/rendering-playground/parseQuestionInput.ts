import type {
  OptionKey,
  OptionType,
  PassageType,
  QuestionCardType,
} from "@/features/shared/components/question-card/types";

type JsonRecord = Record<string, unknown>;

export type QuestionInputResult = {
  format: "empty" | "json" | "text";
  questions: QuestionCardType[];
  error?: string;
};

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function optionKey(value: unknown): OptionKey | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toUpperCase()
    .match(/^(?:OPTION\s*)?([A-D])(?:$|[\s).:])/)?.[1];
  return OPTION_KEYS.find((key) => key === normalized);
}

function questionDifficulty(
  value: unknown,
): QuestionCardType["difficulty"] | undefined {
  switch (textValue(value)?.toLowerCase()) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    default:
      return undefined;
  }
}

function normalizeOptions(value: unknown): OptionType[] {
  const entries = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([key, content]) => ({ key, content }))
      : [];
  const options: OptionType[] = [];

  for (const [index, entry] of entries.slice(0, OPTION_KEYS.length).entries()) {
    const option = isRecord(entry) ? entry : undefined;
    const content = textValue(
      option
        ? firstValue(option, ["content", "text", "value", "label", "option"])
        : entry,
    );
    if (content === undefined) continue;

    const requestedKey = option
      ? optionKey(firstValue(option, ["key", "letter", "id"]))
      : undefined;
    const key =
      requestedKey && !options.some((existing) => existing.key === requestedKey)
        ? requestedKey
        : OPTION_KEYS[index];

    options.push({
      key,
      content,
      ...(typeof option?.isCorrect === "boolean"
        ? { isCorrect: option.isCorrect }
        : {}),
    });
  }

  return options;
}

function normalizeCorrectOption(
  value: unknown,
  options: OptionType[],
): OptionKey | undefined {
  if (isRecord(value)) {
    value = firstValue(value, ["key", "letter", "option", "answer"]);
  }

  const answer = textValue(value);
  if (!answer) return undefined;

  const matchingOption = options.find(
    (option) => option.content.trim().toLowerCase() === answer.trim().toLowerCase(),
  );
  if (matchingOption) return matchingOption.key;

  const key = optionKey(answer);
  if (key && options.some((option) => option.key === key)) return key;

  const numericAnswer = Number(answer);
  if (Number.isInteger(numericAnswer) && numericAnswer >= 1 && numericAnswer <= 4) {
    return OPTION_KEYS[numericAnswer - 1];
  }

  return undefined;
}

function normalizePassage(
  value: unknown,
  questionIndex: number,
): PassageType | null {
  if (typeof value === "string") {
    return {
      id: `render-passage-${questionIndex + 1}`,
      content: value,
      questionPositions: [questionIndex + 1],
    };
  }
  if (!isRecord(value)) return null;

  const content = textValue(firstValue(value, ["content", "text", "passage"]));
  if (content === undefined) return null;

  const positions = Array.isArray(value.questionPositions)
    ? value.questionPositions.filter(
        (position): position is number => typeof position === "number",
      )
    : [questionIndex + 1];

  return {
    id: textValue(value.id) ?? `render-passage-${questionIndex + 1}`,
    content,
    questionPositions: positions,
  };
}

function normalizeQuestion(value: unknown, index: number): QuestionCardType {
  const record = isRecord(value) ? value : {};
  const options = normalizeOptions(
    firstValue(record, ["options", "choices", "answerOptions", "answer_options"]),
  );
  const rawCorrectOption = firstValue(record, [
    "correctOption",
    "correctAnswer",
    "correct_answer",
    "answerKey",
    "answer_key",
    "answer",
  ]);
  const correctOption =
    normalizeCorrectOption(rawCorrectOption, options) ??
    options.find((option) => option.isCorrect)?.key;

  const questionTextValue = firstValue(record, [
    "questionText",
    "question_text",
    "question",
    "prompt",
    "stem",
    "text",
    "content",
  ]);
  const questionText =
    textValue(questionTextValue) ??
    (isRecord(value) || Array.isArray(value)
      ? JSON.stringify(value, null, 2)
      : textValue(value) ?? "");
  const difficulty = questionDifficulty(record.difficulty);
  const marks = Number(firstValue(record, ["marks", "points"]));
  const negativeMarks = Number(
    firstValue(record, ["negativeMarks", "negative_marks", "penalty"]),
  );

  return {
    id: textValue(record.id) ?? `render-question-${index + 1}`,
    subject: textValue(record.subject) ?? "general",
    ...(difficulty ? { difficulty } : {}),
    questionText,
    options,
    ...(correctOption ? { correctOption } : {}),
    ...(textValue(firstValue(record, ["explanation", "solution", "rationale"]))
      ? {
          explanation: textValue(
            firstValue(record, ["explanation", "solution", "rationale"]),
          ),
        }
      : {}),
    ...(Number.isFinite(marks) ? { marks } : {}),
    ...(Number.isFinite(negativeMarks) ? { negativeMarks } : {}),
    ...(typeof record.diagramUrl === "string" ||
    typeof record.diagram_url === "string"
      ? { diagramUrl: textValue(record.diagramUrl ?? record.diagram_url) }
      : {}),
    ...(typeof record.solutionDiagramUrl === "string" ||
    typeof record.solution_diagram_url === "string"
      ? {
          solutionDiagramUrl: textValue(
            record.solutionDiagramUrl ?? record.solution_diagram_url,
          ),
        }
      : {}),
    ...(record.passage !== undefined
      ? { passage: normalizePassage(record.passage, index) }
      : {}),
  };
}

function extractQuestions(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [value];

  for (const key of ["questions", "results", "items"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const key of ["data", "result", "output"]) {
    if (value[key] !== undefined) return extractQuestions(value[key]);
  }
  return [value];
}

export function parseQuestionInput(input: string): QuestionInputResult {
  const trimmedInput = input.trim();
  if (!trimmedInput) return { format: "empty", questions: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedInput);
  } catch (error) {
    if (trimmedInput.startsWith("{") || trimmedInput.startsWith("[")) {
      return {
        format: "json",
        questions: [],
        error:
          error instanceof Error ? error.message : "The JSON could not be parsed.",
      };
    }

    return {
      format: "text",
      questions: [normalizeQuestion(trimmedInput, 0)],
    };
  }

  return {
    format: "json",
    questions: extractQuestions(parsed).map(normalizeQuestion),
  };
}
