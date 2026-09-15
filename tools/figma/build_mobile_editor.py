# ruff: noqa
"""모바일 에디터 화면 두 장(기본 / 편집 중).

설계 판단 셋을 그림으로 옮긴다.
1. 세로 활동 표시줄(48px)을 하단 탭바로 내린다 — 390px 에서 48px 은 12% 다
2. 탭 스트립을 앱바의 파일명 하나 + 탭 개수 뱃지로 접는다
3. 키보드 위 보조 툴바를 둔다 — 모바일 코드 편집의 성패가 여기 걸린다
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figma_kit import *

ASSIST_H=44; KBD_H=216
ROW=20  # 코드 한 줄 높이 — 데스크톱과 같다

# ── 앱바: 탭 스트립을 파일명 하나 + 탭 개수로 접는다 (설계 판단 2) ──────
def app_bar():
    ch=[
        frame('btn · 탐색기',4,2,44,44,radius=6),
        icon('icon/three-bars',17,15,18,FG_DEFAULT,'three-bars'),
        icon('icon/file',56,17,14,FG_MUTED,'file'),
        text('파일명',76,15,104,18,'concept.md',size=13,weight=600),
        icon('icon/dot · 저장 안 됨',180,20,8,FG_ATTENTION,'circle-filled'),
        rect('탭 개수 배경',196,15,38,18,BG_NEUTRAL,radius=9),
        text('탭 개수',200,15,14,18,'3',size=11,color=FG_MUTED,align='CENTER'),
        icon('icon/chevron-down',216,19,10,FG_MUTED,'chevron-down'),
        frame('btn · 에이전트',298,2,44,44,radius=6),
        icon('icon/chat-sparkle',311,15,18,FG_MUTED,'chat-sparkle'),
        frame('btn · 더 보기',342,2,44,44,radius=6),
        icon('icon/ellipsis',355,15,18,FG_MUTED,'ellipsis'),
        rect('border bottom',0,APPBAR_H-1,W,1,BORDER_DEFAULT),
    ]
    return frame('AppBar',0,STATUS_H,W,APPBAR_H,BG_INSET,children=ch)

# ── 에디터 본문 ────────────────────────────────────────────────────────
# (논리 줄번호 | 본문 | 색). 줄번호가 None 인 행은 소프트랩된 이어지는 행이다.
LINES=[
    (1,'# ARKA',CODE_HEADING),
    (2,'',FG_SECONDARY),
    (3,'ARKA는 개인 워크스페이스 기반의',FG_SECONDARY),
    (None,'Integrated Development',FG_SECONDARY),
    (None,'Environment(IDE)로 다음의 내용을',FG_SECONDARY),
    (None,'핵심 키워드로 삼는다.',FG_SECONDARY),
    (4,'',FG_SECONDARY),
    (5,'- **Agent**: 에이전트를 통한 작업',FG_DEFAULT),
    (None,'  수행이 주축이다',FG_DEFAULT),
    (6,'- **Knowledge & Retrieval**: 개인',FG_DEFAULT),
    (None,'  지식 관리 시스템으로서, 사용자가',FG_DEFAULT),
    (None,'  아는 것과 그 맥락을 에이전트와',FG_DEFAULT),
    (None,'  공유한다',FG_DEFAULT),
    (7,'- **Archiving**: 사용자가 데이터를',FG_DEFAULT),
    (None,'  개인 워크스페이스에 명시적으로',FG_DEFAULT),
    (None,'  쌓는다',FG_DEFAULT),
    (8,'',FG_SECONDARY),
    (9,'## 차별성',CODE_HEADING),
    (10,'',FG_SECONDARY),
    (11,'- **폰에서도 되는 편집기.** 파일과',FG_DEFAULT),
    (None,'  무거운 프로세스는 원격 노드에 두고',FG_DEFAULT),
    (None,'  PWA(설치되는 웹앱)로 붙는다.',FG_DEFAULT),
    (None,'  데스크톱과 기능이 같고 화면',FG_DEFAULT),
    (None,'  크기에서 오는 편의만 다르다.',FG_DEFAULT),
    (12,'',FG_SECONDARY),
    (13,'- **에이전트가 관제탑이 아니라',FG_DEFAULT),
    (None,'  편집기 안에 있다.** 에이전트 전용',FG_DEFAULT),
    (None,'  도구는 코드를 직접 만질 자리가',FG_DEFAULT),
    (None,'  없고, 에디터에 얹은 보조 기능은',FG_DEFAULT),
    (None,'  세션이 부속이다.',FG_DEFAULT),
    (14,'',FG_SECONDARY),
    (15,'## 제품 원칙',CODE_HEADING),
    (16,'',FG_SECONDARY),
]
GUTTER=36; PAD_TOP=8; TEXT_X=44

def editor(height, caret_row=None):
    rows=int((height-PAD_TOP)//ROW)
    ch=[rect('gutter',0,0,GUTTER,height,BG_DEFAULT)]
    if caret_row is not None and caret_row<rows:
        ch.append(rect('현재 줄',0,PAD_TOP+caret_row*ROW,W,ROW,BG_MUTED))
    for i,(no,s,color) in enumerate(LINES[:rows]):
        y=PAD_TOP+i*ROW
        if no is not None:
            active = caret_row is not None and i==caret_row
            ch.append(text(f'lineno {no}',0,y,28,ROW,str(no),font=CODE,size=11,
                           color=FG_MUTED if active else LINENO_IDLE,align='RIGHT'))
        if s:
            ch.append(text(f'code {i}',TEXT_X,y,W-TEXT_X-8,ROW,s,font=CODE,size=12,color=color))
    if caret_row is not None and caret_row<rows:
        s=LINES[caret_row][1]
        # Cascadia Code 기준 폭: 라틴 0.6em, 한글 1.2em
        wpx=sum(14.4 if ord(c)>0x1100 else 7.2 for c in s)
        ch.append(rect('caret',TEXT_X+wpx+1,PAD_TOP+caret_row*ROW+2,2,16,FG_DEFAULT))
    return frame('Editor',0,STATUS_H+APPBAR_H,W,height,BG_DEFAULT,children=ch)

# ── 키보드 위 보조 툴바 (설계 판단 3) ──────────────────────────────────
KEYS=['Tab','{','}','(',')','"','-','#']

def assist_bar(y):
    ch=[rect('border top',0,0,W,1,BORDER_DEFAULT)]
    kw,gap,pad=32,6,8
    for i,k in enumerate(KEYS):
        x=pad+i*(kw+gap)
        ch.append(rect(f'key {k}',x,7,kw,30,BG_NEUTRAL,radius=6))
        ch.append(text(f'label {k}',x,7,kw,30,k,font=CODE,size=11 if len(k)>1 else 14,
                       color=FG_SECONDARY,align='CENTER'))
    for j,key in enumerate(['arrow-left','arrow-right']):
        x=pad+(len(KEYS)+j)*(kw+gap)
        ch.append(rect(f'key {key}',x,7,kw,30,BG_NEUTRAL,radius=6))
        ch.append(icon(f'icon/{key}',x+8,15,14,FG_SECONDARY,key))
    return frame('보조 툴바',0,y,W,ASSIST_H,BG_MUTED,children=ch)

# ── 시스템 키보드 (우리 것이 아님을 보이려고 iOS 다크 톤으로 둔다) ──────
def keyboard(y):
    ch=[]; kh=42; top=8; gap=10
    def key(x,yy,w,label,dark=False,size=15):
        ch.append(rect(f'key {label}',x,yy,w,kh,KBD_KEY_DARK if dark else KBD_KEY,radius=5))
        ch.append(text(f'kbd {label}',x,yy+(kh-20)/2,w,20,label,size=size,color=KBD_FG,align='CENTER'))
    r1='qwertyuiop'; r2='asdfghjkl'; r3='zxcvbnm'
    kw,kg=33,6
    y1=top
    x0=(W-(len(r1)*kw+(len(r1)-1)*kg))/2
    for i,c in enumerate(r1): key(x0+i*(kw+kg),y1,kw,c)
    y2=y1+kh+gap
    x0=(W-(len(r2)*kw+(len(r2)-1)*kg))/2
    for i,c in enumerate(r2): key(x0+i*(kw+kg),y2,kw,c)
    y3=y2+kh+gap
    mid=len(r3)*kw+(len(r3)-1)*kg
    x0=(W-(mid+2*(44+kg)))/2
    key(x0,y3,44,'shift',dark=True,size=11)
    for i,c in enumerate(r3): key(x0+44+kg+i*(kw+kg),y3,kw,c)
    key(x0+44+kg+mid+kg,y3,44,'del',dark=True,size=11)
    y4=y3+kh+gap
    key(10,y4,44,'123',dark=True,size=12)
    key(60,y4,44,'😊',dark=True,size=12)
    key(110,y4,180,'space',size=12)
    key(296,y4,84,'return',dark=True,size=12)
    return frame('시스템 키보드',0,y,W,KBD_H,KBD_BG,children=ch)


# ── 화면 두 장 ─────────────────────────────────────────────────────────
def screen_rest():
    eh=H-STATUS_H-APPBAR_H-TABBAR_H-HOME_H
    return frame('shell',0,0,W,H,BG_DEFAULT,children=[
        status_bar(), app_bar(), editor(eh),
        tab_bar(STATUS_H+APPBAR_H+eh), home_indicator(H-HOME_H)])

def screen_typing():
    eh=H-STATUS_H-APPBAR_H-ASSIST_H-KBD_H
    return frame('shell',0,0,W,H,BG_DEFAULT,children=[
        status_bar(), app_bar(), editor(eh,caret_row=23),
        assist_bar(STATUS_H+APPBAR_H+eh), keyboard(STATUS_H+APPBAR_H+eh+ASSIST_H),
        rect('home bar',(W-134)/2,H-12,134,5,FG_MUTED,radius=3,opacity=0.6)])

if __name__=='__main__':
    from paths import OUT as out
    os.makedirs(out, exist_ok=True)
    for fn,tree in [('mobile-editor-rest.json',screen_rest()),
                    ('mobile-editor-typing.json',screen_typing())]:
        print(fn, emit(os.path.join(out,fn),tree), '노드')
