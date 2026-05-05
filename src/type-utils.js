/** Pokémon type colors — official game palette */
export const TYPE_COLORS = {
  normal:   { bg: '#A8A77A', text: '#fff' },
  fire:     { bg: '#EE8130', text: '#fff' },
  water:    { bg: '#6390F0', text: '#fff' },
  electric: { bg: '#F7D02C', text: '#333' },
  grass:    { bg: '#7AC74C', text: '#fff' },
  ice:      { bg: '#96D9D6', text: '#333' },
  fighting: { bg: '#C22E28', text: '#fff' },
  poison:   { bg: '#A33EA1', text: '#fff' },
  ground:   { bg: '#E2BF65', text: '#333' },
  flying:   { bg: '#A98FF3', text: '#fff' },
  psychic:  { bg: '#F95587', text: '#fff' },
  bug:      { bg: '#A6B91A', text: '#fff' },
  rock:     { bg: '#B6A136', text: '#fff' },
  ghost:    { bg: '#735797', text: '#fff' },
  dragon:   { bg: '#6F35FC', text: '#fff' },
  dark:     { bg: '#705746', text: '#fff' },
  steel:    { bg: '#B7B7CE', text: '#333' },
  fairy:    { bg: '#D685AD', text: '#fff' },
};

/** Get a CSS gradient for a dual type combo */
export function typeGradient(types) {
  if (types.length === 1) {
    return TYPE_COLORS[types[0]]?.bg || '#888';
  }
  const c1 = TYPE_COLORS[types[0]]?.bg || '#888';
  const c2 = TYPE_COLORS[types[1]]?.bg || '#888';
  return `linear-gradient(135deg, ${c1} 0%, ${c1} 45%, ${c2} 55%, ${c2} 100%)`;
}

/** Capitalize a Pokémon name (handle hyphens) */
export function capitalize(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

/** Format type combo for display */
export function formatTypes(types) {
  return types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ');
}
