import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { HelpCircle } from "lucide-react";

interface MoreInformationProps {
    content: string;
}

export const MoreInformation = (props: MoreInformationProps) => {
    return (
        <Tooltip>
            <TooltipTrigger>
                <div
                    aria-label="More information"
                    className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                >
                    <HelpCircle className="size-4" />
                </div>
            </TooltipTrigger>

            <TooltipContent side="right">{props.content}</TooltipContent>
        </Tooltip>
    );
};
