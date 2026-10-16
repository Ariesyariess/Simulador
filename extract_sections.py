with open('guia_conduccion.txt', 'r', encoding='utf-8') as f:
    text = f.read()

def find_section(start_kw, length=4000):
    idx = text.upper().find(start_kw.upper())
    if idx < 0:
        return f"[NOT FOUND: {start_kw}]"
    return text[idx:idx+length]

sections = [
    ('LEYES FISICAS Y VELOCIDAD', 'LAS LEYES F'),
    ('MANIOBRAS GENERAL',         'MANIOBRAS EN GENERAL'),
    ('SEMAFOROS ART36',           'ART. 36. LAS SE'),
    ('AGENTES TRANSITO',          'AGENTES DE TR'),
    ('GENERALIDADES CONDUCCION',  'GENERALIDADES EN LA CONDUCCI'),
    ('PREFERENCIA PASO',          'PREFERENCIA DE PASO'),
    ('DISTANCIA SEGURA',          'DISTANCIA DE SEGURIDAD'),
    ('ADELANTAMIENTO',            'ADELANTAMIENTO'),
    ('GIRO Y VUELTA',             'GIROS Y VUELTA'),
    ('CONDUCCION RUTA',           'CONDUCCI'),
    ('PRIORIDAD NUMERAL',         '3) CUANDO DOS VEH'),
    ('LUCES OBLIGATORIAS',        'LUZ REGLAMENTARIA'),
    ('INSPECTORES SEÑAS',         'ADEMANES'),
]

for name, kw in sections:
    content = find_section(kw)
    print(f"\n{'='*60}")
    print(f"SECCION: {name}")
    print('='*60)
    print(content[:3500])
