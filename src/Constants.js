export const CONSTANTS = {
    // Escala del mundo
    BLOCK_SIZE: 100,
    ROAD_WIDTH: 14,
    SIDEWALK_WIDTH: 3,
    INTERSECTION_SIZE: 20,
    QUALITY: 'high', // 'high' o 'low'
    TEST_TIME_LIMIT: 300,
    PASS_POINTS_LIMIT: 70,

    // ── MATEMÁTICAS (M01 / M02 / M03) ───────────────────────────
     // Cada situación de tránsito que el jugador enfrenta es un ítem.
    // 20 ítems × 5 puntos = 100 puntos posibles.
    TOTAL_ITEMS: 20,

    // Puntos que vale cada ítem correcto (M01 — conteo de aciertos)
    ITEM_VALUE: 5,

    // Porcentaje mínimo de aciertos para aprobar (M03)
    // Si el jugador acierta ≥ 70% de los ítems → Aprobado
    MIN_PASS_PERCENT: 70,
    // ─────────────────────────────────────────────────────────────

    // Física del vehículo
    CITY_SPEED_LIMIT: 45,
    SCHOOL_SPEED_LIMIT: 30,
    ROUNDABOUT_SPEED_LIMIT: 20,
    MAX_SPEED: 120,
    MAP_LIMIT: 280,
    ACCELERATION: 4.5,
    BRAKING: 15,
    FRICTION: 2,
    TURN_SPEED: 1.5,

    // Penalizaciones (valor positivo, se resta)
    PENALTY_RED_LIGHT: 20,         
    PENALTY_YELLOW_ACCEL: 10,      
    PENALTY_FLASH_RED: 15,         
    PENALTY_STOP_SIGN: 15,         
    PENALTY_YIELD_SIGN: 10,        
    PENALTY_SPEEDING: 5,           
    PENALTY_SCHOOL_SPEEDING: 5,   
    PENALTY_CENTER_LINE: 15,       
    PENALTY_NO_PRIORITY_RIGHT: 10, 
    PENALTY_ROUNDABOUT: 10,        
    PENALTY_INSPECTOR: 25,         
    PENALTY_BLOCK_INTERSECTION: 10,
    PENALTY_TAILGATING: 3,      
    PENALTY_WRONG_LANE: 10,        
    PENALTY_NO_SIGNAL: 2,          
    PENALTY_ILLEGAL_OVERTAKE: 15,  
    PENALTY_PARKED_BAD: 8,         
    PENALTY_FLEE: 15,             
    PENALTY_REVERSE: 10,           
    PENALTY_CRASH: 30,
    REWARD_GOOD_STOP: 5,

    // Semáforos
    TRAFFIC_LIGHT_GREEN_TIME: 10000,
    TRAFFIC_LIGHT_YELLOW_TIME: 3000,
    TRAFFIC_LIGHT_RED_TIME: 10000,

    // Colores base
    COLOR_ROAD: 0x2a2a2a,
    COLOR_SIDEWALK: 0xc8c0b0,
    COLOR_GRASS: 0x3d7a3a,
    COLOR_BUILDING: [0x7a8c9e, 0x9e8c7a, 0xb0a898, 0x6e7a5c, 0x8c7a6e, 0xa09080],
    COLOR_SCHOOL: 0xe8dfc0,

    // Reglas con texto de ordenanza (para pantalla resumen)
    RULES: {
        RULE_01: { name: 'Semáforo en Rojo',            ordinance: 'Ley 18191, Art. 36(A): La luz roja continua indica detención obligatoria antes del cruce.' },
        RULE_02: { name: 'Aceleración en Amarillo',      ordinance: 'Ley 18191, Art. 36(C): La luz amarilla advierte que debe detenerse. Prohibido acelerar para pasarla.' },
        RULE_06: { name: 'Señal de PARE',                ordinance: 'RNCV, Señal R1: Ante el octágono PARE debe detenerse completamente (0 km/h) antes de la línea.' },
        RULE_07: { name: 'Ceda el Paso / Rotonda',       ordinance: 'RNCV, Señal R2: Reducir velocidad y ceder el paso a los vehículos con preferencia.' },
        RULE_08: { name: 'Velocidad Máxima (Señal)',     ordinance: 'RNCV, Art. R28: Las señales circulares indican el límite máximo de ese tramo.' },
        RULE_11: { name: 'Preferencia por la Derecha',  ordinance: 'Ley 18191, numeral 3: En cruce no señalizado, ceder paso al vehículo que viene por la derecha.' },
        RULE_14: { name: 'Peatón en Cebra',              ordinance: 'Ley 18191, numeral 7: El conductor debe ceder el paso a peatones en pasos reglamentarios.' },
        RULE_18: { name: 'Orden del Inspector',          ordinance: 'Ley 18191, Art. 39: Las indicaciones del agente de tránsito prevalecen sobre semáforos y señales.' },
        RULE_21: { name: 'Velocidad Urbana (45 km/h)',  ordinance: 'Ley 18191, Art. 15: La velocidad máxima en zona urbana es 45 km/h.' },
        RULE_22: { name: 'Zona Escolar (30 km/h)',       ordinance: 'RNCV: En zonas escolares la velocidad máxima es 30 km/h. Señal obligatoria.' },
        RULE_23: { name: 'Distancia de Seguridad',       ordinance: 'Guía Nacional, pág. 112: Mantener distancia equivalente a 3 segundos respecto al vehículo precedente.' },
        RULE_26: { name: 'Circulación Carril Derecho',  ordinance: 'Guía Nacional: Circular por los carriles de la derecha. El izquierdo es solo para adelantar.' },
        RULE_27: { name: 'Señalero Obligatorio',         ordinance: 'Guía Nacional: Es obligatorio usar luces de giro antes de todo cambio de dirección o carril.' },
        RULE_30: { name: 'Estacionamiento Prohibido',   ordinance: 'RNCV: Prohibido estacionar a menos de 10m de señal PARE, en cebras o paradas de ómnibus.' },
        RULE_39: { name: 'Reversa Ilegal',               ordinance: 'Guía Nacional: La marcha atrás solo se permite para estacionar o en tramos cortos sin salida.' },
    }
};