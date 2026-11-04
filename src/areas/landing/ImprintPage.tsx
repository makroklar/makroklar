import { LegalPage, LegalSection } from './components/shared/LegalPage';
import { Todo } from './components/shared/Todo';

export function ImprintPage() {
  return (
    <LegalPage title="Impressum" notice="Entwurf: Die markierten Angaben fehlen noch. Vor der Veröffentlichung ergänzen und prüfen lassen.">
      <LegalSection title="Angaben gemäß § 5 DDG">
        <p><Todo>Name oder Firma der Verantwortlichen</Todo></p>
        <p><Todo>Straße und Hausnummer</Todo></p>
        <p><Todo>PLZ und Ort</Todo></p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>E-Mail: <Todo>E-Mail-Adresse</Todo></p>
        <p>Telefon: <Todo>Telefonnummer oder anderer schneller Kontaktweg</Todo></p>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p><Todo>Name und Anschrift</Todo></p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte">
        <p>
          Wir erstellen die Inhalte dieser Website mit Sorgfalt. Für Richtigkeit, Vollständigkeit und Aktualität können
          wir jedoch keine Gewähr übernehmen. Nährwert- und Allergenangaben zu Gerichten stammen von den jeweiligen
          Betrieben und sind Richtwerte. Sie ersetzen keine medizinische Beratung.
        </p>
      </LegalSection>

      <LegalSection title="Haftung für Links">
        <p>
          Für Inhalte externer Websites, auf die wir verlinken, sind deren Betreiber verantwortlich. Werden uns
          Rechtsverstöße bekannt, entfernen wir solche Links umgehend.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
