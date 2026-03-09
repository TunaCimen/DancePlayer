const params = new URLSearchParams(window.location.search);
const fileUrl = params.get('fileUrl') || '';
const initialName = params.get('name') || 'Track';

const trackTitleNode = document.getElementById('track-title');
const trackTitleInput = document.getElementById('track-title-input');
const editTrackNameButton = document.getElementById('edit-track-name');
const saveTrackNameButton = document.getElementById('save-track-name');
const cancelTrackNameButton = document.getElementById('cancel-track-name');
const statusTextNode = document.getElementById('status-text');
const nowPlayingNode = document.getElementById('now-playing');
const audioPlayer = document.getElementById('audio-player');
const openClipperButton = document.getElementById('open-clipper');
const partsListNode = document.getElementById('parts-list');

const PROJECT_STORAGE_KEY = 'dance-player-projects-v1';

let activeSegmentEnd = null;
let isEditingTrackTitle = false;
let selectedTrack = {
  id: fileUrl,
  audio: {
    fileUrl,
    name: initialName,
  },
  parts: [],
};

function setStatus(message) {
  if (statusTextNode) {
    statusTextNode.textContent = message;
  }
}

function loadProjectStore() {
  const raw = localStorage.getItem(PROJECT_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjectStore(projects) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
}

function persistCurrentTrack() {
  const projects = loadProjectStore();
  const existingIndex = projects.findIndex((project) => project.id === selectedTrack.id);

  if (existingIndex >= 0) {
    projects[existingIndex] = selectedTrack;
  } else {
    projects.push(selectedTrack);
  }

  saveProjectStore(projects);
}

function hydrateTrack() {
  const projects = loadProjectStore();
  const existingTrack = projects.find((project) => project.id === selectedTrack.id);

  if (!existingTrack) {
    persistCurrentTrack();
    return;
  }

  selectedTrack = {
    ...existingTrack,
    audio: {
      ...existingTrack.audio,
      fileUrl,
      name: existingTrack.audio && existingTrack.audio.name ? existingTrack.audio.name : initialName,
    },
    parts: Array.isArray(existingTrack.parts) ? existingTrack.parts : [],
  };
}

function renderHeader() {
  if (trackTitleNode) {
    trackTitleNode.textContent = selectedTrack.audio.name;
  }
}

function setTrackTitleEditMode(editing) {
  isEditingTrackTitle = editing;

  if (!trackTitleNode || !trackTitleInput || !editTrackNameButton || !saveTrackNameButton || !cancelTrackNameButton) {
    return;
  }

  trackTitleNode.classList.toggle('hidden', editing);
  trackTitleInput.classList.toggle('hidden', !editing);
  editTrackNameButton.classList.toggle('hidden', editing);
  saveTrackNameButton.classList.toggle('hidden', !editing);
  cancelTrackNameButton.classList.toggle('hidden', !editing);

  if (editing) {
    trackTitleInput.value = selectedTrack.audio.name;
    trackTitleInput.focus();
    trackTitleInput.select();
  }
}

function commitTrackRename() {
  if (!trackTitleInput) {
    return;
  }

  const trimmedName = trackTitleInput.value.trim();

  if (!trimmedName) {
    setStatus('Track name cannot be empty.');
    return;
  }

  selectedTrack.audio.name = trimmedName;
  renderHeader();
  persistCurrentTrack();
  setTrackTitleEditMode(false);
  setStatus(`Renamed track to ${trimmedName}`);
}

function renderParts() {
  if (!partsListNode) {
    return;
  }

  partsListNode.innerHTML = '';

  if (selectedTrack.parts.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No clips yet. Open Clip Editor to create one.';
    partsListNode.appendChild(empty);
    return;
  }

  selectedTrack.parts.forEach((part, index) => {
    const row = document.createElement('div');
    row.className = 'part-row';

    const label = document.createElement('p');
    label.className = 'part-label';
    label.textContent = `${part.name} (${part.startTime.toFixed(1)}s - ${part.endTime.toFixed(1)}s)`;

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'part-button';
    playButton.textContent = 'Play';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'part-button part-edit';
    editButton.textContent = 'Edit';

    playButton.addEventListener('click', async () => {
      await playSegment(part);
    });

    editButton.addEventListener('click', async () => {
      if (!window.musicApi) {
        return;
      }

      const opened = await window.musicApi.openClipWindow({
        ...selectedTrack.audio,
        mode: 'edit',
        editIndex: index,
        partName: part.name,
        startTime: part.startTime,
        endTime: part.endTime,
      });

      if (!opened) {
        setStatus('Could not open clip editor for editing.');
      }
    });

    const actions = document.createElement('div');
    actions.className = 'part-actions';
    actions.append(playButton, editButton);

    row.append(label, actions);
    partsListNode.appendChild(row);
  });
}

async function playSegment(part) {
  if (!audioPlayer || !nowPlayingNode) {
    return;
  }

  const startPlayback = async () => {
    audioPlayer.currentTime = part.startTime;
    activeSegmentEnd = part.endTime;
    nowPlayingNode.textContent = `Now playing: ${part.name}`;
    await audioPlayer.play();
  };

  if (audioPlayer.src !== selectedTrack.audio.fileUrl) {
    audioPlayer.src = selectedTrack.audio.fileUrl;
    audioPlayer.addEventListener('loadedmetadata', () => {
      void startPlayback();
    }, { once: true });
    return;
  }

  await startPlayback();
}

if (editTrackNameButton) {
  editTrackNameButton.addEventListener('click', () => {
    setTrackTitleEditMode(true);
  });
}

if (saveTrackNameButton) {
  saveTrackNameButton.addEventListener('click', () => {
    commitTrackRename();
  });
}

if (cancelTrackNameButton) {
  cancelTrackNameButton.addEventListener('click', () => {
    setTrackTitleEditMode(false);
  });
}

if (trackTitleInput) {
  trackTitleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && isEditingTrackTitle) {
      event.preventDefault();
      commitTrackRename();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setTrackTitleEditMode(false);
    }
  });
}

if (audioPlayer) {
  audioPlayer.src = selectedTrack.audio.fileUrl;

  audioPlayer.addEventListener('timeupdate', () => {
    if (activeSegmentEnd === null) {
      return;
    }

    if (audioPlayer.currentTime >= activeSegmentEnd) {
      audioPlayer.pause();
      activeSegmentEnd = null;
    }
  });
}

if (openClipperButton && window.musicApi) {
  openClipperButton.addEventListener('click', async () => {
    const opened = await window.musicApi.openClipWindow(selectedTrack.audio);

    if (!opened) {
      setStatus('Could not open clip editor.');
    }
  });
}

if (window.musicApi) {
  window.musicApi.onPartSaved((part) => {
    if (!part || typeof part.startTime !== 'number' || typeof part.endTime !== 'number') {
      return;
    }

    if (typeof part.editIndex === 'number' && selectedTrack.parts[part.editIndex]) {
      selectedTrack.parts[part.editIndex] = {
        ...selectedTrack.parts[part.editIndex],
        ...part,
      };
      setStatus(`Updated ${part.name}`);
    } else {
      selectedTrack.parts.push({
        ...part,
        name: part.name || `Part ${selectedTrack.parts.length + 1}`,
      });
      setStatus(`Saved ${part.name || 'part'}`);
    }

    persistCurrentTrack();
    renderParts();
  });
}

hydrateTrack();
renderHeader();
setTrackTitleEditMode(false);
renderParts();
persistCurrentTrack();
setStatus('Project loaded');
