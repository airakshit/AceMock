import "dotenv/config";
import { db } from "@/db";
import { CURRICULUM } from "@/constants/curriculum";
import { subjects, sections, chapters } from "../schemas";

async function seedCurriculum() {
  await db.transaction(async (tx) => {
    for (const subject of Object.values(CURRICULUM)) {
      // 1. Insert subject
      const [subjectRecord] = await tx
        .insert(subjects)
        .values({
          name: subject.name,
          slug: subject.slug,
        })
        .onConflictDoUpdate({
          target: subjects.slug,
          set: {
            name: subject.name,
          },
        })
        .returning({
          id: subjects.id,
        });

      if (!subjectRecord) {
        throw new Error(`Failed to create/find subject: ${subject.slug}`);
      }

      // 2. Insert sections
      for (const section of Object.values(subject.sections)) {
        const [sectionRecord] = await tx
          .insert(sections)
          .values({
            name: section.name,
            slug: section.slug,
            subjectId: subjectRecord.id,
          })
          .onConflictDoUpdate({
            target: sections.slug,
            set: {
              name: section.name,
            },
          })
          .returning({
            id: sections.id,
          });

        if (!sectionRecord) {
          throw new Error(`Failed to create/find section: ${section.slug}`);
        }

        // 3. Insert chapters
        if (section.chapters.length === 0) {
          continue;
        }

        await tx
          .insert(chapters)
          .values(
            section.chapters.map((chapter: { name: string; slug: string }) => ({
              name: chapter.name,
              slug: chapter.slug,
              sectionId: sectionRecord.id,
            })),
          )
          .onConflictDoUpdate({
            target: chapters.slug,
            set: {
              name: chapters.name,
            },
          });
      }
    }
  });
}

seedCurriculum()
  .then(() => {
    console.log("Curriculum seeded successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed curriculum:", error);
    process.exit(1);
  });
