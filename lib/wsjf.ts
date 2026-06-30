// ============================================================
// lib/wsjf.ts — SAFe WSJF (Weighted Shortest Job First)
// ============================================================
// WSPOMAGANIE DECYZJI (decision support) — NIE jest to model ML ani wywołanie
// LLM. To jawny, deterministyczny wzór ze Scaled Agile Framework. Jedynym
// faktycznym ML w systemie jest klasyfikator typu zadania (U1).
//
// WZÓR (SAFe):
//   WSJF = Cost of Delay / Job Size
//   gdzie Cost of Delay = User-Business Value + Time Criticality
//                         + Risk Reduction / Opportunity Enablement
//   źródło: Scaled Agile Framework, "WSJF"
//           https://scaledagileframework.com/wsjf/  (URL to verify)
//
// Wyższy WSJF ⇒ wyższy priorytet (najkrótsza ważona praca najpierw).
//
// ZNANE OGRANICZENIA WSJF (świadomie udokumentowane na potrzeby pracy dyplom.):
//   1. SUBIEKTYWNOŚĆ WEJŚĆ — wszystkie 4 komponenty to relatywne oszacowania
//      ekspertów na skali Fibonacciego; różni oceniający dają różne wartości.
//   2. PODWÓJNE LICZENIE (double-counting) w komponentach Cost of Delay —
//      User Value, Time Criticality i Risk Reduction często korelują/nakładają
//      się, przez co ta sama "wartość" bywa liczona wielokrotnie w liczniku.
//   3. INFLACJA POJEDYNCZEGO INTERESARIUSZA (single-stakeholder inflation) —
//      przy jednym oceniającym (tu: 3-osobowy zespół) brak uśrednienia perspektyw
//      sprzyja zawyżaniu wartości pod własne priorytety.
//   Atrybucja krytyki:
//     - D. Reinertsen, "The Principles of Product Development Flow" (2009) —
//       formalne ujęcie Cost of Delay i WSJF.            (ISBN/DOI to verify)
//     - J. Yip (jchyip), krytyka praktyki WSJF — problem double-countingu i
//       subiektywności komponentów CoD.                  (URL to verify)
//
// Wniosek projektowy: WSJF traktujemy jako PODPOWIEDŹ kolejności, a nie wyrocznię.
// Liczby pozostają w pełni edytowalne, a finalną decyzję podejmuje człowiek.
// ============================================================

// Dozwolona skala wejść (modified Fibonacci SAFe). Spójna z CHECK w migracji 020.
export const WSJF_FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const

export interface WsjfInputs {
  userValue: number
  timeCriticality: number
  riskReduction: number
  jobSize: number
}

/**
 * Sprawdza, czy wartość jest dodatnia i należy do dozwolonej skali Fibonacciego.
 */
export function isValidWsjfValue(value: number): boolean {
  return Number.isInteger(value) && (WSJF_FIBONACCI as readonly number[]).includes(value)
}

/**
 * Czy komplet 4 wejść jest poprawny (wszystkie na skali, jobSize > 0).
 * Pozwala wywołującemu zdecydować, czy w ogóle liczyć WSJF dla zadania.
 */
export function hasValidWsjfInputs(inputs: Partial<WsjfInputs>): inputs is WsjfInputs {
  const { userValue, timeCriticality, riskReduction, jobSize } = inputs
  if (
    userValue === undefined ||
    timeCriticality === undefined ||
    riskReduction === undefined ||
    jobSize === undefined
  ) {
    return false
  }
  return (
    isValidWsjfValue(userValue) &&
    isValidWsjfValue(timeCriticality) &&
    isValidWsjfValue(riskReduction) &&
    isValidWsjfValue(jobSize) &&
    jobSize > 0
  )
}

/**
 * Liczy WSJF = (UserValue + TimeCriticality + RiskReduction) / JobSize.
 *
 * Walidacja: wszystkie wejścia muszą być dodatnie i na skali Fibonacciego;
 * jobSize > 0 chroni przed dzieleniem przez zero. Zwraca `null`, gdy wejścia
 * są niekompletne/niepoprawne — wywołujący traktuje to jako "brak WSJF"
 * (np. zadanie nieoszacowane), zamiast rzucać wyjątkiem w ścieżce sortowania.
 */
export function computeWsjf(inputs: Partial<WsjfInputs>): number | null {
  if (!hasValidWsjfInputs(inputs)) return null

  const { userValue, timeCriticality, riskReduction, jobSize } = inputs
  // Guard nadmiarowy względem hasValidWsjfInputs, ale jawnie dokumentuje
  // niezmiennik "nigdy nie dziel przez zero".
  if (jobSize <= 0) return null

  const costOfDelay = userValue + timeCriticality + riskReduction
  return costOfDelay / jobSize
}

/**
 * Współczynnik korelacji rang Spearmana (ρ) między dwoma rankingami.
 *
 * Zastosowanie (walidacja na potrzeby pracy dyplomowej): porównanie kolejności
 * wyznaczonej przez WSJF z rankingiem eksperckim. ρ ∈ [-1, 1]; 1 = identyczna
 * kolejność, -1 = odwrotna, 0 = brak monotonicznej zależności.
 *
 * Wejście: dwie równoliczne tablice WARTOŚCI (nie rang) — funkcja sama zamienia
 * je na rangi (z uśrednianiem rang dla remisów — "fractional ranking"), a potem
 * liczy korelację Pearsona na rangach (forma odporna na remisy, w przeciwieństwie
 * do skróconego wzoru 1 - 6Σd²/(n(n²-1)), który zakłada brak remisów).
 *
 * Zwraca `null`, gdy długości się różnią, n < 2, albo któraś z serii jest stała
 * (zerowa wariancja rang ⇒ korelacja nieokreślona).
 */
export function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null

  const ra = toRanks(a)
  const rb = toRanks(b)

  const n = ra.length
  const meanA = ra.reduce((s, v) => s + v, 0) / n
  const meanB = rb.reduce((s, v) => s + v, 0) / n

  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const da = ra[i] - meanA
    const db = rb[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }

  if (varA === 0 || varB === 0) return null // seria stała ⇒ ρ nieokreślone
  return cov / Math.sqrt(varA * varB)
}

/**
 * Zamienia wartości na rangi 1..n, uśredniając rangi dla remisów
 * (fractional ranking). Większa wartość ⇒ wyższa ranga? Tu: niższa wartość ⇒
 * niższa ranga (rosnąco), co jest spójne między obiema seriami, więc znak ρ
 * pozostaje poprawny niezależnie od kierunku.
 */
function toRanks(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((x, y) => x.value - y.value)

  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    // Zbierz grupę remisów o tej samej wartości.
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) {
      j++
    }
    // Rangi pozycji i..j (1-indeksowane) uśredniamy.
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].index] = avgRank
    }
    i = j + 1
  }
  return ranks
}
