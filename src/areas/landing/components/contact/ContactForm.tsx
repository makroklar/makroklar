'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { sendContactMessage, type ContactState } from '../../actions/sendContactMessage';
import { Button } from '../ui/button';

const initialState: ContactState = { status: 'idle' };

const inputClass =
  'w-full rounded-xl border border-line bg-card px-3.5 py-3 font-sans text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-brand aria-invalid:border-[#c7443a]';

function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string; rows?: number } & Record<string, unknown>) {
  const Control = props.rows ? 'textarea' : 'input';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Control
        id={name}
        name={name}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="m-0 text-[13px] text-[#c7443a]">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessage, initialState);

  if (state.status === 'success') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-3xl border border-brand bg-card p-8 text-center">
        <CircleCheck aria-hidden className="size-10 text-brand" />
        <h2 className="m-0 text-2xl/8 font-bold text-brand">Danke für deine Nachricht!</h2>
        <p className="m-0 text-[15px]/6 text-ink">Wir melden uns so bald wie möglich bei dir.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-6 shadow-panel sm:p-8">
      <Field label="Name" name="name" autoComplete="name" required error={state.fieldErrors?.name} />
      <Field label="E-Mail" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Field label="Betrieb (optional)" name="business" autoComplete="organization" error={state.fieldErrors?.business} />
      <Field label="Nachricht" name="message" rows={5} required error={state.fieldErrors?.message} />

      {/* Honeypot gegen Spam-Bots, für Menschen unsichtbar */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.message && (
        <p role="alert" className="m-0 text-sm text-[#c7443a]">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Wird gesendet …' : 'Nachricht senden'}
        <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
      </Button>

      <p className="m-0 text-[13px]/5 text-ink-subtle">
        Wir nutzen deine Angaben nur für die Antwort. Mehr dazu im <Link href="/datenschutz">Datenschutz</Link>.
      </p>
    </form>
  );
}
