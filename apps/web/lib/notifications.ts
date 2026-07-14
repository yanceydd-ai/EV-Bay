import { Resend } from "resend";
import twilio from "twilio";
import { Bay, countOpenBays, pool } from "./db";

type Subscription = {
  id: string;
  email: string | null;
  phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  min_open_bays: number;
};

type DeliveryResult = {
  channel: "email" | "sms";
  destination: string;
  status: "sent" | "logged" | "failed";
  providerMessage: string;
};

export async function maybeNotifyAvailability(previousOpenCount: number, bays: Bay[]) {
  const openCount = countOpenBays(bays);
  if (previousOpenCount > 0 || openCount === 0) {
    return;
  }

  const event = await pool.query<{ id: string }>(
    `INSERT INTO notification_events (open_bay_count, bay_snapshot)
     VALUES ($1, $2)
     RETURNING id`,
    [openCount, JSON.stringify(bays)]
  );

  const subscriptions = await pool.query<Subscription>(
    `SELECT id, email, phone, notify_email, notify_sms, min_open_bays
     FROM subscriptions
     WHERE unsubscribed_at IS NULL
       AND min_open_bays <= $1`,
    [openCount]
  );

  for (const subscription of subscriptions.rows) {
    const deliveries = await sendSubscriptionNotification(subscription, bays, openCount);
    for (const delivery of deliveries) {
      await pool.query(
        `INSERT INTO notification_deliveries
          (notification_event_id, subscription_id, channel, destination, status, provider_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.rows[0].id,
          subscription.id,
          delivery.channel,
          delivery.destination,
          delivery.status,
          delivery.providerMessage
        ]
      );
    }
  }
}

async function sendSubscriptionNotification(
  subscription: Subscription,
  bays: Bay[],
  openCount: number
): Promise<DeliveryResult[]> {
  const openLabels = bays.filter((bay) => bay.status === "open").map((bay) => bay.label).join(", ");
  const message = `${openCount} EV charging bay${openCount === 1 ? " is" : "s are"} open: ${openLabels}.`;
  const results: DeliveryResult[] = [];

  if (subscription.notify_email && subscription.email) {
    results.push(await sendEmail(subscription.email, "EV bay available", message));
  }

  if (subscription.notify_sms && subscription.phone) {
    results.push(await sendSms(subscription.phone, message));
  }

  return results;
}

async function sendEmail(to: string, subject: string, text: string): Promise<DeliveryResult> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.log(`[notification:email] ${to}: ${subject} - ${text}`);
    return { channel: "email", destination: to, status: "logged", providerMessage: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text
    });
    return { channel: "email", destination: to, status: "sent", providerMessage: result.data?.id ?? "sent" };
  } catch (error) {
    return { channel: "email", destination: to, status: "failed", providerMessage: String(error) };
  }
}

async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log(`[notification:sms] ${to}: ${body}`);
    return { channel: "sms", destination: to, status: "logged", providerMessage: "Twilio not configured" };
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to,
      body
    });
    return { channel: "sms", destination: to, status: "sent", providerMessage: result.sid };
  } catch (error) {
    return { channel: "sms", destination: to, status: "failed", providerMessage: String(error) };
  }
}

