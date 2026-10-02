"use client";

import { useEffect, useRef, useState } from "react";
import { arabicCardText, normalizeArabicCardTerms } from "@/lib/arabicCardText";
import type { Locale } from "@/lib/i18n";

export function useArabicCardText(locale: Locale, texts: string[]) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const known = useRef<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const serialized = JSON.stringify([...new Set(texts.filter(Boolean))]);

  useEffect(() => {
    if (locale !== "ar") return;
    const controller = new AbortController();
    const missing = (JSON.parse(serialized) as string[])
      .filter((text) => !arabicCardText[text] && !known.current[text] && /[a-z]/i.test(text));
    setFailed(false);
    setLoading(missing.length > 0);
    const timer = setTimeout(async () => {
      try {
        for (let offset = 0; offset < missing.length; offset += 8) {
          const response = await fetch("/api/cards/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ texts: missing.slice(offset, offset + 8) })
          });
          if (!response.ok) throw new Error("Translation unavailable");
          const payload = await response.json() as { translations: Record<string, string>; failed: string[] };
          if (controller.signal.aborted) return;
          Object.assign(known.current, payload.translations);
          setTranslations({ ...known.current });
          if (payload.failed.length) setFailed(true);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [locale, serialized, attempt]);

  return {
    text: (source: string) => locale === "ar" ? normalizeArabicCardTerms(source, arabicCardText[source] ?? translations[source] ?? source) : source,
    loading: locale === "ar" && loading,
    failed: locale === "ar" && failed,
    retry: () => setAttempt((value) => value + 1)
  };
}
