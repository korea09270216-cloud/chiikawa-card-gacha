#!/usr/bin/env python3
"""칭호 전용 서체(TitleDisplay) 서브셋 생성기.

titles.js 의 TITLES[].name 에 쓰인 글자 + 기본 영문/숫자/기호만 담은 woff2 를 만든다(수 KB~수십 KB).
칭호를 추가/수정했거나 서체를 바꾸고 싶으면 아래처럼 다시 실행하면 된다(파일이 늦게 뜨지 않도록 index.html 에서 preload).

  python tools/make-title-font.py                      # 기본(hahmlet 900) -> assets/fonts/title-display.woff2 (+ OFL.txt, FONT-SOURCE.txt)
  python tools/make-title-font.py --family blackhansans  # 다른 후보로 교체
  python tools/make-title-font.py --family gasoekone --out examine/fonts/gasoekone.woff2 --no-license   # 미리보기용 후보 파일만

--family: hahmlet(Hahmlet 900) | blackhansans | gasoekone | songmyung | dohyeon | gugi   (전부 SIL OFL 1.1, google/fonts 저장소 ofl/ 에서 내려받음)
필요: pip install fonttools brotli.  원본 TTF 는 임시 폴더에 캐시되고 저장소에는 넣지 않는다.
서브셋에 없는 글자는 CSS 의 --title-font 폴백(맑은 고딕 등)으로 자연스럽게 대체된다.
"""
import argparse, json, re, sys, tempfile, urllib.parse, urllib.request
from datetime import date
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
FAMILIES = {  # key: (폴더, 파일, 이름, 가변 wght)
    'hahmlet':     ('hahmlet', 'Hahmlet[wght].ttf', 'Hahmlet Black', 900),
    'blackhansans': ('blackhansans', 'BlackHanSans-Regular.ttf', 'Black Han Sans', None),
    'gasoekone':   ('gasoekone', 'GasoekOne-Regular.ttf', 'Gasoek One', None),
    'songmyung':   ('songmyung', 'SongMyung-Regular.ttf', 'Song Myung', None),
    'dohyeon':     ('dohyeon', 'DoHyeon-Regular.ttf', 'Do Hyeon', None),
    'gugi':        ('gugi', 'Gugi-Regular.ttf', 'Gugi', None),
}
# 이름 외에 항상 담는 글자: 영문/숫자/기호(새 칭호에 SSS, 404, [ ] 등이 섞여도 되도록) + 칭호 목록의 티어 라벨.
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + '·…‘’“”?!' + '일반희귀영웅전설'

def title_names():
    src = (ROOT / 'titles.js').read_text(encoding='utf-8')
    block = src[src.index('export const TITLES'):]
    names = [json.loads('"%s"' % m) for m in re.findall(r'"name":\s*"((?:[^"\\]|\\.)*)"', block)]
    if not names:
        sys.exit('titles.js 에서 TITLES[].name 을 찾지 못했어요.')
    return names

def fetch(url, dest):
    if not dest.exists():
        print('download', url)
        urllib.request.urlretrieve(url, dest)
    return dest

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--family', default='hahmlet', choices=FAMILIES)
    ap.add_argument('--out', default=str(ROOT / 'assets/fonts/title-display.woff2'))
    ap.add_argument('--no-license', action='store_true', help='OFL.txt / FONT-SOURCE.txt 를 쓰지 않음(미리보기 후보용)')
    args = ap.parse_args()
    folder, fname, label, wght = FAMILIES[args.family]
    cache = Path(tempfile.gettempdir()) / 'chiikawa-title-font'
    cache.mkdir(exist_ok=True)
    ttf = fetch(RAW + folder + '/' + urllib.parse.quote(fname), cache / (folder + '-' + re.sub(r'[^\w.-]', '_', fname)))
    font = TTFont(ttf)
    if wght is not None:  # 가변 폰트는 지정한 굵기로 고정(인스턴스)
        from fontTools.varLib import instancer
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    names = title_names()
    chars = sorted(set(''.join(names) + EXTRA))
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'locl', 'ccmp', 'mark', 'mkmk']
    opts.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14]  # 저작권/라이선스 문구는 남긴다
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(chars))
    sub.subset(font)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(out)
    cmap = font.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap and c != ' ']
    print(f'{label}: {len(names)} names, {len(chars)} chars -> {out} ({out.stat().st_size:,} bytes)')
    if missing:
        print('폰트에 없는 글자(폴백 사용):', ''.join(missing))
    if not args.no_license:
        lic = out.parent / 'OFL.txt'
        urllib.request.urlretrieve(RAW + folder + '/OFL.txt', lic)
        (out.parent / 'FONT-SOURCE.txt').write_text(
            f'title-display.woff2 = {label}' + (f' (wght {wght})' if wght else '') + ' 서브셋\n'
            f'원본: {RAW}{folder}/{fname}\n라이선스: SIL Open Font License 1.1 (OFL.txt)\n'
            f'글자: titles.js 의 칭호 이름 {len(names)}개 + 영문/숫자/기호 + 티어 라벨, 생성일 {date.today()}\n'
            f'재생성: python tools/make-title-font.py --family {args.family}\n', encoding='utf-8')

main()
