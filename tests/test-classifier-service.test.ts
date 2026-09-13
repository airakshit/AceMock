import "dotenv/config";
import { db } from "@/db";
import {
  curriculumClassifierService,
  QuestionToClassify,
} from "@/features/questions/services/curriculum-classifier.service";

async function main() {
  console.log("Testing CurriculumClassifierService end-to-end...");

  const testQuestions: QuestionToClassify[] = [
    {
      id: "test-physics-1",
      question: "A projectile is fired at an angle of 45 degrees to the horizontal with an initial velocity of 20 m/s. What is its range? (g = 10 m/s^2)",
      options: [
        { key: "A", text: "20 m" },
        { key: "B", text: "40 m" },
        { key: "C", text: "60 m" },
        { key: "D", text: "80 m" },
      ],
      subject: "physics",
    },
    {
      id: "test-chemistry-1",
      question: "Which of the following compounds exhibits optical isomerism?",
      options: [
        { key: "A", text: "Lactic acid" },
        { key: "B", text: "Acetic acid" },
        { key: "C", text: "Formic acid" },
        { key: "D", text: "Oxalic acid" },
      ],
      subject: "chemistry",
    },
    {
      id: "test-math-1",
      question: "Evaluate the limit as x approaches 0 of sin(5x) / x.",
      options: [
        { key: "A", text: "0" },
        { key: "B", text: "1" },
        { key: "C", text: "5" },
        { key: "D", text: "Does not exist" },
      ],
      subject: "mathematics",
    },
    {
      id: "test-english-1",
      question: "According to the passage, why did the Industrial Revolution begin in Britain?",
      options: [
        { key: "A", text: "Abundant coal reserves" },
        { key: "B", text: "Higher agricultural yields" },
        { key: "C", text: "Both A and B" },
        { key: "D", text: "None of the above" },
      ],
      passageContent: "The Industrial Revolution marked a period of development in the latter half of the 18th century that transformed largely rural, agrarian societies in Europe and America into industrialized, urban ones. Britain possessed rich coal and iron ore reserves...",
    },
  ];

  const results = await curriculumClassifierService.classifyQuestions(db, testQuestions);

  console.log("Classification Results:");
  for (const res of results) {
    console.log(`- ID: ${res.id}`);
    console.log(`  Subject: ${res.subjectSlug}`);
    console.log(`  Section: ${res.sectionSlug}`);
    console.log(`  Chapter Slug: ${res.chapterSlug}`);
    console.log(`  Resolved Chapter ID: ${res.chapterId}`);
  }
}

main().catch(console.error).then(() => process.exit(0));
