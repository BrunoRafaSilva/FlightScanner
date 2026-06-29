# Eligibility Rules — Origin & Regulatory Basis

This document records **where the claim-eligibility rules in this POC come from**.
It is reference/context only — **this project is a POC and is not legally
accurate**.

The rules live in one place: `backend/src/modules/eligibility/eligibility.service.ts`
(the pure function `evaluateEligibility`). Live price-drop comparison lives in
`backend/src/modules/flight-search/pricedrop.service.ts`.

## Rules as implemented

| Claim type | Rule (in the app) | Compensation (US$) |
| --- | --- | --- |
| **DELAY** | `delayMinutes >= 180` | 250 / 400 / 600 at ≥180 / ≥240 / ≥300 min |
| **CANCELLATION** | flight `status = CANCELLED` | 250 |
| **DENIED_BOARDING** | always (POC) | 250 |
| **BAGGAGE** | description not empty | 150 |
| **PRICE_DROP** | live: current price < paid price | refund = paid − current |

## Origin within this project

These rules came from the **development plan that started this build**. That
plan's "Eligibility Rules" section defined them almost verbatim:

- delay ≥180 → 250, ≥240 → 400, ≥300 → 600
- cancellation → 250
- baggage → eligible if description is not empty
- price-drop → "description includes price information"

(Also recorded in `docs/superpowers/specs/2026-06-28-airline-claims-poc-design.md`.)

Filled in or changed **during** the build (not from that plan):

- **BAGGAGE = US$150** — the plan gave no amount; 150 was chosen as a placeholder.
- **DENIED_BOARDING = US$250, always eligible** — it was a claim *type* with no rule.
- **PRICE_DROP** evolved into a **live paid-vs-current price comparison** (the
  plan only checked for "price info" in the text).
- **Currency EUR → US$** — the 250 / 400 / 600 figures are the original amounts
  relabeled.

## Real-world basis ("the basement")

### 1. EU Regulation (EC) No 261/2004 — the source of 250 / 400 / 600
*"…establishing common rules on compensation and assistance to passengers in the
event of denied boarding and of cancellation or long delay of flights, and
repealing Regulation (EEC) No 295/91."* (European Parliament & Council,
11 Feb 2004.) Official text: **EUR-Lex, CELEX `32004R0261`**.

**Article 7 — Right to compensation:**

| Amount | Article 7 distance band |
| --- | --- |
| €250 | flights **≤ 1,500 km** |
| €400 | intra-EU flights > 1,500 km, and other flights **1,500–3,500 km** |
| €600 | all other flights (**> 3,500 km**) |

The same amounts apply to **denied boarding** (Art. 4 → Art. 7) and
**cancellation** (Art. 5 → Art. 7) — hence 250 for those in the app.

> ⚠️ The app **simplifies**: EC 261 tiers the amount by **flight distance**;
> this POC tiers it by **delay duration** (180 / 240 / 300 min). Same numbers,
> different trigger.

### 2. The 3-hour delay threshold — a CJEU ruling, not the text
EC 261's text only grants care/assistance for delay. The right to **monetary
compensation for a 3-hour+ delay** came from the Court of Justice of the EU:

- **Sturgeon and Others**, Joined Cases **C-402/07 and C-432/07** (19 Nov 2009)
- confirmed in **Nelson and Others**, Joined Cases **C-581/10 and C-629/10** (2012)

That 3 hours = the app's **180-minute** threshold.

### 3. Baggage — a different treaty (not EC 261)
The baggage rule (flat US$150) is a placeholder. Real baggage liability comes
from the **Montreal Convention 1999**, Articles 17 & 22(2) — currently capped at
**1,288 SDR** (≈ €1,500 / US$1,700; raised from 1,131 SDR in 2019). For EU
carriers it is incorporated via **Regulation (EC) No 889/2002**.

### 4. Price drop — no legal basis
There is no regulation behind price-drop. It mirrors **getjetback.com** (the
inspiration named in the original plan) — a commercial fare-drop / refund-tracking
service, not a passenger right.

## Summary of the data chain

```
initial project plan
   ├── EC 261/2004, Article 7 ............ the €250 / €400 / €600 amounts
   ├── CJEU Sturgeon (C-402/07) .......... the 3-hour (180-min) delay trigger
   ├── Montreal Convention 1999 .......... loosely echoed by the baggage rule
   └── getjetback.com business model ..... the price-drop idea
```

## References

- Regulation (EC) No 261/2004 — https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32004R0261
- CJEU, Sturgeon, Joined Cases C-402/07 & C-432/07 (2009)
- CJEU, Nelson, Joined Cases C-581/10 & C-629/10 (2012)
- Montreal Convention 1999 (ICAO) + Regulation (EC) No 889/2002
- getjetback.com — https://getjetback.com

> Disclaimer: simplified for demonstration. Not legal advice and not a faithful
> implementation of any jurisdiction's air-passenger-rights law.
