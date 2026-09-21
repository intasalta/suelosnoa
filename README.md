# Atlas Digital de Suelos del NOA (Salta y Jujuy) 🌱🗺️

Dashboard cartográfico e interactivo de los suelos de las provincias de **Salta** y **Jujuy** (República Argentina), desarrollado a partir del estudio científico de referencia:
> *"Los Suelos del NOA (Salta y Jujuy)"* — Nadir A. & Chafatinos T. (1990).  
> Adecuación a Sistema de Información Geográfica: Convenio INTA - UNSa (SIGSSSJ, Ediciones INTA 2009, ISBN: 978-987-25050-8-0).

---

## 🚀 Características Principales ("Nada de PDFs")

- **Cartografía Digital Interactiva**: 784 polígonos edafológicos georreferenciados con cálculo exacto de superficie en km² y hectáreas.
- **216 Unidades Integradas Dinámicamente**: Los 216 informes PDF fueron transformados en un catálogo estructurado JSON de acceso instantáneo.
- **Capas Temáticas Edafológicas**:
  - 🏅 **Grupo de la Tierra (Aptitud Agronómica)**: Clases A (Muy alta) a E (No arable / Conservación).
  - 🧭 **Orden Taxonómico USDA**: Molisoles, Entisoles, Inceptisoles, Alfisoles, Aridisoles.
  - 🌐 **Clasificación FAO**: Litosoles, Phaeozems, Cambisoles, Fluvisoles, Luvisoles, etc.
  - ⛰️ **Regiones Geográficas**: Puna, Cordillera Oriental, Valles Intermontanos, Sierras Subandinas, Llanura Chaqueña.
  - 🔍 **Solo Límites (Transparente)**: Visualización limpia de contornos de polígonos sin opacidad de relleno, ideal para fotointerpretación con imágenes satelitales y relieve topográfico.
- **Mapas Base de Alta Precisión**: Imágenes Satelitales de alta resolución (Esri World Imagery por defecto), Relieve Topográfico, Carto Light y OpenStreetMap (se eliminó el fondo negro para una lectura geográfica natural).
- **Panel de Inspección Modular ("Cajitas cosas lindas")**:
  - Indicadores clave del polígono y paisaje (fisiografía, relieve, cuenca).
  - Régimen térmico, lluvias anuales (mm) y comunidades vegetales nativas características.
  - Diagnóstico agronómico y recomendaciones de manejo estructural de suelos.
  - Desglose de suelos asociados (Dominantes, Subordinados e Inclusiones).
  - **Perfil modal visual a escala** de horizontes (colores Munsell realistas, consistencia, estructura).
  - **Gráficos interactivos de laboratorio**: curva de pH y materia orgánica en profundidad, textura granulométrica (arena/limo/arcilla) y capacidad de intercambio catiónico (CIC con bases Ca, Mg, Na, K).
- **Búsqueda Predictiva en Tiempo Real**: Búsqueda instantánea por nombre de suelo, código de nomenclatura o localidad.
- **Exportación Limpia**: Botón para imprimir o generar ficha técnica en PDF nativo sin elementos superfluos del mapa.

---

## 📦 Estructura del Proyecto

```text
anti_suelosdelnoa/
├── index.html               # Página web principal (Single Page Application)
├── css/
│   └── styles.css          # Diseño moderno, tarjetas ("cajitas"), tipografía y modo de impresión
├── js/
│   └── app.js              # Lógica de Leaflet, Chart.js, búsqueda, filtros y dibujo de perfiles
├── data/
│   ├── suelos_db.json      # Base de datos estructurada con las 216 unidades y análisis de laboratorio
│   └── suelos_geo.json     # Cartografía optimizada con áreas calculadas y vinculaciones
├── scripts/
│   ├── extract_all.py      # Script de extracción automatizada desde los PDFs originales
│   └── optimize_geojson.py # Script de optimización geométrica y enlace cartográfico
├── .gitignore
└── README.md
```

---

## 💻 Cómo Probarlo Localmente

Puedes abrir un servidor HTTP liviano en Python en la carpeta del proyecto:

```bash
# En la terminal dentro de esta carpeta:
python -m http.server 8000
```

Luego abre en tu navegador web:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🌐 Cómo Publicarlo en GitHub Pages (En 30 segundos)

Este proyecto está diseñado para funcionar como un sitio web estático autónomo:

1. **Crea un repositorio en GitHub** (por ejemplo: `suelos-noa`).
2. **Sube los archivos del proyecto**:
   ```bash
   git init
   git add index.html css/ js/ data/ README.md .gitignore
   git commit -m "Publicar Dashboard de Suelos del NOA"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/suelos-noa.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings** ➔ **Pages**:
   - En **Source**, selecciona: `Deploy from a branch`.
   - En **Branch**, selecciona: `main` y carpeta `/(root)`.
   - Haz clic en **Save**.
4. ¡Listo! Tu sitio estará publicado en:  
   `https://TU-USUARIO.github.io/suelos-noa/`

---

## 📚 Créditos Científicos

- **Autores del estudio**: Ing. Agr. Alberto Nadir & Ing. Agr. Teodoro Chafatinos (1990).
- **Digitalización SIG**: Instituto Nacional de Tecnología Agropecuaria (INTA EEA Salta) & Universidad Nacional de Salta (UNSa), 2009.
