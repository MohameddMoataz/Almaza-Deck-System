import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { localeCookieName, normalizeLocale, t } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);
  return { title: t(locale, "brandName") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand">
              <strong>{t(locale, "brandName")}</strong>
              <span>{t(locale, "brandSubtitle")}</span>
            </Link>
            <nav className="nav-actions">
              <Link className="nav-button" href="/">
                {t(locale, "publicDecks")}
              </Link>
              {user ? (
                <>
                  <Link className="nav-button" href={`/users/${user.username}`}>
                    {t(locale, "myDeck")}
                  </Link>
                  <span className="tiny-meta">{user.username}</span>
                  {user.role === "ADMIN" ? <span className="tiny-meta">ADMIN</span> : null}
                  <form action="/api/auth/logout" method="post">
                    <button type="submit">{t(locale, "logout")}</button>
                  </form>
                </>
              ) : (
                <>
                  <Link className="nav-button" href="/login">{t(locale, "login")}</Link>
                  <Link className="nav-button" href="/signup">{t(locale, "signup")}</Link>
                </>
              )}
              <LanguageSwitcher locale={locale} />
            </nav>
          </header>
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
