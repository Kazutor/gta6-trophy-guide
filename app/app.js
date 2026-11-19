// Leonida Legend — offline GTA VI trophy tracker.
// Loads the trophy list and the roadmap from local JSON files, keeps earned
// ticks in localStorage, and offers export / import of that progress.
// It makes no network request other than the two local data files.

const STORAGE_KEY = 'leonida-legend-progress-v1';
const SPOILER_KEY = 'leonida-legend-spoilers-v1';

const trophyList = document.getElementById('trophyList');
const emptyState = document.getElementById('emptyState');
const resultCount = document.getElementById('resultCount');
const searchInput = document.getElementById('search');
const gradeSelect = document.getElementById('grade');
const earnedOnlyBox = document.getElementById('earnedOnly');
const spoilerBox = document.getElementById('spoiler');
const kindFilters = document.getElementById('kindFilters');

const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'story', label: 'Story' },
  { id: 'missable', label: 'Missable' },
  { id: 'collectibles', label: 'Collectibles' },
  { id: 'activities', label: 'Activities' },
  { id: 'online', label: 'Online' },
];

let trophies = [];
let roadmap = null;
let earned = new Set(readStoredIds());
let activeKind = 'all';
let openGuideId = null;

function readStoredIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function saveEarned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function kindLabel(kind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function trophyIsSpoilerHidden(trophy) {
  return spoilerBox.checked && trophy.kind === 'story' && !earned.has(trophy.id);
}

function renderRoadmap() {
  if (!roadmap) return;
  document.getElementById('roadmapTitle').textContent = roadmap.title;
  document.getElementById('roadmapIntro').textContent = roadmap.intro;
  const rulesList = document.getElementById('roadmapRules');
  rulesList.replaceChildren();
  for (const rule of roadmap.rules) {
    const li = document.createElement('li');
    li.textContent = rule;
    rulesList.append(li);
  }
  const stagesBox = document.getElementById('roadmapStages');
  stagesBox.replaceChildren();
  for (const stage of roadmap.stages) {
    const done = stage.trophies.filter((id) => earned.has(id)).length;
    const card = document.createElement('article');
    card.className = 'stage';
    const title = document.createElement('h3');
    const num = document.createElement('span');
    num.className = 'stage-num';
    num.textContent = stage.n;
    title.append(num, document.createTextNode(stage.title));
    const blurb = document.createElement('p');
    blurb.textContent = stage.blurb;
    const prog = document.createElement('p');
    prog.className = 'stage-progress';
    prog.textContent = `${done} of ${stage.trophies.length} earned in this stage`;
    const bar = document.createElement('div');
    bar.className = 'mini-bar';
    const fill = document.createElement('i');
    fill.style.width = `${(done / stage.trophies.length) * 100}%`;
    bar.append(fill);
    card.append(title, blurb, prog, bar);
    stagesBox.append(card);
  }
}

function buildGuidePanel(trophy) {
  const panel = document.createElement('div');
  panel.className = 'guide';
  const heading = document.createElement('h4');
  heading.textContent = 'Guide';
  const text = document.createElement('p');
  text.textContent = trophy.guide;
  panel.append(heading, text);
  if (trophy.sources && trophy.sources.length) {
    const sourceHeading = document.createElement('h4');
    sourceHeading.textContent = 'Sources';
    const list = document.createElement('ul');
    list.className = 'sources';
    for (const source of trophy.sources) {
      const item = document.createElement('li');
      if (source.url) {
        const link = document.createElement('a');
        link.href = source.url;
        link.textContent = source.name;
        link.target = '_blank';
        link.rel = 'noopener';
        item.append(link);
      } else {
        item.textContent = source.name;
      }
      list.append(item);
    }
    panel.append(sourceHeading, list);
  }
  return panel;
}

function buildTrophyCard(trophy) {
  const card = document.createElement('article');
  card.className = `trophy grade-${trophy.grade}`;
  card.id = `trophy-${trophy.id}`;
  if (earned.has(trophy.id)) card.classList.add('earned');

  const head = document.createElement('div');
  head.className = 'trophy-head';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.id);
  box.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(trophy.id);
    else earned.delete(trophy.id);
    saveEarned();
    renderAll();
  });

  const main = document.createElement('div');
  main.className = 'trophy-main';
  const name = document.createElement('h3');
  name.className = 'trophy-name';
  const hiddenBySpoiler = trophyIsSpoilerHidden(trophy);
  name.textContent = hiddenBySpoiler ? 'Hidden story trophy' : trophy.name;
  if (earned.has(trophy.id)) {
    const mark = document.createElement('span');
    mark.className = 'earned-mark';
    mark.textContent = '✓ earned';
    name.append(mark);
  }
  const desc = document.createElement('p');
  desc.className = 'trophy-desc';
  desc.textContent = hiddenBySpoiler
    ? 'Earn this trophy in the game to reveal its name and description here.'
    : trophy.description;

  const meta = document.createElement('div');
  meta.className = 'trophy-meta';
  const gradeBadge = document.createElement('span');
  gradeBadge.className = `badge badge-${trophy.grade}`;
  gradeBadge.textContent = gradeLabel(trophy.grade);
  meta.append(gradeBadge);
  const kindBadge = document.createElement('span');
  kindBadge.className = 'badge badge-kind';
  kindBadge.textContent = kindLabel(trophy.kind);
  meta.append(kindBadge);
  if (trophy.count) {
    const countBadge = document.createElement('span');
    countBadge.className = 'badge badge-count';
    countBadge.textContent = trophy.count;
    meta.append(countBadge);
  }
  if (trophy.missable) {
    const missableBadge = document.createElement('span');
    missableBadge.className = 'badge badge-missable';
    missableBadge.textContent = '⚠ Missable';
    meta.append(missableBadge);
  }
  if (trophy.hidden) {
    const hiddenBadge = document.createElement('span');
    hiddenBadge.className = 'badge badge-hidden';
    hiddenBadge.textContent = 'Hidden on PSN';
    meta.append(hiddenBadge);
  }
  main.append(name, desc, meta);

  const guideBtn = document.createElement('button');
  guideBtn.type = 'button';
  guideBtn.className = 'guide-btn';
  const guideOpen = openGuideId === trophy.id;
  guideBtn.textContent = guideOpen ? 'Hide guide' : 'Guide';
  guideBtn.setAttribute('aria-expanded', String(guideOpen));
  guideBtn.addEventListener('click', () => {
    openGuideId = guideOpen ? null : trophy.id;
    renderAll();
    if (openGuideId === trophy.id) {
      document.getElementById(`trophy-${trophy.id}`)?.scrollIntoView({ block: 'nearest' });
    }
  });

  head.append(box, main, guideBtn);
  card.append(head);

  if (guideOpen) {
    if (hiddenBySpoiler) {
      const note = document.createElement('p');
      note.className = 'spoiler-note';
      note.textContent = 'This guide is hidden while spoilers are on. Earn the trophy, or turn spoilers off, to read it.';
      const panel = document.createElement('div');
      panel.className = 'guide';
      panel.append(note);
      card.append(panel);
    } else {
      card.append(buildGuidePanel(trophy));
    }
  }
  return card;
}

function trophyMatches(trophy) {
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (gradeSelect.value !== 'all' && trophy.grade !== gradeSelect.value) return false;
  if (earnedOnlyBox.checked && !earned.has(trophy.id)) return false;
  if (activeKind === 'story' && trophy.kind !== 'story') return false;
  if (activeKind === 'missable' && !trophy.missable) return false;
  if (activeKind === 'collectibles' && trophy.kind !== 'collectibles') return false;
  if (activeKind === 'activities' && trophy.kind !== 'activities') return false;
  if (activeKind === 'online') return false;
  return true;
}

function renderProgress() {
  const total = trophies.length;
  const done = earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressText').textContent = `${done} of ${total} earned`;
  document.getElementById('progressPct').textContent = `${pct}% to the platinum`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  const parts = ['platinum', 'gold', 'silver', 'bronze'].map((grade) => {
    const inGrade = trophies.filter((t) => t.grade === grade);
    const doneInGrade = inGrade.filter((t) => earned.has(t.id)).length;
    return `${doneInGrade}/${inGrade.length} ${gradeLabel(grade)}`;
  });
  document.getElementById('gradeCounts').textContent = parts.join(' · ');
}

function renderList() {
  const shown = trophies.filter(trophyMatches);
  trophyList.replaceChildren();
  for (const trophy of shown) trophyList.append(buildTrophyCard(trophy));
  emptyState.hidden = shown.length !== 0;
  if (activeKind === 'online') {
    resultCount.textContent = 'No online trophies: all 55 unlock in single-player, so this filter is empty on purpose.';
  } else {
    resultCount.textContent = `Showing ${shown.length} of ${trophies.length} trophies.`;
  }
}

function renderKindButtons() {
  kindFilters.replaceChildren();
  for (const kind of KINDS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kind-btn';
    btn.textContent = kind.label;
    btn.setAttribute('aria-pressed', String(activeKind === kind.id));
    btn.addEventListener('click', () => {
      activeKind = kind.id;
      renderKindButtons();
      renderList();
    });
    kindFilters.append(btn);
  }
}

function renderAll() {
  renderProgress();
  renderRoadmap();
  renderList();
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportProgress() {
  const payload = {
    game: 'Grand Theft Auto VI',
    guide: 'Leonida Legend',
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  downloadFile('gta6-trophy-progress.json', JSON.stringify(payload, null, 2));
}

async function importProgress(file) {
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    alert('That file is not valid JSON progress.');
    return;
  }
  const ids = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(ids)) {
    alert('That file does not hold trophy progress.');
    return;
  }
  const known = new Set(trophies.map((t) => t.id));
  earned = new Set(ids.filter((n) => Number.isInteger(n) && known.has(n)));
  saveEarned();
  renderAll();
}

function openFromHash() {
  const match = window.location.hash.match(/^#trophy-(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    if (trophies.some((t) => t.id === id)) {
      openGuideId = id;
      renderAll();
      document.getElementById(`trophy-${id}`)?.scrollIntoView({ block: 'start' });
    }
  }
}

async function loadData() {
  const [trophyDoc, roadmapDoc] = await Promise.all([
    fetch('data/trophies.json').then((r) => r.json()),
    fetch('data/roadmap.json').then((r) => r.json()),
  ]);
  trophies = trophyDoc.trophies;
  roadmap = roadmapDoc;
}

spoilerBox.checked = localStorage.getItem(SPOILER_KEY) === '1';
spoilerBox.addEventListener('change', () => {
  localStorage.setItem(SPOILER_KEY, spoilerBox.checked ? '1' : '0');
  renderAll();
});
searchInput.addEventListener('input', renderList);
gradeSelect.addEventListener('change', renderList);
earnedOnlyBox.addEventListener('change', renderList);
document.getElementById('exportBtn').addEventListener('click', exportProgress);
document.getElementById('importFile').addEventListener('change', (event) => {
  importProgress(event.target.files[0]);
  event.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Clear every earned tick in this guide?')) {
    earned = new Set();
    saveEarned();
    renderAll();
  }
});
window.addEventListener('hashchange', openFromHash);

renderKindButtons();
await loadData();
renderAll();
openFromHash();
