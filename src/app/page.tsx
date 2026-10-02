import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { totalCopies } from "@/lib/deck";
import { localeCookieName, normalizeLocale, t } from "@/lib/i18n";
import { UserDeleteButton } from "@/components/UserDeleteButton";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: {
      username: true,
      role: true,
      deckCards: { select: { quantity: true } }
    }
  });

  return (
    <main className="page">
      <div className="home-grid">
        <section className="panel">
          <div className="panel-header">
            <h1 className="panel-title">{t(locale, "publicDuelistDecks")}</h1>
            {currentUser ? <Link href={`/users/${currentUser.username}`}>{t(locale, "openMyDeck")}</Link> : null}
          </div>
          <div className="panel-body user-list">
            {users.length ? (
              users.map((user) => (
                <div className="user-row" key={user.username}>
                  <Link className="user-link" href={`/users/${user.username}`}>
                    <strong>{user.username}</strong>
                    <span className="tiny-meta">
                      {user.role === "ADMIN" ? t(locale, "adminPrefix") : ""}
                      {totalCopies(user.deckCards)} {t(locale, "cards")}
                    </span>
                  </Link>
                  {currentUser?.role === "ADMIN" && user.role !== "ADMIN" ? (
                    <UserDeleteButton username={user.username} locale={locale} />
                  ) : null}
                </div>
              ))
            ) : (
              <p>{t(locale, "noDuelists")}</p>
            )}
          </div>
        </section>
        <aside className="panel">
          <div className="panel-header">
            <h2 className="panel-title">{t(locale, "v1Rules")}</h2>
          </div>
          <div className="panel-body">
            <p>{t(locale, "rulesDecks")}</p>
            <p className="tiny-meta">
              {t(locale, "rulesEditing")}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
