# ruff: noqa
"""figma-mcp-bridge 의 import_html_layers 에 먹일 LayerNode 트리를 만드는 공통 도구.

두 가지가 브리지 고유의 함정이라 여기에 가둔다.
- **앞선 형제가 위에 그려진다.** 칠하는 순서(먼저=아래)로 쓰고 flip() 으로 뒤집는다.
- **SVG 루트 프레임에 fills 를 주면 흰 사각형이 된다.** 색은 SVG 문자열 안에 굽는다.

색·치수는 Figma 로컬 변수(ARKA Color / ARKA Size)와 데스크톱 셸 `29:2` 실측값을 따른다.
"""
import json

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import REPO
ICONS = json.load(open(os.path.join(REPO,'packages','client','node_modules','@iconify-json','codicon','icons.json')))

# ── 색: ARKA Color 변수값 ───────────────────────────────────────────────
BG_DEFAULT='#0d1117'; BG_INSET='#010409'; BG_MUTED='#151b23'; BG_NEUTRAL='#212830'
FG_DEFAULT='#f0f6fc'; FG_MUTED='#9198a1'; FG_ACCENT='#4493f8'; FG_ATTENTION='#d29922'
BG_EMPHASIS='#1f6feb'
FG_ON_EMPHASIS='#ffffff'; FG_SUCCESS='#3fb950'; FG_DANGER='#f85149'
BORDER_DEFAULT='#3d444d'; BORDER_MUTED='#2f3742'
FG_SECONDARY='#c9d1d9'   # 데스크톱 본문색
LINENO_IDLE='#484f58'; CODE_HEADING='#79c0ff'
KBD_BG='#1c1c1e'; KBD_KEY='#48484a'; KBD_KEY_DARK='#2f2f31'; KBD_FG='#ffffff'

UI='Noto Sans KR'; CODE='Cascadia Code'

def rgb(h):
    h=h.lstrip('#'); return {'r':int(h[0:2],16)/255,'g':int(h[2:4],16)/255,'b':int(h[4:6],16)/255}
def solid(h,o=1): return [{'type':'SOLID','color':rgb(h),'opacity':o}]

def frame(name,x,y,w,h,fill=None,radius=None,children=None):
    n={'type':'FRAME','name':name,'x':x,'y':y,'width':w,'height':h,
       'fills':solid(fill) if fill else [], 'clipsContent':True}
    if radius is not None: n['cornerRadius']=radius
    if children: n['children']=children
    return n

def rect(name,x,y,w,h,fill,radius=None,opacity=None):
    n={'type':'RECTANGLE','name':name,'x':x,'y':y,'width':w,'height':h,'fills':solid(fill)}
    if radius is not None: n['cornerRadius']=radius
    if opacity is not None: n['opacity']=opacity
    return n

def text(name,x,y,w,h,s,*,font=UI,size=12,color=FG_DEFAULT,weight=400,align='LEFT'):
    """h 를 그대로 lineHeight 로 써서 세로 가운데를 맞춘다 (textAutoResize 가 HEIGHT 로 강제되므로)."""
    return {'type':'TEXT','name':name,'x':x,'y':y,'width':w,'height':h,
            'fontFamily':font,'fontWeight':weight,'characters':s,'fontSize':size,
            'fills':solid(color),'textAlignHorizontal':align,
            'lineHeight':{'value':h,'unit':'PIXELS'}}

def icon(name,x,y,size,color,key):
    ic=ICONS['icons'][key]
    vw=ic.get('width',ICONS.get('width',16)); vh=ic.get('height',ICONS.get('height',16))
    body=ic['body'].replace('currentColor',color)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {vw} {vh}">{body}</svg>'
    return {'type':'SVG','name':name,'x':x,'y':y,'width':size,'height':size,'svg':svg}


W=390; H=844
STATUS_H=44; APPBAR_H=48; TABBAR_H=56; HOME_H=24

def flip(n):
    """브리지는 앞선 형제를 위에 그린다 — 칠하는 순서로 쓴 트리를 뒤집는다."""
    if 'children' in n:
        for c in n['children']: flip(c)
        n['children'].reverse()
    return n

def count(n):
    return 1+sum(count(c) for c in n.get('children',[]))

def emit(path,tree):
    json.dump(flip(tree),open(path,'w'),ensure_ascii=False)
    return count(tree)

# ── 모든 화면이 공유하는 조각 ──────────────────────────────────────────
def status_bar():
    return frame('StatusBar',0,0,W,STATUS_H,BG_INSET,children=[
        text('time',24,13,60,18,'9:41',size=13,weight=600),
        text('status',270,15,96,14,'5G  100%',size=11,color=FG_MUTED,align='RIGHT'),
    ])

TABS=[('파일','files'),('검색','search'),('변경','source-control'),
      ('에이전트','chat-sparkle'),('계정','account')]

def tab_bar(y,active='파일'):
    iw=W/len(TABS)
    ch=[rect('border top',0,0,W,1,BORDER_DEFAULT)]
    for i,(label,key) in enumerate(TABS):
        x=i*iw; on=(label==active); color=FG_ACCENT if on else FG_MUTED
        if on: ch.append(rect('accent',x+iw/2-14,1,28,2,FG_ACCENT))
        ch.append(icon(f'icon/{key}',x+iw/2-10,11,20,color,key))
        ch.append(text(f'label {label}',x,35,iw,14,label,size=10,color=color,align='CENTER'))
    return frame('TabBar',0,y,W,TABBAR_H,BG_INSET,children=ch)

def home_indicator(y,bg=BG_DEFAULT):
    return frame('Home indicator',0,y,W,HOME_H,bg,children=[
        rect('bar',(W-134)/2,10,134,5,FG_MUTED,radius=3,opacity=0.6)])
