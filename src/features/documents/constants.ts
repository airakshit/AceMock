import { LabelIconValueItem } from "@/components/types";
import {
  Atom,
  FlaskConical,
  Languages,
  Sigma,
} from "lucide-react";
import { SubjectsEnum } from "./types";

export const MORE_INFORMATION_NEW_DOCUMENT = `A document is a collection of related questions. Provide sources for specific purpose like single chapters, full tests etc.`;

export const contentTypeItems: LabelIconValueItem[] = [
  {
    label: "Physics",
    icon: Atom,
    value: SubjectsEnum.PHYSICS,
  },
  {
    label: "Chemistry",
    icon: FlaskConical,
    value: SubjectsEnum.CHEMISTRY,
  },
  {
    label: "Mathematics",
    icon: Sigma,
    value: SubjectsEnum.MATHEMATICS,
  },
  {
    label: "English",
    icon: Languages,
    value: SubjectsEnum.ENGLISH,
  },
];
