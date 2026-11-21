# Plan de juego: presión sobre el mariscal

**Elige un rival y la app te dice dónde se rompe su línea ofensiva, cuándo conviene mandar blitz y cuánto tiempo tiene su mariscal, con jugadas reales animadas sobre la cancha.**

Datos de la NFL (tracking de Next Gen Stats y scouting de PFF): 8,557 jugadas de pase de las semanas 1 a 8 de 2021.
Una jugada cuenta como "con presión" si algún pass rusher logró hurry, hit o sack.

## Lo que encontramos

- **La presión cuesta mucho.** Con presión se ganan 3.9 yardas por pase, y sin ella 8.1. Sin contar los sacks, la diferencia sigue siendo de 2.1 yardas y de 23 puntos de pases completos.
- **El tiempo decide.** La mitad de los pases sale a los 2.7 segundos del snap. Si el mariscal suelta en menos de 2 segundos, completa el 76.5 % de los pases. Si tarda más de 3.5, solo el 38.5 %, y el 19.5 % acaba en sack.
- **En tercera y larga la presión llega en la mitad de las jugadas.** Sube de 31.7 % en 1ª down a 50.8 % en 3ª/4ª y larga (7+ yardas).
- **El blitz sube la presión, pero no siempre baja las yardas.** Con 4 rushers hay presión en 34.7 % de las jugadas, y con 5 en 46.3 %. Las yardas permitidas casi no cambian (6.5 contra 6.5), así que la app compara cada situación por separado.
- **Los tackles son el punto débil de la línea.** El RT permite presión en 7.7 % de sus snaps y el LT en 7.3 %. El centro, en 4.1 %.
- **Cada rival se rompe en un lugar distinto.** De 26.2 % (TB) a 46.3 % (NO) de jugadas con presión.

## Qué hace la app

| Pantalla | Qué responde |
|---|---|
| **Rival** | ¿Dónde se rompe su línea? Mapa de calor sobre la formación, por situación y por formación |
| **Costo de la presión** | ¿Cuántas yardas y pases completos le quita la presión a un ataque? Con animación de qué es un hurry, un hit y un sack |
| **Blitz** | ¿Cuántos rushers conviene mandar en cada situación? Esquema animado de 3 a 7 rushers |
| **Jugadores y duelos** | ¿Qué bloqueadores permiten más presión y qué tipo de defensor les gana más? |
| **Cara a cara** | Mi defensa contra la línea de un rival: presión esperada, eslabones débiles y mejores rushers |
| **Cancha en vivo** | Jugadas reales reproducidas cuadro por cuadro, con un semáforo de distancia del rusher al mariscal |
| **Reloj** | Cuánto tarda el mariscal en soltar el balón y cuándo llega el primer defensor |
| **Plan de juego** | Resumen en lenguaje simple, listo para imprimir, y un analista de IA para preguntas libres |

Todas las pantallas aceptan filtros de down, distancia, cuarto y marcador.

**Para no engañarse:** cada porcentaje trae su margen de error (intervalo de Wilson al 95 %), los grupos con pocas jugadas se marcan, y las comparaciones entre equipos se ajustan hacia el promedio de la liga cuando hay pocos datos.
Son solo 8 semanas, y las tasas describen lo ocurrido: no prueban que la presión cause el resultado.

## Inteligencia artificial (opcional)

Amazon Nova, a través de Strands Agents, redacta el resumen del rival, el plan de juego y responde preguntas libres. En ese último caso Nova consulta funciones sobre los datos en lugar de inventar cifras.
Si Nova no está disponible, la app genera el resumen y el plan con las mismas cifras, y todo lo demás funciona igual.

## Correrlo

Para la IA, copiar `.env.example` a `.env` con las llaves del workshop.

```
.venv/bin/uvicorn backend.main:app          # Windows: .venv/Scripts/uvicorn
cd dashboard && npm install && npm run dev  # abre http://localhost:5173
```

Al arrancar, el backend lee en segundo plano los 122 archivos de tracking (menos de un minuto). Mientras tanto, la pantalla "Reloj" muestra el avance y las demás ya funcionan.
Pruebas del backend: `.venv/bin/python -m pytest backend/tests`.

Backend FastAPI + pandas + numpy. Dashboard React, Vite, Tailwind y Recharts. La cancha es SVG propio, sin librerías extra.
