const params = new URLSearchParams(window.location.search);
const sourceUrl = params.get('fileUrl') || '';
const sourceName = params.get('name') || 'Unknown Track';
const mode = params.get('mode') || 'create';
const editIndexParam = params.get('editIndex');
const initialPartName = params.get('partName') || '';
const initialStartTime = Number(params.get('startTime'));
const initialEndTime = Number(params.get('endTime'));

const trackNameNode = document.getElementById('track-name');
const clipAudio = document.getElementById('clip-audio');
const partNameInput = document.getElementById('part-name');
const clipStartInput = document.getElementById('clip-start');
const clipEndInput = document.getElementById('clip-end');
const currentPositionNode = document.getElementById('current-position');
const setStartButton = document.getElementById('set-start');
const setEndButton = document.getElementById('set-end');
const jumpStartButton = document.getElementById('jump-start');
const jumpEndButton = document.getElementById('jump-end');
const previewClipButton = document.getElementById('preview-clip');
const saveClipButton = document.getElementById('save-clip');
const clipStatusNode = document.getElementById('clip-status');

let activePreviewEnd = null;
const editIndex = editIndexParam === null ? null : Number(editIndexParam);

function setClipStatus(message) {
  if (clipStatusNode) {
    clipStatusNode.textContent = message;
  }
}

function updateCurrentPosition() {
  if (currentPositionNode && clipAudio) {
    currentPositionNode.textContent = `${clipAudio.currentTime.toFixed(1)}s`;
  }
}

function setSelection(startTime, endTime) {
  if (!clipStartInput || !clipEndInput) {
    return;
  }

  clipStartInput.value = startTime.toFixed(1);
  clipEndInput.value = endTime.toFixed(1);
}

function normalizeSelection(changedField) {
  if (!clipAudio || !clipStartInput || !clipEndInput) {
    return;
  }

  const maxDuration = Number.isFinite(clipAudio.duration) ? clipAudio.duration : 0;
  let startTime = Number(clipStartInput.value);
  let endTime = Number(clipEndInput.value);

  if (Number.isNaN(startTime)) {
    startTime = 0;
  }

  if (Number.isNaN(endTime)) {
    endTime = maxDuration;
  }

  startTime = Math.max(0, Math.min(startTime, maxDuration));
  endTime = Math.max(0, Math.min(endTime, maxDuration));

  if (changedField === 'start' && startTime >= endTime) {
    endTime = Math.min(maxDuration, startTime + 0.1);
  }

  if (changedField === 'end' && endTime <= startTime) {
    startTime = Math.max(0, endTime - 0.1);
  }

  if (endTime <= startTime) {
    endTime = Math.min(maxDuration, startTime + 0.1);
  }

  setSelection(startTime, endTime);
}

function getSelection() {
  if (!clipStartInput || !clipEndInput || !clipAudio) {
    return null;
  }

  const maxDuration = Number.isFinite(clipAudio.duration) ? clipAudio.duration : 0;
  const startTime = Math.max(0, Math.min(Number(clipStartInput.value), maxDuration));
  const endTime = Math.max(0, Math.min(Number(clipEndInput.value), maxDuration));

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return null;
  }

  return { startTime, endTime };
}

async function previewSelection() {
  if (!clipAudio) {
    return;
  }

  const selection = getSelection();

  if (!selection) {
    setClipStatus('Choose valid clip times before preview.');
    return;
  }

  clipAudio.currentTime = selection.startTime;
  activePreviewEnd = selection.endTime;
  await clipAudio.play();
  setClipStatus(`Previewing ${selection.startTime.toFixed(1)}s to ${selection.endTime.toFixed(1)}s`);
}

async function auditionPoint(point, label) {
  if (!clipAudio) {
    return;
  }

  const maxDuration = Number.isFinite(clipAudio.duration) ? clipAudio.duration : 0;
  const boundedPoint = Math.max(0, Math.min(point, maxDuration));
  const auditionEnd = Math.min(maxDuration, boundedPoint + 0.8);

  clipAudio.currentTime = boundedPoint;
  activePreviewEnd = auditionEnd;
  await clipAudio.play();
  setClipStatus(`${label} set at ${boundedPoint.toFixed(1)}s (quick audition).`);
}

function saveClipPart() {
  if (!window.musicApi || !partNameInput) {
    return;
  }

  const selection = getSelection();

  if (!selection) {
    setClipStatus('Choose valid clip times before saving.');
    return;
  }

  const partName = partNameInput.value.trim();

  if (!partName) {
    setClipStatus('Enter a part name before saving.');
    return;
  }

  window.musicApi.saveClipPart({
    sourceUrl,
    sourceName,
    name: partName,
    startTime: selection.startTime,
    endTime: selection.endTime,
    editIndex: Number.isNaN(editIndex) ? null : editIndex,
  });

  setClipStatus(`${mode === 'edit' ? 'Updated' : 'Saved'} ${partName}: ${selection.startTime.toFixed(1)}s - ${selection.endTime.toFixed(1)}s`);
}

if (trackNameNode) {
  trackNameNode.textContent = sourceName;
}

if (partNameInput) {
  partNameInput.value = initialPartName || '';
}

if (clipAudio) {
  clipAudio.src = sourceUrl;

  clipAudio.addEventListener('loadedmetadata', () => {
    const duration = Number.isFinite(clipAudio.duration) ? clipAudio.duration : 0;
    const startTime = Number.isNaN(initialStartTime) ? 0 : initialStartTime;
    const endTime = Number.isNaN(initialEndTime) ? duration : initialEndTime;
    setSelection(startTime, endTime);

    if (saveClipButton) {
      saveClipButton.textContent = mode === 'edit' ? 'Update Part' : 'Save Part';
    }

    setClipStatus(`Loaded ${sourceName} (${duration.toFixed(1)}s)`);
  });

  clipAudio.addEventListener('timeupdate', () => {
    updateCurrentPosition();

    if (activePreviewEnd === null) {
      return;
    }

    if (clipAudio.currentTime >= activePreviewEnd) {
      clipAudio.pause();
      activePreviewEnd = null;
    }
  });
}

if (clipStartInput) {
  clipStartInput.addEventListener('input', () => {
    normalizeSelection('start');
  });
}

if (clipEndInput) {
  clipEndInput.addEventListener('input', () => {
    normalizeSelection('end');
  });
}

if (setStartButton && clipAudio && clipStartInput) {
  setStartButton.addEventListener('click', () => {
    clipStartInput.value = clipAudio.currentTime.toFixed(1);
    normalizeSelection('start');
    void auditionPoint(Number(clipStartInput.value), 'Start');
  });
}

if (setEndButton && clipAudio && clipEndInput) {
  setEndButton.addEventListener('click', () => {
    clipEndInput.value = clipAudio.currentTime.toFixed(1);
    normalizeSelection('end');
    void auditionPoint(Number(clipEndInput.value), 'End');
  });
}

if (jumpStartButton && clipAudio && clipStartInput) {
  jumpStartButton.addEventListener('click', () => {
    clipAudio.currentTime = Number(clipStartInput.value);
  });
}

if (jumpEndButton && clipAudio && clipEndInput) {
  jumpEndButton.addEventListener('click', () => {
    clipAudio.currentTime = Number(clipEndInput.value);
  });
}

if (previewClipButton) {
  previewClipButton.addEventListener('click', () => {
    void previewSelection();
  });
}

if (saveClipButton) {
  saveClipButton.addEventListener('click', () => {
    saveClipPart();
  });
}

updateCurrentPosition();
