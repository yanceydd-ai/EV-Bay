"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pool } from "./db";

const subscriptionSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7).optional().or(z.literal("")),
  notifyEmail: z.coerce.boolean().default(false),
  notifySms: z.coerce.boolean().default(false),
  minOpenBays: z.coerce.number().int().min(1).max(4).default(1)
});

export async function createSubscription(_: unknown, formData: FormData) {
  const parsed = subscriptionSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    notifyEmail: formData.get("notifyEmail") === "on",
    notifySms: formData.get("notifySms") === "on",
    minOpenBays: formData.get("minOpenBays")
  });

  if (!parsed.success) {
    return { ok: false, message: "Please enter a valid email or phone number." };
  }

  const email = parsed.data.email || null;
  const phone = parsed.data.phone || null;
  if (!email && !phone) {
    return { ok: false, message: "Add at least one destination for notifications." };
  }

  if (!parsed.data.notifyEmail && !parsed.data.notifySms) {
    return { ok: false, message: "Choose email, SMS, or both." };
  }

  await pool.query(
    `INSERT INTO subscriptions (email, phone, notify_email, notify_sms, min_open_bays, verified_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [email, phone, parsed.data.notifyEmail, parsed.data.notifySms, parsed.data.minOpenBays]
  );

  revalidatePath("/");
  return { ok: true, message: "You're signed up for EV bay notifications." };
}

