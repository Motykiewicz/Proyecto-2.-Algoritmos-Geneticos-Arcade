// algoritmoGen.js

console.log("algoritmoGen.js cargado");


// configuración del algoritmo genetico

// cada individuo es un vector de pesos:
// [w_dx, w_dy, w_vx, w_vy, bias]

const NUM_GENES = 5;
let DT_SIM = 1 / 60;   // se ajusta con GA_FPS en la interfaz

// ponemos valores defaults por si no estan definidos dentro de game.js 
if (typeof populationSize === "undefined") populationSize = 30;
if (typeof N_Generations === "undefined") N_Generations = 30;
if (typeof MutationRate === "undefined") MutationRate = 0.05;
if (typeof Max_steps === "undefined") Max_steps = 400;

// los parametros leidos desde la interfaz para el reporte 
let selectionPercent = 10;
let crossoverPercent = 85;
let mutationPercentUI = 5;
let GA_FPS = 60;
let EpisodiosPorIndividuo = 1;
let GA_tamanoTorneo = 3;

// -------------------------------
// Semilla y RNG del GA (opcional)
// -------------------------------

// Si quieres reproducibilidad, puedes hacer desde consola:
//   USE_SEEDED_RNG = true; GA_SEED = 12345;
let USE_SEEDED_RNG = true; 
let GA_SEED = 12345 >>> 0;

// funcion random para sacar la semilla del ga 
function gaRandom() {
    if (!USE_SEEDED_RNG) {
        return Math.random();
    }
    // LCG simple cuando queremos modo "con semilla"
    GA_SEED = (1664525 * GA_SEED + 1013904223) >>> 0;
    return GA_SEED / 0xFFFFFFFF;
}


// Se leen los parametros desde la interfaz 
function leerParametrosDesdeUI() {
    const popInput   = document.getElementById("inputPopulation");
    const genInput   = document.getElementById("inputGenerations");
    const mutInput   = document.getElementById("inputMut");
    const seedInput  = document.getElementById("inputSeed");
    const fpsInput   = document.getElementById("inputFPS");
    const epInput    = document.getElementById("inputEpisodes");
    const selInput   = document.getElementById("inputSel");
    const crossInput = document.getElementById("inputCross");

    if (popInput) {
        const v = parseInt(popInput.value);
        if (!isNaN(v) && v >= 1) populationSize = v;
    }
    if (genInput) {
        const v = parseInt(genInput.value);
        if (!isNaN(v) && v >= 1) N_Generations = v;
    }
    if (mutInput) {
        const v = parseFloat(mutInput.value);
        if (!isNaN(v)) {
            mutationPercentUI = v;
            MutationRate = mutationPercentUI / 100.0;  // 5% seria 0.05
        }
    }
    if (seedInput) {
        const v = parseInt(seedInput.value);
        if (!isNaN(v)) GA_SEED = v >>> 0;
    }
    if (fpsInput) {
        const v = parseInt(fpsInput.value);
        if (!isNaN(v) && v > 0){
            GA_FPS = v;
            DT_SIM = 1 /GA_FPS;
        } 
    }
    if (epInput) {
        const v = parseInt(epInput.value);
        if (!isNaN(v) && v >= 1) EpisodiosPorIndividuo = v;
    }
    if (selInput) {
        const v = parseFloat(selInput.value);
        if (!isNaN(v)) selectionPercent = v;
    }
    if (crossInput) {
        const v = parseFloat(crossInput.value);
        if (!isNaN(v)) crossoverPercent = v;
    }

    console.log(
        "[GA] Parametros:",
        "N =", populationSize,
        "G =", N_Generations,
        "MutationRate =", MutationRate,
        "Seed =", GA_SEED,
        "FPS sim =", GA_FPS,
        "Episodios/ind =", EpisodiosPorIndividuo,
        "%Sel =", selectionPercent,
        "%Cruce =", crossoverPercent
    );
}

// validar que el porcentaje de selección + cruce + mutacion sumen 100
function validarPorcentajes() {
    const selInput = document.getElementById("inputSel");
    const crossInput = document.getElementById("inputCross");
    const mutInput = document.getElementById("inputMut");
    const warning = document.getElementById("advertenciaPorcentaje");
    const btnGA = document.getElementById("btnProbarAlgoritmo");
    const btnMejorDemo = document.getElementById("btnMejorDemo");
    const btnDescargarDemo = document.getElementById("btnDescargarDemo");

    if (!selInput || !crossInput || !mutInput || !btnGA) return;

    const sel = parseFloat(selInput.value)   || 0;
    const cross = parseFloat(crossInput.value) || 0;
    const mut = parseFloat(mutInput.value)   || 0;
    const total = sel + cross + mut;

    if (Math.abs(total - 100) > 0.01) {
        warning.textContent = "Los porcentajes deben sumar 100%";
        btnGA.disabled = true;
        if (btnMejorDemo) btnMejorDemo.disabled = true;
        if (btnDescargarDemo) btnDescargarDemo.disabled = true;
    } else {
        warning.textContent = "";
        btnGA.disabled = false;
    }
}

// Como este script está al final del body, el DOM ya existe.
(function initPorcentajes() {
    ["inputSel", "inputCross", "inputMut"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", validarPorcentajes);
    });
    validarPorcentajes();
})();


// Estado global del algoritmo genetico 

let gaMejorGenoma = null;
let gaEntrenado = false;
let modoGA = false;
let mejorFitnessHistorial = [];
let promedioFitnessHistorial = [];
let tiemposGeneracionHistorial = [];
let tiempoInicioGA = 0;
let tiempoFinalGA = 0;

// Guardamos la función update ORIGINAL definida en game.js
const updateOriginal = window.update;



// -------------------------------
// Representación del individuo
// -------------------------------

// Crea un individuo con genes aleatorios en [-1, 1]
function crearGenomaAleatorio() {
    const genes = [];
    for (let i = 0; i < NUM_GENES; i++) {
        genes.push(gaRandom() * 2 - 1);
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

// -------------------------------
// FUNCIÓN DE FITNESS
// -------------------------------

// Ejecuta uno o varios episodios simulados para un genoma y devuelve el fitness
function simularIndividuo(genoma) {
    let fitnessTotal = 0;

    const episodios = Math.max(1, EpisodiosPorIndividuo);

    for (let ep = 0; ep < episodios; ep++) {
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

            // Si no queda ningún ladrillo, terminamos episodio
            if (ent.bricks.every(b => !b.alive)) {
                vivo = false;
            }

            // Distancia horizontal media entre bola y barra
            const barraCentro = ent.barra.x + ent.barra.width / 2;
            sumaDistanciaX += Math.abs(ent.bola.x - barraCentro);

            pasos++;
        }

        const pasosAlcanzados = pasos;
        const distPromedio = pasosAlcanzados > 0 ? (sumaDistanciaX / pasosAlcanzados) : canvas.width / 2;

        const ratioSupervivencia = pasosAlcanzados / Max_steps;   // 0..1
        const distNorm = distPromedio / canvas.width;             // 0..1 aprox

        // --- NUEVA FUNCIÓN DE FITNESS ---
        const fitnessEpisodio =
            bricksRotosSim * 2000 +        // romper ladrillos vale muchísimo
            rebotesEnBarra * 300 +         // rebotar la bola en la barra también
            ratioSupervivencia * 1000 -    // sobrevivir más tiempo suma bastante
            distNorm * 400;                // estar lejos de la bola resta

        fitnessTotal += fitnessEpisodio;
    }

    // Promedio sobre episodios
    return fitnessTotal / episodios;
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
        return poblacion[Math.floor(gaRandom() * poblacion.length)];
    }

    let r = gaRandom() * total;
    for (const ind of poblacion) {
        r -= ind.fitness;
        if (r <= 0) return ind;
    }
    return poblacion[poblacion.length - 1];
}

function cruzar(p1, p2) {
    const genesHijo = [];
    const punto = Math.floor(gaRandom() * NUM_GENES);

    for (let i = 0; i < NUM_GENES; i++) {
        genesHijo[i] = (i < punto) ? p1.genes[i] : p2.genes[i];

        // Mutación
        if (gaRandom() < MutationRate) {
            genesHijo[i] += (gaRandom() * 0.4 - 0.2); // ruido pequeño
        }
    }

    return { genes: genesHijo, fitness: 0 };
}

function crearSiguienteGeneracion(poblacion) {
    const ordenada = [...poblacion].sort((a, b) => b.fitness - a.fitness);
    const nueva = [];

    // elitismo: el mejor 10% de la población
    let elitismo = Math.floor(populationSize * (selectionPercent / 100));  // math.floor es lo mismo que math.max pero redondea hacia abajo para que no haya decimales sueltos 
    if (elitismo < 1) elitismo = 1;
    if (elitismo > populationSize) elitismo = populationSize;


    // Copiar élites
    for (let i = 0; i < elitismo && i < ordenada.length; i++) {
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
    // 1) Leemos parámetros de la UI (N, G, % mutación, seed, etc.)
    GA_SEED = GA_SEED >>> 0; 
    leerParametrosDesdeUI();
    mejorFitnessHistorial = [];
    promedioFitnessHistorial = [];
    tiemposGeneracionHistorial = [];
    tiempoInicioGA = performance.now();
    tiempoFinalGA = tiempoInicioGA;

    console.log("Iniciando entrenamiento GA...");
    console.log("USE_SEEDED_RNG =", USE_SEEDED_RNG, "GA_SEED =", GA_SEED);

    let poblacion = [];
    for (let i = 0; i < populationSize; i++) {
        poblacion.push(crearGenomaAleatorio());
    }

    for (let g = 0; g < N_Generations; g++) {

        evaluarPoblacion(poblacion);
        poblacion.sort((a, b) => b.fitness - a.fitness);
        const mejor = poblacion[0];

        // promedio de fitness de la generacion 
        let sumaFitness = 0;
        for (const ind of poblacion) sumaFitness += ind.fitness;
        const prom = sumaFitness / poblacion.length;

        mejorFitnessHistorial.push(mejor.fitness);
        promedioFitnessHistorial.push(prom);
        const t1 = performance.now();
        tiemposGeneracionHistorial.push(t1 - tiempoFinalGA);

        console.log(`Gen ${g} – mejor fitness: ${mejor.fitness.toFixed(2)} - promedio: ${prom.toFixed(2)}`);

        poblacion = crearSiguienteGeneracion(poblacion);
    }


    function actualizarMetricasEnInterfaz() {
        const etiquetaMejorFitness = document.getElementById("etiquetaMejorFitness");
        const etiquetaFitnessPromedio = document.getElementById("etiquetaFitnessPromedio");
        const etiquetaTiempoTotal = document.getElementById("etiquetaTiempoTotal");
        const etiquetaTiempoGen = document.getElementById("etiquetaTiempoGen");

        if (!mejorFitnessHistorial.length) return;
        
        const mejor = mejorFitnessHistorial[mejorFitnessHistorial.length - 1];
        const prom = promedioFitnessHistorial[promedioFitnessHistorial.length - 1];

        const tiempoTotal = tiempoFinalGA - tiempoInicioGA;
        const tiempoGen = tiemposGeneracionHistorial.length ? tiemposGeneracionHistorial.reduce((a, b) => a + b, 0) / tiemposGeneracionHistorial.length : 0;


        if (etiquetaMejorFitness) etiquetaMejorFitness.textContent = mejor.toFixed(1);
        if (etiquetaFitnessPromedio) etiquetaFitnessPromedio.textContent = prom.toFixed(1);
        if (etiquetaTiempoTotal) etiquetaTiempoTotal.textContent = (tiempoTotal / 1000).toFixed(2) + " s";
        if (etiquetaTiempoGen) etiquetaTiempoGen.textContent = (tiempoGen).toFixed(2) + " ms";
    }

    function dibujarGraficoGA() {
        const canvas = document.getElementById("TablaGA");
        if (!canvas || !mejorFitnessHistorial.length) return;

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);

        // ejes simples 
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        ctx.moveTo(30, 10);
        ctx.lineTo(30, h - 20);
        ctx.lineTo(w - 5, h - 20);
        ctx.stroke();

        const gens = mejorFitnessHistorial.length;
        const maxFitness = Math.max(...mejorFitnessHistorial, ...promedioFitnessHistorial);
        const minFitness = Math.min(...mejorFitnessHistorial, ...promedioFitnessHistorial);
        const rangoFitness = maxFitness - minFitness || 1;

        function dibujarYFitness(valor){
            const norm = (valor - minFitness) / rangoFitness; 
            return (h - 20) - norm  *(h - 30);
        }

        function dibujarXGen(i){
            return 30 + (i / Math.max(1, i - 1)) * (w - 40);
    }
        
        // dibujar el mejor fitneess
        ctx.strokeStyle = '#00ff88';
        ctx.beginPath();
        mejorFitnessHistorial.forEach((fit, i) => {
            const x = dibujarXGen(i);
            const y = dibujarYFitness(fit);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // diujar el fitness promedio 
        ctx.strokeStyle = '#ffaa00';
        ctx.beginPath();
        promedioFitnessHistorial.forEach((fit, i) => {
            const x = dibujarXGen(i);
            const y = dibujarYFitness(fit);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
    tiempoFinalGA = performance.now();
    actualizarMetricasEnInterfaz();
    dibujarGraficoGA();









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
const btnMejorDemo = document.getElementById("btnMejorDemo");
const btnDescargarDemo = document.getElementById("btnDescargarDemo");



if (btnGA) {
    console.log("Enganchando botón Probar Algoritmo al GA");
    btnGA.addEventListener("click", () => {
        console.log("Click en Probar Algoritmo (entrenando GA)...");
            ejecutarAlgoritmoGenetico();
        

        // ya despues de entrenarlo, obtenemos el mejor individuo 
        if (btnMejorDemo) btnMejorDemo.disabled = false;
        if (btnDescargarDemo) btnDescargarDemo.disabled = false; 
    });


} else {
    console.warn("No se encontró #btnProbarAlgoritmo en el DOM");
}

if (btnMejorDemo) {
    btnMejorDemo.addEventListener("click", () => {
        if (!gaEntrenado || !gaMejorGenoma) {
            alert("Primero entrene el GA con 'Probar Algoritmo'.");
            return;
        }
        // Reiniciamos el juego y dejamos que el GA controle la barra
        if (typeof resetGame === "function") {
            resetGame();
        }
        modoGA = true;
        gameRunning = true;

        const btnPause = document.getElementById("btnPause");
        if (btnPause) btnPause.disabled = false;

        console.log("mejor demo: jugando con el mejor individuo guardado.");
    });
}

function exportBestJson() {
    if (!gaEntrenado || !gaMejorGenoma) {
        alert("No hay individuo entrenado todavía.");
        return;
    }

    const data = {
        game: "Arkanoid-GA",
        representation: "vector_pesos_lineal",
        num_genes: NUM_GENES,
        genes: gaMejorGenoma,
        ga_params: {
            populationSize,
            generations: N_Generations,
            mutationRate: MutationRate,
            selectionPercent,
            crossoverPercent,
            mutationPercent: mutationPercentUI,
            fpsSim: GA_FPS,
            episodesPerIndividual: EpisodiosPorIndividuo,
            seed: GA_SEED
        },
        fitness_history: {
            best: mejorFitnessHistorial,
            avg: promedioFitnessHistorial
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "best.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

if (btnDescargarDemo) {
    btnDescargarDemo.addEventListener("click", exportBestJson);
}


