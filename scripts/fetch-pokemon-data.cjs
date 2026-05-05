/**
 * Fetches all Pokémon (Gen 1-9) type data from PokéAPI
 * and saves it as a static JSON file for the app.
 * 
 * Run: node scripts/fetch-pokemon-data.js
 */

const fs = require('fs');
const path = require('path');

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
// Gen 9 goes up to #1025
const MAX_POKEMON_ID = 1025;
const BATCH_SIZE = 50;
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'pokemon.json');

async function fetchPokemon(id) {
  const res = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch Pokémon #${id}: ${res.status}`);
  const data = await res.json();

  // Also fetch species for generation info
  const speciesRes = await fetch(data.species.url);
  const speciesData = speciesRes.ok ? await speciesRes.json() : null;

  return {
    id: data.id,
    name: data.name,
    types: data.types.map(t => t.type.name),
    sprite: data.sprites.front_default,
    officialArtwork: data.sprites.other?.['official-artwork']?.front_default || null,
    generation: speciesData?.generation?.name || null,
    // Base stat total — useful for "spirit pokémon" ranking
    bst: data.stats.reduce((sum, s) => sum + s.base_stat, 0),
    // Is this a fully evolved form? (no evolution chain check here, we'll handle that separately)
    isLegendary: speciesData?.is_legendary || false,
    isMythical: speciesData?.is_mythical || false,
  };
}

async function fetchBatch(ids) {
  return Promise.all(ids.map(id => fetchPokemon(id).catch(err => {
    console.error(err.message);
    return null;
  })));
}

async function main() {
  console.log(`Fetching ${MAX_POKEMON_ID} Pokémon from PokéAPI...`);

  const allPokemon = [];

  for (let start = 1; start <= MAX_POKEMON_ID; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, MAX_POKEMON_ID);
    const ids = [];
    for (let i = start; i <= end; i++) ids.push(i);

    console.log(`  Fetching #${start}-#${end}...`);
    const batch = await fetchBatch(ids);
    allPokemon.push(...batch.filter(Boolean));

    // Be polite to PokéAPI
    if (end < MAX_POKEMON_ID) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nFetched ${allPokemon.length} Pokémon.`);

  // Build type combo stats
  const typeCombos = {};
  for (const pkmn of allPokemon) {
    const key = pkmn.types.sort().join('/');
    if (!typeCombos[key]) {
      typeCombos[key] = { types: [...pkmn.types].sort(), count: 0, pokemon: [] };
    }
    typeCombos[key].count++;
    typeCombos[key].pokemon.push({
      id: pkmn.id,
      name: pkmn.name,
      sprite: pkmn.sprite,
      officialArtwork: pkmn.officialArtwork,
      bst: pkmn.bst,
      generation: pkmn.generation,
      isLegendary: pkmn.isLegendary,
      isMythical: pkmn.isMythical,
    });
  }

  const output = {
    meta: {
      totalPokemon: allPokemon.length,
      totalTypeCombos: Object.keys(typeCombos).length,
      generatedAt: new Date().toISOString(),
      source: 'PokéAPI (pokeapi.co)',
      maxId: MAX_POKEMON_ID,
    },
    typeCombos,
  };

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${OUTPUT_PATH}`);
  console.log(`Type combos found: ${Object.keys(typeCombos).length}`);

  // Print summary
  const sorted = Object.entries(typeCombos).sort((a, b) => b[1].count - a[1].count);
  console.log('\nTop 10 most common type combos:');
  sorted.slice(0, 10).forEach(([key, val]) => {
    console.log(`  ${key}: ${val.count} Pokémon`);
  });
  console.log('\n10 rarest type combos:');
  sorted.slice(-10).forEach(([key, val]) => {
    console.log(`  ${key}: ${val.count} Pokémon`);
  });
}

main().catch(console.error);
