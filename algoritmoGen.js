// algoritmoGen.js
//

// tabla de contenidos
// 0. configuracion global y los rng ------------------------------------ linea 23
// 1. lectura de parametros de la interfaz y validacion ----------------- linea 69
// 2. estado global del algoritmo genetico y relacion con el juego  ----- linea 135
// 3. representacion del individuo y features del entorno---------------- linea 180
// 4. simulacion del individuo en entorno simulado----------------------- linea 231
// 5. funcion de fitness ------------------------------------------------ linea 418
// 6. operadores del algoritmo genetico --------------------------------- linea 440 
    // 6.1 seleccion ---------------------------------------------------- linea 445
    // 6.2 cruzamiento -------------------------------------------------- linea 476
    // 6.3 mutacion ----------------------------------------------------- linea 476 (estas dos van juntas)
    // 6.4 crear nueva generacion --------------------------------------- linea 504
// 7. bucle principal del algoritmo genetico ---------------------------- linea 563
// 8. metricas, graficas y exportacion de datos ------------------------- linea 803
// 9. botones e interfaz de usuario ------------------------------------- linea 868

//empezamos 

//----------------------------------
// 0. Configuracion global y los RNG
//------------------------------------

// numero de genes por individuo
const NUM_GENES = 5;

// se ajusta con GA_FPS en la interfaz
let DT_SIM = 1 / 60;   

// ponemos valores defaults por si no estan definidos dentro de game.js 
if (typeof populationSize === "undefined") populationSize = 30;
if (typeof N_Generations === "undefined") N_Generations = 30;
if (typeof MutationRate === "undefined") MutationRate = 0.05;
if (typeof Max_steps === "undefined") Max_steps = 600;


// los parametros leidos desde la interfaz para el reporte 
let selectionPercent = 10;
let crossoverPercent = 85;
let mutationPercentUI = 5;
let GA_FPS = 60;
let EpisodiosPorIndividuo = 1;

// Semilla y RNG del GA
let USE_SEEDED_RNG = true; 
let GA_SEED = 12345 >>> 0;
let gaSEED_inicial = GA_SEED;

// funcion random para sacar la semilla del ga 
function gaRandom() {
    if (!USE_SEEDED_RNG) {return Math.random();}
    GA_SEED = (1664525 * GA_SEED + 1013904223) >>> 0;
    return GA_SEED / 0xFFFFFFFF;
}

// funcion para obtener valores aleatorios ocn distribucion gausiana
function gaussianaRandom() {
    let u = gaRandom() || 1e-9;
    let v = gaRandom() || 1e-9;
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}





//-----------------------------------------------------
// 1. Lectura de parametros de la interfaz y validacion
//-------------------------------------------------------

// Se leen los parametros desde la interfaz 
function leerParametrosDesdeUI() {
    populationSize = parseInt(document.getElementById("inputPopulation").value);
    if (populationSize < 20) populationSize = 20; //tiene que haber al menos 20 individuos

    N_Generations = parseInt(document.getElementById("inputGenerations").value);
    if (N_Generations < 50) N_Generations = 50; // al menos 50 generaciones

    MutationRate = parseInt(document.getElementById("inputMut").value) / 100;
    mutationPercentUI = parseInt(document.getElementById("inputMut").value);

    selectionPercent = parseInt(document.getElementById("inputSel").value);
    crossoverPercent = parseInt(document.getElementById("inputCross").value);

    GA_SEED = parseInt(document.getElementById("inputSeed").value);
    gaSEED_inicial = GA_SEED;

    GA_FPS = parseInt(document.getElementById("inputFPS").value);
    EpisodiosPorIndividuo = parseInt(document.getElementById("inputEpisodes").value);
}


function validarPorcentajes() {
    let sel = parseInt(document.getElementById("inputSel").value);
    let cros = parseInt(document.getElementById("inputCross").value);
    let mut = parseInt(document.getElementById("inputMut").value);

    let suma = sel + cros + mut;
    const advert = document.getElementById("advertenciaPorcentaje");

    if (suma !== 100) {
        advert.textContent = "Los porcentajes deben sumar 100%";
        if (btnGA) btnGA.disabled = true;
        if (btnGreedy) btnGreedy.disabled = true;
        if (btnDescargarDemo) btnDescargarDemo.disabled = true;
        if (btnDesc) btnDesc.disabled = true;
    } 
    else {
        advert.textContent = "";
        if (btnGA) btnGA.disabled = false;
        if (btnGreedy) btnGreedy.disabled = false;

        if (gaEntrenado) {
            if (btnDemo) btnDemo.disabled = false;
            if (btnDesc) btnDesc.disabled = false;
        }
    }
}

function initPorcentajes() {
    document.getElementById("inputSel").addEventListener("change", validarPorcentajes);
    document.getElementById("inputCross").addEventListener("change", validarPorcentajes);
    document.getElementById("inputMut").addEventListener("change", validarPorcentajes);
    validarPorcentajes();
}






//-----------------------------------------------------------------
// 2. Estado global del algoritmo genetico y relacion con el juego 
//----------------------------------------------------------------


// el mejor individuo final del algoritmo genetico
let gaMejorGenoma = null;
let gaEntrenado = false;
let modoGA = false;

// historiales para graficas
let mejorFitnessHistorial = [];
let promedioFitnessHistorial = [];
let tiemposGeneracionHistorial = [];

let tiempoInicioGA = 0;
let tiempoFinalGA = 0;

// guardamos la funcion update original del juego para luego llamarla
const updateOriginal = window.update; // Guardamos la función update ORIGINAL definida en game.js

// para que el algoritmo genetico controle la barra cuando modoGA este activo
window.update = function (dt) {
    if (modoGA && gaMejorGenoma) {
        const features = obtenerFeaturesDesdeJuego();
        const accion = decidirAccion(gaMejorGenoma.genes, features);

        // aplicar direccion
        barra.dir = accion;

        const anterior = juegoAutomatico;
        juegoAutomatico = false;
        updateOriginal(dt);
        juegoAutomatico = anterior;

    } else {
        updateOriginal(dt);
    }
};





//--------------------------------------------------------
// 3. Representacion del individuo y features del entorno
//--------------------------------------------------------

// crea un individuo aleatorio con 5 genes entre -1 y 1
function crearGenomaAleatorio() {
    const genes = [];
    for (let i = 0; i < NUM_GENES; i++) {
        genes.push(gaRandom() * 2 - 1);
    }
    return { genes, fitness: 0 };
}

// obtener caraceteristicas desde el entorno simulado
function obtenerFeaturesDesdeEntorno(ent) {
    const barraCentro = ent.barra.x + ent.barra.width / 2;
    const dx = (ent.bola.x - barraCentro) / ent.canvasWidth;
    const dy = (ent.bola.y - ent.barra.y) / ent.canvasHeight;
    const vx = ent.bola.vx / ent.bola.speed;
    const vy = ent.bola.vy / ent.bola.speed;
    return [dx, dy, vx, vy, 1];
}


// obtener caracteristicas desde el juego real
function obtenerFeaturesDesdeJuego() {
    const barraCentro = barra.x + barra.width / 2;
    const dx = (bola.x - barraCentro) / canvas.width;
    const dy = (bola.y - barra.y) / canvas.height;
    const vx = bola.vx / bola.speed;
    const vy = bola.vy / bola.speed;
    return [dx, dy, vx, vy, 1];
}

// poltca lineal: signo(w · x) con umbral
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





//------------------------------------------------
// 4. Simulacion del individuo en entorno simulado
//-------------------------------------------------
// se ejecuta para evaluar el fitness de un individuo sobre el entorno simulado y ver que tan bien juega


// crear un entorno simulado similar al del juego real para la simulacion del individuo
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

    // angulo inicial fijo hacia arriba-izquierda
    const angulo = -Math.PI / 4;
    bolaSim.vx = Math.cos(angulo) * bolaSim.speed;
    bolaSim.vy = Math.sin(angulo) * bolaSim.speed;

    // ladrillos simulados (mismo grid que en el juego)
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
        bricks: bricksSim,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
    };
}

// simular un individuo sobre el entorno, devolviendo su fitness promedio
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

        let bricksSeguidosSinTocarBarra = 0;
        let maxBricksSeguidosSinTocarBarra = 0;

        while (pasos < Max_steps && vivo) {
            // calcular accion segun la politica lineal del individuo
            const features = obtenerFeaturesDesdeEntorno(ent);
            const accion = decidirAccion(genoma, features); // -1, 0, 1

            // mover barra
            ent.barra.x += accion * ent.barra.speed * DT_SIM;
            if (ent.barra.x < 0) ent.barra.x = 0;
            if (ent.barra.x + ent.barra.width > ent.canvasWidth) {
                ent.barra.x = ent.canvasWidth - ent.barra.width;
            }

            // distancia en X barra-bola
            const barraCentro = ent.barra.x + ent.barra.width / 2;
            const distX = Math.abs(ent.bola.x - barraCentro);
            sumaDistanciaX += distX;

            // mover bola
            ent.bola.x += ent.bola.vx * DT_SIM;
            ent.bola.y += ent.bola.vy * DT_SIM;

            // paredes laterales
            if (ent.bola.x - ent.bola.radius < 0) {
                ent.bola.x = ent.bola.radius;
                ent.bola.vx *= -1;
            } else if (ent.bola.x + ent.bola.radius > ent.canvasWidth) {
                ent.bola.x = ent.canvasWidth - ent.bola.radius;
                ent.bola.vx *= -1;
            }

            // techo
            if (ent.bola.y - ent.bola.radius < 0) {
                ent.bola.y = ent.bola.radius;
                ent.bola.vy *= -1;
            }

            // fondo: cuando cae debajo del canvas el episodio termina
            if (ent.bola.y - ent.bola.radius > ent.canvasHeight) {
                vivo = false;
            }

            // colision con barra
            if (circleIntersectsRect(ent.bola, ent.barra)) {
                ent.bola.y = ent.barra.y - ent.bola.radius;
                ent.bola.vy *= -1;

                const hitPos =
                    (ent.bola.x - (ent.barra.x + ent.barra.width / 2)) /
                    (ent.barra.width / 2);
                ent.bola.vx = hitPos * ent.bola.speed;

                rebotesEnBarra++;
                bricksSeguidosSinTocarBarra = 0; // se resetea el combo
            }

            // colision con ladrillos
            for (let i = 0; i < ent.bricks.length; i++) {
                const brick = ent.bricks[i];
                if (!brick.alive) continue;

                if (circleIntersectsRect(ent.bola, brick)) {
                    brick.alive = false;
                    bricksRotosSim++;

                    // invertimos direccion vertical
                    ent.bola.vy *= -1;

                    // combo de ladrillos sin tocar la barra
                    bricksSeguidosSinTocarBarra++;
                    if (bricksSeguidosSinTocarBarra > maxBricksSeguidosSinTocarBarra) {
                        maxBricksSeguidosSinTocarBarra = bricksSeguidosSinTocarBarra;
                    }

                    break;
                }
            }

            // si ya no quedan ladrillos vivos, se termina el episodio
            const quedanLadrillosVivos = ent.bricks.some(b => b.alive);
            if (!quedanLadrillosVivos) {
                vivo = false;
            }

            pasos++;
        }

        const pasosAlcanzados = Math.max(1, pasos);
        const distPromedio = sumaDistanciaX / pasosAlcanzados;
        const ratioSupervivencia = pasosAlcanzados / Max_steps;
        const distNorm = distPromedio / ent.canvasWidth;

        const fitnessEpisodio = calcularFitnessDesdeEstadistcias(
            bricksRotosSim,
            rebotesEnBarra,
            ratioSupervivencia,
            distNorm,
            maxBricksSeguidosSinTocarBarra
        );

        fitnessTotal += fitnessEpisodio;
    }

    return fitnessTotal / episodios;
}





//------------------------
// 5. Funcion de fitness
//------------------------

// el fitness se calcula a partir de varias estadisticas recogidas durante la simulacion del individuo
// como numero de ladrillos rotos, mantener la bola viva(rebotes), tiempo de supervivencia, distancia barra-bola y maximo combo de ladrillos rotos sin tocar la barra
// la funcion se puede utilizar tanto para el entrenamiento del GA como para evaluar el rendimiento de la politica greedy
// asi podemos comparar ambos enfoques con la misma metrica

function calcularFitnessDesdeEstadistcias(bricksRotosSim, rebotesEnBarra, ratioSupervivencia, distNorm, maxBricksSeguidosSinTocarBarra) {
    return bricksRotosSim * 2000 +        // romper ladrillos vale muchisimo
           rebotesEnBarra * 400 +         // rebotar la bola en la barra también pero no tanto
           ratioSupervivencia * 3000 -    // sobrevivir más tiempo suma bastante
           distNorm * 600 +               // estar lejos de la bola resta puntos
           maxBricksSeguidosSinTocarBarra * 500; // se compensa si rompe muchos ladrillos sin tocar la barra
}




//---------------------------------------
// 6. Operadores del algoritmo genetico
//--------------------------------------


//-----------------
// 6.1 Selección
//-----------------

// primero evaluamos toda la poblacion para asignar fitness a cada individuo
function evaluarPoblacion(poblacion) {
    for (let i = 0; i < poblacion.length; i++) {
        poblacion[i].fitness = simularIndividuo(poblacion[i].genes);
    }
}

// luego hacemos una seleccion por ruleta para elegir padres
function seleccionarPadre(poblacion) {
    let sumaFitness = 0;
    for (let i = 0; i < poblacion.length; i++) {
        sumaFitness += Math.max(0, poblacion[i].fitness);
    }

    if (sumaFitness <= 0) {
        const idxAzar = Math.floor(gaRandom() * poblacion.length);
        return poblacion[idxAzar];
    }

    let r = gaRandom() * sumaFitness;
    for (let i = 0; i < poblacion.length; i++) {
        r -= Math.max(0, poblacion[i].fitness);
        if (r <= 0) return poblacion[i];
    }
    return poblacion[poblacion.length - 1];
}

//----------------------------------
// 6.2 y 6.3 Cruzamiento y mutación
//---------------------------------
// cruzar dos padres para crear un hijo con mutacion
function cruzar(p1, p2) {
    const genesHijo = [];

    // cruce de un punto
    const punto = Math.floor(gaRandom() * NUM_GENES);

    for (let i = 0; i < NUM_GENES; i++) {
        const genBase = (i < punto) ? p1.genes[i] : p2.genes[i];
        let genNuevo = genBase;

        // mutacion gaussiana con probabilidad MutationRate
        if (gaRandom() < MutationRate) {
            genNuevo += gaussianaRandom() * 0.2; // ruido pequeno
            if (genNuevo > 1) genNuevo = 1;
            if (genNuevo < -1) genNuevo = -1;
        }

        genesHijo.push(genNuevo);
    }

    return { genes: genesHijo, fitness: 0 };
}


//-------------------------------
// 6.4 Crear nueva generación
//-------------------------------

function crearSiguienteGeneracion(poblacion) {
    // ordenar de mejor a peor
    poblacion.sort((a, b) => b.fitness - a.fitness);

    // porcentaje de elite tomado del parametro de interfaz
    const porcentajeElite = Math.max(1, selectionPercent);
    let numElite = Math.floor(populationSize * (porcentajeElite / 100));
    if (numElite < 1) numElite = 1;
    if (numElite > populationSize) numElite = populationSize;

    const nuevaPoblacion = [];

    // copiar la elite
    for (let i = 0; i < numElite; i++) {
        const original = poblacion[i];
        nuevaPoblacion.push({
            genes: original.genes.slice(),
            fitness: 0
        });
    }


    // rellenar el resto con hijos de cruce + mutacion
    while (nuevaPoblacion.length < populationSize) {
        const padre1 = seleccionarPadre(poblacion);
        const padre2 = seleccionarPadre(poblacion);
        const hijo = cruzar(padre1, padre2);
        nuevaPoblacion.push(hijo);
    }

    return nuevaPoblacion;
}



//--------------------------------------------
// 7. Bucle principal del algoritmo genetico
//------------------------------------------

// el orden seria: se leen los parametros desde la UI, se crea la poblacion inicial, 
// luego para cada generacion se evalua la poblacion, se ordena por fitness, se crea la siguiente generacion y se repite
// al final se guarda el mejor individuo encontrado

// Ejecuta todo el algoritmo genético y guarda el mejor individuo
function ejecutarAlgoritmoGenetico() {
    // Leemos parametros de la UI (N, G, % mutación, seed, etc.)
    leerParametrosDesdeUI();

    // Inicializamos la semilla del RNG (entero sin signo)
    GA_SEED = GA_SEED >>> 0; 
    gaSEED_inicial = GA_SEED;


    mejorFitnessHistorial = [];
    promedioFitnessHistorial = [];
    tiemposGeneracionHistorial = [];
    tiempoInicioGA = performance.now();
    tiempoFinalGA = tiempoInicioGA;

    // para llevar control de parametros en los logs
    console.log("Iniciando entrenamiento GA...");
    console.log(
        "[GA] Parametros: N =",
        populationSize,

        "G =",
        N_Generations,

        "MutationRate =",
        MutationRate,

        "Seed =",
        GA_SEED,

        "FPS sim =",
        GA_FPS,

        "Episodios/ind =",
        EpisodiosPorIndividuo,

        "%Sel =",
        selectionPercent,

        "%Cruce =",
        crossoverPercent
    ); 

    // crear poblacion inicial
    let poblacion = [];
    for (let i = 0; i < populationSize; i++) {
        poblacion.push(crearGenomaAleatorio());
    }

    // bucle principal del algoritmo genetico
    for (let g = 0; g < N_Generations; g++) {
        const tIniGen = performance.now();

        // evaluar poblacion
        evaluarPoblacion(poblacion);

        // ordenar por fitness y guardar estadisticas
        poblacion.sort((a, b) => b.fitness - a.fitness);


        const mejor = poblacion[0].fitness;
        let suma = 0;
        for (let i = 0; i < poblacion.length; i++) {
            suma += poblacion[i].fitness;
        }
        const promedio = suma / poblacion.length;

        mejorFitnessHistorial.push(mejor);
        promedioFitnessHistorial.push(promedio);

        const tFinGen = performance.now();
        tiemposGeneracionHistorial.push(tFinGen - tIniGen);

        console.log("Gen " + g + " – mejor fitness: " + mejor.toFixed(2) + " - promedio: " + promedio.toFixed(2));

        // crear nueva generacion (elitismo + cruza + mutacion)
        poblacion = crearSiguienteGeneracion(poblacion);
    }

    // Evaluamos una vez mas al final para asegurar fitness actualizado
    evaluarPoblacion(poblacion);
    poblacion.sort((a, b) => b.fitness - a.fitness);

    gaMejorGenoma = {
        genes: poblacion[0].genes.slice(),
        fitness: poblacion[0].fitness
    };
    gaEntrenado = true;

    tiempoFinalGA = performance.now();

    //Actualizamos metricas y grafico
    actualizarMetricasEnInterfaz();
    dibujarGraficoGA();

    // habilitamos botones de demo y descarga
    const btnMejorDemo = document.getElementById("btnMejorDemo");
    const btnDescargarDemo = document.getElementById("btnDescargarDemo");
    if (btnMejorDemo) btnMejorDemo.disabled = false;
    if (btnDescargarDemo) btnDescargarDemo.disabled = false;

    console.log("Entrenamiento GA finalizado. Mejor fitness:",gaMejorGenoma.fitness.toFixed(2));
}



//--------------------------------------------
// 8. Metricas, graficas y exportacion de datos
//---------------------------------------------


function actualizarMetricasEnInterfaz() {
    if (mejorFitnessHistorial.length === 0) return;

    const ultimoMejor = mejorFitnessHistorial[mejorFitnessHistorial.length - 1];
    const ultimoProm = promedioFitnessHistorial[promedioFitnessHistorial.length - 1];

    const tiempoTotalSeg = (tiempoFinalGA - tiempoInicioGA) / 1000;
    let tiempoPromGen = 0;
    if (tiemposGeneracionHistorial.length > 0) {
        let suma = 0;
        for (let i = 0; i < tiemposGeneracionHistorial.length; i++) {
            suma += tiemposGeneracionHistorial[i];
        }
        tiempoPromGen = suma / tiemposGeneracionHistorial.length;
    }

    const setText = (id, valor) => {
        const el = document.getElementById(id);
        if (el && !isNaN(valor)) {
            el.textContent = valor.toFixed(2);
        }
    };

    setText("etiquetaMejorFitness", ultimoMejor);
    setText("etiquetaFitnessPromedio", ultimoProm);

    const elTiempoTotal = document.getElementById("etiquetaTiempoTotal");
    if (elTiempoTotal) elTiempoTotal.textContent = tiempoTotalSeg.toFixed(2);

    const elTiempoGen = document.getElementById("etiquetaTiempoGen");
    if (elTiempoGen) elTiempoGen.textContent = tiempoPromGen.toFixed(2);
}


function dibujarGraficoGA() {
    const canvas = document.getElementById("TablaGA");
    if (!canvas || !mejorFitnessHistorial.length) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (mejorFitnessHistorial.length === 0) return;

    // encontrar rango de fitness
    let minF = Infinity;
    let maxF = -Infinity;
    for (let i = 0; i < mejorFitnessHistorial.length; i++) {
        const a = mejorFitnessHistorial[i];
        const b = promedioFitnessHistorial[i];
        if (a < minF) minF = a;
        if (b < minF) minF = b;
        if (a > maxF) maxF = a;
        if (b > maxF) maxF = b;
    }
    if (minF === Infinity || maxF === -Infinity) return;
    if (minF === maxF) {
        minF -= 1;
        maxF += 1;
    }

    const margenIzq = 40;
    const margenDer = 10;
    const margenSup = 10;
    const margenInf = 20;

    const anchoUtil = w - margenIzq - margenDer;
    const altoUtil = h - margenSup - margenInf;

    // grid horizontal
    ctx.strokeStyle = "#333";
    ctx.fillStyle = "#aaa";
    ctx.lineWidth = 1;
    const divisiones = 4;
    for (let i = 0; i <= divisiones; i++) {
        const t = i / divisiones;
        const y = margenSup + t * altoUtil;
        ctx.beginPath();
        ctx.moveTo(margenIzq, y);
        ctx.lineTo(w - margenDer, y);
        ctx.stroke();

        const valor = maxF - t * (maxF - minF);
        ctx.fillText(valor.toFixed(0), 5, y + 4);
    }

    // ejes
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margenIzq, margenSup);
    ctx.lineTo(margenIzq, margenSup + altoUtil);
    ctx.lineTo(w - margenDer, margenSup + altoUtil);
    ctx.stroke();

    // funciones auxiliares
    const totalGen = mejorFitnessHistorial.length;
    const xParaGen = (i) => {
        if (totalGen <= 1) return margenIzq;
        return margenIzq + (i / (totalGen - 1)) * anchoUtil;
    };
    const yParaFitness = (f) => {
        const t = (f - minF) / (maxF - minF);
        return margenSup + (1 - t) * altoUtil;
    };


    // linea del mejor fitness (verde)
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < totalGen; i++) {
        const x = xParaGen(i);
        const y = yParaFitness(mejorFitnessHistorial[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();



    // linea del promedio (naranja)
    ctx.strokeStyle = "#ffa500";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < totalGen; i++) {
        const x = xParaGen(i);
        const y = yParaFitness(promedioFitnessHistorial[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // leyenda
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(margenIzq, margenSup, 10, 4);
    ctx.fillStyle = "#eee";
    ctx.fillText("Mejor", margenIzq + 15, margenSup + 5);

    ctx.fillStyle = "#ffa500";
    ctx.fillRect(margenIzq + 60, margenSup, 10, 4);
    ctx.fillStyle = "#eee";
    ctx.fillText("Promedio", margenIzq + 75, margenSup + 5);
}

// exporta el mejor individuo y el historial a un JSON descargable
function exportBestJson() {
    if (!gaEntrenado || !gaMejorGenoma) {
        alert("Primero entrene el GA con 'Probar Algoritmo'.");
        return;
    }
    const data = {
        game: "Arkanoid-GA",
        representation: "vector_pesos_lineal",
        num_genes: NUM_GENES,
        genes: gaMejorGenoma.genes,
        fitness: gaMejorGenoma.fitness,
        ga_params: {
            populationSize: populationSize,
            generations: N_Generations,
            mutationRate: MutationRate,
            selectionPercent: selectionPercent,
            crossoverPercent: crossoverPercent,
            mutationPercent: mutationPercentUI,
            fpsSim: GA_FPS,
            episodesPerIndividual: EpisodiosPorIndividuo,
            seedInicial: gaSEED_inicial >>> 0,
            seedFinal: GA_SEED >>> 0
        },
        fitness_history: {
            best: mejorFitnessHistorial,
            avg: promedioFitnessHistorial
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "best.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}



//-----------------------------------
// 9. Botones e interfaz de usuario
//-----------------------------------

// aqui definimos la politica greedy baseline para comparar con el GA
// y los botones para probar el algoritmo genetico en el juego real
// en este caso el boton de probar algoritmo inicia el entrenamiento del GA
// probar greedy ejecuta la politica greedy en el juego real y mide lo que es la base de comparacion (baseline heuristica)
// mejor demo ejecuta el mejor individuo entrenado en el juego real
// y por ultimo descargar demo descarga el mejor individuo entrenado en un JSON

// politica greedy baseline: mover barra hacia la bola
function politicaGreedy(ent) {
    const barraCentro = ent.barra.x + ent.barra.width / 2;
    const objetivoX = ent.bola.x;
    const margen = 5; // margen de tolerancia en pixeles

    if (objetivoX < barraCentro - margen) return -1; // mover izquierda
    if (objetivoX > barraCentro + margen) return 1;  // mover derecha
    return 0;                                       // sin moverse
}

function politicaGA(individuo, ent) {
    const features = obtenerFeaturesDesdeEntorno(ent);
    return decidirAccion(individuo.genes, features);
}

// evalua una politica (greedy o GA) en varios episodios y devuelve estadisticas
function evaluarPolitica(politicaFn, genesOpcionales = null, episodios = 5) {
    let sumaFitness = 0;
    let sumaBricks = 0;
    let sumaRebotes = 0;
    let sumaSuperv = 0;
    let sumaDist = 0;
    let sumaCombo = 0;

    const numEp = Math.max(1, episodios);

    for (let ep = 0; ep < numEp; ep++) {
        const ent = crearEntornoSimulado();

        let pasos = 0;
        let bricksRotosSim = 0;
        let rebotesEnBarra = 0;
        let sumaDistanciaX = 0;
        let vivo = true;

        let bricksSeguidosSinBarra = 0;
        let maxBricksSeguidosSinBarra = 0;

        while (pasos < Max_steps && vivo) {
            // accion segun la politica
            const accion = genesOpcionales
                ? politicaFn(genesOpcionales, ent)
                : politicaFn(ent);

            // mover barra
            ent.barra.x += accion * ent.barra.speed * DT_SIM;
            if (ent.barra.x < 0) ent.barra.x = 0;
            if (ent.barra.x + ent.barra.width > canvas.width) {
                ent.barra.x = canvas.width - ent.barra.width;
            }

            // distancia en X barra-bola
            const barraCentro = ent.barra.x + ent.barra.width / 2;
            const distX = Math.abs(ent.bola.x - barraCentro);
            sumaDistanciaX += distX;

            // mover bola
            ent.bola.x += ent.bola.vx * DT_SIM;
            ent.bola.y += ent.bola.vy * DT_SIM;

            // paredes / techo
            if (ent.bola.x - ent.bola.radius < 0) {
                ent.bola.x = ent.bola.radius;
                ent.bola.vx *= -1;
            } else if (ent.bola.x + ent.bola.radius > canvas.width) {
                ent.bola.x = canvas.width - ent.bola.radius;
                ent.bola.vx *= -1;
            }

            if (ent.bola.y - ent.bola.radius < 0) {
                ent.bola.y = ent.bola.radius;
                ent.bola.vy *= -1;
            }

            // fondo
            if (ent.bola.y - ent.bola.radius > canvas.height) {
                vivo = false;
            }

            // barra
            if (circleIntersectsRect(ent.bola, ent.barra)) {
                ent.bola.y = ent.barra.y - ent.bola.radius;
                ent.bola.vy *= -1;

                const hitPos =
                    (ent.bola.x - (ent.barra.x + ent.barra.width / 2)) /
                    (ent.barra.width / 2);
                ent.bola.vx = hitPos * ent.bola.speed;

                rebotesEnBarra++;
                bricksSeguidosSinBarra = 0; // se corta el combo
            }

            // ladrillos
            for (const brick of ent.bricks) {
                if (!brick.alive) continue;
                if (circleIntersectsRect(ent.bola, brick)) {
                    brick.alive = false;
                    bricksRotosSim++;
                    ent.bola.vy *= -1;

                    bricksSeguidosSinBarra++;
                    if (bricksSeguidosSinBarra > maxBricksSeguidosSinBarra) {
                        maxBricksSeguidosSinBarra = bricksSeguidosSinBarra;
                    }

                    break;
                }
            }

            // si no queda ningun ladrillo, se termina el episodio
            if (ent.bricks.every(b => !b.alive)) {
                vivo = false;
            }

            pasos++;
        }

        const pasosAlcanzados = Math.max(1, pasos);
        const distProm = sumaDistanciaX / pasosAlcanzados;
        const ratioSuperv = pasosAlcanzados / Max_steps;
        const distNorm = distProm / canvas.width;

        const fitnessEp = calcularFitnessDesdeEstadistcias(
            bricksRotosSim,
            rebotesEnBarra,
            ratioSuperv,
            distNorm,
            maxBricksSeguidosSinBarra
        );

        sumaFitness += fitnessEp;
        sumaBricks += bricksRotosSim;
        sumaRebotes += rebotesEnBarra;
        sumaSuperv += ratioSuperv;
        sumaDist += distNorm;
        sumaCombo += maxBricksSeguidosSinBarra;
    }

    return {
        fitnessProm: sumaFitness / numEp,
        bricksProm: sumaBricks / numEp,
        rebotesProm: sumaRebotes / numEp,
        supervProm: sumaSuperv / numEp,
        distProm: sumaDist / numEp,
        comboProm: sumaCombo / numEp
    };
}

function mostrarResultadosAgente(prefijo, resultados) {
    const setText = (id, valor) => {
        const el = document.getElementById(id);
        if (el && !isNaN(valor)) {
            el.textContent = valor.toFixed(2);
        }
    };

    setText(prefijo + "Fitness", resultados.fitnessProm);
    setText(prefijo + "Bricks", resultados.bricksProm);
    setText(prefijo + "Rebotes", resultados.rebotesProm);
    setText(prefijo + "Superv", resultados.supervProm);
    setText(prefijo + "Dist", resultados.distProm);

    const comboEl = document.getElementById(prefijo + "Combo");
    if (comboEl && !isNaN(resultados.comboProm)) {
        comboEl.textContent = resultados.comboProm.toFixed(2);
    }
}

// referencias a botones
const btnGA = document.getElementById("btnProbarAlgoritmo");
const btnProbarGreedy = document.getElementById("btnProbarGreedy");
const btnMejorDemo = document.getElementById("btnMejorDemo");
const btnDescargarDemo = document.getElementById("btnDescargarDemo");

// alias para que validarPorcentajes pueda usarlos
const btnGreedy = btnProbarGreedy;
const btnDemo = btnMejorDemo;
const btnDesc = btnDescargarDemo;

// Probar Algoritmo: entrena el GA (offline en el simulador)
if (btnGA) {
    btnGA.addEventListener("click", () => {
        console.log("Click en Probar Algoritmo (entrenando GA)...");
        ejecutarAlgoritmoGenetico();
    });
} else {
    console.warn("No se encontro #btnProbarAlgoritmo en el DOM");
}

// Probar Greedy: evalua la heuristica baseline y actualiza panel izquierdo
if (btnProbarGreedy) {
    btnProbarGreedy.addEventListener("click", () => {
        const resGreedy = evaluarPolitica(politicaGreedy, null, 5);
        mostrarResultadosAgente("greedy", resGreedy);
    });
}

// Mejor Demo: usa el mejor individuo del GA y lanza la demo
if (btnMejorDemo) {
    btnMejorDemo.addEventListener("click", () => {
        if (!gaEntrenado || !gaMejorGenoma) {
            alert("Primero entrene el GA con 'Probar Algoritmo'.");
            return;
        }

        // calculamos estadisticas del mejor individuo
        const resGA = evaluarPolitica(politicaGA, gaMejorGenoma, 5);
        mostrarResultadosAgente("ga", resGA);

        // Reiniciamos el juego y dejamos que el GA controle la barra
        resetGame();
        modoGA = true;
        gameRunning = true;
    });
}

// Descargar Demo: guarda best.json con el mejor individuo y el historial
if (btnDescargarDemo) {
    btnDescargarDemo.addEventListener("click", exportBestJson);
}

// inicializamos la validacion de porcentajes una vez que ya existen los botones
initPorcentajes();
