let fullCfaData = {}; 
let favorites = new Set(); 
let favModules = new Set(); 
let currentSearchTerm = '';
let openState = { classes: new Set(), modules: new Set() };
let suggested = { className: null, moduleName: null }; 

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const searchBar = document.getElementById('search-bar');
  
  const result = await chrome.storage.local.get(['cfaFavorites', 'cfaModFavorites']);
  favorites = new Set(result.cfaFavorites || []); 
  favModules = new Set(result.cfaModFavorites || []);

  try {
    const response = await fetch('CFA_Level1_LetMeExplain_Index.csv');
    if (!response.ok) throw new Error("CSV missing");
    const text = await response.text();
    fullCfaData = parseCSV(text);
    
    // --- SMARTER TAB SCANNER ---
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url && tab.url.startsWith("http")) {
        const allGroups = Object.keys(fullCfaData);
        
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (groups) => {
            let foundGroup = null;
            let foundMod = null;
            
            const titleText = document.title.toLowerCase();
            const headingsText = Array.from(document.querySelectorAll('h1, h2, h3'))
                                      .map(h => h.innerText.toLowerCase())
                                      .join(' ');
            const bodyText = document.body.innerText.toLowerCase();

            // 1. SMARTER GROUP SEARCH: Check Title, then Headings, then Body
            for (const g of groups) {
              const lowerG = g.toLowerCase();
              if (titleText.includes(lowerG)) {
                foundGroup = g; break;
              }
            }
            if (!foundGroup) {
              for (const g of groups) {
                if (headingsText.includes(lowerG)) {
                  foundGroup = g; break;
                }
              }
            }
            if (!foundGroup) {
              for (const g of groups) {
                if (bodyText.includes(lowerG)) {
                  foundGroup = g; break;
                }
              }
            }
            
            // 2. SMARTER MODULE SEARCH
            // First look for the explicit phrase "Module X"
            let match = bodyText.match(/module\s+(\d+)/);
            if (match) {
              foundMod = "Module " + match[1];
            } else {
              // Fallback: Look for "10.04" format and extract the "10"
              // \b ensures it's a standalone number, \d{1,2} grabs the 10, \.\d{2} grabs the .04
              match = bodyText.match(/\b(\d{1,2})\.\d{2}\b/);
              if (match) {
                foundMod = "Module " + match[1];
              }
            }
            
            return { className: foundGroup, moduleName: foundMod };
          },
          args: [allGroups]
        });
        
        if (injectionResults && injectionResults[0].result) {
          suggested = injectionResults[0].result;
        }
      }
    } catch (tabError) {
      console.log("Could not scan tab content:", tabError);
    }
    // ----------------------------

    loading.classList.add('hidden');
    renderMain();
  } catch (error) {
    loading.innerText = 'Error loading CSV. Check folder.';
    loading.style.color = 'red';
    console.error(error);
  }

  searchBar.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.toLowerCase().trim();
      renderMain();
  });
});

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
    keys.forEach(key => { if(obj[key]) result[key] = obj[key]; });
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
      await chrome.storage.local.set({ cfaFavorites: Array.from(favorites) });
      renderMain(); 
    };

    const title = document.createElement('span');
    title.className = 'class-title-text';
    title.innerText = className;
    
    header.appendChild(starBtn);
    header.appendChild(title);
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
        await chrome.storage.local.set({ cfaModFavorites: Array.from(favModules) });
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

      modHeader.appendChild(modStarBtn);
      modHeader.appendChild(arrowIcon);
      modHeader.appendChild(modTitle);
      
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
        const link = document.createElement('a');
        link.href = lesson.url;
        link.target = '_blank';
        link.innerHTML = highlightTerm(lesson.name, currentSearchTerm);
        lessonDiv.appendChild(link);
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
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<b>$1</b>');
}

function filterData(data, term) {
    if (!term) return data;
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

function parseCSV(text) {
  const data = {};
  let row = [];
  let inQuotes = false;
  let cell = '';
  
  for(let i=0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') { inQuotes = !inQuotes; } 
    else if (c === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; } 
    else if (c === '\n' && !inQuotes) { row.push(cell.trim()); addIfValid(row, data); row = []; cell = ''; } 
    else if (c !== '\r') { cell += c; }
  }
  
  if (cell || row.length > 0) { row.push(cell.trim()); addIfValid(row, data); }
  return data;
}

function addIfValid(row, data) {
  if (row.length >= 4 && !row[0].includes('Group Name') && row[0].trim() !== '') {
    const group = row[0];
    const module = row[1];
    const lesson = row[2];
    const link = row[3];
    
    if (!data[group]) data[group] = {};
    if (!data[group][module]) data[group][module] = [];
    data[group][module].push({name: lesson, url: link});
  }
}