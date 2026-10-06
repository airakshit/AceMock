import { redirect } from "next/navigation";

export const metadata = {
  title: "Mock Tests | ePeX",
  description: "Full-length and practice examinations.",
};

export default function MocksPage() {
  // The mocks hub defaults to its Tests section.
  redirect("/mocks/tests");
}
