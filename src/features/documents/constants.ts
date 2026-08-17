import { LabelIconValueItem } from "@/components/types";
import {
    Atom,
    BookOpen,
    FileQuestionIcon,
    FlaskConical,
    Languages,
    Sigma,
} from "lucide-react";
import { documentContentTypeEnum } from "@/db/schemas";

export const MORE_INFORMATION_NEW_DOCUMENT = `A document is a collection of related questions. Provide sources for specific purpose like single chapters, full tests etc.`;

export const contentTypeItems: LabelIconValueItem[] = [
    {
        label: "Physics",
        icon: Atom,
        value: documentContentTypeEnum.enumValues[0],
    },
    {
        label: "Chemistry",
        icon: FlaskConical,
        value: documentContentTypeEnum.enumValues[2],
    },
    {
        label: "Mathematics",
        icon: Sigma,
        value: documentContentTypeEnum.enumValues[1],
    },
    {
        label: "English",
        icon: Languages,
        value: documentContentTypeEnum.enumValues[3],
    },
    {
        label: "Mock Test",
        icon: FileQuestionIcon,
        value: documentContentTypeEnum.enumValues[4],
    },
    {
        label: "Study Notes",
        icon: BookOpen,
        value: documentContentTypeEnum.enumValues[5],
    },
];
