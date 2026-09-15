# ruff: noqa
"""뽑아낸 스토리들을 그룹별 보드 하나로 조립한다.

**뒤집지 않는다.** html-figma 는 children 을 z-index 내림차순으로 내보내고 브리지는
앞선 형제를 위에 그리므로, 스토리 하위 트리의 순서는 이미 맞다. 내가 더하는 껍데기
(보드·제목·캡션)만 브리지 순서(먼저=위)로 직접 쓴다.
"""
import json, os, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import CLIENT_OUT, out

def stories_dir(mode):
    """모드마다 추출물을 따로 담는다 — 한 벌을 덮으면 다른 벌이 사라진다."""
    return os.path.join(CLIENT_OUT, f'stories-{mode}')

STORIES=stories_dir('dark')   # load() 가 보는 곳. set_mode() 로 바꾼다.
MODE='dark'                   # retune 의 검정 글자 보정이 본다.

def set_mode(mode):
    global STORIES, MODE
    STORIES=stories_dir(mode); MODE=mode

BG='#0d1117'; FG='#f0f6fc'; MUTED='#9198a1'; LINE='#2f3742'; ACCENT='#4493f8'
UI='Noto Sans KR'

def rgb(h):
    h=h.lstrip('#'); return {'r':int(h[0:2],16)/255,'g':int(h[2:4],16)/255,'b':int(h[4:6],16)/255}
def solid(h): return [{'type':'SOLID','color':rgb(h),'opacity':1}]
def text(name,x,y,w,h,s,*,size=12,color=FG,weight=400):
    return {'type':'TEXT','name':name,'x':x,'y':y,'width':w,'height':h,'fontFamily':UI,
            'fontWeight':weight,'characters':s,'fontSize':size,'fills':solid(color),
            'lineHeight':{'value':h,'unit':'PIXELS'}}
def rect(name,x,y,w,h,fill):
    return {'type':'RECTANGLE','name':name,'x':x,'y':y,'width':w,'height':h,'fills':solid(fill)}

PAD=64; MAXW=2600; GAP_X=40; GAP_Y=56; GAP_COMP=72
CAP_H=18; CAP_GAP=8; HEAD_H=26

# Figma 에 없는 서체는 Roboto 로 떨어져 UI 가 세리프로 보인다. 데스크톱 셸·모바일 화면과
# 같은 대체(UI=Noto Sans KR, 코드=Cascadia Code)를 여기서 한 번에 건다.
FONT_UI='Noto Sans KR'; FONT_MONO='Cascadia Code'
MONO_HINTS=('mono','cascadia','consolas','menlo','courier','sf mono')

def unblacken(n):
    """다크 추출물의 **순수 검정 글자**를 기본 전경색으로 되돌린다.

    `reset.css`·`globals.css` 어디에도 `body { color }` 가 없다. 그래서 자기 CSS 에
    `color: var(--fgColor-default)` 를 적지 않은 컴포넌트의 글자는 상속받을 색이 없어
    브라우저 기본값인 순수 검정으로 계산된다 — 다크 보드 여섯 장에 147개였다(2026-09-15).
    실앱도 같으니 본래는 코드에서 고칠 일이지만, **그림에서만 손보기로 했다**(사용자 결정).
    코드가 고쳐지면 이 함수는 아무것도 못 찾고 저절로 무해해진다.

    순수 검정만 본다 — Primer 토큰 중 `r=g=b=0` 인 전경색은 없다. 디자인이 일부러 쓴
    `#000` 이 아니라 "아무도 색을 안 정했다" 의 표식이라서다.
    """
    for f in n.get('fills') or []:
        c=f.get('color')
        if f.get('type')=='SOLID' and c and c['r']==0 and c['g']==0 and c['b']==0:
            f['color']=rgb(FG)


def retune(n):
    """추출한 트리를 Figma 쪽 사정에 맞춘다.

    형제 순서를 CSS 회화 순서로 되돌린다. 브리지는 **앞선 형제를 위에** 그리므로 위에 와야 할
    것이 앞에 있어야 한다 — 같은 z 끼리는 DOM 뒤쪽이 위이니 뒤집고, 그 위에 z 내림차순으로
    안정 정렬한다. html-figma 는 z 정렬만 하고 뒤집지 않아 겹치는 형제가 반대로 나온다.
    """
    if n.get('type')=='TEXT':
        fam=(n.get('fontFamily') or '').lower()
        n['fontFamily']=FONT_MONO if any(h in fam for h in MONO_HINTS) else FONT_UI
        if MODE=='dark': unblacken(n)
    ch=n.get('children')
    if ch:
        ch.reverse()
        ch.sort(key=lambda c: -(c.get('__z') or 0))
        for c in ch: retune(c)
    n.pop('__z', None)
    return n

def load(sid):
    n=json.load(open(os.path.join(STORIES,f'{sid}.json')))
    n['x']=0; n['y']=0; n['name']=sid
    # 스토리 안에서 넘친 내용이 옆 칸을 침범하지 않게 스토리 경계에서 자른다 — 실제 DOM 도
    # 그 자리에서 overflow 로 잘린다.
    n['clipsContent']=True
    return retune(n)

def board(group, comps):
    """comps: OrderedDict[컴포넌트 id] -> [스토리 id]"""
    body=[]; y=PAD+44
    for comp, sids in comps.items():
        body.append(text(f'제목 {comp}',PAD,y,900,HEAD_H,comp,size=17,weight=600))
        y+=HEAD_H+16
        row_x=PAD; row_h=0
        for sid in sids:
            node=load(sid)
            w=max(node.get('width',1),1); h=max(node.get('height',1),1)
            cell_w=max(w,120)
            if row_x>PAD and row_x+cell_w>MAXW-PAD:
                y+=row_h+GAP_Y; row_x=PAD; row_h=0
            variant=sid.split('--',1)[1]
            cell=[text('캡션',0,0,cell_w,CAP_H,variant,size=11,color=MUTED),
                  dict(node, x=0, y=CAP_H+CAP_GAP)]
            body.append({'type':'FRAME','name':f'· {variant}','x':row_x,'y':y,
                         'width':cell_w,'height':CAP_H+CAP_GAP+h,'fills':[],
                         'clipsContent':False,'children':cell})
            row_x+=cell_w+GAP_X; row_h=max(row_h,CAP_H+CAP_GAP+h)
        y+=row_h+GAP_COMP
    total_h=y-GAP_COMP+PAD
    head=[text('보드 제목',PAD,PAD,900,30,group,size=24,weight=700),
          rect('구분선',PAD,PAD+40,MAXW-PAD*2,1,LINE)]
    # 브리지는 앞선 형제를 위에 그린다 — 배경은 맨 뒤에 둔다.
    return {'type':'FRAME','name':f'Components · {group}','x':0,'y':0,
            'width':MAXW,'height':total_h,'fills':solid(BG),'clipsContent':True,
            'children':head+body+[rect('배경',0,0,MAXW,total_h,BG)]}

def count(n): return 1+sum(count(c) for c in n.get('children',[]) or [])

# 스토리 제목이 정한 묶음을 보드에서만 옮긴다.
# `Panel` 은 확장이 꽂히는 자리의 크롬이고 `Menu` 는 커널의 메뉴다 — 둘 다 공통 부품이 아니라
# workbench 것이다(2026-09-15 사용자 판단). 코드의 폴더는 그대로 두고 **보드만** 옮긴다.
REGROUP = {'shared-panel': 'workbench', 'shared-menu': 'workbench'}

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'dark'
    assert mode in ('dark','light'), '첫 인자는 dark 또는 light'
    set_mode(mode)
    idx=json.load(open(os.path.join(STORIES,'_index.json')))
    # 아무것도 안 그리는 스토리(`--empty` 중 일부)는 html-figma 가 `[]` 를 낸다. 건너뛴다.
    def drawable(sid):
        n=json.load(open(os.path.join(STORIES,f'{sid}.json')))
        return isinstance(n,dict) and n.get('type') and n.get('width') and n.get('height')
    skipped=[r['id'] for r in idx if not drawable(r['id'])]
    idx=[r for r in idx if r['id'] not in skipped]
    if skipped: print('빈 스토리 건너뜀:', ', '.join(skipped))
    groups=OrderedDict()
    for r in idx:
        sid=r['id']; comp=sid.split('--')[0]
        grp=REGROUP.get(comp, comp.split('-')[0])
        groups.setdefault(grp,OrderedDict()).setdefault(comp,[]).append(sid)
    want=sys.argv[2:] or list(groups)
    for grp in want:
        b=board(grp,groups[grp])
        p=out(f'board-{mode}-{grp}.json')
        json.dump(b,open(p,'w'),ensure_ascii=False)
        print(f'board-{mode}-{grp}.json  {b["width"]}x{b["height"]}  {count(b)} 노드  '
              f'{sum(len(v) for v in groups[grp].values())} 스토리')
