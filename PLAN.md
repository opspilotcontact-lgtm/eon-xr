# Eón · plan del juego (nombre provisional)

> Tenés el planeta en tu mesa. Lo empujás un poquito y la historia de la vida entera toma otro camino.

Juego de dios en **realidad mixta** (Quest 3S, WebXR) donde la mecánica central es **el tiempo**. Un minimundo sobre la mesa real va del nacimiento de la Tierra (en F2, del Big Bang) a la vida, los dinosaurios, las civilizaciones y futuros alternativos. Girás el sol para que pasen los años, parás en cualquier época y metés cambios que parecen chicos pero no lo son.

- **Si no tocás nada**, sale la historia real (modo canon).
- **Si tocás algo**, el **medidor de divergencia** dice cuánto te alejaste de nuestra realidad.

Género de simulador de planeta y juego de dios, pero **original**: nombre, estilo y tono propios. No se copia ningún juego existente.

---

## 1. La idea que lo sostiene todo

La «probabilidad infinita» no se programa, se **finge** con tres capas:

1. **Simulación**: pocas variables por región (temperatura, humedad, hielo, vida…) más unas globales (mar, oxígeno, magma).
2. **Interpretación**: reglas que convierten esas variables en hechos (desiertos, glaciaciones, especies, imperios, colapsos).
3. **Representación**: todo combinatorio. Texturas pintadas desde la simulación, criaturas hechas de piezas y ciudades de módulos.

Además, **dos mundos corren a la vez**: el del jugador y una **sombra canónica** con la misma semilla y sin intervenciones. La divergencia es la distancia entre los dos. Así se puede decir «la vida va un 40 % por debajo de la historia real» sin escribir a mano cada historia alternativa.

**Histéresis = cambios que se quedan.** El hielo enfría su propia región y el bosque genera su propia lluvia. Una helada fuerte puede dejar un casquete que ya no se va, y una sequía puede dejar un desierto permanente. Pequeña causa, consecuencia que dura.

## 2. Interacción en realidad mixta

- **Arranque** (F2): un punto de luz en la habitación. Lo tocás, el Big Bang llena tu cuarto y se condensa en un planeta sobre tu mesa real (plane-detection).
- **Girar el sol = el tiempo.** Lo agarrás y lo hacés orbitar: cuanto más rápido, más años pasan. Sujetarlo quieto es pausa. El sentido da igual, el tiempo solo avanza (rebobinar llega en F4 con ramas).
- **Poderes**: orbes flotando delante del planeta. Pellizcás uno, queda en tu mano y pellizcás apuntando al planeta para soltarlo ahí.
- **Mover y escalar el mundo**: agarre con una mano (mover y girar) o con dos (escalar), como la maqueta de Cocina XR.
- **Acercarse**: te inclinás de verdad para ver la superficie de cerca.
- **Rótulo flotante** sobre el planeta: era, «hace 66 millones de años», divergencia y último suceso.

## 3. El reloj

Son 4.500 millones de años en unos 14 minutos a ritmo normal. El tiempo es **logarítmico por tramos**: cada era recibe un trozo de partida parecido aunque dure mil veces menos.

| p (avance) | Momento |
|---|---|
| 0,00 | Nace la Tierra (4.500 Ma) |
| 0,10 | Gran Oxidación (2.400 Ma) |
| 0,18 | Explosión cámbrica (540 Ma) |
| 0,32 | Asteroide de los dinosaurios (66 Ma) |
| 0,45 | Homo sapiens (300.000 años) |
| 0,60 | Fin del Paleolítico (12.000 años) |
| 0,80 | Edad Media (500 años) |
| 1,00 | Hoy |

Al cruzar un **hito**, el sol frena solo para que no te lo pierdas. Las anclas están en `js/sim/canon.js` y son lo primero que se ajusta si el ritmo no convence.

## 4. Modelo del mundo

**Planeta** (F0): una rejilla de 64×32 celdas con temperatura, humedad, vida en tierra e hielo, más mar, magma, oxígeno y vida marina como valores globales. La historia real entra como **forzamiento**: curvas de temperatura global (glaciación huroniana, Tierra bola de nieve, calor del Pérmico, ciclos glaciares…), la aparición de océanos, la Gran Oxidación, las plantas en tierra y las extinciones.

**Especies** (F1): un genoma, no modelos sueltos.
```
especie = { medio, tamaño, dieta, cuerpo, patas, aletas, alas, piel, inteligencia,
            tolerancia: { frío, calor, sequía }, población por región }
```
Mutan poco a poco y la presión ambiental filtra quién sobrevive. Si una costa se seca, ganan las variantes con patas. Un súper-depredador temprano puede impedir que llegue la inteligencia.

**Civilizaciones** (F3):
```
civilización = { tecnología, población, cohesión, agresividad, ética, recursos, fe }
```
Un regalo anacrónico (bomba atómica a Roma) dispara la tecnología, pero la ética y la cohesión quedan atrás. **El desfase entre poder y madurez genera la historia**: puede salir un imperio mundial, una guerra civil nuclear o una Edad Oscura radiactiva, según la semilla.

## 5. Poderes

| Cuándo | Poderes |
|---|---|
| Siempre (F0) | Sequía, diluvio, helada, sol abrasador |
| F1 | Volcán, terremoto, tornado, meteorito, plaga, chispa de vida, depredador, mutación forzada |
| F2 | Más estrellas, cambiar la órbita, otra luna |
| F3 | Fuego antes de tiempo, segunda especie inteligente; regalos anacrónicos (pólvora, imprenta, electricidad, antibióticos, internet, bomba atómica); matar o salvar a un líder, peste, religión nueva |
| F4 | IA, colonias, terraformación |

Los poderes nuevos se **desbloquean** viendo hitos y llegando a finales distintos.

## 6. Finales (F4)

Salen de qué variable dominó la partida, no se escriben uno a uno:

- Planeta de hielo
- Mundo océano
- Reptiles sapientes
- Imperio eterno
- Ceniza (la vida reinicia desde los insectos)
- Jardín de máquinas
- Silencio (nunca pasó de bacterias)
- Nuestra realidad

Al terminar se muestra una **crónica generada**, la línea de tiempo con tus intervenciones, el % de divergencia y la **semilla** para compartir la partida.

## 7. Arquitectura

Mismo stack que Cocina XR y Apocalipsis: three.js 0.170 por importmap, sin build.

```
index.html          interfaz de escritorio + importmap
js/app.js           escena, bucle, ratón, cableado con el worker
js/tiempo.js        el reloj: el sol orbita y su velocidad es la del tiempo
js/xr.js            sesión RM/RV, mandos y manos, colocar en la mesa, agarrar sol y mundo
js/hud.js           interfaz HTML de escritorio
js/poderes.js       definición de poderes (compartida con la simulación)
js/emulador.js      IWER (?emular) para probar RM en el PC
js/sim/             ← NO conoce three.js: pura, determinista, en un Web Worker
  canon.js          reloj logarítmico, forzamiento real, eras, hitos, extinciones
  ruido.js          ruido con semilla
  mundo.js          geografía, simulación por celdas, pintado de texturas, divergencia
  worker.js         jugador + sombra canónica, mensajes, consecuencias
js/vista/           planeta (relieve por shader), sol, rótulo, paleta de orbes
```

**Regla de oro: la simulación no sabe que existe three.js.** Recibe intervenciones y devuelve estado y texturas ya pintadas. Así se puede probar, acelerar y (en F4) rebobinar sin tocar el render.

**Rendimiento en Quest 3S**: planeta de 256×128 segmentos con relieve en el vertex shader (`max(elevación, mar)`), textura de color de 512×256 pintada en el worker a unos 6 Hz, nubes y atmósfera en dos esferas y simulación de 2 × 2.048 celdas por paso. Las criaturas (F1) irán con InstancedMesh y LOD.

## 8. Fases con puerta de calidad

### F0 · La prueba en las gafas ← EN CURSO
**Objetivo**: comprobar que girar el sol sobre tu mesa y ver cambiar el planeta da gusto.

- [x] Planeta procedural con semilla (`?semilla=123`): continentes, relieve, nubes y atmósfera.
- [x] Línea real desde el océano de magma hasta hoy: océanos que se llenan, cielo naranja → azul con la Gran Oxidación, Tierra bola de nieve, plantas en tierra, extinciones y ciclos glaciares.
- [x] Sol que orbita y es el control del tiempo (arrastrar en el PC, agarrar en las gafas) con frenada en los hitos.
- [x] 4 poderes de clima con marca en el planeta y efecto mientras pasa el tiempo.
- [x] Sombra canónica, divergencia y mensajes de consecuencia.
- [x] RM con mesa detectada, agarre y escala del mundo, orbes de poder y rótulo flotante. RV con estrellas.
- [x] **Panel «Datos del mundo»** (escritorio y flotante en las gafas), siempre con «tu mundo vs. historia real»:
  - Tiempo: años desde el inicio, «hace…» y año del calendario.
  - Planeta: temperatura media, % de hielo, nivel del mar, oxígeno del aire y duración del día (la Luna frena la Tierra: 6 h → 24 h).
  - Vida: forma dominante de la época, especies estimadas y % de tierra verde.
  - Sociedad: población humana estimada y época histórica. En F0 se escala desde la curva real; en F3 la calculan las civilizaciones.
  - Una curiosidad que cambia con la era.
- [ ] **Probar en la Quest 3S** (sin probar todavía: todo `xr.js`).

**Puerta F0**:
1. En las gafas va fluido, sin tirones visibles.
2. Girar el sol se entiende sin explicación.
3. Una helada o sequía bien puesta deja una huella que se ve 50 millones de años después.

### F1 · La vida
Genoma de especies, criaturas por piezas visibles con la lupa, salida del agua y patas, depredadores y poderes de catástrofe. **Puerta**: dos partidas con cambios distintos se ven DISTINTAS.

### F2 · Big Bang en la habitación + canon real
Arranque cósmico que llena el cuarto y continentes reales al llegar a hoy (deriva continental simplificada). **Puerta**: el modo «no toco nada» enseña algo de verdad.

### F3 · Civilizaciones
Homínidos → imperios, regalos anacrónicos y Roma nuclear. **Puerta**: el regalo anacrónico produce tres historias distintas con tres semillas.

### F4 · Finales, crónica, semillas y ramas
Rebobinar con instantáneas, ramas de la línea de tiempo, finales y crónica compartible.

### F5 · Pulido
Sonido espacial, narración, desbloqueos y accesibilidad.

## 9. Cómo probar

```
python servir_lan.py --local    → http://127.0.0.1:18745        (PC, sin caché)
python servir_lan.py            → https://<IP-del-PC>:18744     (Quest: aceptar el aviso del certificado)
?emular                         → emulador de gafas IWER en el PC (planos y mesas sintéticos)
?semilla=123                    → misma semilla = mismo planeta
```

En el PC:
- Arrastrá el sol para pasar el tiempo (o usá ×1/×3/×8).
- Elegí un poder abajo y hacé clic en el planeta. Esc lo suelta.
- Rueda del ratón para el zoom y arrastrar fuera del sol para girar la vista.

En las gafas (RM):
- El planeta busca tu mesa durante unos segundos; si no la encuentra, queda delante de ti.
- Pellizcá el sol para agarrarlo y movelo alrededor del planeta.
- Pellizcá un orbe, apuntá al planeta y volvé a pellizcar.
- Pellizcar en vacío (o el botón lateral del mando) agarra el mundo; con las dos manos se escala.

## 10. Decisiones y alternativas

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| Tiempo logarítmico por tramos | En tiempo lineal el 99 % de la partida serían rocas enfriándose | Lineal con saltos: rompe la sensación de continuidad |
| Rejilla lat-lon de 64×32 | Simple, encaja con la textura equirectangular y basta para clima | Icosaedro geodésico: celdas iguales pero más código; valorar en F1 si los polos molestan |
| Relieve en shader con `max(e, mar)` | El mar sube y baja sin reconstruir la malla | Dos esferas (tierra + océano): más simple, pero el hielo marino y la costa quedan peor |
| Sim en worker y pintado allí | El hilo principal solo sube texturas: frames estables en la Quest | Pintar en GPU con shader: más rápido, pero acopla la sim al render; quizá en F5 |
| Continentes procedurales | Cada partida es distinta y el canon no depende de datos externos | Mapa real: se reserva para «hoy» en F2 |
| Sombra canónica en paralelo | La divergencia y las consecuencias salen gratis y deterministas | Comparar con tablas fijas: no reacciona a la geografía de cada semilla |
