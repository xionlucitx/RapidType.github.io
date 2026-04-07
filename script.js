const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('difficulty') || 'easy'; // Default to 'easy' if no difficulty is specified

// Word pool variable
let words = [];
let currentWordIndex = 0;
let typedCharacters = 0;
let mistakes = 0;
let timeLeft = 60;
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
  window.location.href = '/'; // Adjust URL if necessary
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

function updateTextDisplay() {
  const visibleWordsCount = 50; // Number of words to show initially and during the test
  const visibleWords = words.slice(currentWordIndex, currentWordIndex + visibleWordsCount);

  // If there are not enough words, generate additional words
  if (visibleWords.length < visibleWordsCount) {
    words.push(...generateWords(visibleWordsCount - visibleWords.length));
  }

  textDisplay.textContent = visibleWords.join(' ');
}

function startTest() {
  currentWordIndex = 0; // Start from the first word
  updateTextDisplay(); // Display the initial 50 words
  textInput.addEventListener('input', checkInput);
}


function updateTextDisplay() {
  const visibleWordsCount = 50;
  const visibleWords = words.slice(currentWordIndex, currentWordIndex + visibleWordsCount); 
  textDisplay.textContent = visibleWords.join(' '); 
}

function checkInput(e) {
  // Start timer on first input (except backspace)
  if (!timerStarted && e.inputType !== 'deleteContentBackward') {
    interval = setInterval(updateTimer, 1000);
    timerStarted = true;
  }

  const typedText = textInput.value.trim(); // Get the typed input
  const currentWord = words[currentWordIndex]; // Current word to match

  // Handle backspace and input logic
  if (e.inputType === 'deleteContentBackward') {
    return; // Do not count backspace as a mistake or character typed
  }

  // Track all characters typed
  typedCharacters++;

  // Validate input
  if (currentWord.startsWith(typedText)) {
    textInput.style.color = "green";
  } else {
    textInput.style.color = "red";
    mistakes++;
  }

  // Move to the next word when space is pressed and the word is correct
  if (typedText === currentWord && textInput.value.endsWith(" ")) {
    currentWordIndex++; // Move to the next word
    textInput.value = ""; // Clear the input field

    // Add one new word at the end of the array when needed
    if (currentWordIndex + 50 >= words.length) {
      words.push(...generateWords(10)); // Add 10 new word to ensure smooth flow
    }

    updateTextDisplay(); // Update visible words immediately
  }

  updateStats();
}

function updateStats() {
  const wordsTyped = currentWordIndex;
  const minutes = (60 - timeLeft) / 60;
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

// Add event listener to the "Go Home" buttons
goHomeBtn.addEventListener('click', goHome);

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