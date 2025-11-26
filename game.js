// ==========================
// Referencias globales
// ==========================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

console.log("game.js cargado, canvas:", canvas);

// FPS objetivo ~60, pero usamos requestAnimationFrame
const MAX_DT = 1 / 30;

// Paddle
const paddle = {
    width: 80,
    height: 12,
    x: 0,
    y: 0,
    speed: 260,
    dir: 0
};

// Bola
const ball = {
    radius: 6,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 220
};

// Ladrillos
const brickConfig = {
    rows: 5,
    cols: 8,
    width: 50,
    height: 16,
    padding: 4,
    offsetTop: 60,
    offsetLeft: 20
};

let bricks = [];

// Juego
let score = 0;
let lives = 3;
let gameRunning = false;
let lastTimestamp = 0;

// ==========================
// Inicialización
// ==========================

function init() {
    setupEventListeners();
    resetGame();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    score = 0;
    lives = 3;
    document.getElementById("scoreValue").textContent = score;
    document.getElementById("livesValue").textContent = lives;

    resetPaddle();
    resetBall();
    initBricks();
    gameRunning = false;
    lastTimestamp = 0;
}

function resetPaddle() {
    paddle.x = (canvas.width - paddle.width) / 2;
    paddle.y = canvas.height - 40;
    paddle.dir = 0;
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 60;

    const angle = (-Math.PI / 4) + (Math.random() * Math.PI / 8);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
}

function initBricks() {
    bricks = [];
    for (let row = 0; row < brickConfig.rows; row++) {
        for (let col = 0; col < brickConfig.cols; col++) {
            const x = brickConfig.offsetLeft + col * (brickConfig.width + brickConfig.padding);
            const y = brickConfig.offsetTop + row * (brickConfig.height + brickConfig.padding);
            bricks.push({
                x,
                y,
                width: brickConfig.width,
                height: brickConfig.height,
                alive: true
            });
        }
    }
}

// ==========================
// Entradas
// ==========================

function setupEventListeners() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            paddle.dir = -1;
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            paddle.dir = 1;
        }
    });

    document.addEventListener("keyup", (e) => {
        if (
            e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ||
            e.key === "ArrowRight" || e.key === "d" || e.key === "D"
        ) {
            paddle.dir = 0;
        }
    });

    document.getElementById("btnStart").addEventListener("click", () => {
        gameRunning = true;
    });

    document.getElementById("btnPause").addEventListener("click", () => {
        gameRunning = !gameRunning;
    });

    document.getElementById("btnReset").addEventListener("click", () => {
        resetGame();
    });
}

// ==========================
// Bucle de juego
// ==========================

function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    let dt = (timestamp - lastTimestamp) / 1000.0;
    lastTimestamp = timestamp;

    if (dt > MAX_DT) dt = MAX_DT;

    if (gameRunning) {
        update(dt);
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// ==========================
// Lógica
// ==========================

function update(dt) {
    // Mover paddle
    paddle.x += paddle.dir * paddle.speed * dt;

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }

    // Mover bola
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    handleCollisions();
}

function handleCollisions() {
    // Paredes laterales
    if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx *= -1;
    } else if (ball.x + ball.radius > canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.vx *= -1;
    }

    // Techo
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy *= -1;
    }

    // Fondo
    if (ball.y - ball.radius > canvas.height) {
        lives--;
        document.getElementById("livesValue").textContent = lives;

        if (lives <= 0) {
            gameOver();
        } else {
            resetPaddle();
            resetBall();
        }
        return;
    }

    // Paddle
    if (circleIntersectsRect(ball, paddle)) {
        ball.y = paddle.y - ball.radius;
        ball.vy *= -1;

        const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        ball.vx = hitPos * ball.speed;
    }

    // Ladrillos
    for (const brick of bricks) {
        if (!brick.alive) continue;

        if (circleIntersectsRect(ball, brick)) {
            brick.alive = false;
            score += 10;
            document.getElementById("scoreValue").textContent = score;

            ball.vy *= -1;
            break;
        }
    }

    if (bricks.every(b => !b.alive)) {
        initBricks();
    }
}

function circleIntersectsRect(circle, rect) {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;

    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function gameOver() {
    gameRunning = false;
    alert("Game Over");
    resetGame();
}

// ==========================
// Dibujado
// ==========================

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Paddle
    ctx.fillStyle = "#0f0";
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Bola
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();

    // Ladrillos
    for (const brick of bricks) {
        if (!brick.alive) continue;
        ctx.fillStyle = "#f90";
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    }
}

// ==========================
// Arrancar juego
// ==========================
init();
