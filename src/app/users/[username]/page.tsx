import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { DeckManager } from "@/components/DeckManager";
import { getCurrentUser } from "@/lib/auth";
import { getDeckByUsername } from "@/lib/deck";
import { localeCookieName, normalizeLocale } from "@/lib/i18n";
import { readPowerOfChaosOverrides } from "@/lib/powerOfChaosCards";
import { readSavedCardSets } from "@/lib/savedSets";

export default async function UserDeckPage({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const deck = await getDeckByUsername(username.toLowerCase());
  if (!deck) notFound();

  const currentUser = await getCurrentUser();
  const canEdit = Boolean(currentUser && (currentUser.id === deck.id || currentUser.role === "ADMIN"));
  const savedSets = await readSavedCardSets();
  const powerOfChaosCards = await readPowerOfChaosOverrides();
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <main className="page">
      <DeckManager
        owner={{ id: deck.id, username: deck.username }}
        cards={deck.deckCards}
        canEdit={canEdit}
        isAdmin={currentUser?.role === "ADMIN"}
        initialSavedSets={savedSets}
        initialPowerOfChaosCards={powerOfChaosCards}
        locale={locale}
        initialTab={(await searchParams).tab}
      />
    </main>
  );
}
