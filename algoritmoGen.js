// ===============================
// algoritmoGen.js
// Algoritmo genético para Arkanoid
// ===============================

console.log("algoritmoGen.js cargado");

// -------------------------------
// Configuración del GA
// -------------------------------

// Cada individuo es un vector de pesos:
// [w_dx, w_dy, w_vx, w_vy, bias]
const NUM_GENES = 5;
const DT_SIM = 1 / 60;

// Si estos valores NO están definidos en game.js, ponemos defaults
if (typeof populationSize === "undefined") populationSize = 30;
if (typeof N_Generations === "undefined") N_Generations = 30;
if (typeof MutationRate === "undefined") MutationRate = 0.05;
if (typeof Max_steps === "undefined") Max_steps = 400;

// Estado global del GA
let gaMejorGenoma = null;
let gaEntrenado = false;
let modoGA = false;

// Guardamos la función update ORIGINAL definida en game.js
const updateOriginal = window.update;

// -------------------------------
// Representación del individuo
// -------------------------------

// Crea un individuo con genes aleatorios en [-1, 1]
function crearGenomaAleatorio() {
    const genes = [];
    for (let i = 0; i < NUM_GENES; i++) {
        genes.push(Math.random() * 2 - 1);
    }
    return { genes, fitness: 0 };
}

// Features desde entorno simulado (para evaluación)
function obtenerFeaturesDesdeEntorno(ent) {
    const barraCentro = ent.barra.x + ent.barra.width / 2;

    const dx = (ent.bola.x - barraCentro) / canvas.width;   // distancia horizontal normalizada
    const dy = (ent.bola.y - ent.barra.y) / canvas.height;  // distancia vertical normalizada

    const vx = ent.bola.vx / ent.bola.speed; // -1..1
    const vy = ent.bola.vy / ent.bola.speed; // -1..1

    return [dx, dy, vx, vy, 1]; // 1 = bias
}

// Features desde el juego real (para controlar la barra en pantalla)
function obtenerFeaturesDesdeJuego() {
    const barraCentro = barra.x + barra.width / 2;

    const dx = (bola.x - barraCentro) / canvas.width;
    const dy = (bola.y - barra.y) / canvas.height;

    const vx = bola.vx / bola.speed;
    const vy = bola.vy / bola.speed;

    return [dx, dy, vx, vy, 1];
}

// Política lineal: signo(w · x)
function decidirAccion(genoma, features) {
    let suma = 0;
    for (let i = 0; i < genoma.length; i++) {
        suma += genoma[i] * features[i];
    }

    // Usamos un umbral pequeño: si la suma es muy pequeña, nos quedamos quietos
    const umbral = 0.05;
    if (suma > umbral) return 1;    // mover derecha
    if (suma < -umbral) return -1;  // mover izquierda
    return 0;                       // quieto
}

// -------------------------------
// Entorno de simulación interno
// -------------------------------

// Crea una copia local de barra, bola y ladrillos para probar un individuo
function crearEntornoSimulado() {
    // Barra simulada
    const barraSim = {
        width: barra.width,
        height: barra.height,
        x: (canvas.width - barra.width) / 2,
        y: canvas.height - 40,
        speed: barra.speed
    };

    // Bola simulada
    const bolaSim = {
        radius: bola.radius,
        x: canvas.width / 2,
        y: canvas.height - 60,
        speed: typeof VELOCIDAD_INICIAL_BOLA !== "undefined"
            ? VELOCIDAD_INICIAL_BOLA
            : bola.speed,
        vx: 0,
        vy: 0
    };

    // Ángulo inicial fijo hacia arriba-izquierda
    const angulo = -Math.PI / 4;
    bolaSim.vx = Math.cos(angulo) * bolaSim.speed;
    bolaSim.vy = Math.sin(angulo) * bolaSim.speed;

    // Ladrillos simulados (misma grilla que en el juego)
    const bricksSim = [];
    for (let row = 0; row < brickConfig.rows; row++) {
        for (let col = 0; col < brickConfig.cols; col++) {
            const x = brickConfig.offsetLeft + col * (brickConfig.width + brickConfig.padding);
            const y = brickConfig.offsetTop + row * (brickConfig.height + brickConfig.padding);
            bricksSim.push({
                x,
                y,
                width: brickConfig.width,
                height: brickConfig.height,
                alive: true
            });
        }
    }

    return {
        barra: barraSim,
        bola: bolaSim,
        bricks: bricksSim
    };
}

// Ejecuta una "partida" simulada para un genoma y devuelve el fitness
function simularIndividuo(genoma) {
    const ent = crearEntornoSimulado();

    let pasos = 0;
    let bricksRotosSim = 0;
    let rebotesEnBarra = 0;
    let sumaDistanciaX = 0;
    let vivo = true;

    while (pasos < Max_steps && vivo) {
        // 1. Decidir acción según el genoma y el estado
        const features = obtenerFeaturesDesdeEntorno(ent);
        const accion = decidirAccion(genoma, features);

        // 2. Mover barra simulada
        ent.barra.x += accion * ent.barra.speed * DT_SIM;
        if (ent.barra.x < 0) ent.barra.x = 0;
        if (ent.barra.x + ent.barra.width > canvas.width) {
            ent.barra.x = canvas.width - ent.barra.width;
        }

        // 3. Mover bola simulada
        ent.bola.x += ent.bola.vx * DT_SIM;
        ent.bola.y += ent.bola.vy * DT_SIM;

        // 4. Colisiones (versión simplificada de tu lógica)

        // Paredes laterales
        if (ent.bola.x - ent.bola.radius < 0) {
            ent.bola.x = ent.bola.radius;
            ent.bola.vx *= -1;
        } else if (ent.bola.x + ent.bola.radius > canvas.width) {
            ent.bola.x = canvas.width - ent.bola.radius;
            ent.bola.vx *= -1;
        }

        // Techo
        if (ent.bola.y - ent.bola.radius < 0) {
            ent.bola.y = ent.bola.radius;
            ent.bola.vy *= -1;
        }

        // Fondo (pierde)
        if (ent.bola.y - ent.bola.radius > canvas.height) {
            vivo = false;
        }

        // Barra
        if (circleIntersectsRect(ent.bola, ent.barra)) {
            ent.bola.y = ent.barra.y - ent.bola.radius;
            ent.bola.vy *= -1;

            const hitPos = (ent.bola.x - (ent.barra.x + ent.barra.width / 2)) / (ent.barra.width / 2);
            ent.bola.vx = hitPos * ent.bola.speed;

            rebotesEnBarra++;
        }

        // Ladrillos
        for (const brick of ent.bricks) {
            if (!brick.alive) continue;
            if (circleIntersectsRect(ent.bola, brick)) {
                brick.alive = false;
                bricksRotosSim++;
                ent.bola.vy *= -1;
                break;
            }
        }

        // Si no queda ningún ladrillo, terminamos simulación
        if (ent.bricks.every(b => !b.alive)) {
            vivo = false;
        }

        // Distancia horizontal media entre bola y barra (para penalizar estar lejos)
        const barraCentro = ent.barra.x + ent.barra.width / 2;
        sumaDistanciaX += Math.abs(ent.bola.x - barraCentro);

        pasos++;
    }

    const pasosAlcanzados = pasos; // por claridad
    const distPromedio = pasosAlcanzados > 0 ? (sumaDistanciaX / pasosAlcanzados) : canvas.width / 2;

    // --- FUNCIÓN DE FITNESS ---
    // Objetivo:
    //  - Más ladrillos rotos   → mucho mejor.
    //  - Más rebotes en barra  → mejor (sabe “recoger” la bola).
    //  - Vivir más pasos        → un poco mejor.
    //  - Menor distancia media  → mejor (la barra sigue la bola).
    const fitness =
        bricksRotosSim * 1000 +          // romper ladrillos vale muchísimo
        rebotesEnBarra * 200 +           // rebotar la bola en la barra también
        pasosAlcanzados * 1.0 -          // sobrevivir suma
        distPromedio * 0.5;              // estar lejos resta

    return fitness;
}

// -------------------------------
// Operadores del GA
// -------------------------------

function evaluarPoblacion(poblacion) {
    for (const ind of poblacion) {
        ind.fitness = simularIndividuo(ind.genes);
    }
}

function seleccionarPadre(poblacion) {
    let total = 0;
    for (const ind of poblacion) total += ind.fitness;

    if (total === 0) {
        // Si todos valen 0, escogemos uno al azar
        return poblacion[Math.floor(Math.random() * poblacion.length)];
    }

    let r = Math.random() * total;
    for (const ind of poblacion) {
        r -= ind.fitness;
        if (r <= 0) return ind;
    }
    return poblacion[poblacion.length - 1];
}

function cruzar(p1, p2) {
    const genesHijo = [];
    const punto = Math.floor(Math.random() * NUM_GENES);

    for (let i = 0; i < NUM_GENES; i++) {
        genesHijo[i] = (i < punto) ? p1.genes[i] : p2.genes[i];

        // Mutación
        if (Math.random() < MutationRate) {
            genesHijo[i] += (Math.random() * 0.4 - 0.2); // ruido pequeño
        }
    }

    return { genes: genesHijo, fitness: 0 };
}

function crearSiguienteGeneracion(poblacion) {
    const ordenada = [...poblacion].sort((a, b) => b.fitness - a.fitness);
    const nueva = [];

    const elitismo = Math.max(1, Math.floor(populationSize * 0.1));

    // Copiar élites
    for (let i = 0; i < elitismo; i++) {
        const copiaGenes = ordenada[i].genes.slice();
        nueva.push({ genes: copiaGenes, fitness: 0 });
    }

    // Rellenar resto con cruza + mutación
    while (nueva.length < populationSize) {
        const p1 = seleccionarPadre(ordenada);
        const p2 = seleccionarPadre(ordenada);
        nueva.push(cruzar(p1, p2));
    }

    return nueva;
}

// Ejecuta todo el algoritmo genético y guarda el mejor individuo
function ejecutarAlgoritmoGenetico() {
    console.log("Iniciando entrenamiento GA...");

    let poblacion = [];
    for (let i = 0; i < populationSize; i++) {
        poblacion.push(crearGenomaAleatorio());
    }

    for (let g = 0; g < N_Generations; g++) {
        evaluarPoblacion(poblacion);
        poblacion.sort((a, b) => b.fitness - a.fitness);
        const mejor = poblacion[0];
        console.log(`Gen ${g} – mejor fitness: ${mejor.fitness.toFixed(2)}`);
        poblacion = crearSiguienteGeneracion(poblacion);
    }

    // Evaluación final
    evaluarPoblacion(poblacion);
    poblacion.sort((a, b) => b.fitness - a.fitness);
    gaMejorGenoma = poblacion[0].genes.slice();
    gaEntrenado = true;

    console.log("Entrenamiento GA finalizado. Mejor genoma:", gaMejorGenoma);
}

// -------------------------------
// Enganche con el motor del juego
// -------------------------------

// Si modoGA=true, la barra se mueve con el mejor genoma
window.update = function (dt) {
    if (modoGA && gaMejorGenoma) {
        const features = obtenerFeaturesDesdeJuego();
        const accion = decidirAccion(gaMejorGenoma, features);

        // Forzamos la dirección de la barra según el GA
        barra.dir = accion;

        // Desactivamos temporalmente la lógica de juegoAutomatico de game.js
        const prevAuto = juegoAutomatico;
        juegoAutomatico = false;
        updateOriginal(dt);
        juegoAutomatico = prevAuto;
    } else {
        // Comportamiento normal
        updateOriginal(dt);
    }
};

// -------------------------------
// Botón "Probar Algoritmo"
// -------------------------------

const btnGA = document.getElementById("btnProbarAlgoritmo");
if (btnGA) {
    console.log("Enganchando botón Probar Algoritmo al GA");
    btnGA.addEventListener("click", () => {
        console.log("Click en Probar Algoritmo");

        if (!gaEntrenado) {
            ejecutarAlgoritmoGenetico();
        }

        // Activamos modo GA y ponemos el juego a correr
        modoGA = true;
        gameRunning = true;
        console.log("Modo GA activado; jugando con el mejor individuo.");
    });
} else {
    console.warn("No se encontró #btnProbarAlgoritmo en el DOM");
}
