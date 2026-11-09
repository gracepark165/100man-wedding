# src/app.src.html 의 그림 자리표시자를 base64로 채우고, 완전한 HTML 문서로 감싸 ../index.html 을 만든다.
# 사용: python3 src/build.py
import base64, json, os, pathlib
here = pathlib.Path(__file__).parent
s = (here / 'app.src.html').read_text(encoding='utf-8')
for key, f in (('__CAP__', 'duck_cap.webp'), ('__WHITE__', 'duck_white.webp'), ('__PAINT__', 'paint.webp')):
    assert key in s, key
    s = s.replace(key, base64.b64encode((here / f).read_bytes()).decode())
# 공공예식장 목록: VENUES_JSON(테스트용) 또는 src/venues.json. 깨진 JSON이면 여기서 실패한다
venues = json.loads(pathlib.Path(os.environ.get('VENUES_JSON') or (here / 'venues.json')).read_text(encoding='utf-8'))
assert isinstance(venues, list), 'venues.json은 배열이어야 합니다'
for v in venues:
    for k in ('id', 'name', 'gu', 'area', 'cap', 'fee', 'food', 'open', 'url', 'checked'):
        assert k in v, f"{v.get('id', '?')}: '{k}' 필드가 없습니다"
assert '__PUBLIC_VENUES__' in s
s = s.replace('__PUBLIC_VENUES__', json.dumps(venues, ensure_ascii=False).replace('</', '<\\/'))
cut = s.index('</style>') + len('</style>')
head, body = s[:cut], s[cut:]
doc = (
    '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<style>html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head + '\n</head>\n<body>\n' + body.strip() + '\n</body>\n</html>\n'
)
out = pathlib.Path(os.environ.get('OUT') or (here.parent / 'index.html'))  # 테스트는 OUT으로 임시 파일에 빌드한다
out.write_text(doc, encoding='utf-8')
print('index.html 생성 완료')
