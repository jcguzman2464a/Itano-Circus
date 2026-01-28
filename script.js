const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let width, height, stars = [], missiles = [], particles = [], ships = [];
let gameState = 'MENU', health = 100, level = 1, gameTimer = 60;
let currentScore = 0;
let mouse = { x: 0, y: 0 };
let highScore = JSON.parse(localStorage.getItem('itanoScores')) || [0, 0, 0, 0];

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
            if (missiles.length < 180) fireItano(this.x, this.y);
            this.lastShot = Date.now();
            this.shotDelay = Math.random() * 6000 + 4000;
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = "#00f2ff";
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(50, 0); ctx.lineTo(0, 20); ctx.fill();
        ctx.fillStyle = "#0af";
        ctx.beginPath(); ctx.ellipse(-10, 0, 20 + Math.random() * 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
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
        this.spiralOffset = Math.random() * Math.PI * 2; // Desfase para que no todos giren igual
    }

    update() {
        let now = Date.now();
        let age = (now - this.born) / 1000;

        // Re-Boost Itano
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
            // 1. Dirección base al objetivo
            let dirX = dx / dist;
            let dirY = dy / dist;

            // 2. MOVIMIENTO EN ESPIRAL
            // Creamos un movimiento perpendicular (seno/coseno) que oscila con el tiempo
            let spiralFrequency = 5; // Rapidez del giro
            let spiralAmplitude = 4;  // Ancho de la espiral
            let spiralX = -dirY * Math.sin(age * spiralFrequency + this.spiralOffset) * spiralAmplitude;
            let spiralY = dirX * Math.sin(age * spiralFrequency + this.spiralOffset) * spiralAmplitude;

            let desiredX = (dirX * this.maxSpeed) + spiralX;
            let desiredY = (dirY * this.maxSpeed) + spiralY;

            this.vel.x += (desiredX - this.vel.x) * 0.08;
            this.vel.y += (desiredY - this.vel.y) * 0.08;
        }

        this.pos.x += this.vel.x; this.pos.y += this.vel.y;

        // Humo
        this.trail.push({ x: this.pos.x, y: this.pos.y, opacity: 1.0, size: Math.random() * 3 + 2 });
        let decayRate = 0.04 + (this.boostCount * 0.02);
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].opacity -= decayRate;
            this.trail[i].size *= 0.98;
            if (this.trail[i].opacity <= 0) this.trail.splice(i, 1);
        }

        if (dist < 20) { this.alive = false; createExplosion(this.pos.x, this.pos.y); health--; }
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

// --- Resto de funciones del motor ---
function fireItano(x, y) {
    let m = (level === 2 || level === 4) ? 1.1 : 1;
    for (let i = 0; i < 18; i++) missiles.push(new Missile(x, y, m));
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 1, c: `hsl(${Math.random() * 360}, 100%, 50%)` });
}

function startGame() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    level = 1; health = 100; currentScore = 0;
    startLevel();
}

function startLevel() {
    gameState = 'COUNTDOWN';
    missiles = []; particles = [];
    ships = [new Ship(1)];
    if (level >= 3) ships.push(new Ship(2));
    gameTimer = 60;
    let c = 4;
    let el = document.getElementById('countdown');
    el.classList.remove('hidden'); el.innerText = c;
    let timerInterval = setInterval(() => {
        c--; el.innerText = c;
        if (c <= 0) { clearInterval(timerInterval); el.classList.add('hidden'); gameState = 'GAME'; }
    }, 1000);
}

function cerrarVentana() {
    if (confirm("¿Deseas salir del juego?")) window.close();
}


function animate() {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
    stars.forEach(s => { s.update(); s.draw(); });

    if (gameState === 'MENU') {
        if (Math.random() < 0.04) { let m = new Missile(Math.random() * width, Math.random() * height); m.maxSpeed = 3; missiles.push(m); }
        missiles.forEach((m, i) => { m.update(); m.draw(); if (m.pos.x < 0 || m.pos.x > width || !m.alive) missiles.splice(i, 1); });
    }

    if (gameState === 'GAME') {
        gameTimer -= 1 / 60;
        
        // LÓGICA DE SCORE DINÁMICO
        // Ganar puntos por tiempo + (Misiles en pantalla / 10) cada frame
        let dodgeBonus = missiles.length / 10;
        currentScore += (1 + dodgeBonus);

        document.getElementById('timer-display').innerText = `SCORE: ${Math.floor(currentScore)}`;
        document.getElementById('health-bar').style.width = health + "%";
        document.getElementById('health-pct').innerText = health + "%";
        document.getElementById('missile-count').innerText = `Misiles: ${missiles.length}`;
        document.getElementById('level-indicator').innerText = `NIVEL ${level} | Tiempo: ${Math.ceil(gameTimer)}s`;

        ships.forEach(s => { s.update(); s.draw(); });
        missiles.forEach((m, i) => { m.update(); m.draw(); if (!m.alive) missiles.splice(i, 1); });

        if (gameTimer <= 0) {
            level++;
            if (level > 4) { saveScore(Math.floor(currentScore)); location.reload(); }
            else { health = 100; startLevel(); }
        }
        if (health <= 0) {
            gameState = 'GAMEOVER';
            saveScore(Math.floor(currentScore));
            document.getElementById('game-over').classList.remove('hidden');
        }
    }

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        ctx.fillStyle = p.c; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
}

function saveScore(s) {
    highScore.push(s);
    highScore.sort((a, b) => b - a);
    highScore = highScore.slice(0, 4);
    localStorage.setItem('itanoScores', JSON.stringify(highScore));
    updateScores();
}

function updateScores() {
    let list = document.getElementById('scores-list');
    if(list) list.innerHTML = highScore.map((s, i) => `<div style="color:${i === 0 ? '#C0C0C0' : 'white'}">${i + 1}ER Lugar: <span class="gold-text">${s} pts</span></div>`).join('');
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