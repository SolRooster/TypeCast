/**
 * U.S. birth frequency data by month and day.
 * Relative weights based on CDC/SSA birth statistics.
 * Higher number = more births on that day.
 * 
 * Sources: CDC National Vital Statistics, FiveThirtyEight birth data analysis
 * Normalized so average day ≈ 1.0
 */

// Monthly relative birth rates (CDC averages)
const MONTHLY_WEIGHTS = {
  1: 0.94,   // January
  2: 0.93,   // February
  3: 0.97,   // March
  4: 0.96,   // April
  5: 0.98,   // May
  6: 1.02,   // June
  7: 1.06,   // July
  8: 1.07,   // August
  9: 1.08,   // September (most common birth month)
  10: 1.04,  // October
  11: 0.98,  // November
  12: 0.97,  // December
};

// Day-of-month adjustments (slight variations)
// Days that tend to have fewer births (holidays, weekends cluster effects)
const SPECIAL_DAY_ADJUSTMENTS = {
  // Major holidays tend to have fewer births (induced/scheduled births avoid these)
  '1-1': 0.75,    // New Year's Day
  '2-14': 1.08,   // Valentine's Day (slightly more — scheduled C-sections!)
  '2-29': 0.25,   // Leap day (only occurs 1/4 of years)
  '7-4': 0.82,    // Independence Day
  '10-31': 0.90,  // Halloween (slightly fewer)
  '11-23': 0.80,  // ~Thanksgiving range
  '11-24': 0.80,
  '11-25': 0.82,
  '12-24': 0.78,  // Christmas Eve
  '12-25': 0.72,  // Christmas Day (fewest births)
  '12-31': 0.80,  // New Year's Eve
  // 13th of any month — slightly fewer (superstition effect is real but tiny)
};

/**
 * Generate birthday slots with relative birth frequency weights.
 * @param {boolean} useAmPm — if true, generates 732 slots (366 days × AM/PM).
 *                            If false, generates 366 slots (one per day).
 */
export function generateBirthdaySlots(useAmPm = true) {
  const slots = [];
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= daysInMonth[m]; d++) {
      const monthWeight = MONTHLY_WEIGHTS[m + 1];
      const specialKey = `${m + 1}-${d}`;
      const dayAdj = SPECIAL_DAY_ADJUSTMENTS[specialKey] || 1.0;

      if (useAmPm) {
        for (const period of ['AM', 'PM']) {
          // AM births are slightly less common than PM births (about 45/55 split)
          const periodAdj = period === 'AM' ? 0.92 : 1.08;
          slots.push({
            month: m + 1,
            monthName: monthNames[m],
            day: d,
            period,
            label: `${monthNames[m]} ${d}, ${period}`,
            weight: monthWeight * dayAdj * periodAdj,
          });
        }
      } else {
        slots.push({
          month: m + 1,
          monthName: monthNames[m],
          day: d,
          period: null,
          label: `${monthNames[m]} ${d}`,
          weight: monthWeight * dayAdj,
        });
      }
    }
  }

  return slots;
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Ensures the same seed always produces the same chart.
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** All generation keys in order */
export const GENERATIONS = [
  { key: 'generation-i', label: 'Gen I', subtitle: 'Kanto (Red/Blue/Yellow)', range: '1–151' },
  { key: 'generation-ii', label: 'Gen II', subtitle: 'Johto (Gold/Silver/Crystal)', range: '152–251' },
  { key: 'generation-iii', label: 'Gen III', subtitle: 'Hoenn (Ruby/Sapphire/Emerald)', range: '252–386' },
  { key: 'generation-iv', label: 'Gen IV', subtitle: 'Sinnoh (Diamond/Pearl/Platinum)', range: '387–493' },
  { key: 'generation-v', label: 'Gen V', subtitle: 'Unova (Black/White)', range: '494–649' },
  { key: 'generation-vi', label: 'Gen VI', subtitle: 'Kalos (X/Y)', range: '650–721' },
  { key: 'generation-vii', label: 'Gen VII', subtitle: 'Alola (Sun/Moon)', range: '722–809' },
  { key: 'generation-viii', label: 'Gen VIII', subtitle: 'Galar (Sword/Shield)', range: '810–905' },
  { key: 'generation-ix', label: 'Gen IX', subtitle: 'Paldea (Scarlet/Violet)', range: '906–1025' },
];

/**
 * Filter type combos to only include Pokémon from the selected generations.
 * Returns a new typeCombos object with recalculated counts.
 */
export function filterTypeCombos(typeCombos, enabledGens) {
  const filtered = {};

  for (const [key, data] of Object.entries(typeCombos)) {
    const filteredPokemon = data.pokemon.filter(p => enabledGens.has(p.generation));
    if (filteredPokemon.length > 0) {
      filtered[key] = {
        types: data.types,
        count: filteredPokemon.length,
        pokemon: filteredPokemon,
      };
    }
  }

  return filtered;
}

/**
 * Core mapping algorithm:
 * 1. Rank type combos by prevalence (common → rare)
 * 2. Rank birthday slots by birth frequency (common → rare)
 * 3. Map them so common types go to common birthdays, rare types to rare birthdays
 * 4. Use deterministic shuffle within prevalence tiers for variety
 */
export function mapBirthdaysToTypes(typeCombos, seed = 42, useAmPm = true) {
  const rng = mulberry32(seed);

  // Get all type combos sorted by count (descending)
  const comboEntries = Object.entries(typeCombos).map(([key, data]) => ({
    key,
    types: data.types,
    count: data.count,
    pokemon: data.pokemon,
  }));

  // Sort by prevalence descending
  comboEntries.sort((a, b) => b.count - a.count);

  // Generate and sort birthday slots by weight descending (most common first)
  const slots = generateBirthdaySlots(useAmPm);
  slots.sort((a, b) => b.weight - a.weight);

  // We have 732 (or 366) slots and ~154 type combos.
  // Each combo should appear proportionally to its prevalence.
  const totalPokemon = comboEntries.reduce((sum, c) => sum + c.count, 0);
  const totalSlots = slots.length;

  // Calculate how many slots each combo gets, proportional to prevalence
  let assignedSlots = comboEntries.map(combo => ({
    ...combo,
    targetSlots: Math.max(1, Math.round((combo.count / totalPokemon) * totalSlots)),
  }));

  // Adjust to fit exactly the target slot count
  let currentTotal = assignedSlots.reduce((sum, c) => sum + c.targetSlots, 0);
  while (currentTotal !== totalSlots) {
    if (currentTotal > totalSlots) {
      // Remove from most over-represented
      const sorted = [...assignedSlots].filter(c => c.targetSlots > 1)
        .sort((a, b) => (b.targetSlots / b.count) - (a.targetSlots / a.count));
      if (sorted.length > 0) {
        sorted[0].targetSlots--;
        currentTotal--;
      } else break;
    } else {
      // Add to most under-represented
      const sorted = [...assignedSlots]
        .sort((a, b) => (a.targetSlots / a.count) - (b.targetSlots / b.count));
      sorted[0].targetSlots++;
      currentTotal++;
    }
  }

  // Now assign slots: expand combo list so each combo appears targetSlots times
  const expandedCombos = [];
  for (const combo of assignedSlots) {
    for (let i = 0; i < combo.targetSlots; i++) {
      expandedCombos.push(combo);
    }
  }

  // Deterministic shuffle of the expanded list for variety
  // But maintain general trend: common combos → common birthdays
  // We do this by shuffling within "tiers" of similar prevalence
  const tierSize = Math.ceil(expandedCombos.length / 12); // ~61 per tier
  for (let i = 0; i < expandedCombos.length; i += tierSize) {
    const tierEnd = Math.min(i + tierSize, expandedCombos.length);
    // Fisher-Yates shuffle within tier
    for (let j = tierEnd - 1; j > i; j--) {
      const k = i + Math.floor(rng() * (j - i + 1));
      [expandedCombos[j], expandedCombos[k]] = [expandedCombos[k], expandedCombos[j]];
    }
  }

  // Map each slot to its combo
  const mapping = slots.map((slot, i) => ({
    ...slot,
    typeCombo: expandedCombos[i].key,
    types: expandedCombos[i].types,
    pokemon: expandedCombos[i].pokemon,
  }));

  // Re-sort by calendar order for display
  mapping.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    if (a.day !== b.day) return a.day - b.day;
    return a.period === 'AM' ? -1 : 1;
  });

  return mapping;
}

/**
 * Select the "spirit Pokémon" for a given type combo assignment.
 * 
 * Criteria (in priority order):
 * 1. Not legendary/mythical (those feel too "special" for a birthday chart)
 * 2. Prefer fully evolved or single-stage Pokémon
 * 3. Prefer mid-range BST (not too weak, not too OP) — the "relatable" pick
 * 4. Deterministic tie-breaking using the slot's position
 */
export function selectSpiritPokemon(pokemon, slotIndex, seed = 42) {
  if (!pokemon || pokemon.length === 0) return null;
  if (pokemon.length === 1) return pokemon[0];

  const rng = mulberry32(seed + slotIndex);

  // Filter out legendaries/mythicals for the "spirit" pick
  let candidates = pokemon.filter(p => !p.isLegendary && !p.isMythical);
  if (candidates.length === 0) candidates = pokemon; // fallback if ALL are legendary

  // Score each candidate
  const medianBst = candidates.reduce((s, p) => s + p.bst, 0) / candidates.length;
  const scored = candidates.map(p => {
    let score = 0;
    // Prefer higher BST (likely evolved) but not extreme
    const bstDiff = Math.abs(p.bst - medianBst);
    score -= bstDiff * 0.1; // Penalty for being far from median
    // Prefer higher BST slightly (evolved forms are more iconic)
    score += p.bst * 0.01;
    // Add some deterministic randomness for variety
    score += rng() * 50;
    return { ...p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

/**
 * Look up a specific birthday. Pass period=null for no-AM/PM mode.
 */
export function lookupBirthday(mapping, month, day, period) {
  return mapping.find(s => {
    if (s.month !== month || s.day !== day) return false;
    if (s.period === null && (period === null || period === undefined)) return true;
    return period && s.period === period.toUpperCase();
  });
}
