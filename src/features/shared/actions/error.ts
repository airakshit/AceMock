import { ServerActionResult } from "./types";

export class ServerActionError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

export function handleActionError(err: any): ServerActionResult<never> {
    if (err instanceof ServerActionError) {
        return {
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        };
    }

    console.log(`The error is : ${err}`);

    return {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: err.message,
        },
    };
}
