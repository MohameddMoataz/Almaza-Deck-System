"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeckCard } from "@prisma/client";
import { artworkLookupUrl, artworkProxyUrl, isDirectArtworkUrl, croppedArtworkUrl } from "@/lib/cardArtwork";
import { CardSummary } from "@/lib/cards";
import { canCardGoInSection, isFusionCard, SectionKey, deckSections, groupBySection, totalCopies } from "@/lib/deck";
import { Locale, sectionLabel, t } from "@/lib/i18n";
import type { PowerOfChaosCardOverride } from "@/lib/powerOfChaosCards";
import type { SavedCardSet } from "@/lib/savedSetData";
import { useArabicCardText } from "./useArabicCardText";

type Props = {
  owner: {
    id: string;
    username: string;
  };
  cards: DeckCard[];
  canEdit: boolean;
  isAdmin: boolean;
  initialSavedSets: SavedCardSet[];
  initialPowerOfChaosCards: PowerOfChaosCardOverride[];
  locale: Locale;
};

type Selection = {
  entryId: string;
  copy: number;
  section: SectionKey;
};

type SavedSetDraft = {
  name: string;
  description: string;
  cards: SavedCardSet["cards"];
};

type CardDetail = {
  nameAr?: string;
  descriptionAr?: string;
  image: string;
  artworkImage?: string;
  name: string;
  type: string;
  description: string;
  atk: number | null;
  def: number | null;
  level: number | null;
};

type PowerOfChaosDraft = {
  nameAr: string;
  descriptionAr: string;
  image: string;
  artworkImage: string;
  type: string;
  description: string;
  atk: string;
  def: string;
  level: string;
};

const tabs: Array<SectionKey | "CARDS" | "DETAILS"> = ["CARDS", ...deckSections, "DETAILS"];

function powerOfChaosMap(overrides: PowerOfChaosCardOverride[]) {
  return overrides.reduce<Record<string, PowerOfChaosCardOverride>>((acc, override) => {
    acc[override.name.toLowerCase()] = override;
    return acc;
  }, {});
}

function draftFromDetail(detail: CardDetail): PowerOfChaosDraft {
  return {
    nameAr: detail.nameAr ?? "",
    descriptionAr: detail.descriptionAr ?? "",
    image: detail.image,
    artworkImage: detail.artworkImage ?? "",
    type: detail.type,
    description: detail.description,
    atk: detail.atk === null ? "" : String(detail.atk),
    def: detail.def === null ? "" : String(detail.def),
    level: detail.level === null ? "" : String(detail.level)
  };
}

function numberFromDraft(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function SmartCardPreview({ card, locale, translated }: {
  card: CardDetail; locale: Locale; translated: { name: string; type: string; description: string };
}) {
  const isMonster = card.atk !== null || card.def !== null || card.level !== null;
  const isFusion = card.type.toLowerCase().includes("fusion");
  const stars = isMonster && card.level ? "★".repeat(Math.min(card.level, 12)) : "";
  const preferredArtwork = isDirectArtworkUrl(card.artworkImage) ? card.artworkImage : artworkProxyUrl(card.name);
  const [artwork, setArtwork] = useState(preferredArtwork);
  const [artworkFailed, setArtworkFailed] = useState(false);

  useEffect(() => {
    setArtwork(preferredArtwork);
    setArtworkFailed(false);
  }, [preferredArtwork]);

  return (
    <div
      className={`smart-card ${
        isFusion ? "fusion-card" : isMonster ? "monster-card" : card.type.includes("Trap") ? "trap-card" : "spell-card"
      }`}
    >
      <div className="smart-card-name" dir="auto">{translated.name}</div>
      {stars ? (
        <div className="smart-card-stars" aria-label={`${t(locale, "level")} ${card.level}`}>
          {Array.from({ length: Math.min(card.level ?? 0, 12) }, (_, index) => (
            <span key={index}>★</span>
          ))}
        </div>
      ) : <div className="smart-card-stars" dir="auto">{isMonster ? "" : translated.type}</div>}
      <div className="smart-card-art">
        {artwork && !artworkFailed ? (
          <img
            src={artwork}
            alt=""
            onError={() => {
              const fallback = croppedArtworkUrl(card.image);
              if (fallback && artwork !== fallback) setArtwork(fallback);
              else setArtworkFailed(true);
            }}
          />
        ) : (
          <span>{t(locale, "artworkNotFound")}</span>
        )}
      </div>
      <div className="smart-card-text" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} tabIndex={0} aria-label={t(locale, "cardDescriptionA11y")}>
        <div className="smart-card-type-row"><span>{translated.type}</span></div>
        <p dir="auto">{translated.description || t(locale, "noCardText")}</p>
        {isMonster ? (
          <div className="smart-card-stats">
            <span>ATK/{card.atk ?? "?"}</span>
            <span>DEF/{card.def ?? "?"}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeckManager({ owner, cards, canEdit, isAdmin, initialSavedSets, initialPowerOfChaosCards, locale }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSummary[]>([]);
  const [message, setMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [savedSets, setSavedSets] = useState(initialSavedSets);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<SavedSetDraft>({ name: "", description: "", cards: [] });
  const [resolvedSetCards, setResolvedSetCards] = useState<Record<string, CardSummary>>({});
  const [powerOfChaosCards, setPowerOfChaosCards] = useState<Record<string, PowerOfChaosCardOverride>>(
    () => powerOfChaosMap(initialPowerOfChaosCards)
  );
  const [powerOfChaosDraft, setPowerOfChaosDraft] = useState<PowerOfChaosDraft>({
    nameAr: "",
    descriptionAr: "",
    image: "",
    artworkImage: "",
    type: "",
    description: "",
    atk: "",
    def: "",
    level: ""
  });
  const [isSavingPowerOfChaosCard, setIsSavingPowerOfChaosCard] = useState(false);
  const [missingSetCards, setMissingSetCards] = useState<string[]>([]);
  const [isResolvingSet, setIsResolvingSet] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [importingSetId, setImportingSetId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardSummary | DeckCard | null>(null);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionKey | "CARDS" | "DETAILS">("MAIN");
  const [dragOver, setDragOver] = useState<SectionKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => groupBySection(cards), [cards]);
  const selectedCount = selection.length;
  const selectedDeckCards = useMemo(
    () =>
      selection
        .map((selected) => cards.find((card) => card.id === selected.entryId))
        .filter((card): card is DeckCard => Boolean(card)),
    [cards, selection]
  );

  async function runSearch(value: string, signal?: AbortSignal) {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setMessage("");
    setIsSearching(true);
    const response = await fetch(`/api/cards/search?q=${encodeURIComponent(trimmed)}`, { signal });
    const payload = (await response.json()) as { cards?: CardSummary[]; error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? t(locale, "searchFailed"));
      setIsSearching(false);
      return;
    }

    setResults(payload.cards ?? []);
    setIsSearching(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void runSearch(query, controller.signal).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(t(locale, "searchFailed"));
        setIsSearching(false);
      });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query);
  }

  async function deckRequest(body: unknown) {
    setMessage("");
    const response = await fetch("/api/deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? t(locale, "deckUpdateFailed"));
      return;
    }

    setSelection([]);
    setSelectionMode(false);
    startTransition(() => router.refresh());
  }

  async function importSavedSet(setId: string) {
    setMessage("");
    setImportMessage("");
    setImportingSetId(setId);

    const response = await fetch("/api/deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "importSet", ownerId: owner.id, setId })
    });
    const payload = (await response.json()) as { imported?: number; missing?: string[]; error?: string };

    setImportingSetId(null);

    if (!response.ok) {
      setMessage(payload.error ?? t(locale, "importFailed"));
      return;
    }

    const missing = payload.missing?.length ? t(locale, "missingMessage", { cards: payload.missing.join(", ") }) : "";
    setImportMessage(t(locale, "importedMessage", { count: payload.imported ?? 0, missing }));
    startTransition(() => router.refresh());
  }

  function startEditingSet(set: SavedCardSet) {
    setEditingSetId(set.id);
    setSetDraft({
      name: set.name,
      description: set.description,
      cards: set.cards
    });
    void resolveSetCards(set.cards);
  }

  async function resolveSetCards(nextCards: SavedCardSet["cards"]) {
    const names = nextCards.map((card) => card.name);
    if (!names.length) {
      setResolvedSetCards({});
      setMissingSetCards([]);
      return;
    }

    setIsResolvingSet(true);
    const response = await fetch("/api/cards/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names })
    });
    const payload = (await response.json()) as { cards?: CardSummary[]; missing?: string[]; error?: string };
    setIsResolvingSet(false);

    if (!response.ok) {
      setMessage(payload.error ?? t(locale, "resolveSetFailed"));
      return;
    }

    setResolvedSetCards(
      (payload.cards ?? []).reduce<Record<string, CardSummary>>((acc, card) => {
        acc[card.name.toLowerCase()] = card;
        return acc;
      }, {})
    );
    setMissingSetCards(payload.missing ?? []);
  }

  function addCardToSetDraft(card: CardSummary) {
    setSetDraft((draft) => {
      const existing = draft.cards.find((item) => item.name.toLowerCase() === card.name.toLowerCase());
      const cards = existing
        ? draft.cards.map((item) =>
            item.name.toLowerCase() === card.name.toLowerCase()
              ? { ...item, quantity: (item.quantity ?? 1) + 1 }
              : item
          )
        : [...draft.cards, { name: card.name }];

      void resolveSetCards(cards);
      return { ...draft, cards };
    });
  }

  function updateSetCardQuantity(cardName: string, delta: number) {
    setSetDraft((draft) => {
      const cards = draft.cards
        .map((card) =>
          card.name === cardName
            ? { ...card, quantity: Math.max(1, (card.quantity ?? 1) + delta) }
            : card
        );

      return { ...draft, cards };
    });
  }

  function removeCardFromSetDraft(cardName: string) {
    setSetDraft((draft) => {
      const cards = draft.cards.filter((card) => card.name !== cardName);
      void resolveSetCards(cards);
      return { ...draft, cards };
    });
  }

  async function saveSetEdit(set: SavedCardSet) {
    setMessage("");
    const nextSet = {
      ...set,
      name: setDraft.name.trim(),
      description: setDraft.description.trim(),
      cards: setDraft.cards
        .map((card) => ({
          name: card.name.trim(),
          quantity: card.quantity && card.quantity > 1 ? card.quantity : undefined
        }))
        .filter((card) => card.name)
    };

    if (!nextSet.name || nextSet.cards.length === 0) {
      setMessage(t(locale, "setValidation"));
      return;
    }

    const response = await fetch("/api/saved-sets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSet)
    });
    const payload = (await response.json()) as { savedSet?: SavedCardSet; error?: string };

    if (!response.ok || !payload.savedSet) {
      setMessage(payload.error ?? t(locale, "setSaveFailed"));
      return;
    }

    setSavedSets((current) => current.map((item) => (item.id === payload.savedSet!.id ? payload.savedSet! : item)));
    setEditingSetId(null);
  }

  function addCard(card: CardSummary, section: SectionKey) {
    void deckRequest({ action: "add", ownerId: owner.id, section, card });
  }

  function overrideForCard(name: string) {
    return powerOfChaosCards[name.toLowerCase()];
  }

  function deckCardImage(entry: DeckCard) {
    return overrideForCard(entry.cardName)?.image ?? entry.cardImage;
  }

  function selectionPayload() {
    const counts = new Map<string, number>();
    selection.forEach((item) => counts.set(item.entryId, (counts.get(item.entryId) ?? 0) + 1));
    return [...counts.entries()].map(([entryId, count]) => ({ entryId, count }));
  }

  function moveSelection(targetSection: SectionKey) {
    void deckRequest({
      action: "move",
      ownerId: owner.id,
      targetSection,
      selections: selectionPayload()
    });
  }

  function removeSelection() {
    void deckRequest({
      action: "remove",
      ownerId: owner.id,
      selections: selectionPayload()
    });
  }

  function moveSelectedDeckCard(entry: DeckCard, targetSection: SectionKey) {
    void deckRequest({
      action: "move",
      ownerId: owner.id,
      targetSection,
      selections: [{ entryId: entry.id, count: 1 }]
    }).then(() => setSelectedCard(null));
  }

  function removeSelectedDeckCard(entry: DeckCard) {
    void deckRequest({
      action: "remove",
      ownerId: owner.id,
      selections: [{ entryId: entry.id, count: 1 }]
    }).then(() => setSelectedCard(null));
  }

  function openDetails(card: CardSummary | DeckCard) {
    setSelectedCard(card);
    if (window.matchMedia("(max-width: 760px)").matches) {
      setActiveTab("DETAILS");
    }
  }

  function toggleCard(entry: DeckCard, copy: number, range: boolean) {
    setSelectedCard(entry);

    if (!canEdit) return;

    const item = { entryId: entry.id, copy, section: entry.section as SectionKey };
    const exists = selection.some((selected) => selected.entryId === entry.id && selected.copy === copy);

    if (range && selection.length) {
      const sectionCards = grouped[entry.section as SectionKey].flatMap((card) =>
        Array.from({ length: card.quantity }, (_, index) => ({ entryId: card.id, copy: index + 1, section: card.section as SectionKey }))
      );
      const last = selection[selection.length - 1];
      const start = sectionCards.findIndex((card) => card.entryId === last.entryId && card.copy === last.copy);
      const end = sectionCards.findIndex((card) => card.entryId === item.entryId && card.copy === item.copy);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelection(sectionCards.slice(from, to + 1));
        return;
      }
    }

    if (exists) {
      setSelection(selection.filter((selected) => selected.entryId !== entry.id || selected.copy !== copy));
      return;
    }

    setSelection([...selection, item]);
  }

  function selectAll(section: SectionKey) {
    setSelectionMode(true);
    setSelection(
      grouped[section].flatMap((card) =>
        Array.from({ length: card.quantity }, (_, index) => ({
          entryId: card.id,
          copy: index + 1,
          section
        }))
      )
    );
  }

  function startSelection(section?: SectionKey) {
    setSelectionMode(true);
    setSelection((current) => current.filter((item) => !section || item.section === section));
  }

  function cancelSelection() {
    setSelection([]);
    setSelectionMode(false);
  }

  function onDrop(section: SectionKey, event: React.DragEvent) {
    event.preventDefault();
    setDragOver(null);
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as
        | { kind: "deck-entry"; entryId: string }
        | { kind: "search-card"; card: CardSummary }
        | { entryId: string };

      if ("kind" in data && data.kind === "search-card") {
        addCard(data.card, section);
        return;
      }

      const entryId = "entryId" in data ? data.entryId : "";
      if (!entryId) return;

      void deckRequest({
        action: "move",
        ownerId: owner.id,
        targetSection: section,
        selections: [{ entryId, count: 1 }]
      });
    } catch {
      setMessage(t(locale, "dropFailed"));
    }
  }

  const selectedDetail: CardDetail | null = selectedCard
    ? "cardApiId" in selectedCard
      ? {
          image: selectedCard.cardImage,
          name: selectedCard.cardName,
          type: selectedCard.cardType,
          description: selectedCard.description,
          atk: selectedCard.atk,
          def: selectedCard.def,
          level: selectedCard.level
        }
      : selectedCard
    : null;
  const displayedDetail = selectedDetail
    ? {
        ...selectedDetail,
        nameAr: powerOfChaosCards[selectedDetail.name.toLowerCase()]?.nameAr,
        descriptionAr: powerOfChaosCards[selectedDetail.name.toLowerCase()]?.descriptionAr,
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.image
          ? { image: powerOfChaosCards[selectedDetail.name.toLowerCase()].image! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.artworkImage
          ? { artworkImage: powerOfChaosCards[selectedDetail.name.toLowerCase()].artworkImage! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.type
          ? { type: powerOfChaosCards[selectedDetail.name.toLowerCase()].type! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.description
          ? { description: powerOfChaosCards[selectedDetail.name.toLowerCase()].description! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.atk !== undefined
          ? { atk: powerOfChaosCards[selectedDetail.name.toLowerCase()].atk! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.def !== undefined
          ? { def: powerOfChaosCards[selectedDetail.name.toLowerCase()].def! }
          : {}),
        ...(powerOfChaosCards[selectedDetail.name.toLowerCase()]?.level !== undefined
          ? { level: powerOfChaosCards[selectedDetail.name.toLowerCase()].level! }
          : {})
      }
    : null;
  const liveDetail = displayedDetail && isAdmin
    ? {
        ...displayedDetail,
        nameAr: powerOfChaosDraft.nameAr,
        descriptionAr: powerOfChaosDraft.descriptionAr,
        image: powerOfChaosDraft.image.trim() || displayedDetail.image,
        artworkImage: powerOfChaosDraft.artworkImage.trim() || displayedDetail.artworkImage,
        type: powerOfChaosDraft.type.trim() || displayedDetail.type,
        description: powerOfChaosDraft.description,
        atk: numberFromDraft(powerOfChaosDraft.atk),
        def: numberFromDraft(powerOfChaosDraft.def),
        level: numberFromDraft(powerOfChaosDraft.level)
      }
    : displayedDetail;
  const arabic = useArabicCardText(locale, [
    ...(liveDetail ? [
      ...(liveDetail.descriptionAr ? [] : [liveDetail.description]),
      ...(liveDetail.nameAr ? [] : [liveDetail.name]),
      liveDetail.type
    ] : []),
    ...results.flatMap((card) => [card.name, card.type]),
    ...cards.map((card) => card.cardName),
    ...savedSets.flatMap((set) => set.cards.map((card) => card.name)),
    ...Object.values(resolvedSetCards).flatMap((card) => [card.name, card.type])
  ]);
  function cardName(name: string) {
    return locale === "ar" ? powerOfChaosCards[name.toLowerCase()]?.nameAr || arabic.text(name) : name;
  }
  const translatedDetail = liveDetail ? {
    name: locale === "ar" ? liveDetail.nameAr || arabic.text(liveDetail.name) : liveDetail.name,
    description: locale === "ar" ? liveDetail.descriptionAr || arabic.text(liveDetail.description) : liveDetail.description,
    type: arabic.text(liveDetail.type)
  } : null;
  const selectedDeckEntry = selectedCard && "cardApiId" in selectedCard ? selectedCard : null;
  const detailMoveTargets: SectionKey[] = selectedDeckEntry
    ? selectedDeckEntry.section === "EXTRA_CARDS"
      ? (["MAIN", "EXTRA", "SIDE"] as SectionKey[]).filter((section) => canCardGoInSection(selectedDeckEntry.cardType, section))
      : ["EXTRA_CARDS"]
    : [];

  function placementTitle(cardType: string, section: SectionKey) {
    if (canCardGoInSection(cardType, section)) return undefined;
    return isFusionCard(cardType)
      ? t(locale, "fusionPlacement")
      : t(locale, "nonFusionPlacement");
  }

  useEffect(() => {
    if (!displayedDetail) return;
    const savedArtwork = powerOfChaosCards[displayedDetail.name.toLowerCase()]?.artworkImage;
    setPowerOfChaosDraft(
      draftFromDetail({
        ...displayedDetail,
        artworkImage: isDirectArtworkUrl(savedArtwork) ? savedArtwork : ""
      })
    );

    if (isDirectArtworkUrl(savedArtwork)) return;

    const controller = new AbortController();
    void fetch(artworkLookupUrl(displayedDetail.name), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { artworkImage?: string | null } | null) => {
        if (!payload?.artworkImage) return;
        setPowerOfChaosDraft((draft) => ({
          ...draft,
          artworkImage: draft.artworkImage || payload.artworkImage!
        }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [displayedDetail?.name]);

  async function savePowerOfChaosCard() {
    if (!displayedDetail) return;

    setMessage("");
    setIsSavingPowerOfChaosCard(true);
    const body: PowerOfChaosCardOverride = {
      name: displayedDetail.name,
      nameAr: powerOfChaosDraft.nameAr.trim(),
      descriptionAr: powerOfChaosDraft.descriptionAr.trim(),
      image: powerOfChaosDraft.image.trim(),
      artworkImage: powerOfChaosDraft.artworkImage.trim(),
      type: powerOfChaosDraft.type.trim(),
      description: powerOfChaosDraft.description.trim(),
      atk: numberFromDraft(powerOfChaosDraft.atk),
      def: numberFromDraft(powerOfChaosDraft.def),
      level: numberFromDraft(powerOfChaosDraft.level)
    };

    const response = await fetch("/api/power-of-chaos-cards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { card?: PowerOfChaosCardOverride; error?: string };
    setIsSavingPowerOfChaosCard(false);

    if (!response.ok || !payload.card) {
      setMessage(payload.error ?? t(locale, "powerSaveFailed"));
      return;
    }

    setPowerOfChaosCards((current) => ({
      ...current,
      [payload.card!.name.toLowerCase()]: payload.card!
    }));
    setMessage(t(locale, "powerSaved"));
  }

  return (
    <>
      <div className="mobile-tabs">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab === "CARDS" ? t(locale, "cards") : tab === "DETAILS" ? t(locale, "details") : sectionLabel(locale, tab)}
          </button>
        ))}
      </div>

      <div className="deck-grid">
        <aside className={`panel library-panel ${activeTab !== "CARDS" ? "mobile-hidden" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">{t(locale, "cardDatabase")}</h2>
          </div>
          <div className="panel-body">
            <div className="saved-set-list">
              {savedSets.map((set) => {
                const cardCount = set.cards.reduce((sum, card) => sum + (card.quantity ?? 1), 0);
                const isEditing = editingSetId === set.id;
                return (
                  <section className="saved-set-card" key={set.id}>
                    {isEditing ? (
                      <div className="saved-set-editor">
                        <label>
                          {t(locale, "setName")}
                          <input
                            value={setDraft.name}
                            onChange={(event) => setSetDraft((draft) => ({ ...draft, name: event.target.value }))}
                          />
                        </label>
                        <label>
                          {t(locale, "description")}
                          <input
                            value={setDraft.description}
                            onChange={(event) => setSetDraft((draft) => ({ ...draft, description: event.target.value }))}
                          />
                        </label>
                        <label>
                          {t(locale, "addCards")}
                          <span className="tiny-meta">{t(locale, "addCardsHelp")}</span>
                        </label>
                        {isResolvingSet ? <span className="tiny-meta">{t(locale, "loadingCardImages")}</span> : null}
                        {missingSetCards.length ? (
                          <div className="error">{t(locale, "missingFromYgo", { cards: missingSetCards.join(", ") })}</div>
                        ) : null}
                        <div className="saved-set-edit-grid">
                          {setDraft.cards.map((savedCard) => {
                            const resolvedCard = resolvedSetCards[savedCard.name.toLowerCase()];
                            return (
                              <div className="saved-set-edit-card" key={savedCard.name}>
                                {resolvedCard ? (
                                  <img src={resolvedCard.image} alt="" />
                                ) : (
                                  <div className="missing-card-art">?</div>
                                )}
                                <strong dir="auto">{cardName(savedCard.name)}</strong>
                                <span className="tiny-meta">
                                  {resolvedCard ? arabic.text(resolvedCard.type) : t(locale, "unresolvedCard")}
                                </span>
                                <div className="quantity-controls">
                                  <button onClick={() => updateSetCardQuantity(savedCard.name, -1)} type="button">
                                    -
                                  </button>
                                  <span>{savedCard.quantity ?? 1}</span>
                                  <button onClick={() => updateSetCardQuantity(savedCard.name, 1)} type="button">
                                    +
                                  </button>
                                </div>
                                <button className="danger-button" onClick={() => removeCardFromSetDraft(savedCard.name)} type="button">
                                  {t(locale, "remove")}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="selection-actions">
                          <button onClick={() => saveSetEdit(set)} type="button">
                            {t(locale, "saveSet")}
                          </button>
                          <button onClick={() => setEditingSetId(null)} type="button">
                            {t(locale, "cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{set.name}</strong>
                          <p className="tiny-meta">{set.description}</p>
                          <span className="tiny-meta">{t(locale, "importedToExtraCards", { count: cardCount })}</span>
                        </div>
                        <div className="selection-actions saved-set-actions">
                          {canEdit ? (
                            <button disabled={importingSetId === set.id} onClick={() => importSavedSet(set.id)} type="button">
                              {importingSetId === set.id ? t(locale, "importing") : t(locale, "importSet")}
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button onClick={() => startEditingSet(set)} type="button">
                              {t(locale, "editSet")}
                            </button>
                          ) : null}
                        </div>
                        <details className="saved-set-details">
                          <summary>{t(locale, "viewCards")}</summary>
                          <div className="saved-set-names">
                            {set.cards.map((card) => (
                              <span key={card.name}>
                                {cardName(card.name)}
                                {card.quantity && card.quantity > 1 ? ` x${card.quantity}` : ""}
                              </span>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </section>
                );
              })}
              {importMessage ? <div className="success-message">{importMessage}</div> : null}
            </div>
            <form className="form-stack" onSubmit={search}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(locale, "searchPlaceholder")} />
              <button type="submit" disabled={isSearching}>{isSearching ? t(locale, "searching") : t(locale, "search")}</button>
            </form>
            <div className="search-results">
              {results.map((card) => (
                <div className="result-card" key={card.id}>
                  <button
                    className="result-row"
                    draggable={canEdit}
                    onClick={() => {
                      setSelectedCard(card);
                      setActiveTab("DETAILS");
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/json", JSON.stringify({ kind: "search-card", card }));
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    type="button"
                  >
                    <img src={card.image} alt="" />
                    <span>
                      <strong dir="auto">{cardName(card.name)}</strong>
                      <span className="tiny-meta">{arabic.text(card.type)}</span>
                    </span>
                  </button>
                  {isAdmin && editingSetId ? (
                    <button className="compact-button" onClick={() => addCardToSetDraft(card)} type="button">
                      {t(locale, "addToSet")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main>
          <section className="panel">
            <div className="panel-header">
              <h1 className="panel-title">{t(locale, "ownerDeck", { username: owner.username })}</h1>
              <div className="deck-toolbar">
                <span className="tiny-meta">{t(locale, "totalCards", { count: totalCopies(cards) })}</span>
                {canEdit ? (
                  <button
                    className={selectionMode ? "active" : ""}
                    onClick={() => (selectionMode ? cancelSelection() : startSelection())}
                    type="button"
                  >
                    {selectionMode ? t(locale, "doneSelecting") : t(locale, "selectCards")}
                  </button>
                ) : null}
              </div>
            </div>
            {selectionMode && canEdit ? (
              <div className="selection-mode-banner">
                <strong>{t(locale, "selectionMode")}</strong>
                <span className="tiny-meta">{t(locale, "selectionHelp")}</span>
              </div>
            ) : null}
            {message ? <div className="error">{message}</div> : null}
            <div className="deck-sections">
              {deckSections.map((section) => (
                <section
                  className={`section-drop ${dragOver === section ? "drag-over" : ""} ${activeTab !== section ? "mobile-hidden" : ""}`}
                  key={section}
                  onDragOver={(event) => {
                    if (!canEdit) return;
                    event.preventDefault();
                    setDragOver(section);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => onDrop(section, event)}
                >
                  <div className="section-header">
                    <h2 className="section-title">{sectionLabel(locale, section)}</h2>
                    <span className="tiny-meta">{totalCopies(grouped[section])} {t(locale, "cards")}</span>
                    {canEdit ? (
                      <div className="section-controls">
                        <button onClick={() => startSelection(section)} type="button">
                          {t(locale, "select")}
                        </button>
                        <button disabled={!selectionMode} onClick={() => selectAll(section)} type="button">
                          {t(locale, "selectAll")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="card-grid">
                    {grouped[section].flatMap((entry) =>
                      Array.from({ length: entry.quantity }, (_, index) => {
                        const copy = index + 1;
                        const selected = selection.some((item) => item.entryId === entry.id && item.copy === copy);
                        return (
                          <button
                            className={`card-tile ${selected ? "selected" : ""}`}
                            draggable={canEdit}
                            key={`${entry.id}-${copy}`}
                            onClick={(event) => {
                              if (selectionMode) {
                                toggleCard(entry, copy, event.shiftKey);
                                return;
                              }

                              openDetails(entry);
                            }}
                            onDragStart={(event) => {
                              event.dataTransfer.setData("application/json", JSON.stringify({ kind: "deck-entry", entryId: entry.id }));
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            type="button"
                          >
                            <img src={deckCardImage(entry)} alt="" />
                            {selectionMode ? <span className="select-mark">{selected ? t(locale, "selected") : t(locale, "select")}</span> : null}
                            {entry.quantity > 1 ? <span className="copy-chip">{copy}</span> : null}
                            <span className="card-name" dir="auto">{cardName(entry.cardName)}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>

            {canEdit && selectionMode ? (
              <div className="selection-bar">
                <div className="selection-summary">
                  <strong>{t(locale, "selectedCount", { count: selectedCount, plural: selectedCount === 1 ? "" : "s" })}</strong>
                  <span className="tiny-meta">{t(locale, "bulkHelp")}</span>
                </div>
                <div className="selection-actions">
                  {deckSections.map((section) => (
                    (() => {
                      const invalidCard = selectedDeckCards.find((card) => !canCardGoInSection(card.cardType, section));
                      return (
                        <button
                          disabled={isPending || selectedCount === 0 || Boolean(invalidCard)}
                          key={section}
                          onClick={() => moveSelection(section)}
                          title={invalidCard ? placementTitle(invalidCard.cardType, section) : undefined}
                        >
                          {t(locale, "moveTo", { section: sectionLabel(locale, section) })}
                        </button>
                      );
                    })()
                  ))}
                  <button className="danger-button" disabled={isPending || selectedCount === 0} onClick={removeSelection}>{t(locale, "remove")}</button>
                  <button disabled={selectedCount === 0} onClick={() => setSelection([])}>{t(locale, "clear")}</button>
                  <button onClick={cancelSelection}>{t(locale, "exitSelect")}</button>
                </div>
              </div>
            ) : null}
          </section>
        </main>

        <aside className={`panel details-panel ${activeTab !== "DETAILS" ? "mobile-hidden" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">{t(locale, "cardDetails")}</h2>
            {arabic.loading ? <p className="tiny-meta" role="status">{t(locale, "translatingCards")}</p> : null}
            {arabic.failed ? (
              <div className="tiny-meta" role="status">
                {t(locale, "translationUnavailable")}
                <button type="button" onClick={arabic.retry}>{t(locale, "retryTranslation")}</button>
              </div>
            ) : null}
          </div>
          <div className="panel-body">
            {liveDetail ? (
              <>
                <SmartCardPreview card={liveDetail} locale={locale} translated={translatedDetail!} />
                <h2 dir="auto">{translatedDetail!.name}</h2>
                <p className="tiny-meta">{translatedDetail!.type}</p>
                <div className="stats">
                  <div className="stat">
                    <span>ATK</span>
                    {liveDetail.atk ?? "-"}
                  </div>
                  <div className="stat">
                    <span>DEF</span>
                    {liveDetail.def ?? "-"}
                  </div>
                  <div className="stat">
                    <span>{t(locale, "level")}</span>
                    {liveDetail.level ?? "-"}
                  </div>
                </div>
                <p dir="auto">{translatedDetail!.description}</p>
                {canEdit && !("cardApiId" in selectedCard!) ? (
                  <div className="selection-actions">
                    {deckSections.map((section) => (
                      <button
                        disabled={!canCardGoInSection((selectedCard as CardSummary).type, section)}
                        key={section}
                        onClick={() => addCard(selectedCard as CardSummary, section)}
                        title={placementTitle((selectedCard as CardSummary).type, section)}
                      >
                        {t(locale, "addTo", { section: sectionLabel(locale, section) })}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isAdmin ? (
                  <div className="detail-action-panel">
                    <strong>{t(locale, "powerOfChaosData")}</strong>
                    <span className="tiny-meta">
                      {t(locale, "powerOfChaosHelp")}
                    </span>
                    <label>
                      {t(locale, "cardImageUrl")}
                      <input
                        value={powerOfChaosDraft.image}
                        onChange={(event) =>
                          setPowerOfChaosDraft((draft) => ({ ...draft, image: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      {t(locale, "artworkImageUrl")}
                      <input
                        placeholder={t(locale, "artworkPlaceholder")}
                        value={powerOfChaosDraft.artworkImage}
                        onChange={(event) =>
                          setPowerOfChaosDraft((draft) => ({ ...draft, artworkImage: event.target.value }))
                        }
                      />
                      <span className="tiny-meta">{t(locale, "artworkHelp")}</span>
                    </label>
                    <button
                      className="compact-button"
                      onClick={() => {
                        setPowerOfChaosDraft((draft) => ({
                          ...draft,
                          artworkImage: ""
                        }));
                        void fetch(artworkLookupUrl(liveDetail.name))
                          .then((response) => (response.ok ? response.json() : null))
                          .then((payload: { artworkImage?: string | null } | null) => {
                            if (!payload?.artworkImage) return;
                            setPowerOfChaosDraft((draft) => ({
                              ...draft,
                              artworkImage: payload.artworkImage!
                            }));
                          }).catch(() => setMessage(t(locale, "artworkResolveFailed")));
                      }}
                      type="button"
                    >
                      {t(locale, "useWikiArtwork")}
                    </button>
                    <label>
                      {t(locale, "type")}
                      <input
                        value={powerOfChaosDraft.type}
                        onChange={(event) =>
                          setPowerOfChaosDraft((draft) => ({ ...draft, type: event.target.value }))
                        }
                      />
                    </label>
                    <div className="legacy-stat-editor">
                      <label>
                        ATK
                        <input
                          inputMode="numeric"
                          value={powerOfChaosDraft.atk}
                          onChange={(event) =>
                            setPowerOfChaosDraft((draft) => ({ ...draft, atk: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        DEF
                        <input
                          inputMode="numeric"
                          value={powerOfChaosDraft.def}
                          onChange={(event) =>
                            setPowerOfChaosDraft((draft) => ({ ...draft, def: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        {t(locale, "level")}
                        <input
                          inputMode="numeric"
                          value={powerOfChaosDraft.level}
                          onChange={(event) =>
                            setPowerOfChaosDraft((draft) => ({ ...draft, level: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      {t(locale, "effectDescription")}
                      <textarea
                        value={powerOfChaosDraft.description}
                        onChange={(event) =>
                          setPowerOfChaosDraft((draft) => ({ ...draft, description: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      {t(locale, "arabicCardName")}
                      <input lang="ar" dir="rtl" maxLength={200}
                        placeholder={locale === "ar" ? arabic.text(liveDetail.name) : t(locale, "automaticTranslation")}
                        value={powerOfChaosDraft.nameAr}
                        onChange={(event) => setPowerOfChaosDraft((draft) => ({ ...draft, nameAr: event.target.value }))}
                      />
                    </label>
                    <label>
                      {t(locale, "arabicCardDescription")}
                      <textarea lang="ar" dir="rtl" maxLength={10000}
                        placeholder={locale === "ar" ? arabic.text(liveDetail.description) : t(locale, "automaticTranslation")}
                        value={powerOfChaosDraft.descriptionAr}
                        onChange={(event) => setPowerOfChaosDraft((draft) => ({ ...draft, descriptionAr: event.target.value }))}
                      />
                    </label>
                    <button disabled={isSavingPowerOfChaosCard} onClick={savePowerOfChaosCard} type="button">
                      {isSavingPowerOfChaosCard ? t(locale, "saving") : t(locale, "savePowerData")}
                    </button>
                  </div>
                ) : null}
                {canEdit && selectedDeckEntry ? (
                  <div className="detail-action-panel">
                    <strong>{t(locale, "deckActions")}</strong>
                    <span className="tiny-meta">
                      {t(locale, "cardIsIn", { section: sectionLabel(locale, selectedDeckEntry.section as SectionKey) })}
                    </span>
                    <div className="selection-actions">
                      {detailMoveTargets.map((section) => (
                        <button disabled={isPending} key={section} onClick={() => moveSelectedDeckCard(selectedDeckEntry, section)}>
                          {t(locale, "moveTo", { section: sectionLabel(locale, section) })}
                        </button>
                      ))}
                      <button className="danger-button" disabled={isPending} onClick={() => removeSelectedDeckCard(selectedDeckEntry)}>
                        {t(locale, "removeFromDeck")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="tiny-meta">{t(locale, "emptyDetails")}</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
