import { LegalPage, LegalSection } from './components/shared/LegalPage';
import { Todo } from './components/shared/Todo';

export function PrivacyPage() {
  return (
    <LegalPage
      title="Datenschutz"
      notice="Entwurf ohne rechtliche Prüfung. Vor der Veröffentlichung ergänzen und prüfen lassen, besonders sobald weitere Dienste dazukommen."
    >
      <LegalSection title="Verantwortliche Stelle">
        <p><Todo>Name, Anschrift und E-Mail der Verantwortlichen</Todo></p>
      </LegalSection>

      <LegalSection title="Hosting">
        <p>
          Diese Website wird bei Vercel Inc. gehostet. Beim Aufruf verarbeitet der Hoster technisch notwendige Daten
          wie IP-Adresse, Zeitpunkt und aufgerufene Seite, um die Website auszuliefern und abzusichern. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. f DSGVO. <Todo>Standort der Verarbeitung, Auftragsverarbeitungsvertrag und Drittlandtransfer ergänzen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Kontaktformular">
        <p>
          Wenn du uns über das Formular schreibst, verarbeiten wir deine Angaben (Name, E-Mail-Adresse, optional
          Betrieb, Nachricht), um deine Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b oder f DSGVO.
          Die Nachricht wird über den E-Mail-Dienst Resend an uns zugestellt.{' '}
          <Todo>Speicherdauer und Angaben zu Resend ergänzen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Cookies und Tracking">
        <p>Diese Website setzt keine Tracking-Cookies und keine Analyse-Dienste ein.</p>
      </LegalSection>

      <LegalSection title="Schriftarten">
        <p>Die Schrift Poppins wird lokal von unserem Server geladen. Es werden dafür keine Daten an Google übertragen.</p>
      </LegalSection>

      <LegalSection title="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde
          beschweren.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
