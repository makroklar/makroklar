import Image from 'next/image';
import Link from 'next/link';
import { menuImportOptions } from './data/menuImportOptions';
import styles from './MenuImportPage.module.css';

export function MenuImportPage() {
  return (
    <section className={styles.step} aria-labelledby="menu-import-title">
      <header className={styles.intro}>
        <h1 className={styles.title} id="menu-import-title">
          Lass uns deine Speisekarte importieren.
        </h1>
        <p className={styles.description}>
          Wähle einen Weg, um deine Gerichte in das System zu übertragen.
        </p>
      </header>
      <fieldset className={styles.options}>
        <legend className={styles.visuallyHidden}>Importmethode wählen</legend>
        {menuImportOptions.map((option) => {
          const content = (
            <>
              <span className={styles.icon}>
                <Image src={option.icon} alt="" />
              </span>
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionDescription}>
                {option.description}
              </span>
            </>
          );

          return option.href ? (
            <Link className={styles.option} href={option.href} key={option.id}>
              {content}
            </Link>
          ) : (
            <label className={styles.option} key={option.id}>
              <input
                className={styles.visuallyHidden}
                type="radio"
                name="menuImportMethod"
                value={option.id}
              />
              {content}
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
