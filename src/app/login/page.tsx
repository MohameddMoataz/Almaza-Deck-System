import Link from "next/link";
import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale, t } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>{t(locale, "login")}</h1>
        <form className="form-stack" action="/api/auth/login" method="post">
          {error ? <div className="error">{error}</div> : null}
          <label>
            {t(locale, "username")}
            <input name="username" autoComplete="username" required minLength={3} />
          </label>
          <label>
            {t(locale, "password")}
            <input name="password" type="password" autoComplete="current-password" required minLength={6} />
          </label>
          <button type="submit">{t(locale, "enterDeckSystem")}</button>
        </form>
        <p className="tiny-meta">
          {t(locale, "needAccount")} <Link href="/signup">{t(locale, "signup")}</Link>
        </p>
      </section>
    </main>
  );
}
