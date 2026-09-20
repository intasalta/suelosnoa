import json, math, re

def calculate_polygon_area(geometry):
    """Calculate area in square meters for GeoJSON Polygon or MultiPolygon using spherical formula."""
    def ring_area(ring):
        if len(ring) < 3:
            return 0.0
        area = 0.0
        R = 6378137.0 # Earth's radius in meters
        coords = ring
        for i in range(len(coords) - 1):
            p1 = coords[i]
            p2 = coords[i+1]
            lon1 = math.radians(p1[0])
            lat1 = math.radians(p1[1])
            lon2 = math.radians(p2[0])
            lat2 = math.radians(p2[1])
            area += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))
        area = area * (R * R) / 2.0
        return abs(area)

    total_area = 0.0
    g_type = geometry.get('type')
    coords = geometry.get('coordinates', [])
    
    if g_type == 'Polygon':
        if coords:
            # exterior ring
            total_area += ring_area(coords[0])
            # interior holes
            for hole in coords[1:]:
                total_area -= ring_area(hole)
    elif g_type == 'MultiPolygon':
        for poly in coords:
            if poly:
                total_area += ring_area(poly[0])
                for hole in poly[1:]:
                    total_area -= ring_area(hole)
                    
    return max(0.0, total_area)

def round_coords(coords, precision=5):
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    elif isinstance(coords, list):
        return [round_coords(c, precision) for c in coords]
    return coords

def normalize_text(t):
    if not t:
        return ""
    # Standardize accents and lower/upper
    t = t.strip().lower()
    t = re.sub(r'[áàäâ]', 'a', t)
    t = re.sub(r'[éèëê]', 'e', t)
    t = re.sub(r'[íìïî]', 'i', t)
    t = re.sub(r'[óòöô]', 'o', t)
    t = re.sub(r'[úùüû]', 'u', t)
    t = re.sub(r'[ñ]', 'n', t)
    t = re.sub(r'[^a-z0-9]', '', t)
    return t

def main():
    print("Loading data/suelos_db.json and suelosnoa.geojson...")
    with open('data/suelos_db.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
        
    with open('suelosnoa.geojson', 'r', encoding='utf-8') as f:
        gj = json.load(f)
        
    # Build search index for db
    # Maps normalized strings to pdf_id
    db_by_nom = {}
    db_by_aso = {}
    for pid_str, item in db.items():
        pid = int(pid_str)
        nom = item.get('nomencla', '')
        aso = item.get('asociacion', '')
        if nom:
            db_by_nom[normalize_text(nom)] = pid
        if aso:
            db_by_aso[normalize_text(aso)] = pid
        # Also map each associated soil's nomenclatura
        for s in item.get('suelos_asociados', []):
            snom = s.get('nomencla', '')
            if snom and normalize_text(snom) not in db_by_nom:
                db_by_nom[normalize_text(snom)] = pid
                
    features = gj['features']
    print(f"Total input features: {len(features)}")
    
    matched_count = 0
    water_count = 0
    optimized_features = []
    
    for idx, f in enumerate(features):
        props = f['properties']
        geom = f['geometry']
        
        # Check if water/saline
        usda = (props.get('usda_orden') or '').strip()
        nom = (props.get('nomencla') or '').strip()
        aso = (props.get('nom_aso') or '').strip()
        
        is_water = False
        if usda == 'Salares, Lagos y Cursos de Agua' or not aso or nom.startswith('D.') or nom.startswith('S. ') or nom.startswith('L. ') or nom.startswith('R. '):
            is_water = True
            water_count += 1
            matched_pdf_id = None
        else:
            # Find matching PDF ID
            matched_pdf_id = None
            
            # 1. Direct nom match
            n_norm = normalize_text(nom)
            if n_norm in db_by_nom:
                matched_pdf_id = db_by_nom[n_norm]
                
            # 2. Direct aso match
            if not matched_pdf_id and aso:
                a_norm = normalize_text(aso)
                if a_norm in db_by_aso:
                    matched_pdf_id = db_by_aso[a_norm]
                    
            # 3. Fuzzy contains
            if not matched_pdf_id:
                for a_key, pid in db_by_aso.items():
                    if n_norm and n_norm in a_key:
                        matched_pdf_id = pid
                        break
                    if aso and normalize_text(aso) in a_key:
                        matched_pdf_id = pid
                        break
                        
            # 4. Try matching PDF title
            if not matched_pdf_id and aso:
                for pid_str, item in db.items():
                    if aso.lower() in item.get('asociacion', '').lower() or item.get('asociacion', '').lower() in aso.lower():
                        matched_pdf_id = int(pid_str)
                        break
                        
            if matched_pdf_id:
                matched_count += 1
            else:
                print(f"Warning: Could not match feature {idx}: nom='{nom}', aso='{aso}'")
                
        # Calculate area
        area_m2 = calculate_polygon_area(geom)
        area_km2 = round(area_m2 / 1000000.0, 2)
        area_ha = round(area_m2 / 10000.0, 1)
        
        # Round geometry coordinates to 5 decimals
        rounded_geom = {
            'type': geom['type'],
            'coordinates': round_coords(geom['coordinates'], precision=5)
        }
        
        # Build clean properties
        clean_props = {
            'fid': idx + 1,
            'pdf_id': matched_pdf_id,
            'is_water': is_water,
            'nomencla': nom,
            'nom_aso': aso if aso else nom,
            'grupo_tier': (props.get('grupo_tier') or '').strip(),
            'usda_orden': usda,
            'suborden': (props.get('suborden') or '').strip(),
            'grangrupo': (props.get('grangrupo') or '').strip(),
            'subgrupo': (props.get('subgrupo') or '').strip(),
            'clas_fao': (props.get('clas_fao') or '').strip(),
            'reg_geo': (props.get('reg_geo') or '').strip(),
            'subcuenca': (props.get('subcuenca') or '').strip(),
            'area_km2': area_km2,
            'area_ha': area_ha
        }
        
        # If matched to db, enhance properties with db values
        if matched_pdf_id:
            db_item = db[str(matched_pdf_id)]
            if not clean_props['grupo_tier'] and db_item.get('grupo_tierra'):
                clean_props['grupo_tier'] = db_item['grupo_tierra']
            if not clean_props['reg_geo'] and db_item.get('region_geografica'):
                clean_props['reg_geo'] = db_item['region_geografica']
            if not clean_props['subcuenca'] and db_item.get('subcuenca'):
                clean_props['subcuenca'] = db_item['subcuenca']
                
        optimized_features.append({
            'type': 'Feature',
            'properties': clean_props,
            'geometry': rounded_geom
        })
        
    print(f"Matched soil features: {matched_count}")
    print(f"Water/saline features: {water_count}")
    print(f"Total processed: {len(optimized_features)}")
    
    out_gj = {
        'type': 'FeatureCollection',
        'name': 'suelos_noa_salta_jujuy',
        'features': optimized_features
    }
    
    out_path = 'data/suelos_geo.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out_gj, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"Saved optimized GeoJSON to {out_path}")

if __name__ == '__main__':
    main()
