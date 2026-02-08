const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

window.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
}, { once: true });

let width, height, stars = [], missiles = [], particles = [], ships = [];
let gameState = 'MENU', health = 100, level = 1, gameTimer = 60;
let currentScore = 0;
let mouse = { x: 0, y: 0 };
let highScore = JSON.parse(localStorage.getItem('itanoScores')) || [0, 0, 0, 0];

// Variables para nuevas mecánicas
let isShieldActive = false;
let shieldTimer = 0;
let specialMsg = "";

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

class Star {
    constructor() { this.reset(); }
    reset() { this.x = Math.random() * width; this.y = Math.random() * height; this.z = Math.random() * width; }
    update() { this.z -= 4; if (this.z <= 0) this.reset(); }
    draw() {
        let sx = (this.x - width / 2) * (width / this.z) + width / 2;
        let sy = (this.y - height / 2) * (width / this.z) + height / 2;
        let r = (width / this.z) * 1.2;
        ctx.fillStyle = "white";
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
}

class Ship {
    constructor(id) {
        this.x = 80; this.y = height / 2;
        this.targetY = this.y;
        this.lastShot = Date.now();
        this.shotDelay = 4000;
        this.id = id;
    }
    update() {
        if (Math.abs(this.y - this.targetY) < 10) this.targetY = Math.random() * (height - 100) + 50;
        this.y += (this.targetY - this.y) * 0.03;
        if (gameState === 'GAME' && Date.now() - this.lastShot > this.shotDelay) {
            if (missiles.length < 250) fireItano(this.x, this.y);
            this.lastShot = Date.now();
            this.shotDelay = Math.random() * 6000 + 4000;
        }
    }
    draw() {
        let angle = Math.sin(Date.now() * 0.002) * 0.05;
        drawVF19(this.x, this.y, 2.5, angle);
    }
}

class Missile {
    constructor(x, y, speedMult = 1) {
        this.pos = { x, y };
        this.angle = Math.random() * Math.PI * 2;
        this.maxSpeed = 6 * speedMult;
        this.vel = { x: Math.cos(this.angle) * 10, y: Math.sin(this.angle) * 10 };
        this.born = Date.now();
        this.lastBoostTime = 0;
        this.boostCount = 0;
        this.trail = [];
        this.alive = true;
        this.spiralOffset = Math.random() * Math.PI * 2;
    }
    update() {
        let now = Date.now();
        let age = (now - this.born) / 1000;
        let shouldBoost = (this.boostCount === 0 && age >= 6) || (this.boostCount > 0 && (age - this.lastBoostTime) >= 3);
        if (shouldBoost) {
            this.maxSpeed *= 1.33;
            this.lastBoostTime = age;
            this.boostCount++;
            this.vel.x = Math.cos(Math.random()*Math.PI*2) * this.maxSpeed;
            this.vel.y = Math.sin(Math.random()*Math.PI*2) * this.maxSpeed;
        }
        let dx = mouse.x - this.pos.x, dy = mouse.y - this.pos.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            let dirX = dx / dist, dirY = dy / dist;
            let sFreq = 5, sAmp = 4;
            let sX = -dirY * Math.sin(age * sFreq + this.spiralOffset) * sAmp;
            let sY = dirX * Math.sin(age * sFreq + this.spiralOffset) * sAmp;
            let dX = (dirX * this.maxSpeed) + sX;
            let dY = (dirY * this.maxSpeed) + sY;
            this.vel.x += (dX - this.vel.x) * 0.08;
            this.vel.y += (dY - this.vel.y) * 0.08;
        }
        this.pos.x += this.vel.x; this.pos.y += this.vel.y;
        this.trail.push({ x: this.pos.x, y: this.pos.y, opacity: 1.0, size: Math.random() * 3 + 2 });
        let decay = 0.04 + (this.boostCount * 0.02);
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].opacity -= decay;
            if (this.trail[i].opacity <= 0) this.trail.splice(i, 1);
        }
        if (dist < 20) { 
            this.alive = false; 
            createExplosion(this.pos.x, this.pos.y); 
            playBubblePop(); 
            if (!isShieldActive) health--; 
        }
    }
    draw() {
        this.trail.forEach(t => {
            ctx.fillStyle = `rgba(180, 180, 180, ${t.opacity})`;
            ctx.beginPath(); ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = "red";
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, 4, 0, Math.PI * 2); ctx.fill();
    }
}

function fireItano(x, y) {
    let mMult = 1;
    if (level === 2 || level === 4 || level === 6 || level === 8) mMult = 1.15;
    if (level === 10) mMult = 1.20;
    for (let i = 0; i < 18; i++) missiles.push(new Missile(x, y, mMult));
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 1, c: `hsl(${Math.random() * 360}, 100%, 50%)` });
}

function startGame() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden'); // Ocultar si viene de reinicio
    level = 1; health = 100; currentScore = 0;
    startLevel();
}

function startLevel() {
    gameState = 'COUNTDOWN';
    missiles = []; particles = [];
    isShieldActive = false;
    specialMsg = "";
    
    // Configuración de naves por nivel
    let numShips = 1;
    if (level >= 3) numShips = 2;
    if (level >= 5) numShips = 3;
    if (level >= 7) numShips = 4;
    if (level >= 9) numShips = 5;
    
    ships = [];
    for(let i=0; i<numShips; i++) ships.push(new Ship(i));
    
    gameTimer = (level >= 5) ? 90 : 60;
    
    let c = 4;
    let el = document.getElementById('countdown');
    el.classList.remove('hidden'); el.innerText = c;
    let timerInterval = setInterval(() => {
        c--; el.innerText = c;
        if (c <= 0) { clearInterval(timerInterval); el.classList.add('hidden'); gameState = 'GAME'; }
    }, 1000);
}

function drawVF19(x, y, scale = 4, angle = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    const colorLight = "#e9eeff", colorMid = "#b6c4ff", colorDark = "#6d7fb3";
    ctx.fillStyle = colorDark; ctx.fillRect(-10, -6, 7, 2.5);
    ctx.fillStyle = colorMid; ctx.beginPath(); ctx.moveTo(-4, -2.5); ctx.lineTo(4, -8); ctx.lineTo(6, -8); ctx.lineTo(1, -2.5); ctx.fill();
    ctx.fillStyle = colorLight; ctx.beginPath(); ctx.moveTo(-12, -1); ctx.lineTo(14, -2); ctx.lineTo(18, 0); ctx.lineTo(14, 2); ctx.lineTo(-12, 4); ctx.fill();
    ctx.fillStyle = "rgba(0, 200, 255, 0.8)"; ctx.beginPath(); ctx.ellipse(7, -1, 4.5, 1.8, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colorLight; ctx.beginPath(); ctx.moveTo(5, 1); ctx.lineTo(10, 5); ctx.lineTo(12, 1); ctx.fill();
    ctx.fillStyle = colorDark; ctx.fillRect(-11, 1, 9, 4);
    ctx.fillStyle = colorMid; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(8, 12); ctx.lineTo(11, 12); ctx.lineTo(4, 2); ctx.fill();
    ctx.restore();
}

function drawTargetShip(x, y) {
    ctx.save();
    ctx.translate(x, y);
    
    if (isShieldActive) {
        ctx.strokeStyle = "#00f2ff";
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 25, i * Math.PI/4, i * Math.PI/4 + 0.5);
            ctx.stroke();
        }
        // Brillo azul
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00f2ff";
    }

    let pulse = Math.sin(Date.now() * 0.02) * 2;
    ctx.strokeStyle = "rgba(0, 255, 150, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 12 + pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f7"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function playBubblePop() {
    if (audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function animate() {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
    stars.forEach(s => { s.update(); s.draw(); });

    if (gameState === 'MENU') {
        if (Math.random() < 0.04) { let m = new Missile(Math.random() * width, Math.random() * height, 0.5); missiles.push(m); }
        missiles.forEach((m, i) => { m.update(); m.draw(); if (m.pos.x < 0 || m.pos.x > width || !m.alive) missiles.splice(i, 1); });
    }

    if (gameState === 'GAME') {
        gameTimer -= 1 / 60;
        let currentTime = Math.ceil(gameTimer);
        currentScore += (1 + missiles.length / 10);

        // --- LÓGICA NIVEL 5+: ESCUDO ---
        if (level >= 5) {
            let nextShield = currentTime % 30;
            if (nextShield <= 3 && nextShield > 0) {
                specialMsg = `Escudo en: ${nextShield}`;
            } else if (nextShield === 0 || nextShield > 27) {
                isShieldActive = true;
                specialMsg = "¡ESCUDO ACTIVO!";
            } else {
                isShieldActive = false;
                specialMsg = "";
            }
        }

        // --- LÓGICA NIVEL 8+: BOMBA ---
        if (level >= 8) {
            if ((currentTime > 45 && currentTime <= 48) || (currentTime > 75 && currentTime <= 78)) {
                specialMsg = `Bomba en: ${currentTime % 15 === 0 ? 0 : currentTime % 3}`;
            }
            if (currentTime === 45 || currentTime === 75) {
                // Efecto Explosión Central
                createExplosion(width/2, height/2);
                missiles = [];
                specialMsg = "¡BOMBA DESPLEGADA!";
            }
        }

        document.getElementById('timer-display').innerText = `SCORE: ${Math.floor(currentScore)}`;
        document.getElementById('health-bar').style.width = health + "%";
        document.getElementById('health-pct').innerText = health + "%";
        document.getElementById('missile-count').innerText = `Misiles: ${missiles.length}`;
        document.getElementById('level-indicator').innerText = `NIVEL ${level} | Tiempo: ${currentTime}s`;

        // Dibujar mensaje especial
        if (specialMsg !== "") {
            ctx.fillStyle = "#00f2ff";
            ctx.font = "bold 24px Arial";
            ctx.textAlign = "center";
            ctx.fillText(specialMsg, width / 2, 100);
        }

        drawTargetShip(mouse.x, mouse.y);
        ships.forEach(s => { s.update(); s.draw(); });
        missiles.forEach((m, i) => { m.update(); m.draw(); if (!m.alive) missiles.splice(i, 1); });

        if (gameTimer <= 0) {
            if (level === 10) {
                gameState = 'VICTORY';
                showVictoryScreen();
            } else {
                level++;
                health = 100;
                startLevel();
            }
        }
        if (health <= 0) {
            gameState = 'GAMEOVER';
            saveScore(Math.floor(currentScore));
            document.getElementById('game-over').classList.remove('hidden');
        }
    }

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        ctx.fillStyle = p.c; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 4, 4);
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
}

function showVictoryScreen() {
    const screen = document.getElementById('game-over');
    screen.innerHTML = `
        <h1 style="color: #00f2ff">¡FELICIDADES!</h1>
        <p>Lograste sobrevivir al ataque.</p>
        <p>Eres uno de los mejores pilotos del universo.</p>
        <p>SCORE FINAL: ${Math.floor(currentScore)}</p>
        <button onclick="location.reload()">REINICIAR JUEGO</button>
    `;
    screen.classList.remove('hidden');
    saveScore(Math.floor(currentScore));
}

function saveScore(s) {
    highScore.push(s); highScore.sort((a, b) => b - a);
    highScore = highScore.slice(0, 4);
    localStorage.setItem('itanoScores', JSON.stringify(highScore));
    updateScores();
}

function updateScores() {
    let list = document.getElementById('scores-list');
    if(list) list.innerHTML = highScore.map((s, i) => `<div>${i + 1}ER Lugar: <span class="gold-text">${s} pts</span></div>`).join('');
}

window.addEventListener('resize', resize);
const updateMouse = e => { 
    let t = e.touches ? e.touches[0] : e;
    mouse.x = t.clientX; mouse.y = t.clientY; 
};
window.addEventListener('mousemove', updateMouse);
window.addEventListener('touchstart', updateMouse);
window.addEventListener('touchmove', updateMouse);

resize();
for (let i = 0; i < 150; i++) stars.push(new Star());
updateScores();
animate();