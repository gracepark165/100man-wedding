# src/app.src.html 의 그림 자리표시자를 base64로 채우고, 완전한 HTML 문서로 감싸 ../index.html 을 만든다.
# 사용: python3 src/build.py
import base64, pathlib
here = pathlib.Path(__file__).parent
s = (here / 'app.src.html').read_text(encoding='utf-8')
for key, f in (('__CAP__', 'duck_cap.webp'), ('__WHITE__', 'duck_white.webp'), ('__PAINT__', 'paint.webp')):
    assert key in s, key
    s = s.replace(key, base64.b64encode((here / f).read_bytes()).decode())
cut = s.index('</style>') + len('</style>')
head, body = s[:cut], s[cut:]
doc = (
    '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<style>html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head + '\n</head>\n<body>\n' + body.strip() + '\n</body>\n</html>\n'
)
(here.parent / 'index.html').write_text(doc, encoding='utf-8')
print('index.html 생성 완료')
