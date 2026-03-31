import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM?.trim();
  if (!resend || !from) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY / EMAIL_FROM)" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to.trim(),
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      const name = "name" in error ? String((error as { name?: string }).name) : "";
      const hint =
        name === "invalid_from_address" || error.message.toLowerCase().includes("from")
          ? " Check EMAIL_FROM matches a verified domain in Resend, or use TaskFlow <onboarding@resend.dev> for testing."
          : "";
      return { ok: false, error: `${error.message}${hint}` };
    }
    if (!data?.id) {
      return { ok: false, error: "Resend returned no email id (unexpected response)" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Resend request failed";
    return { ok: false, error: message };
  }
}
