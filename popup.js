// Each level has its own index file and its own favorites
const LEVELS = {
  '1': { title: 'CFA Level 1 Index', csv: 'CFA_Level1_LetMeExplain_Index.csv', favKey: 'cfaFavorites', modFavKey: 'cfaModFavorites' },
  '2': { title: 'CFA Level 2 Index', csv: 'CFA_Level2_Index.csv', favKey: 'cfaFavoritesL2', modFavKey: 'cfaModFavoritesL2' }
};

let currentLevel = '1';
let fullCfaData = {};
let favorites = new Set();
let favModules = new Set();
let currentSearchTerm = '';
let currentHighlightTerm = '';
let openState = { classes: new Set(), modules: new Set() };
let suggested = { className: null, moduleName: null };

document.addEventListener('DOMContentLoaded', async () => {
  const searchBar = document.getElementById('search-bar');

  const result = await chrome.storage.local.get(['cfaLevel', 'youtubeFocusMode']);

  const ytFocusToggle = document.getElementById('yt-focus-toggle');
  ytFocusToggle.checked = result.youtubeFocusMode || false;

  ytFocusToggle.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ youtubeFocusMode: e.target.checked });
  });

  // The chosen level is saved in local storage, so it only applies to this device
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      if (level === currentLevel) return;
      chrome.storage.local.set({ cfaLevel: level });
      loadLevel(level);
    });
  });

  await loadLevel(LEVELS[result.cfaLevel] ? result.cfaLevel : '1');

  searchBar.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.toLowerCase().trim();
    const parts = currentSearchTerm.split(',').map(p => p.trim());
    currentHighlightTerm = parts.length > 1 ? (parts[2] || '') : currentSearchTerm;
    renderMain();
  });
});

async function loadLevel(level) {
  const config = LEVELS[level];
  const loading = document.getElementById('loading');
  currentLevel = level;

  document.getElementById('level-title').innerText = config.title;
  document.querySelectorAll('.level-btn').forEach(btn => {
    const isActive = btn.dataset.level === level;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  document.getElementById('main-container').innerHTML = '';
  document.getElementById('no-results').classList.add('hidden');
  loading.innerText = 'Loading Data...';
  loading.style.color = '';
  loading.classList.remove('hidden');

  try {
    const stored = await chrome.storage.local.get([config.favKey, config.modFavKey]);
    const response = await fetch(config.csv);
    if (!response.ok) throw new Error("CSV missing");
    const text = await response.text();
    if (level !== currentLevel) return; // Switched level while this one was loading

    favorites = new Set(stored[config.favKey] || []);
    favModules = new Set(stored[config.modFavKey] || []);
    fullCfaData = parseCSV(text);
    openState = { classes: new Set(), modules: new Set() };
    suggested = { className: null, moduleName: null };

    // "Suggested For This Page" only covers Level 1 for now
    if (level === '1') {
      const found = await findSuggestionForActiveTab();
      if (level !== currentLevel) return;
      if (found) suggested = found;
    }

    loading.classList.add('hidden');
    renderMain();
  } catch (error) {
    if (level !== currentLevel) return;
    loading.innerText = 'Error loading CSV. Check folder.';
    loading.style.color = 'red';
    console.error(error);
  }
}

// Scans the active tab and returns the group and module it matches, or null
async function findSuggestionForActiveTab() {
  // --- SMARTER TAB SCANNER ---
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && tab.url.startsWith("http")) {

      // Extract the page text FIRST, then process it in the popup
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const titleText = document.title.toLowerCase();
          const h1Element = document.querySelector('h1');
          const h1Text = h1Element ? h1Element.innerText.toLowerCase() : "";
          const combinedTitle = titleText + " " + h1Text;

          const headingsText = Array.from(document.querySelectorAll('h2, h3'))
            .map(h => h.innerText.toLowerCase())
            .join(' ');
          const bodyText = document.body.innerText.toLowerCase();

          return { combinedTitle, headingsText, bodyText };
        }
      });

      if (injectionResults && injectionResults[0].result) {
        const { combinedTitle, headingsText, bodyText } = injectionResults[0].result;
        let foundGroup = null;
        let foundMod = null;
        let foundByLesson = false;

        // STRATEGY 1: Reverse Lookup - Check if a CSV Lesson Name is inside the YouTube Title
        for (const className in fullCfaData) {
          for (const moduleName in fullCfaData[className]) {
            for (const lesson of fullCfaData[className][moduleName]) {
              const lessonLower = lesson.name.toLowerCase().trim();

              // Only match if lesson string has some length (prevents matching single tiny words)
              if (lessonLower.length > 10 && combinedTitle.includes(lessonLower)) {
                foundGroup = className;
                foundMod = moduleName;
                foundByLesson = true;
                break;
              }
            }
            if (foundByLesson) break;
          }
          if (foundByLesson) break;
        }

        // STRATEGY 2: Fallback to the old logic (searching for "Module X" explicitly) if no lesson matches
        if (!foundByLesson) {
          const allGroups = Object.keys(fullCfaData);

          // Find Group
          for (const g of allGroups) {
            const lowerG = g.toLowerCase();
            if (combinedTitle.includes(lowerG)) { foundGroup = g; break; }
          }
          if (!foundGroup) {
            for (const g of allGroups) {
              const lowerG = g.toLowerCase();
              if (headingsText.includes(lowerG)) { foundGroup = g; break; }
            }
          }
          if (!foundGroup) {
            for (const g of allGroups) {
              const lowerG = g.toLowerCase();
              if (bodyText.includes(lowerG)) { foundGroup = g; break; }
            }
          }

          // Find Module
          let match = combinedTitle.match(/module\s*(\d+)/) || combinedTitle.match(/mod\s*(\d+)/);
          if (!match) {
            match = bodyText.match(/module\s*(\d+)/) || bodyText.match(/mod\s*(\d+)/);
          }

          if (match) {
            foundMod = "Module " + match[1];
          } else {
            match = combinedTitle.match(/\b(\d{1,2})\.\d{2}\b/) || bodyText.match(/\b(\d{1,2})\.\d{2}\b/);
            if (match) {
              foundMod = "Module " + match[1];
            }
          }
        }

        // If we found a match using either strategy, return it!
        if (foundGroup && foundMod) {
          return { className: foundGroup, moduleName: foundMod };
        }
      }
    }
  } catch (tabError) {
    console.log("Could not scan tab content:", tabError);
  }
  return null;
}

function renderMain() {
  const container = document.getElementById('main-container');
  const noResults = document.getElementById('no-results');
  container.innerHTML = '';

  const filteredData = filterData(fullCfaData, currentSearchTerm);
  const allClassNames = Object.keys(filteredData).sort();

  if (allClassNames.length === 0 && currentSearchTerm !== '') {
    noResults.classList.remove('hidden');
    return;
  } else {
    noResults.classList.add('hidden');
  }

  // Render Suggested Section
  if (suggested.className && suggested.moduleName && !currentSearchTerm) {
    if (fullCfaData[suggested.className] && fullCfaData[suggested.className][suggested.moduleName]) {
      const suggTitle = document.createElement('div');
      suggTitle.className = 'section-title';
      suggTitle.innerText = 'Suggested For This Page';
      container.appendChild(suggTitle);

      const suggData = {
        [suggested.className]: {
          [suggested.moduleName]: fullCfaData[suggested.className][suggested.moduleName]
        }
      };

      openState.classes.add(suggested.className);
      openState.modules.add(`${suggested.className}-${suggested.moduleName}`);

      renderGroup(container, suggData, [suggested.className]);
    }
  }

  const favClasses = allClassNames.filter(c => favorites.has(c));
  const otherClasses = allClassNames.filter(c => !favorites.has(c));

  if (favClasses.length > 0) {
    const favTitle = document.createElement('div');
    favTitle.className = 'section-title';
    favTitle.innerText = currentSearchTerm ? 'Found in Favorites' : 'Favorites';
    container.appendChild(favTitle);
    const favDataSubset = pick(filteredData, favClasses);
    renderGroup(container, favDataSubset, favClasses);
  }

  if (otherClasses.length > 0) {
    const otherTitle = document.createElement('div');
    otherTitle.className = 'section-title';
    otherTitle.innerText = (favClasses.length > 0 || suggested.className) ? 'Other Classes' : 'All Classes';
    container.appendChild(otherTitle);
    const otherDataSubset = pick(filteredData, otherClasses);
    renderGroup(container, otherDataSubset, otherClasses);
  }
}

function pick(obj, keys) {
  const result = {};
  keys.forEach(key => { if (obj[key]) result[key] = obj[key]; });
  return result;
}

function renderGroup(container, dataObj, sortedKeys) {
  sortedKeys.forEach(className => {
    const classDiv = document.createElement('div');
    classDiv.className = 'class-item';

    const header = document.createElement('div');
    header.className = 'class-header';

    const starBtn = document.createElement('div');
    starBtn.className = 'star-btn class-star';
    const isFav = favorites.has(className);

    starBtn.innerHTML = `
      <svg class="star-icon ${isFav ? 'is-favorite' : ''}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"></polygon>
      </svg>
    `;

    starBtn.onclick = async (e) => {
      e.stopPropagation();
      if (favorites.has(className)) {
        favorites.delete(className);
      } else {
        favorites.add(className);
      }
      await chrome.storage.local.set({ [LEVELS[currentLevel].favKey]: Array.from(favorites) });
      renderMain();
    };

    const title = document.createElement('span');
    title.className = 'class-title-text';
    title.innerText = className;

    let classDuration = 0;
    if (dataObj[className]) {
      Object.values(dataObj[className]).forEach(lessons => {
        lessons.forEach(l => classDuration += (l.duration || 0));
      });
    }

    header.appendChild(starBtn);
    header.appendChild(title);
    
    if (classDuration > 0) {
      const classBadge = document.createElement('span');
      classBadge.className = 'duration-badge class-duration';
      classBadge.innerText = formatDuration(classDuration);
      header.appendChild(classBadge);
    }
    
    classDiv.appendChild(header);

    const isClassOpen = openState.classes.has(className) || currentSearchTerm.length > 0;
    const modulesContainer = document.createElement('div');
    modulesContainer.className = `modules-container ${isClassOpen ? '' : 'hidden'}`;

    header.onclick = () => {
      toggleState(openState.classes, className);
      modulesContainer.classList.toggle('hidden');
    };

    const modules = Object.keys(dataObj[className]);

    modules.sort((a, b) => {
      const modKeyA = `${className}-${a}`;
      const modKeyB = `${className}-${b}`;
      const aFav = favModules.has(modKeyA);
      const bFav = favModules.has(modKeyB);

      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB - (a < b);
    });

    let previousWasFav = false;

    modules.forEach((modName, index) => {
      const modDiv = document.createElement('div');
      const modKey = `${className}-${modName}`;
      const isModFav = favModules.has(modKey);
      const isModOpen = openState.modules.has(modKey) || currentSearchTerm.length > 0;

      modDiv.className = `module-item ${isModOpen ? 'expanded' : ''}`;

      if (index > 0 && previousWasFav && !isModFav) {
        modDiv.classList.add('module-separator');
      }
      previousWasFav = isModFav;

      const modHeader = document.createElement('div');
      modHeader.className = 'module-header';

      const modStarBtn = document.createElement('div');
      modStarBtn.className = 'star-btn mod-star';

      modStarBtn.innerHTML = `
        <svg class="star-icon ${isModFav ? 'is-favorite' : ''}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"></polygon>
        </svg>
      `;

      modStarBtn.onclick = async (e) => {
        e.stopPropagation();
        if (favModules.has(modKey)) favModules.delete(modKey);
        else favModules.add(modKey);
        await chrome.storage.local.set({ [LEVELS[currentLevel].modFavKey]: Array.from(favModules) });
        renderMain();
      };

      const arrowIcon = document.createElement('div');
      arrowIcon.className = 'mod-arrow-container';
      arrowIcon.innerHTML = `
        <svg class="mod-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;

      const modTitle = document.createElement('span');
      modTitle.className = 'module-title-text';
      modTitle.innerText = modName;

      let moduleDuration = 0;
      if (dataObj[className] && dataObj[className][modName]) {
        dataObj[className][modName].forEach(l => moduleDuration += (l.duration || 0));
      }

      modHeader.appendChild(modStarBtn);
      modHeader.appendChild(arrowIcon);
      modHeader.appendChild(modTitle);
      
      if (moduleDuration > 0) {
        const modBadge = document.createElement('span');
        modBadge.className = 'duration-badge module-duration';
        modBadge.innerText = formatDuration(moduleDuration);
        modHeader.appendChild(modBadge);
      }

      const lessonsContainer = document.createElement('div');
      lessonsContainer.className = `lessons-container ${isModOpen ? '' : 'hidden'}`;

      modHeader.onclick = () => {
        toggleState(openState.modules, modKey);
        modDiv.classList.toggle('expanded');
        lessonsContainer.classList.toggle('hidden');
      };

      dataObj[className][modName].forEach(lesson => {
        const lessonDiv = document.createElement('div');
        lessonDiv.className = 'lesson-item';
        // Lessons without a video link (Level 2) are shown as plain text
        const row = document.createElement(lesson.url ? 'a' : 'div');
        if (lesson.url) {
          row.href = lesson.url;
          row.target = '_blank';
        } else {
          row.className = 'lesson-text';
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'lesson-title-text';
        titleSpan.innerHTML = highlightTerm(lesson.name, currentHighlightTerm);
        row.appendChild(titleSpan);

        if (lesson.duration > 0) {
          const badge = document.createElement('span');
          badge.className = 'duration-badge lesson-duration';
          badge.innerText = formatDuration(lesson.duration);
          row.appendChild(badge);
        } else if (lesson.page > 0) {
          const badge = document.createElement('span');
          badge.className = 'duration-badge lesson-duration';
          badge.title = 'Curriculum page';
          badge.innerText = `p. ${lesson.page}`;
          row.appendChild(badge);
        }

        lessonDiv.appendChild(row);
        lessonsContainer.appendChild(lessonDiv);
      });

      modDiv.appendChild(modHeader);
      modDiv.appendChild(lessonsContainer);
      modulesContainer.appendChild(modDiv);
    });

    classDiv.appendChild(modulesContainer);
    container.appendChild(classDiv);
  });
}

function toggleState(set, key) {
  if (set.has(key)) set.delete(key);
  else set.add(key);
}

function highlightTerm(text, term) {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<b>$1</b>');
}

function filterData(data, term) {
  if (!term) return data;

  const parts = term.split(',').map(p => p.trim());

  if (parts.length === 1) {
    const result = {};
    Object.keys(data).forEach(className => {
      const modules = data[className];
      const matchingModules = {};
      let classHasMatch = false;

      if (className.toLowerCase().includes(term)) {
        result[className] = modules;
        return;
      }

      Object.keys(modules).forEach(modName => {
        const lessons = modules[modName];
        if (modName.toLowerCase().includes(term)) {
          matchingModules[modName] = lessons;
          classHasMatch = true;
          return;
        }

        const matchingLessons = lessons.filter(l => l.name.toLowerCase().includes(term));
        if (matchingLessons.length > 0) {
          matchingModules[modName] = matchingLessons;
          classHasMatch = true;
        }
      });

      if (classHasMatch) {
        result[className] = matchingModules;
      }
    });
    return result;
  }

  // Comma-separated: [groupTerm, moduleTerm, lessonTerm]
  const groupTerm = parts[0];
  const moduleTerm = parts[1];
  const lessonTerm = parts[2] || '';
  const result = {};

  Object.keys(data).forEach(className => {
    if (groupTerm && !className.toLowerCase().includes(groupTerm)) return;

    const modules = data[className];
    const matchingModules = {};
    let classHasMatch = false;

    Object.keys(modules).forEach(modName => {
      if (moduleTerm && !modName.toLowerCase().includes(moduleTerm)) return;

      const lessons = modules[modName];
      if (lessonTerm) {
        const matchingLessons = lessons.filter(l => l.name.toLowerCase().includes(lessonTerm));
        if (matchingLessons.length > 0) {
          matchingModules[modName] = matchingLessons;
          classHasMatch = true;
        }
      } else {
        matchingModules[modName] = lessons;
        classHasMatch = true;
      }
    });

    if (classHasMatch) {
      result[className] = matchingModules;
    }
  });
  return result;
}

function parseCSV(text) {
  const data = {};
  let row = [];
  let inQuotes = false;
  let cell = '';

  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' && !inQuotes) { row.push(cell.trim()); addIfValid(row, data); row = []; cell = ''; }
    else if (c !== '\r') { cell += c; }
  }

  if (cell || row.length > 0) { row.push(cell.trim()); addIfValid(row, data); }
  return data;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

function addIfValid(row, data) {
  if (row.length >= 4 && !row[0].includes('Group Name') && row[0].trim() !== '') {
    const group = row[0];
    const module = row[1];
    const lesson = row[2];
    const link = row[3];
    const duration = row.length >= 5 ? parseInt(row[4]) || 0 : 0;
    const page = row.length >= 6 ? parseInt(row[5]) || 0 : 0;

    if (!data[group]) data[group] = {};
    if (!data[group][module]) data[group][module] = [];
    data[group][module].push({ name: lesson, url: link, duration: duration, page: page });
  }
}