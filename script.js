let currentPokemons = [];
let streak = 0;
let highScore = 0;
let timeAttackHighScore = 0;
let lightningHighScore = 0;
let isAnimating = false;
let currentGen = 'all';
let currentStat = 'speed';
let currentCount = 2;
let currentDifficulty = 'easy';

// Game Modes State
let gameMode = 'normal'; // normal, time-attack, lightning
let timeAttackActive = false;
let timeRemaining = 0;
let timerInterval = null;

// ID ranges for each Pokemon Generation
const GENERATIONS = {
    'all': { min: 1, max: 1025 },
    '1': { min: 1, max: 151 },
    '2': { min: 152, max: 251 },
    '3': { min: 252, max: 386 },
    '4': { min: 387, max: 493 },
    '5': { min: 494, max: 649 },
    '6': { min: 650, max: 721 },
    '7': { min: 722, max: 809 },
    '8': { min: 810, max: 905 },
    '9': { min: 906, max: 1025 }
};

const STAT_LABELS = {
    'hp': 'HP',
    'attack': 'ATAQUE',
    'defense': 'DEFENSA',
    'special-attack': 'ATAQUE SP.',
    'special-defense': 'DEFENSA SP.',
    'speed': 'VELOCIDAD'
};

const pokemonCache = {}; 

const DOM = {
    loadingState: document.getElementById('loading-state'),
    pokemonContainer: document.getElementById('pokemon-container'),
    streak: document.getElementById('current-streak'),
    highScore: document.getElementById('high-score'),
    resultOverlay: document.getElementById('result-overlay'),
    resultMessage: document.getElementById('result-message'),
    genFilter: document.getElementById('gen-filter'),
    statFilter: document.getElementById('stat-filter'),
    countFilter: document.getElementById('count-filter'),
    difficultyFilter: document.getElementById('difficulty-filter'),
    gameMode: document.getElementById('game-mode'),
    timerDisplay: document.getElementById('timer-display'),
    timerText: document.getElementById('timer-text'),
    scoreLabel: document.getElementById('score-label'),
    highScoreLabel: document.getElementById('high-score-label'),
    nextBtn: document.getElementById('next-btn')
};

init();

function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const backdrop = document.getElementById('modal-backdrop');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        backdrop.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
    }
}

function init() {
    const savedHighScore = localStorage.getItem('pokeSpeedHighScore');
    if (savedHighScore) highScore = parseInt(savedHighScore);
    DOM.highScore.textContent = highScore;
    
    const savedTAHighScore = localStorage.getItem('pokeSpeedTAHighScore');
    if (savedTAHighScore) timeAttackHighScore = parseInt(savedTAHighScore);

    const savedLgHighScore = localStorage.getItem('pokeSpeedLgHighScore');
    if (savedLgHighScore) lightningHighScore = parseInt(savedLgHighScore);
    
    startRound();
}

function onGameModeChange() {
    gameMode = DOM.gameMode.value;
    
    if (gameMode !== 'normal') {
        DOM.timerDisplay.classList.remove('hidden');
        
        if (gameMode === 'time-attack') {
            DOM.countFilter.value = '2';
            DOM.countFilter.disabled = true;
            DOM.difficultyFilter.value = 'hard';
            DOM.difficultyFilter.disabled = true;
            
            DOM.scoreLabel.textContent = "Aciertos:";
            DOM.highScoreLabel.textContent = "Récord 1m:";
            DOM.highScore.textContent = timeAttackHighScore;
        } else if (gameMode === 'lightning') {
            DOM.countFilter.value = '2'; // Set initial state
            DOM.countFilter.disabled = false; // Allow user to change it
            DOM.difficultyFilter.value = 'hard';
            DOM.difficultyFilter.disabled = true;
            
            DOM.scoreLabel.textContent = "Racha:";
            DOM.highScoreLabel.textContent = "Récord 10s:";
            DOM.highScore.textContent = lightningHighScore;
        }
    } else {
        DOM.countFilter.disabled = false;
        DOM.difficultyFilter.disabled = false;
        
        DOM.timerDisplay.classList.add('hidden');
        DOM.scoreLabel.textContent = "Racha:";
        DOM.highScoreLabel.textContent = "Mejor Racha:";
        DOM.highScore.textContent = highScore;
    }
    
    resetGame();
}

function resetGame() {
    streak = 0;
    DOM.streak.textContent = streak;
    
    clearInterval(timerInterval);
    timeAttackActive = false;
    
    if (gameMode === 'time-attack') timeRemaining = 60;
    else if (gameMode === 'lightning') timeRemaining = 10;
    
    updateTimerText();
    DOM.timerDisplay.classList.remove('warning');
    
    startRound();
}

function updateTimerText() {
    const min = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const sec = (timeRemaining % 60).toString().padStart(2, '0');
    DOM.timerText.textContent = `${min}:${sec}`;
    
    let isWarningPeriod = false;
    if (gameMode === 'time-attack' && timeRemaining <= 10 && timeRemaining > 0) isWarningPeriod = true;
    if (gameMode === 'lightning' && timeRemaining <= 3 && timeRemaining > 0) isWarningPeriod = true;
    
    if (isWarningPeriod) DOM.timerDisplay.classList.add('warning');
    else DOM.timerDisplay.classList.remove('warning');
}

function onFilterChange() {
    resetGame();
}

async function fetchPokemonData(id) {
    if (pokemonCache[id]) return pokemonCache[id];
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();
    const processed = processPokemonData(data);
    pokemonCache[id] = processed;
    return processed;
}

function processPokemonData(data) {
    const statsObj = {};
    data.stats.forEach(s => {
        statsObj[s.stat.name] = s.base_stat;
    });
    
    const spriteBase = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
    
    return {
        id: data.id,
        name: data.name.replace('-', ' '),
        image: spriteBase,
        stats: statsObj
    };
}

async function startRound() {
    isAnimating = true;
    clearInterval(timerInterval);
    
    if (gameMode === 'lightning') {
        timeRemaining = 10;
        updateTimerText();
    }
    
    currentPokemons = [];
    
    DOM.loadingState.style.display = 'flex';
    DOM.pokemonContainer.classList.add('hidden');
    DOM.pokemonContainer.innerHTML = ''; 
    DOM.resultOverlay.classList.add('hidden');
    DOM.nextBtn.classList.remove('hidden');
    DOM.nextBtn.textContent = "Siguiente Ronda";
    
    currentGen = DOM.genFilter.value;
    currentStat = DOM.statFilter.value;
    currentCount = parseInt(DOM.countFilter.value);
    currentDifficulty = DOM.difficultyFilter.value;
    
    DOM.pokemonContainer.dataset.count = currentCount;
    
    try {
        if (currentDifficulty === 'easy') {
            const ids = new Set();
            while (ids.size < currentCount) ids.add(getRandomId(currentGen));
            const fetchPromises = Array.from(ids).map(id => fetchPokemonData(id));
            currentPokemons = await Promise.all(fetchPromises);
        } else {
            const minDiff = currentDifficulty === 'hard' ? 1 : 11;
            const maxDiff = currentDifficulty === 'hard' ? 10 : 26;
            
            let foundGroup = false;
            let attempts = 0;
            
            while (!foundGroup && attempts < 5) {
                attempts++;
                
                const batchIds = new Set();
                while (batchIds.size < 15) batchIds.add(getRandomId(currentGen));
                
                const batchPromises = Array.from(batchIds).map(id => fetchPokemonData(id));
                const batchResults = await Promise.all(batchPromises);
                
                batchResults.sort(() => Math.random() - 0.5);
                
                for (let i = 0; i < batchResults.length; i++) {
                    const basePoke = batchResults[i];
                    const baseStat = basePoke.stats[currentStat];
                    const candidateGroup = [basePoke];
                    
                    for (let j = 0; j < batchResults.length; j++) {
                        if (i === j) continue;
                        const candidate = batchResults[j];
                        const diff = Math.abs(baseStat - candidate.stats[currentStat]);
                        
                        if (diff >= minDiff && diff <= maxDiff) {
                            candidateGroup.push(candidate);
                            if (candidateGroup.length === currentCount) break;
                        }
                    }
                    
                    if (candidateGroup.length === currentCount) {
                        currentPokemons = candidateGroup;
                        foundGroup = true;
                        break;
                    }
                }
            }
            
            if (!foundGroup) {
                const fallbackIds = new Set();
                while (fallbackIds.size < currentCount) fallbackIds.add(getRandomId(currentGen));
                currentPokemons = await Promise.all(Array.from(fallbackIds).map(id => fetchPokemonData(id)));
            }
        }
        
        currentPokemons.sort(() => Math.random() - 0.5);
        updateUI();
    } catch (error) {
        alert("Hubo un error cargando los Pokémon. Intenta de nuevo.");
    }
}

function getRandomId(gen) {
    const range = GENERATIONS[gen] || GENERATIONS['all'];
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

function updateUI() {
    currentPokemons.forEach((poke, index) => {
        const cardValue = poke.stats[currentStat];
        const cardLabel = STAT_LABELS[currentStat] || 'STAT';
        
        const cardHTML = `
            <div class="pokemon-card glass-panel" id="card-${index}" onclick="selectPokemon(${index})">
                <div class="poke-image-container">
                    <img src="${poke.image}" alt="${poke.name}">
                </div>
                <div class="card-info">
                    <h2 class="poke-name">${poke.name}</h2>
                    <div class="stat-reveal" id="stat-${index}">
                        <span class="speed-value">${cardValue}</span>
                        <span class="speed-label">${cardLabel}</span>
                    </div>
                </div>
            </div>
        `;
        DOM.pokemonContainer.insertAdjacentHTML('beforeend', cardHTML);
    });

    DOM.loadingState.style.display = 'none';
    DOM.pokemonContainer.classList.remove('hidden');
    isAnimating = false;
    
    // Auto-start timer for lightning mode
    if (gameMode === 'lightning') {
        timeAttackActive = true;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerText();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                handleTimeoutLightning();
            }
        }, 1000);
    }
}

function handleTimeoutLightning() {
    isAnimating = true;
    streak = 0; // Lost streak
    DOM.streak.textContent = streak;
    
    const maxStatValue = Math.max(...currentPokemons.map(p => p.stats[currentStat]));
    
    currentPokemons.forEach((poke, i) => {
        const card = document.getElementById(`card-${i}`);
        document.getElementById(`stat-${i}`).classList.add('visible');
        card.classList.add('disabled');
        if (poke.stats[currentStat] === maxStatValue) card.classList.add('correct');
        else card.classList.add('faded');
    });
    
    // Proceed seamlessly without overlay message
    setTimeout(() => {
        startRound();
    }, 1200);
}

function selectPokemon(selectedIndex) {
    if (isAnimating) return;
    
    if (gameMode === 'time-attack' && !timeAttackActive) {
        timeAttackActive = true;
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerText();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                finishTimeAttack();
            }
        }, 1000);
    }

    if (gameMode === 'time-attack' && timeRemaining <= 0) return;
    if (gameMode === 'lightning') clearInterval(timerInterval); // freeze timer

    isAnimating = true;
    
    const maxStatValue = Math.max(...currentPokemons.map(p => p.stats[currentStat]));
    const selectedStatValue = currentPokemons[selectedIndex].stats[currentStat];
    const isCorrect = selectedStatValue === maxStatValue;
    
    currentPokemons.forEach((_, i) => {
        document.getElementById(`stat-${i}`).classList.add('visible');
        document.getElementById(`card-${i}`).classList.add('disabled');
    });
    
    setTimeout(() => {
        if (gameMode === 'time-attack' && timeRemaining <= 0) {
            currentPokemons.forEach((poke, i) => {
                const card = document.getElementById(`card-${i}`);
                if (poke.stats[currentStat] === maxStatValue) card.classList.add('correct');
                else card.classList.add('faded');
            });
            return;
        }

        currentPokemons.forEach((poke, i) => {
            const card = document.getElementById(`card-${i}`);
            if (poke.stats[currentStat] === maxStatValue) {
                card.classList.add('correct');
            } else {
                card.classList.add('faded');
            }
        });

        const selectedCard = document.getElementById(`card-${selectedIndex}`);
        
        if (isCorrect) {
            handleCorrectChoice();
        } else {
            selectedCard.classList.remove('faded'); 
            selectedCard.classList.add('wrong');
            handleWrongChoice();
        }
    }, 500);
}

function handleCorrectChoice() {
    streak++;
    DOM.streak.textContent = streak;
    
    if (gameMode === 'time-attack') {
        if (streak > timeAttackHighScore) {
            timeAttackHighScore = streak;
            DOM.highScore.textContent = timeAttackHighScore;
            localStorage.setItem('pokeSpeedTAHighScore', timeAttackHighScore);
        }
    } else if (gameMode === 'lightning') {
        if (streak > lightningHighScore) {
            lightningHighScore = streak;
            DOM.highScore.textContent = lightningHighScore;
            localStorage.setItem('pokeSpeedLgHighScore', lightningHighScore);
        }
    } else {
        if (streak > highScore) {
            highScore = streak;
            DOM.highScore.textContent = highScore;
            localStorage.setItem('pokeSpeedHighScore', highScore);
        }
    }
    
    fireConfetti();
    
    if (gameMode === 'lightning' || (gameMode === 'time-attack' && timeRemaining > 0)) {
        showResult("¡Correcto!", "#10B981", true);
        return;
    }
    
    showResult("¡Correcto!", "#10B981");
}

function handleWrongChoice() {
    if (gameMode === 'normal' || gameMode === 'lightning') {
        streak = 0;
        DOM.streak.textContent = streak;
    }
    
    if (gameMode === 'lightning' || (gameMode === 'time-attack' && timeRemaining > 0)) {
        showResult("¡Fallaste!", "#EF4444", true);
        return;
    }
    
    showResult("¡Fallaste!", "#EF4444");
}

function showResult(message, color, isAutoAdvance = false) {
    if (isAutoAdvance) {
        DOM.resultMessage.textContent = message;
        DOM.resultMessage.style.color = color;
        DOM.resultOverlay.classList.remove('hidden');
        DOM.nextBtn.classList.add('hidden'); // Force no button block
        
        setTimeout(() => {
            if (gameMode === 'time-attack' && timeRemaining <= 0) return; // safeguard against timer ending mid-transition
            DOM.resultOverlay.classList.add('hidden');
            DOM.nextBtn.classList.remove('hidden');
            startRound();
        }, 1200); // 1.2s delay and then jumps to next round seamlessly
        return;
    }

    setTimeout(() => {
        if (gameMode === 'time-attack' && timeRemaining <= 0) return;
        DOM.resultMessage.textContent = message;
        DOM.resultMessage.style.color = color;
        DOM.resultOverlay.classList.remove('hidden');
        DOM.nextBtn.classList.remove('hidden');
    }, 1000);
}

function nextRound() {
    if (gameMode === 'time-attack' && timeRemaining <= 0) {
        resetGame();
    } else {
        startRound();
    }
}

function finishTimeAttack() {
    isAnimating = true;
    DOM.resultMessage.textContent = `¡Tiempo agotado! Lograste ${streak} aciertos.`;
    DOM.resultMessage.style.color = "#3B82F6";
    DOM.nextBtn.classList.remove('hidden');
    DOM.nextBtn.textContent = "Jugar de nuevo";
    DOM.resultOverlay.classList.remove('hidden');
    
    if (streak > 0) fireConfetti();
}

function fireConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF5A5F', '#10B981', '#F59E0B']
    });
}

function toggleImmersiveMode() {
    const isImmersive = document.getElementById('immersive-toggle').checked;
    
    if (isImmersive) {
        document.body.classList.add('immersive');
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen request denied", e));
        }
    } else {
        document.body.classList.remove('immersive');
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(e => console.log("Fullscreen exit denied", e));
        }
    }
}

// Reset visual toggle if user exits Full Screen via ESC or mobile swipe.
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('immersive');
        const toggle = document.getElementById('immersive-toggle');
        if(toggle) toggle.checked = false;
    }
});
