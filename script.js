const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('difficulty') || 'easy'; // Default to 'easy' if no difficulty is specified

// Load settings from localStorage
const settings = JSON.parse(localStorage.getItem('typingTestSettings') || '{}');
const timerDuration = settings.timerDuration || 60;
const visibleWordsCount = settings.visibleWords || 50;

// Word pool variable
let words = [];

// Punctuation pools by difficulty level
const punctuationPools = {
  easy: [".", ",", "'", ";", "-"],
  medium: [".", ",", "'", ";", "-", "(", ")", "_", "=", "+", ":", "\""],
  hard: [".", ",", "'", ";", "-", "(", ")", "_", "=", "+", ":", "\"", "<", ">", "{", "}", "[", "]", "/", "\\", "|", "?", "!", "@", "#", "$", "%", "^", "&", "*"]
};

// Function to get random punctuation based on difficulty
function getRandomPunctuation() {
  const pool = punctuationPools[difficulty] || punctuationPools.easy;
  return pool[Math.floor(Math.random() * pool.length)];
}
let separators = [];
let currentWordIndex = 0;
let typedCharacters = 0;
let mistakes = 0;
let timeLeft = timerDuration;
let interval;
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
  window.location.href = 'index.html'; // Go to the home page
}

// Calculate score based on CPM, accuracy, and difficulty
function calculateScore(cpm, accuracy, mode) {
  const modeTargets = {
    easy: { cpm: 380, accuracy: 95 },
    medium: { cpm: 325, accuracy: 95 },
    hard: { cpm: 270, accuracy: 95 },
  };
  
  const { cpm: targetCpm, accuracy: targetAccuracy } = modeTargets[mode];
  const rawScore = 100 * (cpm / targetCpm) * (accuracy / targetAccuracy);
  return Math.max(0, Math.min(150, Math.round(rawScore)));
}

// Load words from the selected difficulty
function loadWords() {
  fetch(`${difficulty}.json`)
    .then(response => response.json())
    .then(data => {
      words = shuffleArray(data.words); // Shuffle the words to make the test more interesting

      // Generate more words if the initial pool is smaller than required
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
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

// Generate random words dynamically
function generateWords(count) {
  const wordList = [];
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

// Global variable to store current punctuation for Enter separators
let currentPunctuation = '';

function updateTextDisplay() {
  const viewMode = localStorage.getItem('viewMode') || 'vertical';
  const visibleWords = words.slice(currentWordIndex, currentWordIndex + visibleWordsCount);

  if (visibleWords.length < visibleWordsCount) {
    words.push(...generateWords(visibleWordsCount - visibleWords.length));
  }

  ensureSeparators(currentWordIndex + visibleWordsCount);

  // Generate punctuation for current word if it's an Enter separator
  const currentSeparator = separators[currentWordIndex];
  if (currentSeparator === '\n' && !currentPunctuation) {
    currentPunctuation = getRandomPunctuation();
  }

  let displayHtml = '';

  if (viewMode === 'horizontal') {
    // Horizontal view: display words in paragraph format
    visibleWords.forEach((word, index) => {
      const separator = separators[currentWordIndex + index];
      const prevSeparatorIndex = currentWordIndex + index - 1;
      const prevSeparator = prevSeparatorIndex >= 0 ? separators[prevSeparatorIndex] : null;
      let displayWord = word;

      // Capitalize word if it's the first word or the previous separator was punctuation (Enter separator)
      if (currentWordIndex + index === 0 || prevSeparator === '\n') {
        displayWord = word.charAt(0).toUpperCase() + word.slice(1);
      }

      displayHtml += `<span class="word">${escapeHtml(displayWord)}</span>`;

      if (index < visibleWords.length - 1) {
        if (separator === '\n') {
          // Show punctuation and Enter symbol for punctuation separators
          const punctToShow = (index === 0) ? currentPunctuation : getRandomPunctuation();
          displayHtml += `<span class="punctuation">${punctToShow}↵</span><br>`;
        } else {
          displayHtml += `<span class="space"> </span>`;
        }
      }
    });
  } else {
    // Vertical view: display words in lines (original behavior)
    visibleWords.forEach((word, index) => {
      const separator = separators[currentWordIndex + index];
      const prevSeparatorIndex = currentWordIndex + index - 1;
      const prevSeparator = prevSeparatorIndex >= 0 ? separators[prevSeparatorIndex] : null;
      let displayWord = word;

      // Capitalize word if it's the first word or the previous separator was punctuation (Enter separator)
      if (currentWordIndex + index === 0 || prevSeparator === '\n') {
        displayWord = word.charAt(0).toUpperCase() + word.slice(1);
      }

      displayHtml += `<span class="word">${escapeHtml(displayWord)}</span>`;

      if (index < visibleWords.length - 1) {
        if (separator === '\n') {
          // Show punctuation and Enter icon for punctuation separators
          const punctToShow = (index === 0) ? currentPunctuation : getRandomPunctuation();
          displayHtml += `<span class="punctuation">${punctToShow}↵ </span>`;
        } else {
          displayHtml += `<span class="space"> </span>`;
        }
      }
    });
  }

  textDisplay.innerHTML = displayHtml;
}

function startTest() {
  currentWordIndex = 0;
  currentPunctuation = '';
  timeLeft = timerDuration; // Reset to the configured duration
  timerDisplay.textContent = timeLeft; // Update the display
  ensureSeparators(words.length + visibleWordsCount);
  updateTextDisplay();
  textInput.addEventListener('input', checkInput);
  textInput.addEventListener('keydown', handleKeyDown);
}

function getExpectedWord(word, index) {
  if (index === 0) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return word;
}

function checkInput() {
  const typedText = textInput.value;
  const currentWord = words[currentWordIndex];
  const expectedText = getExpectedWord(currentWord, currentWordIndex);

  if (expectedText.startsWith(typedText)) {
    textInput.style.color = "green";
  } else {
    textInput.style.color = "red";
    mistakes++;
    playSound("error");
  }

  updateStats();
}

function handleKeyDown(e) {
  if (e.key !== " " && e.key !== "Enter") return;

  e.preventDefault();

  const typedText = textInput.value.trim();
  const currentWord = words[currentWordIndex];
  const expectedText = getExpectedWord(currentWord, currentWordIndex);

  if (typedText === expectedText) {
    moveToNextWord();
  } else {
    markIncorrectInput(expectedText);
  }
}

function moveToNextWord() {
  currentWordIndex++;
  textInput.value = '';

  playSound('success');

  if (currentWordIndex + visibleWordsCount >= words.length) {
    words.push(...generateWords(10));
    ensureSeparators(words.length + 10);
  }

  // Reset punctuation for new word
  currentPunctuation = '';

  updateTextDisplay();
  updateStats();
}

function checkInput(e) {
  // Start timer on first input (except backspace)
  if (!timerStarted && e.inputType !== 'deleteContentBackward') {
    interval = setInterval(updateTimer, 1000);
    timerStarted = true;
  }

  const typedText = textInput.value; // Raw input without trim
  const currentWord = words[currentWordIndex]; // Current word to match
  const nextSeparator = separators[currentWordIndex] || ' ';
  const prevSeparator = currentWordIndex > 0 ? separators[currentWordIndex - 1] : null;

  // Handle backspace and input logic
  if (e.inputType === 'deleteContentBackward') {
    return; // Do not count backspace as a mistake or character typed
  }

  // Track all characters typed
  typedCharacters++;

  // Validate input
  let expectedText = currentWord;
  // Capitalize if the previous separator was punctuation (word should be capitalized)
  if (prevSeparator === '\n') {
    expectedText = currentWord.charAt(0).toUpperCase() + currentWord.slice(1);
  }
  if (nextSeparator === '\n') {
    expectedText += currentPunctuation;
  }

  if (expectedText.startsWith(typedText)) {
    textInput.style.color = "green";
  } else {
    textInput.style.color = "red";
    mistakes++;
    playSound('error');
  }

  updateStats();
}

function updateStats() {
  const wordsTyped = currentWordIndex;
  const elapsedTime = timerDuration - timeLeft;
  const minutes = elapsedTime / 60;
  const wpm = Math.round(wordsTyped / minutes || 0);
  const cpm = Math.round(typedCharacters / minutes || 0);
  const accuracy = Math.max(0, Math.round(((typedCharacters - mistakes) / typedCharacters) * 100) || 0);

  wpmDisplay.textContent = wpm;
  cpmDisplay.textContent = cpm;
  accuracyDisplay.textContent = `${accuracy}%`;
}

function updateTimer() {
  timeLeft--;
  timerDisplay.textContent = timeLeft;

  if (timeLeft === 0) {
    clearInterval(interval);
    textInput.disabled = true;
    showPopup();
  }
}

function showPopup() {
  // Check if results popup should be shown
  const settings = JSON.parse(localStorage.getItem('typingTestSettings') || '{}');
  if (settings.showResults === false) {
    return; // Don't show popup if disabled
  }

  const wpm = parseInt(wpmDisplay.textContent);
  const cpm = parseInt(cpmDisplay.textContent);
  const accuracy = parseFloat(accuracyDisplay.textContent.replace('%', ''));
  const score = calculateScore(cpm, accuracy, difficulty);

  popupWpm.textContent = wpm;
  popupCpm.textContent = cpm; 
  popupAccuracy.textContent = accuracyDisplay.textContent;
  popupScore.textContent = score;

  // Check if it's a new high score
  const results = JSON.parse(localStorage.getItem('typingTestResults') || '[]');
  const previousScores = results.map(r => r.score || 0);
  const previousHighScore = previousScores.length > 0 ? Math.max(...previousScores) : 0;
  const isNewHighScore = score > previousHighScore;
  
  // Check if it's a perfect game (100% accuracy)
  const isPerfectGame = accuracy === 100;
  
  const newHighscoreMsg = document.getElementById('new-highscore-msg');
  const perfectGameMsg = document.getElementById('perfect-game-msg');
  
  if (isNewHighScore) {
    newHighscoreMsg.classList.remove('hidden');
  } else {
    newHighscoreMsg.classList.add('hidden');
  }
  
  if (isPerfectGame) {
    perfectGameMsg.classList.remove('hidden');
  } else {
    perfectGameMsg.classList.add('hidden');
  }

  popup.classList.remove('hidden');

  // Save results to localStorage
  const testResult = {
    wpm: wpm,
    cpm: cpm,
    accuracy: accuracy,
    score: score,
    difficulty: difficulty,
    timestamp: new Date().toISOString(),
    timeTaken: 60 - timeLeft,
    isHighScore: isNewHighScore,
    isPerfectGame: isPerfectGame
  };
  results.push(testResult);
  // Keep only last 100 results
  if (results.length > 100) {
    results.shift();
  }
  localStorage.setItem('typingTestResults', JSON.stringify(results));
}

restartBtn.addEventListener('click', () => {
  timerStarted = false;
  if (interval) clearInterval(interval);
  location.reload(); // Reload the page to restart the test
});

goHomeBtn.addEventListener('click', goHome);

// Sound effects
function playSound(type) {
  if (!settings.soundEffects) return;

  if (type === 'error' && !settings.errorSounds) return;

  // Create audio context for simple beep sounds
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'error') {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
    } else {
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Fallback: do nothing if Web Audio API is not supported
  }
}

// Dark mode toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  body.classList.add('dark');
  darkModeToggle.textContent = '☀️ Light Mode';
}

darkModeToggle.addEventListener('click', () => {
  body.classList.toggle('dark');
  const theme = body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  darkModeToggle.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// Start the test when the page loads and the difficulty is loaded
loadWords();