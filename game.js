// las referencias globales
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

console.log("game.js cargado, canvas:", canvas);

// FPS objetivo alrededor de 60, pero usamos requestAnimationFrame
const MAX_DT = 1 / 30;
let backgroundPattern = null 


juegoAutomatico = false; 
populationSize = 100;
N_Generations = 1000;
MutationRate = 0.05;
Max_steps = 100;
bricksRotos = 0;
//individuo = [h1,h2,h3,h4,h5,h6] // hace falta definir los valores a evaluar
// por ejemplo h1 = distancia entre el centro de la barra y la bola en x
// y h2 puede ser la velocidad de la bola en y
// barra 
const barra = {
    width: 80,
    height: 12,
    x: 0,
    y: 0,
    speed: 300,
    dir: 0
};

// Bola
const bola = {
    radius: 6,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 400
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

// estadisticas del juego
let score = 0;
let lives = 3;
let gameRunning = false;
let lastTimestamp = 0;

// para crear el fondo (background) del juego para que se parezca al juego original 
function createBG(){
    const off = document.createElement("canvas");
    off.width = 32;
    off.height = 32; 
    const figuras = off.getContext("2d");

    figuras.fillStyle = "#002b80";
    figuras.fillRect(0,0,off.width,off.height);

    figuras.fillStyle = "#195ad1";
    figuras.beginPath();
    figuras.arc(8,8,6,0, 1.3); // pi por dos para darle la curva 
    figuras.fill();

    figuras.beginPath();
    figuras.arc(24,24,6,0,1.3); 
    figuras.fill();

    figuras.fillStyle = "#00162d"
    figuras.beginPath();
    figuras.arc(24,8,12,0,1.3);
    figuras.fill();

    figuras.beginPath();
    figuras.arc(8,24,4,0,1.3);
    figuras.fill();

    backgroundPattern = ctx.createPattern(off,"repeat");
}




// Inicializacion del juego
function init() {
    setupEventListeners();
    createBG();
    resetGame();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    score = 0;
    lives = 3;
    document.getElementById("scoreValue").textContent = score;
    document.getElementById("livesValue").textContent = lives;

    resetBarra();
    resetBola();
    initBricks();
    gameRunning = false;
    lastTimestamp = 0;
}

function resetBarra() {
    barra.x = (canvas.width - barra.width) / 2;
    barra.y = canvas.height - 40;
    barra.dir = 0;
}

function resetBola() {
    bola.x = canvas.width / 2;
    bola.y = canvas.height - 60;

    const angle = (-Math.PI / 4) + (Math.random() * Math.PI / 8);
    bola.vx = Math.cos(angle) * bola.speed;
    bola.vy = Math.sin(angle) * bola.speed;
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


// Entradas
let leftArrowPressed = false;
let rightArrowPressed = false; 
const btnStart = document.getElementById("btnStart");
const btnPause = document.getElementById("btnPause");
const btnReset = document.getElementById("btnReset");
const btnProbarAlgoritmo = document.getElementById("btnProbarAlgoritmo");

function setupEventListeners() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            leftArrowPressed = true;
        }

        else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            rightArrowPressed = true;
        }
        actualizarDireccionBarra();
    });

    document.addEventListener("keyup", (e) => {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            leftArrowPressed = false;
        } 
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            rightArrowPressed = false;
        }
        actualizarDireccionBarra();    
    });

    btnStart.addEventListener("click", () => {
        juegoAutomatico = false;
        gameRunning = true;
        btnPause.disabled = false;
    });

    btnPause.addEventListener("click", () => {
        if (btnPause.disabled) return; 
        gameRunning = !gameRunning;
    });

    btnReset.addEventListener("click", () => {
        resetGame();
        btnPause.disabled = true;
    });

     btnProbarAlgoritmo.addEventListener("click", () => {
        juegoAutomatico = true;
        gameRunning = true;
        btnPause.disabled = false;
    });
}

function actualizarDireccionBarra() {
    if (leftArrowPressed && !rightArrowPressed) {
        barra.dir = -1;
    } else if (rightArrowPressed && !leftArrowPressed) {
        barra.dir = 1;
    } else {
        barra.dir = 0;
    }       
}


// Bucle de juego
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


// Lógica del juego 
function update(dt) {
    // Mover barra
    if(juegoAutomatico){
        const barracenter = barra.x + barra.width / 2;
        const objetivoX = bola.x;

        if(objetivoX < barracenter - 5){
            barra.dir = -1;
        }
        else if(objetivoX > barracenter + 5){
            barra.dir = 1;
        }
        else{
            barra.dir = 0;
        }
    }


    barra.x += barra.dir * barra.speed * dt;

    if (barra.x < 0) barra.x = 0;
    if (barra.x + barra.width > canvas.width) {
        barra.x = canvas.width - barra.width;
    }

    // Mover bola
    bola.x += bola.vx * dt;
    bola.y += bola.vy * dt;

    handleCollisions();
}

function handleCollisions() {
    // Paredes laterales
    if (bola.x - bola.radius < 0) {
        bola.x = bola.radius;
        bola.vx *= -1;
    } else if (bola.x + bola.radius > canvas.width) {
        bola.x = canvas.width - bola.radius;
        bola.vx *= -1;
    }

    // Techo
    if (bola.y - bola.radius < 0) {
        bola.y = bola.radius;
        bola.vy *= -1;
    }

    // Fondo
    if (bola.y - bola.radius > canvas.height) {
        lives--;
        document.getElementById("livesValue").textContent = lives;

        if (lives <= 0) {
            gameOver();
        } else {
            resetBarra();
            resetBola();
        }
        return;
    }

    // barra
    if (circleIntersectsRect(bola, barra)) {
        bola.y = barra.y - bola.radius;
        bola.vy *= -1;

        const hitPos = (bola.x - (barra.x + barra.width / 2)) / (barra.width / 2);
        bola.vx = hitPos * bola.speed;
    }

    // Ladrillos
    for (const brick of bricks) {
        if (!brick.alive) continue;

        if (circleIntersectsRect(bola, brick)) {
            brick.alive = false;
            score += 10;
            bricksRotos++;

            if (bricksRotos % 10 === 0) {
                bola.speed *= 1.2;
                const dir = Math.atan2(bola.vy, bola.vx);
                bola.vx = Math.cos(dir) * bola.speed;
                bola.vy = Math.sin(dir) * bola.speed;
            }

            document.getElementById("scoreValue").textContent = score;

            bola.vy *= -1;
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
    alert("Game Over!, Tu puntuación: " + score);
    resetGame();
}


// Dibujado


function draw() {
    if (backgroundPattern) {
        ctx.fillStyle = backgroundPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // barra
    ctx.fillStyle = "#0f0";
    ctx.fillRect(barra.x, barra.y, barra.width, barra.height);

    // Bola
    ctx.beginPath();
    ctx.arc(bola.x, bola.y, bola.radius, 0, Math.PI * 2);
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


// iniciamos el juego 
init();
