import fitz, re, glob, json

def diagnose_all_pdfs():
    print("Diagnosing lab tables in all PDFs...")
    issues = []
    
    with open('data/suelos_db.json', 'r', encoding='utf-8') as f:
        current_db = json.load(f)
        
    for pdf_id in range(1, 217):
        pdf_path = f"{pdf_id}.pdf"
        doc = fitz.open(pdf_path)
        
        # Find all lab pages and their headers
        labs_in_pdf = []
        for pno in range(len(doc)):
            txt = doc[pno].get_text('text')
            if 'Análisis de Laboratorio' in txt or 'Analisis de Laboratorio' in txt:
                m_s = re.search(r'Suelo:\s*([^\(\n\r]+)(?:\s*\(([^)]+)\))?', txt)
                name = m_s.group(1).strip() if m_s else ""
                code = m_s.group(2).strip() if m_s and m_s.group(2) else ""
                labs_in_pdf.append({'page': pno + 1, 'name': name, 'code': code})
                
        # Compare with soils in db
        item = current_db.get(str(pdf_id), {})
        soils = item.get('suelos_asociados', [])
        
        # Check if any soil has modal horizons different from lab horizons
        for s in soils:
            pm_horiz = [h['horizonte'] for h in s.get('perfil_modal', [])]
            lab = s.get('laboratorio')
            if lab and pm_horiz:
                lab_horiz = lab.get('horizontes', [])
                # Compare horizons
                if pm_horiz != lab_horiz:
                    # Check if it's completely different
                    overlap = set(pm_horiz).intersection(set(lab_horiz))
                    issues.append({
                        'pdf': pdf_id,
                        'soil': s.get('nombre'),
                        'code': s.get('nomencla'),
                        'pm_horiz': pm_horiz,
                        'lab_horiz': lab_horiz,
                        'overlap': len(overlap)
                    })
                    
    print(f"Total potential horizon mismatch issues found: {len(issues)}")
    for iss in issues[:20]:
        print(f"PDF {iss['pdf']}: Soil '{iss['soil']}' ({iss['code']}) -> Modal: {iss['pm_horiz']} vs Lab: {iss['lab_horiz']}")

if __name__ == '__main__':
    diagnose_all_pdfs()
