'use server';

import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Bitte gib deinen Namen an.').max(100),
  email: z.email('Bitte gib eine gültige E-Mail-Adresse an.'),
  business: z.string().trim().max(120),
  message: z.string().trim().min(10, 'Bitte schreib uns ein paar Worte mehr.').max(2000),
});

export type ContactState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof contactSchema>, string>>;
};

export async function sendContactMessage(_previous: ContactState, formData: FormData): Promise<ContactState> {
  // Unsichtbares Feld: Nur Bots füllen es aus, sie bekommen trotzdem eine Erfolgsmeldung
  if (formData.get('website')) return { status: 'success' };

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    business: formData.get('business'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    const fieldErrors: ContactState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.infer<typeof contactSchema>;
      fieldErrors[field] ??= issue.message;
    }
    return { status: 'error', fieldErrors };
  }

  const { RESEND_API_KEY, CONTACT_EMAIL_TO, CONTACT_EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !CONTACT_EMAIL_TO || !CONTACT_EMAIL_FROM) {
    console.error('Kontaktformular: Resend-Umgebungsvariablen fehlen');
    return { status: 'error', message: 'Das Formular ist gerade nicht erreichbar. Bitte versuche es später erneut.' };
  }

  const { name, email, business, message } = parsed.data;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: CONTACT_EMAIL_FROM,
      to: CONTACT_EMAIL_TO,
      reply_to: email,
      subject: `Neue Anfrage von ${name}`,
      text: `Name: ${name}\nE-Mail: ${email}\nBetrieb: ${business || '–'}\n\n${message}`,
    }),
  });

  if (!response.ok) {
    console.error('Kontaktformular: Resend antwortet mit', response.status);
    return { status: 'error', message: 'Deine Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.' };
  }

  return { status: 'success' };
}
