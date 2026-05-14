"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailFieldSchema = z.object({
  email: z.string().email(),
});

export type MagicLinkFormState =
  | { readonly kind: "idle" }
  | { readonly kind: "sent" }
  | { readonly kind: "error"; readonly message: string };

/**
 * Envía magic link (OTP por correo). Requiere URL de callback registrada en Supabase Auth.
 */
export async function sendMagicLink(
  _prevState: MagicLinkFormState,
  formData: FormData,
): Promise<MagicLinkFormState> {
  const rawEmail = formData.get("email");
  const parsed = emailFieldSchema.safeParse({
    email: typeof rawEmail === "string" ? rawEmail.trim() : "",
  });
  if (!parsed.success) {
    return { kind: "error", message: "Introduce un correo válido." };
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Faltan NEXT_PUBLIC_SUPABASE_* en .env.local." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let origin: string | null = null;
  if (typeof siteUrl === "string" && siteUrl.length > 0) {
    try {
      origin = new URL(siteUrl).origin;
    } catch {
      origin = null;
    }
  }
  if (origin === null) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (typeof host === "string" && host.length > 0) {
      origin = `${proto}://${host}`;
    }
  }
  if (origin === null) {
    return {
      kind: "error",
      message: "Configura NEXT_PUBLIC_SITE_URL o accede con Host válido para el enlace mágico.",
    };
  }

  const callback = new URL("/auth/callback", origin);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callback.toString(),
    },
  });

  if (error !== null) {
    return { kind: "error", message: error.message };
  }
  return { kind: "sent" };
}
