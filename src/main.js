import { mapBirthdaysToTypes, lookupBirthday, selectSpiritPokemon, filterTypeCombos, GENERATIONS } from './birthday-engine.js';
import { TYPE_COLORS, typeGradient, capitalize, formatTypes } from './type-utils.js';
import { downloadAvatar } from './avatar.js';
import pokemonData from './data/pokemon.json';
import './style.css';

// Track enabled generations — all on by default
let enabledGens = new Set(GENERATIONS.map(g => g.key));
let mapping = rebuildMapping();

function rebuildMapping() {
  const filtered = filterTypeCombos(pokemonData.typeCombos, enabledGens);
  return mapBirthdaysToTypes(filtered);
}

function getActiveStats() {
  const filtered = filterTypeCombos(pokemonData.typeCombos, enabledGens);
  const totalPokemon = Object.values(filtered).reduce((sum, c) => sum + c.count, 0);
  const totalCombos = Object.keys(filtered).length;
  return { totalPokemon, totalCombos };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function init() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1 class="title">
          <span class="title-sub">The Scientifically & Statistically Accurate</span>
          <span class="title-main">Pokémon Birthday Chart</span>
          <span class="title-gen">Gen IX Edition — All 1,025 Pokémon</span>
        </h1>
      </header>

      <div class="lookup-section">
        <div class="lookup-card">
          <h2>What's Your Pokémon Type?</h2>
          <div class="gen-filter">
            <div class="gen-filter-header">
              <span class="gen-filter-label">Generations</span>
              <div class="gen-filter-actions">
                <button id="gen-all" class="gen-action-btn">All</button>
                <button id="gen-none" class="gen-action-btn">None</button>
              </div>
            </div>
            <div class="gen-toggles" id="gen-toggles">
              ${GENERATIONS.map(g => `
                <label class="gen-toggle" title="${g.subtitle} (${g.range})">
                  <input type="checkbox" value="${g.key}" checked />
                  <span class="gen-toggle-pill">
                    <span class="gen-toggle-label">${g.label}</span>
                    <span class="gen-toggle-sub">${g.subtitle.split('(')[0].trim()}</span>
                  </span>
                </label>
              `).join('')}
            </div>
            <div class="gen-stats" id="gen-stats"></div>
          </div>
          <div class="lookup-form">
            <div class="field">
              <label for="month">Month</label>
              <select id="month">
                ${MONTH_NAMES.map((name, i) => `<option value="${i + 1}">${name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="day">Day</label>
              <select id="day">
                ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="period">Time</label>
              <select id="period">
                <option value="AM">AM (Midnight–Noon)</option>
                <option value="PM">PM (Noon–Midnight)</option>
              </select>
            </div>
            <button id="lookup-btn" class="lookup-btn">Reveal My Type!</button>
          </div>
        </div>
      </div>

      <div id="result" class="result-section hidden"></div>

      <div class="chart-section">
        <h2 class="chart-title">Full Chart</h2>
        <p class="chart-subtitle">Based on actual Pokémon type combo prevalence (Gen I–IX) & U.S. average births-per-day statistics</p>
        <div class="chart-scroll">
          <table id="chart-table" class="chart-table"></table>
        </div>
      </div>

      <footer class="footer">
        <p>Inspired by the original chart by Riff Conner / @rifflesby</p>
        <p id="footer-stats">Data: ${pokemonData.meta.totalPokemon} Pokémon · ${pokemonData.meta.totalTypeCombos} type combos · Source: PokéAPI</p>
      </footer>
    </div>
  `;

  setupLookup();
  setupGenFilter();
  updateGenStats();
  buildChart();
}

function setupLookup() {
  const monthSelect = document.getElementById('month');
  const daySelect = document.getElementById('day');
  const btn = document.getElementById('lookup-btn');

  monthSelect.addEventListener('change', () => updateDayOptions());

  btn.addEventListener('click', () => {
    const month = parseInt(monthSelect.value);
    const day = parseInt(daySelect.value);
    const period = document.getElementById('period').value;
    showResult(month, day, period);
  });

  // Pre-fill with today's date
  const now = new Date();
  monthSelect.value = now.getMonth() + 1;
  updateDayOptions();
  daySelect.value = now.getDate();
  document.getElementById('period').value = now.getHours() < 12 ? 'AM' : 'PM';
}

function updateDayOptions() {
  const month = parseInt(document.getElementById('month').value);
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];
  const daySelect = document.getElementById('day');
  const currentDay = parseInt(daySelect.value);

  daySelect.innerHTML = Array.from({ length: maxDay }, (_, i) =>
    `<option value="${i + 1}">${i + 1}</option>`
  ).join('');

  daySelect.value = Math.min(currentDay, maxDay);
}

function setupGenFilter() {
  const togglesContainer = document.getElementById('gen-toggles');
  const allBtn = document.getElementById('gen-all');
  const noneBtn = document.getElementById('gen-none');

  togglesContainer.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const genKey = e.target.value;
    if (e.target.checked) {
      enabledGens.add(genKey);
    } else {
      enabledGens.delete(genKey);
    }
    onGensChanged();
  });

  allBtn.addEventListener('click', () => {
    enabledGens = new Set(GENERATIONS.map(g => g.key));
    togglesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    onGensChanged();
  });

  noneBtn.addEventListener('click', () => {
    // Keep at least Gen I so the chart isn't empty
    enabledGens = new Set(['generation-i']);
    togglesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = cb.value === 'generation-i';
    });
    onGensChanged();
  });
}

function onGensChanged() {
  // Ensure at least one gen is enabled
  if (enabledGens.size === 0) {
    enabledGens.add('generation-i');
    const cb = document.querySelector(`input[value="generation-i"]`);
    if (cb) cb.checked = true;
  }

  mapping = rebuildMapping();
  updateGenStats();
  buildChart();

  // Clear any existing result
  const resultDiv = document.getElementById('result');
  resultDiv.classList.add('hidden');
  resultDiv.innerHTML = '';
}

function updateGenStats() {
  const stats = getActiveStats();
  const statsEl = document.getElementById('gen-stats');
  const footerEl = document.getElementById('footer-stats');

  const genCount = enabledGens.size;
  const label = genCount === GENERATIONS.length
    ? `All ${GENERATIONS.length} generations`
    : `${genCount} of ${GENERATIONS.length} generations`;

  statsEl.textContent = `${label} · ${stats.totalPokemon} Pokémon · ${stats.totalCombos} type combos`;
  footerEl.textContent = `Data: ${stats.totalPokemon} Pokémon · ${stats.totalCombos} type combos · Source: PokéAPI`;
}

function showResult(month, day, period) {
  const result = lookupBirthday(mapping, month, day, period);
  if (!result) return;

  const slotIndex = mapping.indexOf(result);
  const spirit = selectSpiritPokemon(result.pokemon, slotIndex);
  const resultDiv = document.getElementById('result');
  resultDiv.classList.remove('hidden');

  // Build the user's active filter context
  const userSelectedGens = GENERATIONS.filter(g => enabledGens.has(g.key));
  const isAllGens = userSelectedGens.length === GENERATIONS.length;

  const typeStyle = result.types.length === 1
    ? `background: ${TYPE_COLORS[result.types[0]]?.bg || '#888'}`
    : `background: ${typeGradient(result.types)}`;

  const shareText = spirit
    ? `I'm ${formatTypes(result.types)} — my spirit Pokémon is ${capitalize(spirit.name)}! 🎂⚡`
    : `I'm ${formatTypes(result.types)}! 🎂⚡`;

  resultDiv.innerHTML = `
    <div class="result-card" style="${typeStyle}">
      <div class="result-header">
        <h2>${result.label}</h2>
        <div class="result-types">
          ${result.types.map(t => `<span class="type-badge" style="background:${TYPE_COLORS[t]?.bg};color:${TYPE_COLORS[t]?.text}">${capitalize(t)}</span>`).join('')}
        </div>
      </div>

      ${spirit ? `
        <div class="spirit-section">
          <div class="spirit-image">
            <img src="${spirit.officialArtwork || spirit.sprite}" alt="${spirit.name}" />
          </div>
          <div class="spirit-info">
            <h3>Your Spirit Pokémon</h3>
            <p class="spirit-name">${capitalize(spirit.name)}</p>
            <p class="spirit-detail">#${spirit.id} · ${spirit.generation?.replace('generation-', 'Gen ').toUpperCase()}</p>
            <div class="spirit-actions">
              <button class="avatar-btn" id="download-avatar">Save as Profile Pic</button>
              <button class="avatar-btn share-btn" id="share-btn">Share Result</button>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="gen-provenance">
        <span class="gen-provenance-icon">📡</span>
        <span class="gen-provenance-label">${isAllGens ? 'Pokédex set to: All Regions' : 'Pokédex set to:'}</span>
        ${!isAllGens ? userSelectedGens.map(g => `<span class="gen-provenance-tag">${g.label} <span class="gen-provenance-region">${g.subtitle.split('(')[0].trim()}</span></span>`).join('') : ''}
      </div>

      <div class="roster-section">
        <h3>All ${formatTypes(result.types)} Pokémon (${result.pokemon.length})</h3>
        <div class="roster-grid">
          ${result.pokemon.map(p => `
            <div class="roster-item ${spirit && p.id === spirit.id ? 'spirit-highlight' : ''}" title="${capitalize(p.name)} #${p.id}">
              <img src="${p.sprite}" alt="${p.name}" loading="lazy" />
              <span>${capitalize(p.name)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Wire up avatar download button
  const avatarBtn = document.getElementById('download-avatar');
  if (avatarBtn && spirit) {
    avatarBtn.addEventListener('click', () => {
      avatarBtn.textContent = 'Generating...';
      avatarBtn.disabled = true;
      downloadAvatar(spirit, result.types).then(() => {
        avatarBtn.textContent = 'Saved!';
        setTimeout(() => {
          avatarBtn.textContent = 'Save as Profile Pic';
          avatarBtn.disabled = false;
        }, 2000);
      }).catch(() => {
        avatarBtn.textContent = 'Save as Profile Pic';
        avatarBtn.disabled = false;
      });
    });
  }

  // Wire up share button
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = 'https://solrooster.github.io/TypeCast/';
      const text = shareText + `\n\nFind yours: ${url}`;

      if (navigator.share) {
        // Native share sheet (mobile + some desktop)
        try {
          await navigator.share({ title: 'TypeCast — Pokémon Birthday Chart', text, url });
        } catch (e) {
          // User cancelled — that's fine
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(text);
          shareBtn.textContent = 'Copied!';
          setTimeout(() => { shareBtn.textContent = 'Share Result'; }, 2000);
        } catch (e) {
          // Last resort: prompt
          prompt('Copy your result:', text);
        }
      }
    });
  }
}

function buildChart() {
  const table = document.getElementById('chart-table');

  let headerRow = '<thead><tr><th></th><th></th>';
  for (let d = 1; d <= 31; d++) {
    headerRow += `<th>${d}</th>`;
  }
  headerRow += '</tr></thead>';

  let bodyRows = '<tbody>';
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  for (let m = 1; m <= 12; m++) {
    for (const period of ['AM', 'PM']) {
      bodyRows += `<tr>`;
      if (period === 'AM') {
        bodyRows += `<td class="month-label" rowspan="2">${MONTH_NAMES[m - 1]}</td>`;
      }
      bodyRows += `<td class="period-label">${period.toLowerCase()}</td>`;

      for (let d = 1; d <= 31; d++) {
        if (d > daysInMonth[m - 1]) {
          bodyRows += `<td class="empty-cell"></td>`;
          continue;
        }

        const entry = lookupBirthday(mapping, m, d, period);
        if (!entry) {
          bodyRows += `<td class="empty-cell"></td>`;
          continue;
        }

        const bg = TYPE_COLORS[entry.types[0]]?.bg || '#888';
        const bg2 = entry.types.length > 1
          ? TYPE_COLORS[entry.types[1]]?.bg || '#888'
          : bg;

        const cellStyle = entry.types.length === 1
          ? `background:${bg}`
          : `background:linear-gradient(135deg,${bg} 50%,${bg2} 50%)`;

        const slotIndex = mapping.indexOf(entry);
        const spirit = selectSpiritPokemon(entry.pokemon, slotIndex);

        bodyRows += `
          <td class="chart-cell" style="${cellStyle}" 
              title="${entry.label}: ${formatTypes(entry.types)}${spirit ? ' — ' + capitalize(spirit.name) : ''}"
              data-month="${m}" data-day="${d}" data-period="${period}">
            <div class="cell-types">${entry.types.map(t => capitalize(t)).join('\n')}</div>
          </td>`;
      }

      bodyRows += `</tr>`;
    }
  }
  bodyRows += '</tbody>';

  table.innerHTML = headerRow + bodyRows;

  table.addEventListener('click', (e) => {
    const cell = e.target.closest('.chart-cell');
    if (!cell) return;
    const month = parseInt(cell.dataset.month);
    const day = parseInt(cell.dataset.day);
    const period = cell.dataset.period;

    document.getElementById('month').value = month;
    updateDayOptions();
    document.getElementById('day').value = day;
    document.getElementById('period').value = period;
    showResult(month, day, period);
  });
}

init();
