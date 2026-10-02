"use client";

import { useRouter } from "next/navigation";
import { Locale, localeCookieName, t } from "@/lib/i18n";

type Props = {
  locale: Locale;
};

export function LanguageSwitcher({ locale }: Props) {
  const router = useRouter();

  function changeLocale(nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <label className="language-switcher">
      <span>{t(locale, "language")}</span>
      <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
        <option value="en">{t(locale, "english")}</option>
        <option value="ar">{t(locale, "arabic")}</option>
      </select>
    </label>
  );
}
