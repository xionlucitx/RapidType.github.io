const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('difficulty') || 'easy';

// Load settings from localStorage
const settings = JSON.parse(localStorage.getItem('typingTestSettings') || '{}');
const timerDuration = settings.timerDuration || 60;
const visibleWordsCount = settings.visibleWords || 50;

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
    .then(response => response.json())
    .then(data => {
      words = shuffleArray([...data.words]);

      if (words.length < 50) {
        words.push(...generateWords(50 - words.length));
      }

      startTest();
    })
    .catch(error => {
      console.error("Error loading word file:", error);
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

function updateTextDisplay() {
  const viewMode = localStorage.getItem('viewMode') || 'vertical';
  let visibleWords = words.slice(currentWordIndex, currentWordIndex + visibleWordsCount);

  if (visibleWords.length < visibleWordsCount) {
    words.push(...generateWords(visibleWordsCount - visibleWords.length));
    visibleWords = words.slice(currentWordIndex, currentWordIndex + visibleWordsCount);
  }

  ensureSeparators(currentWordIndex + visibleWordsCount);

  let displayHtml = '';

  if (viewMode === 'horizontal') {
    visibleWords.forEach((word, index) => {
      const wordIndex = currentWordIndex + index;
      const expectedWord = getExpectedWord(word, wordIndex);
      const isCurrent = index === 0 ? ' current-word' : '';

      displayHtml += `<span class="word${isCurrent}">${escapeHtml(expectedWord)}</span>`;

      if (index < visibleWords.length - 1) {
        const separator = separators[wordIndex];

        if (separator === '\n') {
          displayHtml += `<span class="enter-separator"> ↵ </span>`;
        } else {
          displayHtml += `<span class="space"> </span>`;
        }
      }
    });
  } else {
    visibleWords.forEach((word, index) => {
      const wordIndex = currentWordIndex + index;
      const expectedWord = getExpectedWord(word, wordIndex);
      const isCurrent = index === 0 ? ' current-word' : '';

      displayHtml += `<div class="word${isCurrent}">${escapeHtml(expectedWord)}</div>`;
    });
  }

  textDisplay.innerHTML = displayHtml;
}

function startTest() {
  currentWordIndex = 0;
  typedCharacters = 0;
  mistakes = 0;
  timeLeft = timerDuration;
  timerStarted = false;
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

  ensureSeparators(words.length + visibleWordsCount);
  updateTextDisplay();
  updateStats();

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
    textInput.style.color = expectedText.startsWith(typedText) ? 'green' : 'red';
    updateStats();
    return;
  }

  typedCharacters++;

  if (
    expectedText.startsWith(typedText) ||
    expectedText.toLowerCase().startsWith(typedText.toLowerCase())
  ) {
    textInput.style.color = 'green';
  } else {
    textInput.style.color = 'red';
    mistakes++;
  }

  updateStats();
}

function normalizeWordForCompare(text) {
  if (!text) return '';
  return text.replace(/\s+/g, '');
}

function handleKeyDown(e) {
  if (e.key !== ' ' && e.key !== 'Enter') return;

  e.preventDefault();

  const rawTypedText = textInput.value;
  const expectedText = getExpectedWord(words[currentWordIndex], currentWordIndex);

  const typedText = normalizeWordForCompare(rawTypedText);
  const expectedNormalized = normalizeWordForCompare(expectedText);

  if (typedText === expectedNormalized) {
    moveToNextWord();
  } else {
    markIncorrectInput(expectedText);
  }
}


function moveToNextWord() {
  currentWordIndex++;

  textInput.value = '';
  textInput.style.color = '';

  playSuccessSound();

  if (currentWordIndex + visibleWordsCount >= words.length) {
    words.push(...generateWords(10));
    ensureSeparators(words.length + 10);
  }

  updateTextDisplay();
  updateStats();
}

function markIncorrectInput(expectedText) {
  textInput.style.color = 'red';

  if (textInput.value.trim() !== '') {
    mistakes++;
  }

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