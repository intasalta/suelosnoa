import json, os

def test():
    with open('data/suelos_db.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
    print('suelos_db.json valid units:', len(db))

    with open('data/suelos_geo.json', 'r', encoding='utf-8') as f:
        geo = json.load(f)
    print('suelos_geo.json valid features:', len(geo['features']))

    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    print('index.html size:', len(html), 'bytes')
    assert 'id="map"' in html
    assert 'id="detailDrawer"' in html
    assert 'js/app.js' in html
    assert 'css/styles.css' in html

    with open('js/app.js', 'r', encoding='utf-8') as f:
        js = f.read()
    print('js/app.js size:', len(js), 'bytes')

    with open('css/styles.css', 'r', encoding='utf-8') as f:
        css = f.read()
    print('css/styles.css size:', len(css), 'bytes')

    print('SUCCESS: All files and structures verified!')

if __name__ == '__main__':
    test()
