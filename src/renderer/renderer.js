const versionNode = document.getElementById('version');
const newProjectButton = document.getElementById('new-project');
const homeStatusNode = document.getElementById('home-status');
const savedProjectsNode = document.getElementById('saved-projects');

const PROJECT_STORAGE_KEY = 'dance-player-projects-v1';

if (versionNode && window.appInfo) {
  versionNode.textContent = `${window.appInfo.name} v${window.appInfo.version}`;
}

function setHomeStatus(message) {
  if (homeStatusNode) {
    homeStatusNode.textContent = message;
  }
}

function loadProjects() {
  const rawState = localStorage.getItem(PROJECT_STORAGE_KEY);

  if (!rawState) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawState);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
}

function upsertProject(audio) {
  const projects = loadProjects();
  const existingIndex = projects.findIndex((project) => project.id === audio.fileUrl);

  if (existingIndex >= 0) {
    projects[existingIndex] = {
      ...projects[existingIndex],
      id: audio.fileUrl,
      audio: {
        ...projects[existingIndex].audio,
        ...audio,
      },
      parts: Array.isArray(projects[existingIndex].parts) ? projects[existingIndex].parts : [],
    };
  } else {
    projects.push({
      id: audio.fileUrl,
      audio,
      parts: [],
    });
  }

  saveProjects(projects);
}

function renderSavedProjects() {
  if (!savedProjectsNode) {
    return;
  }

  const projects = loadProjects();
  savedProjectsNode.innerHTML = '';

  if (projects.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.textContent = 'No saved projects yet.';
    savedProjectsNode.appendChild(emptyText);
    return;
  }

  projects.forEach((project) => {
    if (!project || !project.audio || !project.audio.fileUrl) {
      return;
    }

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'saved-project-card';

    const trackName = project.audio.name || 'Untitled Track';
    const clipsCount = Array.isArray(project.parts) ? project.parts.length : 0;

    card.innerHTML = `
      <span class="saved-project-name">${trackName}</span>
      <span class="saved-project-meta">${clipsCount} clip${clipsCount === 1 ? '' : 's'}</span>
    `;

    card.addEventListener('click', async () => {
      if (!window.musicApi) {
        return;
      }

      const opened = await window.musicApi.openProjectWindow(project.audio);

      if (!opened) {
        setHomeStatus('Could not open saved project window.');
        return;
      }

      setHomeStatus('');
    });

    savedProjectsNode.appendChild(card);
  });
}

if (newProjectButton && window.musicApi) {
  newProjectButton.addEventListener('click', async () => {
    const selectedMp3 = await window.musicApi.selectMp3();

    if (!selectedMp3) {
      return;
    }

    upsertProject(selectedMp3);
    renderSavedProjects();

    const opened = await window.musicApi.openProjectWindow(selectedMp3);

    if (!opened) {
      setHomeStatus('Could not open project window.');
      return;
    }

    setHomeStatus('');
  });
}

renderSavedProjects();

window.addEventListener('storage', (event) => {
  if (event.key === PROJECT_STORAGE_KEY) {
    renderSavedProjects();
  }
});
