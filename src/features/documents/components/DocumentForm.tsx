"use client";

import { FileText, Image as ImageIcon, Plus, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { MiniHorizontalList } from "@/components/shared/MiniHorizontalList";
import { contentTypeItems } from "../constants";

import { documentFormSchema, type DocumentFormData } from "../schemas";
import { FileDropzone } from "./FileDropzone";
import {
    CreateNewDocumentActionPayload,
    CreateNewDocumentActionResponse,
} from "../types";
import { documentFormDataToCreateNewDocumentPayload } from "../utils";

interface DocumentFormProps {
    onSumbitAction: (
        data: CreateNewDocumentActionPayload,
    ) => Promise<CreateNewDocumentActionResponse>;
}

export function DocumentForm({ onSumbitAction }: DocumentFormProps) {
    const [showDescription, setShowDescription] = useState(false);
    const form = useForm<DocumentFormData>({
        resolver: zodResolver(documentFormSchema),
        defaultValues: {
            title: "",
            description: "",
            contentType: undefined,
            pdfs: [],
            images: [],
        },
    });

    const onSubmit = async (data: DocumentFormData) => {
        console.log("Document Submitted:", data);
        const payload: CreateNewDocumentActionPayload =
            documentFormDataToCreateNewDocumentPayload(data);

        await onSumbitAction(payload);
    };

    const handleRemoveDescription = () => {
        form.setValue("description", "");
        setShowDescription(false);
    };

    return (
        <Card>
            {/* <CardHeader>
                <CardTitle>New document</CardTitle>
                <CardDescription>
                    Add a title, description, and any source files.
                </CardDescription>
            </CardHeader> */}

            <CardContent>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className={cn(layout.fieldStack, "space-y-6")}
                >
                    <FieldGroup className={layout.fieldStack}>
                        {/* Content Type */}
                        <Controller
                            name="contentType"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="min-w-0"
                                >
                                    <FieldLabel>Content Type</FieldLabel>

                                    <MiniHorizontalList
                                        items={contentTypeItems}
                                        value={field.value}
                                        onChange={field.onChange}
                                    />

                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Title */}
                        <Controller
                            name="title"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    className="min-w-0"
                                >
                                    <FieldLabel htmlFor="title">
                                        Title
                                    </FieldLabel>

                                    <Input
                                        {...field}
                                        id="title"
                                        placeholder="e.g. Physics Mechanics"
                                        aria-invalid={fieldState.invalid}
                                    />

                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />

                        {/* Description */}
                        {showDescription ? (
                            <Controller
                                name="description"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        data-invalid={fieldState.invalid}
                                        className="min-w-0"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <FieldLabel htmlFor="description">
                                                Description
                                            </FieldLabel>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={
                                                    handleRemoveDescription
                                                }
                                                className="h-8 shrink-0 px-2 text-muted-foreground"
                                            >
                                                <X className="size-4" />
                                                <span className="hidden sm:inline">
                                                    Remove
                                                </span>
                                            </Button>
                                        </div>

                                        <Textarea
                                            {...field}
                                            id="description"
                                            placeholder="Describe what this document contains..."
                                            rows={4}
                                            aria-invalid={fieldState.invalid}
                                        />

                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowDescription(true)}
                                className="w-full border-dashed sm:w-fit"
                            >
                                <Plus className="size-4" />
                                Add description
                            </Button>
                        )}

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* PDFs */}
                            <Controller
                                name="pdfs"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        data-invalid={fieldState.invalid}
                                        className="min-w-0"
                                    >
                                        <FieldLabel htmlFor="pdfs">
                                            PDF Files
                                        </FieldLabel>

                                        <FileDropzone
                                            id="pdfs"
                                            label="PDF files"
                                            title="Upload PDF files"
                                            description="Select one or more PDF files"
                                            accept="application/pdf"
                                            icon={FileText}
                                            value={field.value}
                                            onChange={field.onChange}
                                            invalid={fieldState.invalid}
                                        />

                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />

                            {/* Images */}
                            <Controller
                                name="images"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        data-invalid={fieldState.invalid}
                                        className="min-w-0"
                                    >
                                        <FieldLabel htmlFor="images">
                                            Images
                                        </FieldLabel>

                                        <FileDropzone
                                            id="images"
                                            label="Images"
                                            title="Upload images"
                                            description="Images will be processed in the selected order"
                                            accept="image/*"
                                            icon={ImageIcon}
                                            value={field.value}
                                            onChange={field.onChange}
                                            invalid={fieldState.invalid}
                                            numbered
                                        />

                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                        </div>
                    </FieldGroup>

                    <Button type="submit" className="h-10 w-full">
                        Create Document
                    </Button>
                </form>
            </CardContent>

            <CardFooter>Please Upload Only Related Documents.</CardFooter>
        </Card>
    );
}
