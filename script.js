const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('difficulty') || 'easy';

// Load settings from localStorage
const settings = JSON.parse(localStorage.getItem('typingTestSettings') || '{}');
const timerDuration = settings.timerDuration || 60;
const visibleWordsCount = Math.min(settings.visibleWords || 10, 12);

// Word pool variable
let words = [];

const punctuationMap = {};

const punctuationPools = {
  easy: [".", ",", "'"],
  medium: [".", ",", "'", ";", "-", "(", ")", ":"],
  hard: [".", ",", "'", ";", "-", "(", ")", "_", "=", "+", ":", "\"", "<", ">", "{", "}", "[", "]", "/", "\\", "|", "?", "!", "@", "#", "$", "%", "^", "&", "*"]
};

function getRandomPunctuation() {
  const savedDifficulty = localStorage.getItem('difficulty') || difficulty || 'easy';
  const pool = punctuationPools[savedDifficulty] || punctuationPools.easy;
  return pool[Math.floor(Math.random() * pool.length)];
}

let separators = [];
let currentWordIndex = 0;
let typedCharacters = 0;
let mistakes = 0;
let timeLeft = timerDuration;
let interval = null;
let timerStarted = false;
let currentWordIncorrect = false;

// DOM Elements
const textDisplay = document.getElementById('text-display');
const textInput = document.getElementById('text-input');
const wpmDisplay = document.getElementById('wpm');
const cpmDisplay = document.getElementById('cpm');
const accuracyDisplay = document.getElementById('accuracy');
const timerDisplay = document.getElementById('timer');
const popup = document.getElementById('popup');
const popupWpm = document.getElementById('popup-wpm');
const popupCpm = document.getElementById('popup-cpm');
const popupAccuracy = document.getElementById('popup-accuracy');
const popupScore = document.getElementById('popup-score');
const restartBtn = document.getElementById('restart-btn');
const goHomeBtn = document.getElementById('go-home-btn');

// Show the homepage when the Go Home button is clicked
function goHome() {
  window.location.href = 'index.html';
}

// Safe sound wrapper
function playSuccessSound() {
  if (typeof playSound === 'function') {
    playSound('success');
  }
}

// Calculate score based on CPM, accuracy, and difficulty
function calculateScore(cpm, accuracy, mode) {
  const modeTargets = {
    easy: { cpm: 380, accuracy: 95 },
    medium: { cpm: 325, accuracy: 95 },
    hard: { cpm: 270, accuracy: 95 },
  };

  const { cpm: targetCpm, accuracy: targetAccuracy } = modeTargets[mode] || modeTargets.easy;
  const rawScore = 100 * (cpm / targetCpm) * (accuracy / targetAccuracy);
  return Math.max(0, Math.min(150, Math.round(rawScore)));
}

// Load words from the selected difficulty
function loadWords() {
  fetch(`${difficulty}.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${difficulty}.json`);
      }
      return response.json();
    })
    .then(data => {
      words = shuffleArray([...data.words]);

      if (words.length < 50) {
        words.push(...generateWords(50 - words.length));
      }

      startTest();
    })
    .catch(error => {
      console.error('Error loading word file:', error);
      textDisplay.innerHTML = `<span style="color:red;">Failed to load word list: ${difficulty}.json</span>`;
    });
}

// Utility function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generate random words dynamically
function generateWords(count) {
  const wordList = [];
  if (words.length === 0) return wordList;

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    wordList.push(words[randomIndex]);
  }
  return wordList;
}

function ensureSeparators(length) {
  while (separators.length < length) {
    separators.push(Math.random() < 0.25 ? '\n' : ' ');
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getExpectedWord(word, index) {
  let expectedWord = word;

  if (index === 0 || separators[index - 1] === '\n') {
    expectedWord = word.charAt(0).toUpperCase() + word.slice(1);
  }

  if (separators[index] === '\n') {
    if (!punctuationMap[index]) {
      punctuationMap[index] = getRandomPunctuation();
    }
    expectedWord += punctuationMap[index];
  }

  return expectedWord;
}

function getWordsToShow() {
  const viewMode = localStorage.getItem('viewMode') || 'paragraph';
  return viewMode === 'paragraph' ? 24 : visibleWordsCount;
}

function updateInputHint() {
  const expectedSeparator = separators[currentWordIndex] || ' ';
  textInput.placeholder =
    expectedSeparator === '\n'
      ? 'Type the word, then press Enter'
      : 'Type the word, then press Space';
}

function updateTextDisplay() {
  const viewMode = localStorage.getItem('viewMode') || 'paragraph';

  if (viewMode === 'classic') {
    renderClassicView();
  } else {
    renderParagraphView();
  }
}

function buildParagraphSentenceData(startIndex, maxWords = 120) {
  const sentences = [];
  let index = startIndex;
  let wordsRead = 0;

  while (wordsRead < maxWords) {
    if (index >= words.length - 20) {
      words.push(...generateWords(30));
    }

    ensureSeparators(index + 30);

    const sentence = [];

    while (wordsRead < maxWords) {
      const wordIndex = index;
      sentence.push(wordIndex);

      index++;
      wordsRead++;

      if (separators[wordIndex] === '\n') {
        break;
      }

      if (index >= words.length - 5) {
        words.push(...generateWords(20));
      }

      ensureSeparators(index + 10);
    }

    if (sentence.length > 0) {
      sentences.push(sentence);
    }

    if (sentence.length === 0) {
      break;
    }
  }

  return sentences;
}

function renderClassicView() {
  const wordsToShow = getWordsToShow();

  const startIndex = currentWordIndex;
  const endIndex = startIndex + wordsToShow;

  if (endIndex > words.length) {
    words.push(...generateWords(endIndex - words.length + 10));
  }

  ensureSeparators(endIndex + 1);

  const visibleWords = words.slice(startIndex, endIndex);
  let displayHtml = '';

  visibleWords.forEach((word, index) => {
    const wordIndex = startIndex + index;
    const expectedWord = getExpectedWord(word, wordIndex);

    let className = 'word';
    if (wordIndex < currentWordIndex) {
      className += ' completed-word';
    } else if (wordIndex === currentWordIndex) {
      className += ' current-word';
    } else {
      className += ' upcoming-word';
    }

    const separator = separators[wordIndex];
    let separatorHtml = '';

    if (index < visibleWords.length - 1) {
      separatorHtml =
      separator === '\n'
        ? `<span class="enter-separator"> ↵ </span>`
        : `<span class="space"> </span>`;
    }

    if (wordIndex === currentWordIndex) {
      displayHtml += `<span class="${className}">${escapeHtml(expectedWord)}${separatorHtml}</span>`;
    } else {
      displayHtml += `<span class="${className}">${escapeHtml(expectedWord)}</span>`;
      if (index < visibleWords.length - 1) {
        displayHtml += separatorHtml;
      }
    }
  });

  textDisplay.classList.remove('paragraph-view');
  textDisplay.classList.add('classic-view');
  textDisplay.innerHTML = displayHtml;
}

function renderParagraphView() {
  textDisplay.classList.remove('classic-view');
  textDisplay.classList.add('paragraph-view');
  textDisplay.innerHTML = '';

  const sentenceData = buildParagraphSentenceData(currentWordIndex, 140);

  for (const sentence of sentenceData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sentence-block';

    sentence.forEach((wordIndex) => {
      const expectedWord = getExpectedWord(words[wordIndex], wordIndex);

      let className = 'word';
      if (wordIndex < currentWordIndex) {
        className += ' completed-word';
      } else if (wordIndex === currentWordIndex) {
        className += ' current-word';
      } else {
        className += ' upcoming-word';
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = className;
      wordSpan.innerHTML = escapeHtml(expectedWord);

      const separator = separators[wordIndex];
      const showEnterIcon = separator === '\n';
      const showSpace = separator === ' ';

      if (wordIndex === currentWordIndex && (showEnterIcon || showSpace)) {
        const separatorSpan = document.createElement('span');
        separatorSpan.className = showEnterIcon ? 'enter-separator' : 'space';
        separatorSpan.innerHTML = showEnterIcon ? ' ↵ ' : ' ';
        wordSpan.appendChild(separatorSpan);
        wrapper.appendChild(wordSpan);
      } else {
        wrapper.appendChild(wordSpan);

        if (showSpace) {
          const separatorSpan = document.createElement('span');
          separatorSpan.className = 'space';
          separatorSpan.innerHTML = ' ';
          wrapper.appendChild(separatorSpan);
        } else if (showEnterIcon) {
          const separatorSpan = document.createElement('span');
          separatorSpan.className = 'enter-separator';
          separatorSpan.innerHTML = ' ↵ ';
          wrapper.appendChild(separatorSpan);
        }
      }
    });

    textDisplay.appendChild(wrapper);

    if (textDisplay.scrollHeight > textDisplay.clientHeight) {
      textDisplay.removeChild(wrapper);
      break;
    }
  }
}

function startTest() {
  currentWordIndex = 0;
  typedCharacters = 0;
  mistakes = 0;
  timeLeft = timerDuration;
  timerStarted = false;
  currentWordIncorrect = false;
  separators = [];

  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  Object.keys(punctuationMap).forEach(key => delete punctuationMap[key]);

  textInput.disabled = false;
  textInput.value = '';
  textInput.style.color = '';
  timerDisplay.textContent = timeLeft;

  ensureSeparators(words.length + getWordsToShow());
  updateTextDisplay();
  updateStats();
  updateInputHint();

  textInput.removeEventListener('input', checkInput);
  textInput.removeEventListener('keydown', handleKeyDown);
  textInput.addEventListener('input', checkInput);
  textInput.addEventListener('keydown', handleKeyDown);

  textInput.focus();
}

function checkInput(e) {
  if (!timerStarted && e.inputType !== 'deleteContentBackward') {
    interval = setInterval(updateTimer, 1000);
    timerStarted = true;
  }

  const typedText = textInput.value;
  const expectedText = getExpectedWord(words[currentWordIndex], currentWordIndex);

  if (e.inputType === 'deleteContentBackward') {
    textInput.style.color =
      typedText === '' || expectedText.startsWith(typedText)
        ? 'green'
        : 'red';

    updateStats();
    return;
  }

  typedCharacters++;

  if (expectedText.startsWith(typedText)) {
    textInput.style.color = 'green';
  } else {
    textInput.style.color = 'red';

    if (!currentWordIncorrect) {
      mistakes++;
      currentWordIncorrect = true;
    }
  }

  updateStats();
}

function normalizeWordForCompare(text) {
  if (!text) return '';
  return text.replace(/\s+/g, '');
}

function handleKeyDown(e) {
  if (e.key !== ' ' && e.key !== 'Enter') return;

  const expectedSeparator = separators[currentWordIndex] || ' ';
  const shouldUseEnter = expectedSeparator === '\n';

  if (shouldUseEnter && e.key !== 'Enter') {
    e.preventDefault();
    markIncorrectInput();
    return;
  }

  if (!shouldUseEnter && e.key !== ' ') {
    e.preventDefault();
    markIncorrectInput();
    return;
  }

  e.preventDefault();

  const rawTypedText = textInput.value;
  const expectedText = getExpectedWord(words[currentWordIndex], currentWordIndex);

  // THIS IS THE IMPORTANT FIX
  if (expectedText.startsWith(rawTypedText) && rawTypedText.length === expectedText.length) {
    moveToNextWord();
  } else {
    markIncorrectInput();
  }
}


function moveToNextWord() {
  currentWordIndex++;
  currentWordIncorrect = false;

  textInput.value = '';
  textInput.style.color = '';

  const wordsToShow = getWordsToShow();

  if (currentWordIndex + wordsToShow >= words.length) {
    words.push(...generateWords(10));
    ensureSeparators(words.length + 10);
  }

  updateTextDisplay();
  updateStats();
  updateInputHint();
}

function markIncorrectInput() {
  textInput.style.color = 'red';

  if (textInput.value.trim() !== '') {
    mistakes++;
  }

  textInput.classList.add('input-error');
  setTimeout(() => {
    textInput.classList.remove('input-error');
  }, 120);

  updateStats();
}

function updateStats() {
  const wordsTyped = currentWordIndex;
  const elapsedTime = timerDuration - timeLeft;
  const minutes = elapsedTime / 60;

  const wpm = Math.round(wordsTyped / minutes || 0);
  const cpm = Math.round(typedCharacters / minutes || 0);
  const accuracy = Math.max(
    0,
    Math.round(((typedCharacters - mistakes) / typedCharacters) * 100) || 0
  );

  wpmDisplay.textContent = wpm;
  cpmDisplay.textContent = cpm;
  accuracyDisplay.textContent = `${accuracy}%`;
}

function updateTimer() {
  timeLeft--;
  timerDisplay.textContent = timeLeft;

  if (timeLeft <= 0) {
    clearInterval(interval);
    interval = null;
    textInput.disabled = true;
    showPopup();
  }
}

function showPopup() {
  const currentSettings = JSON.parse(localStorage.getItem('typingTestSettings') || '{}');
  if (currentSettings.showResults === false) {
    return;
  }

  const wpm = parseInt(wpmDisplay.textContent, 10) || 0;
  const cpm = parseInt(cpmDisplay.textContent, 10) || 0;
  const accuracy = parseFloat(accuracyDisplay.textContent.replace('%', '')) || 0;
  const score = calculateScore(cpm, accuracy, difficulty);

  popupWpm.textContent = wpm;
  popupCpm.textContent = cpm;
  popupAccuracy.textContent = accuracyDisplay.textContent;
  popupScore.textContent = score;

  const results = JSON.parse(localStorage.getItem('typingTestResults') || '[]');
  const previousScores = results.map(r => r.score || 0);
  const previousHighScore = previousScores.length > 0 ? Math.max(...previousScores) : 0;
  const isNewHighScore = score > previousHighScore;
  const isPerfectGame = accuracy === 100;

  const newHighscoreMsg = document.getElementById('new-highscore-msg');
  const perfectGameMsg = document.getElementById('perfect-game-msg');

  if (newHighscoreMsg) {
    newHighscoreMsg.classList.toggle('hidden', !isNewHighScore);
  }

  if (perfectGameMsg) {
    perfectGameMsg.classList.toggle('hidden', !isPerfectGame);
  }

  popup.classList.remove('hidden');

  const testResult = {
    wpm,
    cpm,
    accuracy,
    score,
    difficulty,
    timestamp: new Date().toISOString(),
    timeTaken: timerDuration - timeLeft,
    isHighScore: isNewHighScore,
    isPerfectGame: isPerfectGame
  };

  results.push(testResult);

  if (results.length > 100) {
    results.shift();
  }

  localStorage.setItem('typingTestResults', JSON.stringify(results));
}

restartBtn.addEventListener('click', () => {
  timerStarted = false;
  if (interval) clearInterval(interval);
  location.reload();
});

goHomeBtn.addEventListener('click', goHome);

// Dark mode toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  body.classList.add('dark');
  if (darkModeToggle) {
    darkModeToggle.textContent = '☀️ Light Mode';
  }
}

if (darkModeToggle) {
  darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark');
    const theme = body.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    darkModeToggle.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  });
}

// Start the test when the page loads and the difficulty is loaded
loadWords();