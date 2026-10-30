import { type EmailAttachment, EmailMessage, renderEmail } from '@teamflow/email';

export interface Mailer {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: EmailAttachment[];
  }): Promise<unknown>;
}

export interface EmailJob {
  id: string;
  data: unknown;
}

/**
 * Render and send a batch of email jobs. A malformed job is dropped (retrying cannot fix it); a delivery failure
 * throws so pg-boss retries the batch with backoff.
 */
export async function deliverEmails(
  jobs: EmailJob[],
  {
    mailer,
    from,
    webUrl,
    onDropped,
  }: { mailer: Mailer; from: string; webUrl: string; onDropped?: (id: string) => void },
): Promise<void> {
  for (const job of jobs) {
    const parsed = EmailMessage.safeParse(job.data);
    if (!parsed.success) {
      onDropped?.(job.id);
      continue;
    }
    const email = await renderEmail(parsed.data, { webUrl });
    await mailer.sendMail({ from, ...email });
  }
}
