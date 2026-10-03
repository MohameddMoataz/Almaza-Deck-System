# Arabic Card Translation

These are community translations, not official Konami Arabic text. English identifiers, effects, artwork and placement rules are unchanged.

## Priority

1. Administrator-supplied Arabic text.
2. Prepared translation matching the actual English effect, ignoring whitespace and typographic quote differences.
3. A complete effect template with explicit stat/type/recipient parameters.
4. Context-aware machine translation with original English available in the details.

Never select effects by card name alone. Legacy, modern and administrator-edited cards can have different rules.

## Terminology

| English | Arabic | Meaning to preserve |
| --- | --- | --- |
| Equip / equipped | تجهيز / مجهَّز ببطاقة تجهيز | Equipment, not summoning. |
| Die / dice | حجر نرد / النرد | Not death. Preserve rolls and multipliers. |
| Toss a coin | ارمِ عملة | Separate from rolling dice. |
| Call it / heads or tails | توقّع النتيجة: صورة أو كتابة | Prediction, not calling/summoning. |
| Call it right / wrong | إذا صحّ توقّعك / إذا أخطأت | Keep both outcomes distinct. |
| Tribute / Tribute Summon | تضحية / استدعاء بالتضحية | Never تكريم. |
| Fusion / Deck | دمج / مجموعة | App terminology. |
| Draw | اسحب | Not drawing a picture or adding a searched card. |
| Discard | تخلّص من بطاقة من يدك | Different from send, destroy, Tribute. |
| Send to the GY | أرسل إلى المقبرة | Not necessarily destroy or discard. |
| Destroy / banish | دمّر / استبعد | Different operations. |
| Target / choose | استهدف / اختر | Never invent targeting. |
| Owner / controller | المالك / المتحكّم | Ownership and control can differ. |
| Face-up / face-down | مكشوف / مقلوب | Preserve position as well as orientation. |
| Negate activation / effect | أبطل التفعيل / أبطل التأثير | Not interchangeable. |
| You can / must / cannot | يمكنك / يجب / لا يمكن | Optional, mandatory, prohibited. |

## Review Checklist

- Preserve who acts/benefits: you, opponent, each player, either player.
- Preserve counts, up-to/exactly, at-least/at-most, AND/OR, exceptions and once-per-turn limits.
- Preserve timing: when/if, this/next turn, Damage Step/damage calculation.
- Preserve source/destination: hand, field, Graveyard, top/bottom of the Deck.
- Keep quoted card names identifiable and consistent with displayed names.
- Preserve ATK/DEF/LP, original/current values, gain/loss, doubling/halving.
- Preserve colons/semicolons separating conditions, activation actions and resolution. Not everything before a semicolon is a cost; it can include targeting.
- Do not treat `then`, `and if you do`, `also`, and `and` as interchangeable; timing and dependencies differ.
- Do not replace legacy effects with modern rules unless the English source changes.

References: [Konami conditions/activation/effects](https://www.yugioh-card.com/en/play/psct/psct-3/) and [conjunctions](https://www.yugioh-card.com/eu/play/understanding-card-text/part-7-conjunction-functions/).

## Maintenance

Add source-matched effects to `src/lib/arabicReviewedEffects.ts`. Use `arabicEffectTemplates.ts` only for complete unambiguous structures, with positive and negative tests. `ARABIC_TRANSLATION_VERSION` bypasses obsolete machine caches without invalidating administrator edits.

Free translation APIs do not accept instruction prompts. Contextual rewrites skip quoted names. Numeric checks catch changed stats, but do not prove semantic accuracy; 1 and 2 often become inflected Arabic words. Unknown effects remain labeled automatic, with their originals accessible.

Run `pnpm test:translations`. Optional live check: `pnpm exec tsx scripts/check-arabic-provider.ts` (external requests, no database changes).
