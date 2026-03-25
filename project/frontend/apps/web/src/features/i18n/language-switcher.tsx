import { useId } from "react";
import { useI18n } from "@/features/i18n/i18n-context";

export function LanguageSwitcher() {
  const id = useId();
  const { language, setLanguage, supportedLanguages, t } = useI18n();

  return (
    <div className="language-switcher">
      <label className="language-switcher-label" htmlFor={id}>
        {t("common.language.label")}
      </label>
      <select
        className="language-switcher-select"
        id={id}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        value={language}
      >
        {supportedLanguages.map((item) => (
          <option key={item} value={item}>
            {t(`common.language.${item}` as const)}
          </option>
        ))}
      </select>
    </div>
  );
}
