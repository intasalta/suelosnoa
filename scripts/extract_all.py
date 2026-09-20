import fitz, re, json, glob, os, unicodedata

def normalize_str(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9]', '', text.lower())

def clean_text(t):
    if not t:
        return ""
    # Fix whitespace
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n\n', t)
    return t.strip()

def extract_general_info(full_text):
    info = {}
    
    # 1. Asociacion
    m = re.search(r'Asociaci[oó]n:\s*(.*?)(?=\n\s*Suelos Asociados:|\n\s*Regi[oó]n Geogr|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    aso_raw = clean_text(m.group(1)) if m else ""
    # Extract nomenclatura from parentheses if present, e.g. "Bermejo (Be)"
    nom_m = re.search(r'\(([^)]+)\)$', aso_raw)
    nomencla = nom_m.group(1).strip() if nom_m else ""
    # Clean association name without trailing code
    aso_clean = re.sub(r'\s*\([^)]+\)$', '', aso_raw).strip()
    info['asociacion'] = aso_clean if aso_clean else aso_raw
    info['nomencla'] = nomencla
    
    # 2. Suelos asociados summary
    m = re.search(r'Suelos Asociados:\s*(.*?)(?=\n\s*Regi[oó]n Geogr|\n\s*Ubicaci[oó]n:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['suelos_asociados_resumen'] = clean_text(m.group(1)) if m else ""
    
    # 3. Región Geográfica
    m = re.search(r'Regi[oó]n Geogr[aá]fica:\s*(.*?)(?=\n\s*Ubicaci[oó]n:|\n\s*Subcuenca:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['region_geografica'] = clean_text(m.group(1)) if m else ""
    
    # 4. Ubicación
    m = re.search(r'Ubicaci[oó]n:\s*(.*?)(?=\n\s*Subcuenca:|\n\s*Fisiograf[ií]a:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['ubicacion'] = clean_text(m.group(1)) if m else ""
    
    # 5. Subcuenca
    m = re.search(r'Subcuenca:\s*(.*?)(?=\n\s*Fisiograf[ií]a:|\n\s*Relieve:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['subcuenca'] = clean_text(m.group(1)) if m else ""
    
    # 6. Fisiografía
    m = re.search(r'Fisiograf[ií]a:\s*(.*?)(?=\n\s*Relieve:|\n\s*Clima:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['fisiografia'] = clean_text(m.group(1)) if m else ""
    
    # 7. Relieve
    m = re.search(r'Relieve:\s*(.*?)(?=\n\s*Clima:|\n\s*Vegetaci[oó]n:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['relieve'] = clean_text(m.group(1)) if m else ""
    
    # 8. Clima
    m = re.search(r'Clima:\s*(.*?)(?=\n\s*Vegetaci[oó]n:|\n\s*Material Original:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    clima_raw = clean_text(m.group(1)) if m else ""
    info['clima'] = clima_raw
    # Try extracting precipitation
    precip_m = re.search(r'Precipitaci[oó]n\s*media\s*anual:\s*([^\.\n]+(?:\.\s*\d+)?(?:\s*mm)?)', clima_raw, re.IGNORECASE)
    info['precipitacion'] = precip_m.group(1).strip() if precip_m else ""
    temp_m = re.search(r'Temperatura\s*media:\s*([^\.\n]+(?:\.[^\.\n]+)?)', clima_raw, re.IGNORECASE)
    info['temperatura'] = temp_m.group(1).strip() if temp_m else ""
    
    # 9. Vegetación
    m = re.search(r'Vegetaci[oó]n:\s*(.*?)(?=\n\s*Material Original:|\n\s*Grupo de la Tierra:|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['vegetacion'] = clean_text(m.group(1)) if m else ""
    
    # 10. Material Original
    m = re.search(r'Material Original:\s*(.*?)(?=\n\s*Grupo de la Tierra:|\n\s*Descripci[oó]n de los suelos|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    info['material_original'] = clean_text(m.group(1)) if m else ""
    
    # 11. Grupo de la Tierra
    m = re.search(r'Grupo de la Tierra:\s*([A-Z\-\s\+0-9]+)\s*\n+(.*?)(?=\n\s*Descripci[oó]n de los suelos|\Z)', full_text, re.DOTALL | re.IGNORECASE)
    if m:
        info['grupo_tierra'] = m.group(1).strip()
        info['grupo_tierra_desc'] = clean_text(m.group(2))
    else:
        # Fallback search
        m2 = re.search(r'Grupo de la Tierra:\s*(.*?)(?=\n\s*Descripci[oó]n de los suelos|\Z)', full_text, re.DOTALL | re.IGNORECASE)
        if m2:
            lines = clean_text(m2.group(1)).split(' ', 1)
            info['grupo_tierra'] = lines[0].strip()
            info['grupo_tierra_desc'] = lines[1].strip() if len(lines) > 1 else ""
        else:
            info['grupo_tierra'] = ""
            info['grupo_tierra_desc'] = ""
            
    return info

def extract_modal_horizons(pm_text):
    horizons = []
    # Pattern to match horizon lines: "A1: 0-15 cm" or "B2t: 20-45 cm" or "R: 35-+ cm" or "Ap: 0-20 cm"
    # Find all horizon headers with depths
    matches = list(re.finditer(r'(?:^|\n)\s*([A-Z0-9/]+):\s*([0-9\-\+\s]+(?:cm)?)\s*\n', pm_text, re.IGNORECASE))
    for i, m in enumerate(matches):
        h_name = m.group(1).strip()
        h_depth = m.group(2).strip()
        # description is between end of this match and start of next match or end of text
        start_desc = m.end()
        end_desc = matches[i+1].start() if i + 1 < len(matches) else len(pm_text)
        desc = clean_text(pm_text[start_desc:end_desc])
        
        # Parse numeric top and bottom depths in cm
        top_cm = None
        bottom_cm = None
        depth_nums = re.findall(r'\d+', h_depth)
        if len(depth_nums) >= 2:
            top_cm = int(depth_nums[0])
            bottom_cm = int(depth_nums[1])
        elif len(depth_nums) == 1:
            top_cm = int(depth_nums[0])
            bottom_cm = top_cm + 20 # default layer thickness if "+"
            
        horizons.append({
            'horizonte': h_name,
            'profundidad': h_depth,
            'top_cm': top_cm,
            'bottom_cm': bottom_cm,
            'descripcion': desc
        })
    return horizons

def parse_lab_table_from_page(page, start_y, end_y):
    words = page.get_text('words')
    # Filter words in y range
    table_words = [w for w in words if start_y <= w[1] <= end_y]
    
    # Find 'Horizonte'
    h_words = [w for w in table_words if w[4] == 'Horizonte']
    if not h_words:
        return None
    hw = h_words[0]
    
    # Headers on roughly the same line
    cols = [w for w in table_words if abs(w[1] - hw[1]) < 8 and w[0] > (hw[2] + 15)]
    cols.sort(key=lambda w: w[0])
    if not cols:
        return None
        
    col_names = [c[4] for c in cols]
    col_x = [c[0] for c in cols]
    num_cols = len(col_names)
    
    # Group words below hw[1] by line
    lines_by_y = {}
    for w in table_words:
        if w[1] > hw[1] - 4:
            y_key = round(w[1] / 6.5) * 6.5
            if y_key not in lines_by_y:
                lines_by_y[y_key] = []
            lines_by_y[y_key].append(w)
            
    # Standard metrics mapping
    row_keywords = [
        ('profundidad', ['profundidad']),
        ('ph_pasta', ['ph (pasta', 'pasta saturaci']),
        ('ph_agua', ['ph (1:', 'ph en agua', '1:2,5']),
        ('resistencia_electrica', ['resistencia el']),
        ('conductividad_electrica', ['conduct. el', 'conductividad el']),
        ('co3ca', ['co3ca']),
        ('carbono_organico', ['carbono org']),
        ('nitrogeno_total', ['nitr', 'total %']),
        ('relacion_cn', ['c/n', 'c / n']),
        ('materia_organica', ['materia org']),
        ('arcilla', ['arcilla']),
        ('limo', ['limo']),
        ('arena', ['arena']),
        ('textura_clase', ['textura (clase)']),
        ('cic', ['capacidad de intercambio', 'cic']),
        ('calcio', ['calcio']),
        ('magnesio', ['magnesio']),
        ('sodio', ['sodio']),
        ('potasio', ['potasio']),
        ('saturacion_bases', ['saturaci']),
        ('psi', ['psi'])
    ]
    
    parsed_rows = {}
    for yk in sorted(lines_by_y.keys()):
        lw = sorted(lines_by_y[yk], key=lambda w: w[0])
        lbl_words = [w for w in lw if w[0] < col_x[0] - 12]
        val_words = [w for w in lw if w[0] >= col_x[0] - 12]
        lbl_text = ' '.join([w[4] for w in lbl_words]).lower().strip()
        
        if not val_words:
            continue
            
        # Match metric
        matched_key = None
        for mkey, kw_list in row_keywords:
            if any(kw in lbl_text for kw in kw_list):
                # Extra checks to avoid collisions
                if mkey == 'materia_organica' and ('carbono' in lbl_text or 'nitr' in lbl_text or 'c/n' in lbl_text):
                    continue
                matched_key = mkey
                break
                
        if matched_key and matched_key not in parsed_rows:
            # Assign values to closest columns
            cell_vals = {i: [] for i in range(num_cols)}
            for vw in val_words:
                best_i = min(range(num_cols), key=lambda i: abs(vw[0] - col_x[i]))
                cell_vals[best_i].append(vw[4])
            row_arr = [' '.join(cell_vals[i]).strip() for i in range(num_cols)]
            parsed_rows[matched_key] = row_arr
            
    return {
        'horizontes': col_names,
        'filas': parsed_rows
    }

def extract_pdf_data(pdf_path, pdf_id):
    doc = fitz.open(pdf_path)
    pages_text = [p.get_text('text') for p in doc]
    full_text = '\n'.join(pages_text)
    
    # 1. General association info
    gen_info = extract_general_info(full_text)
    gen_info['pdf_id'] = pdf_id
    gen_info['pdf_file'] = os.path.basename(pdf_path)
    
    # 2. Extract Soil Blocks
    # Split by 'Suelo \n'
    soil_blocks_raw = re.split(r'\n\s*Suelo\s*\n\s*', full_text)[1:]
    soils = []
    
    for s_idx, sb in enumerate(soil_blocks_raw):
        s_data = {}
        # First line usually: "Bermejo --> Dominante"
        first_line = sb.strip().split('\n')[0]
        name_dom = re.search(r'^(.*?)\s*-->\s*(.*)$', first_line)
        if name_dom:
            s_data['nombre'] = name_dom.group(1).strip()
            s_data['dominancia'] = name_dom.group(2).strip()
        else:
            s_data['nombre'] = first_line.strip()
            s_data['dominancia'] = "Dominante" if s_idx == 0 else "Subordinado"
            
        # Nomenclatura
        m = re.search(r'Nomenclatura:\s*([^\n\r]+)', sb, re.IGNORECASE)
        s_data['nomencla'] = m.group(1).strip() if m else ""
        
        # Característica
        m = re.search(r'Caracter[ií]stica:\s*(.*?)(?=\n\s*Limitaciones:|\n\s*Clase:|\Z)', sb, re.DOTALL | re.IGNORECASE)
        s_data['caracteristica'] = clean_text(m.group(1)) if m else ""
        
        # Limitaciones
        m = re.search(r'Limitaciones:\s*(.*?)(?=\n\s*Clase:|\n\s*Clasificaci[oó]n|\Z)', sb, re.DOTALL | re.IGNORECASE)
        s_data['limitaciones'] = clean_text(m.group(1)) if m else ""
        
        # Clase de capacidad de uso
        m = re.search(r'Clase:\s*([a-z0-9\-\s\+]+)\s*\n+(.*?)(?=\n\s*Clasificaci[oó]n Taxon[oó]mica|\Z)', sb, re.DOTALL | re.IGNORECASE)
        if m:
            s_data['clase_capacidad'] = m.group(1).strip()
            s_data['clase_capacidad_desc'] = clean_text(m.group(2))
        else:
            s_data['clase_capacidad'] = ""
            s_data['clase_capacidad_desc'] = ""
            
        # Clasificación USDA
        m = re.search(r'Clasificaci[oó]n Taxon[oó]mica USDA:\s*([^\n\r]+)', sb, re.IGNORECASE)
        s_data['usda'] = m.group(1).strip() if m else ""
        
        # Clasificación FAO
        m = re.search(r'Clasificaci[oó]n Taxon[oó]mica FAO:\s*(.*?)(?=\n\s*Descripci[oó]n del Perfil modal|\n\s*Perfil modal|\Z)', sb, re.DOTALL | re.IGNORECASE)
        s_data['fao'] = clean_text(m.group(1)) if m else ""
        
        # Perfil Modal
        m = re.search(r'Descripci[oó]n del Perfil modal\s*\n+(.*?)(?=\n\s*(?:Sin )?An[aá]lisis de Laboratorio|\n\s*Suelo|\Z)', sb, re.DOTALL | re.IGNORECASE)
        if m:
            s_data['perfil_modal'] = extract_modal_horizons(m.group(1))
        else:
            s_data['perfil_modal'] = []
            
        # Laboratorio: check in pages
        s_data['laboratorio'] = None
        soils.append(s_data)
        
    # Now scan pages for Lab tables and associate with corresponding soil
    for pno, page in enumerate(doc):
        text = page.get_text('text')
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        has_lab = any(('análisis de laboratorio' in l.lower() or 'analisis de laboratorio' in l.lower()) and 'sin' not in l.lower() for l in lines)
        if has_lab:
            # Check soil name in this page
            m_s = re.search(r'Suelo:\s*([^\(\n\r]+)(?:\s*\(([^)]+)\))?', text)
            lab_soil_name = m_s.group(1).strip() if m_s else ""
            lab_soil_code = m_s.group(2).strip() if m_s and m_s.group(2) else ""
            
            # Find bounds
            words = page.get_text('words')
            lab_headers = [w for i, w in enumerate(words) if 'laboratorio' in w[4].lower() and (i == 0 or words[i-1][4].lower() != 'sin')]
            if lab_headers:
                start_y = lab_headers[0][1]
                # End is either 'Suelo' in lower half or page height
                lower_soils = [w for w in words if w[4] == 'Suelo' and w[1] > start_y + 40]
                end_y = lower_soils[0][1] - 5 if lower_soils else page.rect.height
                
                tab = parse_lab_table_from_page(page, start_y, end_y)
                if tab and tab.get('filas'):
                    target_soil = None
                    
                    # 1. Exact code match (case-insensitive normalized)
                    if lab_soil_code:
                        for s in soils:
                            if s.get('laboratorio') is None and normalize_str(s['nomencla']) == normalize_str(lab_soil_code):
                                target_soil = s
                                break
                                
                    # 2. Exact normalized name match
                    if not target_soil and lab_soil_name:
                        for s in soils:
                            if s.get('laboratorio') is None and normalize_str(s['nombre']) == normalize_str(lab_soil_name):
                                target_soil = s
                                break
                                
                    # 3. Normalized containment ONLY on unassigned soils
                    if not target_soil and lab_soil_name:
                        candidates = [s for s in soils if s.get('laboratorio') is None and (normalize_str(s['nombre']) in normalize_str(lab_soil_name) or normalize_str(lab_soil_name) in normalize_str(s['nombre']))]
                        if candidates:
                            candidates.sort(key=lambda s: abs(len(normalize_str(s['nombre'])) - len(normalize_str(lab_soil_name))))
                            target_soil = candidates[0]
                            
                    # 4. Sequential fallback: first unassigned soil
                    if not target_soil:
                        unassigned = [s for s in soils if s.get('laboratorio') is None]
                        if unassigned:
                            target_soil = unassigned[0]
                            
                    if target_soil and target_soil.get('laboratorio') is None:
                        target_soil['laboratorio'] = tab
                        
    gen_info['suelos_asociados'] = soils
    return gen_info

def main():
    all_data = {}
    print("Starting extraction of all 216 PDFs...")
    success_count = 0
    lab_count = 0
    
    for pdf_id in range(1, 217):
        pdf_path = f"c:/INTA/IA/anti_suelosdelnoa/{pdf_id}.pdf"
        if not os.path.exists(pdf_path):
            print(f"Warning: {pdf_path} not found!")
            continue
        try:
            d = extract_pdf_data(pdf_path, pdf_id)
            all_data[pdf_id] = d
            success_count += 1
            has_any_lab = any(s.get('laboratorio') is not None for s in d.get('suelos_asociados', []))
            if has_any_lab:
                lab_count += 1
        except Exception as e:
            print(f"Error processing {pdf_id}.pdf: {e}")
            
    print(f"Processed {success_count} / 216 PDFs.")
    print(f"Units with lab tables extracted: {lab_count}")
    
    output_path = "c:/INTA/IA/anti_suelosdelnoa/data/suelos_db.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully saved database to {output_path}")

if __name__ == '__main__':
    main()
