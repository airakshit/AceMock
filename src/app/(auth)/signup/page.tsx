"use client";

import { redirect } from "next/navigation";

export default function SignUpPage() {
    redirect("/signin?tab=signup");
}

