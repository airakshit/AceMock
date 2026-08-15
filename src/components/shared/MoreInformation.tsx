
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { HelpCircle } from "lucide-react";

interface MoreInformationProps {
    content: string;
}

export const MoreInformation = (props: MoreInformationProps) => {
    return (
        <Tooltip>
            <TooltipTrigger>
                <button
                    type="button"
                    aria-label="More information"
                    className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                >
                    <HelpCircle className="size-4" />
                </button>
            </TooltipTrigger>

            <TooltipContent side="right">
                {props.content}
            </TooltipContent>
        </Tooltip>
    );
};
