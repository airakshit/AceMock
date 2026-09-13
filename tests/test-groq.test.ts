import "dotenv/config";
import { GroqLLMService, GroqModels } from "@/services/llm";
import { env } from "@/config/env/server";

async function main() {
  console.log("Testing Groq LLM Service...");
  console.log("Listing available Groq models...");
  console.log("Testing 2-step classification with Groq...");
  const llm = new GroqLLMService(env.GROQ_API_KEY, GroqModels.GPT_OSS_120B);

  // Sample questions
  const sampleQuestions = [
    {
      id: "q1",
      question: "A stone is thrown vertically upwards with a velocity of 20 m/s. Find the maximum height reached. (g = 10 m/s^2)",
      options: "A: 10m, B: 20m, C: 30m, D: 40m",
      subject: "physics",
    },
    {
      id: "q2",
      question: "Two point charges +2uC and -2uC are placed at a distance of 10 cm. The electric potential at the midpoint is:",
      options: "A: 0 V, B: 100 V, C: 200 V, D: 360 V",
      subject: "physics",
    },
    {
      id: "q3",
      question: "He said, 'I have been working hard.' In indirect speech, this becomes:",
      options: "A: He said that he was working hard., B: He said that he had been working hard., C: He said that he has worked hard., D: He says that he is working hard.",
      subject: "english",
    },
  ];

  // Test Section Classification for Physics
  const physicsSectionsPrompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: Physics

Available Sections:
- Mechanics (slug: "mechanics")
- Heat and Thermodynamics (slug: "heat-and-thermodynamics")
- Sound and Waves (slug: "sound-and-waves")
- Optics (slug: "optics")
- Electrostatics (slug: "electrostatics")
- Current Electricity and Magnetism (slug: "current-electricity-and-magnetism")
- Modern Physics (slug: "modern-physics")

Classify each question into the single most appropriate Section slug from the list above.

Questions:
1. [ID: q1] Question: A stone is thrown vertically upwards with a velocity of 20 m/s. Find the maximum height reached.
2. [ID: q2] Question: Two point charges +2uC and -2uC are placed at a distance of 10 cm. The electric potential at the midpoint is:

Respond with JSON adhering to this schema:
{
  "classifications": [
    { "id": "question_id", "sectionSlug": "slug_of_section" }
  ]
}`;

  const secRes = await llm.call(
    physicsSectionsPrompt,
    undefined,
    undefined,
    {
      name: "section_classification",
      schema: {
        type: "object",
        properties: {
          classifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                sectionSlug: { type: "string" },
              },
              required: ["id", "sectionSlug"],
              additionalProperties: false,
            },
          },
        },
        required: ["classifications"],
        additionalProperties: false,
      },
      strict: true,
    }
  );

  console.log("Section classification result:", secRes);

  // Test Chapter Classification for Mechanics (q1)
  const mechanicsChaptersPrompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: Physics
Section: Mechanics

Available Chapters:
- Physical Quantities (slug: "physical-quantities")
- Vectors (slug: "vectors")
- Kinematics (slug: "kinematics")
- Dynamics (slug: "dynamics")
- Work, Energy, and Power (slug: "work-energy-and-power")
- Circular Motion (slug: "circular-motion")
- Gravitation (slug: "gravitation")
- Rotational Dynamics (slug: "rotational-dynamics")
- Simple Harmonic Motion (slug: "shm")
- Fluid Mechanics (slug: "fluid-mechanics")

Classify each question into the single most appropriate Chapter slug from the list above.

Questions:
1. [ID: q1] Question: A stone is thrown vertically upwards with a velocity of 20 m/s. Find the maximum height reached. (g = 10 m/s^2) Options: A: 10m, B: 20m, C: 30m, D: 40m

Respond with JSON adhering to this schema:
{
  "classifications": [
    { "id": "question_id", "chapterSlug": "slug_of_chapter" }
  ]
}`;

  const chapRes = await llm.call(
    mechanicsChaptersPrompt,
    undefined,
    undefined,
    {
      name: "chapter_classification",
      schema: {
        type: "object",
        properties: {
          classifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                chapterSlug: { type: "string" },
              },
              required: ["id", "chapterSlug"],
              additionalProperties: false,
            },
          },
        },
        required: ["classifications"],
        additionalProperties: false,
      },
      strict: true,
    }
  );

  console.log("Chapter classification result:", chapRes);
}

main().catch(console.error).then(() => process.exit(0));
