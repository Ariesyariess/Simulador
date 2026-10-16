# REGLAS DE TRÁNSITO — Simulador de Conducción Uruguay
## Fuente: Guía Nacional de Conducción (UNASEV) — Ley 18191 / RNCV

> Cada regla tiene: **ID de comando**, descripción clara, fuente legal y parámetros
> para implementar en `ScoringSystem.js` o módulos relacionados del simulador PPDM.

---

## CATEGORÍA 1 — Cartelería y Semáforos

### RULE_01 — Luz Roja: Detención Obligatoria
**Fuente:** Ley 18191, Art. 36 (A)
**Descripción:** La luz roja continua indica detención obligatoria para todo vehículo que la enfrente. Debe detenerse antes de la línea de detención o antes de entrar al cruce.
```
trigger: vehicle_in_intersection && traffic_light === 'RED'
condition: speed > 0.5 km/h
penalty: -20 pts | message: "Cruzó semáforo en rojo"
```

---

### RULE_02 — Luz Amarilla: Preparar Detención, No Acelerar
**Fuente:** Ley 18191, Art. 36 (C)
**Descripción:** La luz amarilla continua advierte que debe detenerse, a menos que esté tan cerca que frenar resulte peligroso. Está prohibido acelerar para pasar con amarillo.
```
trigger: vehicle_approaching_intersection && traffic_light === 'YELLOW'
condition: speed_increasing === true && distance_to_stop_line > 10m
penalty: -10 pts | message: "Aceleró en semáforo amarillo"
```

---

### RULE_03 — Luz Amarilla Intermitente: Precaución Máxima
**Fuente:** Ley 18191, Art. 36 (D)
**Descripción:** La luz amarilla intermitente (baliza) indica que se puede continuar pero con extrema precaución. No hay derecho de paso garantizado.
```
trigger: traffic_light === 'FLASH_YELLOW'
condition: speed > CITY_SPEED_LIMIT
penalty: -5 pts | message: "Exceso de velocidad en zona de precaución"
```

---

### RULE_04 — Luz Roja Intermitente: Equivale a Señal PARE
**Fuente:** Ley 18191, Art. 36 (B)
**Descripción:** La luz roja intermitente obliga a detenerse completamente y luego continuar solo si el camino está libre, igual que ante una señal de PARE.
```
trigger: traffic_light === 'FLASH_RED'
condition: speed > 0 km/h (no full stop before crossing)
penalty: -15 pts | message: "No se detuvo ante rojo intermitente"
```

---

### RULE_05 — Flecha Verde: Solo en Dirección Indicada
**Fuente:** Ley 18191, Art. 36 (F)
**Descripción:** Cuando hay luz roja con flecha verde, solo se puede ingresar al cruce para seguir en la dirección que indica la flecha, con precaución.
```
trigger: traffic_light === 'RED_GREEN_ARROW'
condition: vehicle_turning_direction !== arrow_direction
penalty: -10 pts | message: "Maniobra prohibida con flecha direccional"
```

---

### RULE_06 — Señal PARE (R1): Detención Total a 0 km/h
**Fuente:** Ley 18191 / RNCV — Señal Reglamentaria R1
**Descripción:** Ante el signo octogonal rojo de PARE el conductor debe detener el vehículo completamente (0 km/h) antes de la línea y ceder el paso.
```
trigger: vehicle_in_stop_zone
condition: min_speed_reached < 1 km/h === false (never fully stopped)
penalty: -15 pts | message: "No se detuvo ante señal de PARE"
reward: +5 pts si speed === 0 antes de cruzar | message: "Buen cumplimiento del PARE"
```

---

### RULE_07 — Señal CEDA EL PASO (R2): Reducir y Ceder
**Fuente:** Ley 18191 / RNCV — Señal Reglamentaria R2
**Descripción:** Ante el triángulo invertido rojo/blanco, el conductor debe reducir la velocidad y ceder el paso a los vehículos con preferencia. No necesita detenerse si el camino está libre.
```
trigger: vehicle_in_yield_zone
condition: speed > 20 km/h
penalty: -10 pts | message: "No respetó señal de Ceda el Paso"
```

---

### RULE_08 — Señal de Velocidad Máxima: Límite Dinámico
**Fuente:** RNCV — Señal Reglamentaria R28
**Descripción:** Las señales circulares con número indican la velocidad máxima permitida en ese tramo. El límite varía según zona (30, 45, 60, 75 km/h).
```
trigger: vehicle_in_speed_zone
condition: speed > zone.limit
penalty: -5 pts / cada 2 segundos | message: "Exceso de velocidad (Límite: ${zone.limit} km/h)"
```

---

### RULE_09 — Línea Central Continua: Prohibido Adelantar
**Fuente:** RNCV — Señales Horizontales
**Descripción:** La línea central continua divide carriles opuestos y prohíbe la maniobra de adelantamiento. Solo se permite cruzarla para girar a la izquierda si no hay tráfico.
```
trigger: vehicle_crosses_center_line && line_type === 'CONTINUOUS'
condition: not_turning_left === true
penalty: -15 pts | message: "Cruzó línea central continua"
```

---

### RULE_10 — Semáforos Apagados: Preferencia por la Derecha
**Fuente:** Guía Nacional, pág. 108
**Descripción:** Cuando los semáforos están apagados, la intersección se trata como no regulada y la preferencia la tiene el vehículo que viene por la derecha.
```
trigger: traffic_system.lightsOff === true
condition: vehicle_enters_intersection && vehicle_from_right_present
action: aplicar RULE_11 (preferencia derecha) en lugar de semáforo
```

---

## CATEGORÍA 2 — Preferencias de Paso

### RULE_11 — Cruce No Señalizado: Preferencia por la Derecha
**Fuente:** Ley 18191, Art. (numeral 3)
**Descripción:** En intersecciones no señalizadas, cuando dos vehículos llegan desde calles diferentes, el conductor que ve a otro aproximarse por su derecha debe ceder el paso.
```
trigger: vehicle_in_unsignalized_intersection
condition: npc_vehicle_approaching_from_right === true && vehicle_did_not_yield
penalty: -10 pts | message: "No cedió el paso a vehículo por la derecha"
```

---

### RULE_12 — Ingreso/Egreso de la Vía Pública: Siempre Ceder
**Fuente:** Ley 18191, Art. (numeral 5)
**Descripción:** El conductor que ingresa a la vía pública desde un garaje, predio o acceso lateral debe dar preferencia absoluta a todos los usuarios de esa vía.
```
trigger: vehicle_exiting_garage_or_side_road
condition: speed > 5 km/h al ingresar sin verificar
penalty: -10 pts | message: "No cedió paso al salir a la vía"
```

---

### RULE_13 — Cambio de Dirección: Ceder a Todos
**Fuente:** Ley 18191, Art. (numeral 6)
**Descripción:** El conductor que cambia de dirección o de sentido de marcha (girar, dar vuelta en U) debe dar preferencia de paso a todos los demás usuarios.
```
trigger: vehicle.turning === true
condition: oncoming_vehicle_present && speed_not_reduced
penalty: -8 pts | message: "No cedió paso al girar"
```

---

### RULE_14 — Peatón en Cebra: Preferencia Absoluta
**Fuente:** Ley 18191, Art. (numeral 7)
**Descripción:** Todo conductor debe ceder el paso a los peatones en los pasos reglamentarios (cebras) y esquinas. El peatón siempre tiene prioridad en estos cruces.
```
trigger: pedestrian_in_crosswalk
condition: vehicle_speed > 3 km/h && vehicle_in_crosswalk_area
penalty: GAME_OVER | message: "Atropellaste a un peatón en la cebra"
```

---

### RULE_15 — Vehículo de Emergencia: Ceder Inmediatamente
**Fuente:** Ley 18191, Art. (numeral 8)
**Descripción:** Los vehículos deben dar preferencia de paso a los de emergencia (ambulancias, bomberos, policía) cuando emiten sirenas y luces.
```
trigger: emergency_vehicle_nearby && siren_active
condition: player_does_not_slow_or_yield
penalty: -20 pts | message: "No cedió paso a vehículo de emergencia"
```

---

### RULE_16 — Rotonda: Preferencia del Vehículo que Circula Dentro
**Fuente:** Guía Nacional, sección Generalidades / RNCV
**Descripción:** En rotondas, la circulación se hace por la derecha dejando el obstáculo central a la izquierda. Tiene preferencia el vehículo que ya está circulando dentro de la rotonda.
```
trigger: vehicle_entering_roundabout
condition: vehicle_inside_roundabout_present && speed > 15 km/h
penalty: -10 pts | message: "No cedió paso en rotonda"
```

---

### RULE_17 — Giro a la Izquierda: Ceder a Tráfico de Frente
**Fuente:** Guía Nacional — Maniobras Generales
**Descripción:** Al girar a la izquierda, el conductor debe ceder el paso a los vehículos que circulan de frente y a los peatones que pudieran cruzar.
```
trigger: vehicle_turning_left
condition: oncoming_traffic_present
penalty: -8 pts | message: "No cedió paso al girar a la izquierda"
```

---

### RULE_18 — Jerarquía: Inspector > Semáforo > Señal > Regla General
**Fuente:** Ley 18191, Art. 39
**Descripción:** Las indicaciones de los agentes (inspectores) de tránsito prevalecen sobre los semáforos. Los semáforos prevalecen sobre las demás señales y reglas.
```
trigger: inspector_in_range && inspector.state === 'STOP'
condition: vehicle_speed > 5 km/h
penalty: -25 pts | message: "No respetó orden del Inspector"
action: inspector signals override all other traffic rules
```

---

### RULE_19 — Obstáculo en Carril: Ceder al Tráfico Opuesto
**Fuente:** Guía Nacional — Maniobras Generales
**Descripción:** Si hay un obstáculo que obliga a invadir el carril contrario para esquivarlo, se debe ceder el paso al tráfico opuesto antes de realizar la maniobra.
```
trigger: vehicle_crosses_center_line && obstacle_in_lane
condition: oncoming_traffic_present
penalty: -12 pts | message: "Maniobra peligrosa esquivando obstáculo"
```

---

### RULE_20 — No Avanzar si se Obstruye el Área de Cruce
**Fuente:** Ley 18191, Art. (numeral 9)
**Descripción:** Aunque el semáforo esté en verde, está prohibido avanzar hacia una intersección si existe posibilidad de quedar bloqueado dentro del área de cruzamiento.
```
trigger: vehicle_entering_intersection
condition: intersection_blocked_by_npc === true
penalty: -10 pts | message: "Bloqueó el área de intersección"
```

---

## CATEGORÍA 3 — Velocidades y Distancias Seguras

### RULE_21 — Velocidad Máxima en Zona Urbana: 45 km/h
**Fuente:** Guía Nacional, pág. 90 / Ley 18191, Art. 15
**Descripción:** La velocidad máxima de circulación en zona urbana es de 45 km/h, salvo que una señal específica indique otro límite (mayor o menor).
```
trigger: vehicle_on_urban_road && no_speed_zone_override
condition: speed > 45 km/h
penalty: -5 pts / cada 2 segundos | message: "Exceso de velocidad en zona urbana (Máx: 45 km/h)"
```

---

### RULE_22 — Zona Escolar: Máximo 30 km/h
**Fuente:** Guía Nacional / RNCV — Zona Escolar
**Descripción:** En las proximidades de escuelas, liceos y centros educativos, la velocidad máxima se reduce a 30 km/h. La señal "ZONA ESCOLAR" tiene carácter imperativo.
```
trigger: vehicle_in_school_zone
condition: speed > 30 km/h
penalty: -5 pts / cada 2 segundos | message: "Exceso de velocidad en Zona Escolar (Máx: 30 km/h)"
```

---

### RULE_23 — Distancia de Seguridad: Regla de los 3 Segundos
**Fuente:** Guía Nacional, pág. 112 — "Distancia Prudencial"
**Descripción:** Mantener una distancia equivalente a 3 segundos respecto al vehículo precedente. En condiciones adversas (lluvia, noche) aumentar a 4 o más segundos.
```
trigger: npc_vehicle_ahead && distance < (npc_speed * 3)
condition: player_speed > 20 km/h
penalty: -3 pts | message: "Distancia de seguimiento insuficiente"
// distancia_minima_metros = velocidad_m_s * 3
```

---

### RULE_24 — Velocidad Compatible con las Circunstancias
**Fuente:** Ley 18191, Art. 15, Inc. 1
**Descripción:** La velocidad debe ser compatible con el estado del terreno, la vía, el vehículo, la carga, las condiciones meteorológicas y el volumen de tráfico.
```
trigger: always
condition: speed > currentLimit (dinámico por zona)
penalty: aplicar RULE_08 con límite dinámico según zona activa
```

---

### RULE_25 — Velocidad Mínima: No Entorpecer el Tráfico
**Fuente:** Guía Nacional, pág. 90
**Descripción:** Los vehículos que circulan a baja velocidad deben hacerlo lo más próximo posible a la derecha, permitiendo que los más veloces circulen al centro.
```
trigger: vehicle_speed < 10 km/h && vehicle_in_traffic_lane
condition: vehicles_behind_queuing === true
penalty: -3 pts | message: "Circulación a velocidad excesivamente baja"
```

---

### RULE_26 — Circular por el Carril Derecho
**Fuente:** Guía Nacional — Carriles de Circulación
**Descripción:** Debe circularse por los carriles situados a la derecha de la calzada. El carril izquierdo se usa exclusivamente para adelantamientos.
```
trigger: vehicle_in_left_lane && no_overtaking_in_progress
condition: oncoming_vehicle_present && sustained_time > 5s
penalty: -10 pts | message: "Circulación incorrecta por carril izquierdo"
```

---

### RULE_27 — Señalero Obligatorio Antes de Girar o Cambiar Carril
**Fuente:** Guía Nacional — Maniobras / Señales del Vehículo
**Descripción:** Es obligatorio usar las luces de giro (señaleros) para indicar toda maniobra con suficiente anticipación.
```
trigger: vehicle_turning || vehicle_changing_lane
condition: signal_not_active (keys.signalLeft || keys.signalRight === false)
penalty: -2 pts | message: "Maniobra sin señalero"
```

---

### RULE_28 — No Adelantar en Intersecciones ni en Cebras
**Fuente:** Guía Nacional — Adelantamientos / RNCV
**Descripción:** Está prohibido adelantar en intersecciones, en puentes, túneles o a un vehículo detenido momentáneamente en un cruce peatonal.
```
trigger: vehicle_overtaking && vehicle_position_in_intersection
condition: true
penalty: -15 pts | message: "Adelantamiento prohibido en intersección"
```

---

### RULE_29 — No Aumentar Velocidad al ser Adelantado
**Fuente:** Guía Nacional — Adelantamientos
**Descripción:** Cuando un vehículo lo está adelantando, no debe aumentar su velocidad hasta que el otro haya finalizado la maniobra.
```
trigger: npc_overtaking_player
condition: player_speed_increasing_during_overtake
penalty: -5 pts | message: "No facilitar el adelantamiento"
```

---

### RULE_30 — Estacionamiento Prohibido a Menos de 10m de Señal PARE
**Fuente:** Guía Nacional — Estacionamiento / RNCV
**Descripción:** Está terminantemente prohibido estacionar a menos de 10 metros antes de señal de PARE, CEDA, ni en cebras, curvas, paradas de ómnibus o frente a garajes.
```
trigger: vehicle_speed === 0 && duration > 5s
condition: distance_to_stop_sign < 10m || vehicle_on_crosswalk
penalty: -8 pts | message: "Estacionamiento en lugar prohibido"
```

---

## CATEGORÍA 4 — Autoridades, Señas de Inspectores y Situaciones Extraordinarias

### RULE_31 — Inspector de Frente o de Espaldas: DETENCIÓN para TODOS
**Fuente:** Guía Nacional, pág. 108 — Señales Manuales (a)
**Descripción:** Cuando el agente de tránsito está en posición de frente o de espaldas al conductor, significa detención obligatoria. Equivale al semáforo en rojo.
```
trigger: inspector_facing_player || inspector_back_to_player
condition: vehicle_speed > 3 km/h
penalty: -25 pts | message: "👮 No respetó posición de Inspector: DETENCIÓN"
inspector_state: 'STOP'
```

---

### RULE_32 — Inspector de Perfil: Avance Permitido
**Fuente:** Guía Nacional, pág. 108 — Señales Manuales (b)
**Descripción:** Cuando el agente de tránsito está de perfil respecto al conductor, significa que puede avanzar. El flujo perpendicular debe detenerse.
```
trigger: inspector_profile_to_player
condition: vehicle_stopped_unnecessarily && duration > 8s
penalty: 0 (informativo) | message: "👮 Inspector: SIGA"
inspector_state: 'GO'
```

---

### RULE_33 — Inspector: Brazo en Alto = Detención Universal
**Fuente:** Guía Nacional — Combinatoria de señas del agente
**Descripción:** El agente puede levantar el brazo en alto para detener a todos los vehículos en cualquier dirección, independientemente del semáforo.
```
trigger: inspector.armRaised === true (inspector_state === 'STOP')
condition: vehicle_in_inspector_zone && speed > 5 km/h
penalty: -25 pts | message: "👮 INSPECTOR: ¡DETÉNGASE!"
```

---

### RULE_34 — Silbato del Inspector: Señal Acústica de Orden
**Fuente:** Guía Nacional, pág. 109 — Señales Acústicas
**Descripción:** El silbato del agente de tránsito es una señal acústica de autoridad. Combinado con señas corporales regula el flujo de vehículos y peatones.
```
trigger: inspector state change event
action: play whistle sound + show inspector order message in HUD
// SoundManager.playWhistle() → nuevo método a implementar
```

---

### RULE_35 — Contacto Visual Obligatorio con el Inspector
**Fuente:** Guía Nacional, pág. 108
**Descripción:** Es imprescindible que el conductor haga contacto visual con el agente que controla el tránsito para interpretar correctamente sus señas.
```
trigger: inspector_in_proximity_zone (< 30m)
action: highlight inspector in HUD + show proximity warning
message: "👮 Inspector de tránsito a la vista — Preste atención"
```

---

### RULE_36 — Jerarquía de Control: Inspector > Semáforo > Señal
**Fuente:** Ley 18191, Art. 39
**Descripción:** Las indicaciones de los agentes que dirigen el tránsito prevalecen sobre las señales luminosas (semáforos), y éstas sobre los demás elementos y reglas de circulación.
```
// Orden de evaluación en GameEngine.animate():
// 1. checkInspectorOrders()    ← MÁXIMA PRIORIDAD (RULE_18, RULE_36)
// 2. checkTrafficLights()      ← RULE_01 al RULE_05
// 3. checkRoadSigns()          ← RULE_06 al RULE_10
// 4. checkGeneralRules()       ← RULE_11 al RULE_30
```

---

### RULE_37 — Vehículo de Emergencia con Sirena: Ceder Carril
**Fuente:** Ley 18191, Art. (numeral 8)
**Descripción:** Los vehículos deben dar preferencia de paso inmediata a los vehículos de emergencia cuando emiten señales audibles (sirena) y visuales (luces destellantes) simultáneamente.
```
trigger: emergency_vehicle_nearby
condition: player_in_path && not_yielded
penalty: -20 pts | message: "No cedió paso a emergencias (sirena activa)"
// Implementar: NPC tipo 'EMERGENCY' con luces rojas destellantes + sonido de sirena
```

---

### RULE_38 — Accidente: Detención Obligatoria y No Fuga
**Fuente:** Guía Nacional — ¿Cómo actuar en caso de accidente?
**Descripción:** En caso de siniestro es obligatorio detener el vehículo inmediatamente. Huir del lugar de un accidente es una infracción grave.
```
trigger: vehicle_collision_event (roce leve con NPC o edificio)
condition: player_continues_driving_at_high_speed_after_crash
penalty: -15 pts | message: "Fuga tras siniestro de tránsito"
```

---

### RULE_39 — Reversa: Solo para Estacionar o Tramos Cortos
**Fuente:** Guía Nacional — Maniobras / RNCV
**Descripción:** La marcha atrás solo está permitida para estacionar o en tramos cortos sin salida. No se puede circular en reversa en calles normales ni en intersecciones.
```
trigger: vehicle_speed < 0 (reverse gear active)
condition: reverse_distance > 20m || vehicle_in_intersection
penalty: -10 pts | message: "Marcha atrás no permitida en este tramo"
```

---

### RULE_40 — Peatón Vulnerable: Prioridad Extrema y Tolerancia
**Fuente:** Guía Nacional — Personas Discapacitadas / El Peatón
**Descripción:** Los peatones con discapacidad visual, en sillas de ruedas o con movilidad reducida tienen prioridad absoluta. El conductor debe detenerse completamente y esperar. El impacto a 45 km/h es fatal en más del 50% de los casos (Guía, pág. 94).
```
trigger: pedestrian_in_crosswalk || pedestrian_on_ramp
condition: vehicle_speed > 0 km/h && pedestrian_in_collision_path
penalty: GAME_OVER si hay contacto
penalty: -15 pts si no reduce velocidad al aproximarse
message: "Peatón con prioridad — Detenga el vehículo"
// Dato de la guía: velocidad de impacto determina gravedad de lesión
// < 30 km/h → alta probabilidad de supervivencia
// ≥ 45 km/h → más del 50% de fatalidades
```

---

## Resumen de Parámetros del Juego

| Concepto | Valor | Fuente |
|---|---|---|
| Velocidad máx. urbana | **45 km/h** | Ley 18191 / Guía pág. 90 |
| Velocidad máx. zona escolar | **30 km/h** | RNCV |
| Velocidad máx. rotonda (recomendada) | **20 km/h** | Guía Nacional |
| Distancia de seguimiento (condiciones normales) | **3 segundos** | Guía pág. 112 |
| Distancia de seguimiento (condiciones adversas) | **4+ segundos** | Guía pág. 112 |
| Distancia mínima a señal PARE para estacionar | **10 metros** | RNCV |
| Inspector prevalece sobre semáforo | **Sí** (Art. 39) | Ley 18191 |
| Semáforo apagado → regla aplicada | **Preferencia por la derecha** | Guía pág. 108 |
| Impacto peatonal a 45 km/h → fatalidad | **> 50% probabilidad** | Guía pág. 94 |

---

## Mapa de Penalizaciones para `Constants.js`

```javascript
// Constantes a agregar/actualizar en Constants.js
PENALTY_RED_LIGHT:          20,  // RULE_01
PENALTY_YELLOW_ACCEL:       10,  // RULE_02
PENALTY_FLASH_RED:          15,  // RULE_04
PENALTY_STOP_SIGN:          15,  // RULE_06
PENALTY_YIELD_SIGN:         10,  // RULE_07
PENALTY_SPEEDING:            5,  // RULE_08, RULE_21 (cada 2s)
PENALTY_SCHOOL_SPEEDING:     5,  // RULE_22 (cada 2s, límite 30)
PENALTY_CENTER_LINE:        15,  // RULE_09
PENALTY_NO_PRIORITY_RIGHT:  10,  // RULE_11
PENALTY_NO_YIELD_TURN:       8,  // RULE_13
PENALTY_EMERGENCY_YIELD:    20,  // RULE_15, RULE_37
PENALTY_ROUNDABOUT:         10,  // RULE_16
PENALTY_INSPECTOR:          25,  // RULE_18, RULE_31, RULE_33
PENALTY_BLOCK_INTERSECTION: 10,  // RULE_20
PENALTY_TAILGATING:          3,  // RULE_23
PENALTY_WRONG_LANE:         10,  // RULE_26
PENALTY_NO_SIGNAL:           2,  // RULE_27
PENALTY_ILLEGAL_OVERTAKE:   15,  // RULE_28
PENALTY_CROSSWALK_PARK:      8,  // RULE_30
PENALTY_FLEE_ACCIDENT:      15,  // RULE_38
PENALTY_REVERSE_ILLEGAL:    10,  // RULE_39
REWARD_GOOD_STOP:            5,  // RULE_06 (cumplimiento correcto)
```
