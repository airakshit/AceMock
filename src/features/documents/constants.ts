import { LabelIconValueItem } from "@/components/types";
import {
    Atom,
    BookOpen,
    FileQuestionIcon,
    FlaskConical,
    Languages,
    Sigma,
} from "lucide-react";
import { FileContentTypeEnum } from "./types";

export const MORE_INFORMATION_NEW_DOCUMENT = `A document is a collection of related questions. Provide sources for specific purpose like single chapters, full tests etc.`;

export const contentTypeItems: LabelIconValueItem[] = [
    { label: "Physics", icon: Atom, value: FileContentTypeEnum.PHYSICS },
    {
        label: "Chemistry",
        icon: FlaskConical,
        value: FileContentTypeEnum.CHEMISTRY,
    },
    { label: "Mathematics", icon: Sigma, value: FileContentTypeEnum.MATHS },
    { label: "English", icon: Languages, value: FileContentTypeEnum.ENGLISH },
    {
        label: "Mock Test",
        icon: FileQuestionIcon,
        value: FileContentTypeEnum.MOCK_TEST,
    },
    {
        label: "Study Notes",
        icon: BookOpen,
        value: FileContentTypeEnum.STUDY_NOTES,
    },
];
