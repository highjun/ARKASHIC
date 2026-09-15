# ruff: noqa
"""모바일 화면 두 장 — 탐색기 드로어 / 에이전트 채팅.

탐색기는 데스크톱 패널(`30:18`)의 파일 트리를 그대로 쓰되 줄 높이만
`row/heightTouch`(44)로 올린다 — 데스크톱은 `row/height`(28)다.
채팅은 "에이전트가 관제탑이 아니라 편집기 안에 있다"를 그림으로 옮긴다.
에이전트가 파일 변경을 카드로 제안하고, 적용 여부는 사용자가 정한다.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figma_kit import *
from build_mobile_editor import app_bar, editor

def mtext(name,x,y,w,s,*,lines=1,lh=20,font=UI,size=13,color=FG_DEFAULT,weight=400,align='LEFT'):
    """여러 줄 텍스트. 줄 높이를 따로 두려고 text() 대신 쓴다."""
    return {'type':'TEXT','name':name,'x':x,'y':y,'width':w,'height':lh*lines,
            'fontFamily':font,'fontWeight':weight,'characters':s,'fontSize':size,
            'fills':solid(color),'textAlignHorizontal':align,
            'lineHeight':{'value':lh,'unit':'PIXELS'}}

# ══ 화면 3 · 탐색기 드로어 ═════════════════════════════════════════════
DRAWER_W=320; ROW_TOUCH=44   # ARKA Size 의 row/heightTouch

TREE=[  # (깊이, 이름, 종류, 펼침, 선택)
    (0,'arkashic','dir',True,False),
    (1,'packages','dir',True,False),
    (2,'client','dir',True,False),
    (3,'src','dir',False,False),
    (3,'package.json','file',False,False),
    (2,'contracts','dir',False,False),
    (2,'server','dir',False,False),
    (1,'docs','dir',True,False),
    (2,'adr','dir',False,False),
    (2,'tasks','dir',False,False),
    (2,'concept.md','file',False,True),
    (2,'overview.md','file',False,False),
    (1,'ops','dir',False,False),
    (1,'CLAUDE.md','file',False,False),
    (1,'README.md','file',False,False),
]

def tree_row(y,depth,name,kind,open_,selected):
    bx=8+depth*16
    ch=[]
    if selected:
        ch.append(rect('선택',0,0,DRAWER_W,ROW_TOUCH,BG_NEUTRAL))
        ch.append(rect('accent',0,0,2,ROW_TOUCH,FG_ACCENT))
    if kind=='dir':
        ch.append(icon('icon/chevron',bx,15,14,FG_MUTED,'chevron-down' if open_ else 'chevron-right'))
    ch.append(icon('icon/'+kind,bx+18,14,16,
                   FG_MUTED if kind=='file' else FG_ACCENT,
                   'file' if kind=='file' else ('folder-opened' if open_ else 'folder')))
    ch.append(mtext('name',bx+42,13,DRAWER_W-bx-50,name,size=14,lh=18,
                    color=FG_DEFAULT if selected else FG_SECONDARY,
                    weight=600 if selected else 400))
    return frame(f'row · {name}',0,y,DRAWER_W,ROW_TOUCH,children=ch)

def drawer():
    h=H-STATUS_H
    head=frame('panel header',0,0,DRAWER_W,44,children=[
        mtext('제목',16,13,120,'탐색기',size=12,lh=18,color=FG_MUTED,weight=600),
        frame('btn · 새 파일',184,0,44,44,radius=6),
        icon('icon/new-file',197,13,18,FG_MUTED,'new-file'),
        frame('btn · 모두 접기',228,0,44,44,radius=6),
        icon('icon/collapse-all',241,13,18,FG_MUTED,'collapse-all'),
        frame('btn · 더 보기',272,0,44,44,radius=6),
        icon('icon/ellipsis',285,13,18,FG_MUTED,'ellipsis'),
    ])
    rows=[tree_row(44+i*ROW_TOUCH,*r) for i,r in enumerate(TREE)]
    return frame('Drawer · 탐색기',0,STATUS_H,DRAWER_W,h,BG_INSET,
                 children=[head]+rows+[rect('border right',DRAWER_W-1,0,1,h,BORDER_DEFAULT)])

def screen_drawer():
    eh=H-STATUS_H-APPBAR_H-TABBAR_H-HOME_H
    return frame('shell',0,0,W,H,BG_DEFAULT,children=[
        # 뒤에 깔린 에디터 — 드로어는 그 위를 덮는 모달이다
        status_bar(), app_bar(), editor(eh),
        tab_bar(STATUS_H+APPBAR_H+eh), home_indicator(H-HOME_H),
        rect('scrim',0,STATUS_H,W,H-STATUS_H,BG_INSET,opacity=0.6),
        drawer(),
        rect('home bar',(W-134)/2,H-12,134,5,FG_MUTED,radius=3,opacity=0.6)])

# ══ 화면 4 · 에이전트 채팅 ═════════════════════════════════════════════
CTX_H=32; COMPOSER_H=56
MSG_Y=STATUS_H+APPBAR_H+CTX_H
MSG_H=H-MSG_Y-COMPOSER_H-TABBAR_H-HOME_H

def chat_app_bar():
    return frame('AppBar',0,STATUS_H,W,APPBAR_H,BG_INSET,children=[
        frame('btn · 뒤로',4,2,44,44,radius=6),
        icon('icon/chevron-left',17,15,18,FG_DEFAULT,'chevron-left'),
        mtext('제목',52,15,160,'에이전트',size=15,lh=18,weight=600),
        frame('btn · 새 세션',298,2,44,44,radius=6),
        icon('icon/add',311,15,18,FG_MUTED,'add'),
        frame('btn · 더 보기',342,2,44,44,radius=6),
        icon('icon/ellipsis',355,15,18,FG_MUTED,'ellipsis'),
        rect('border bottom',0,APPBAR_H-1,W,1,BORDER_DEFAULT),
    ])

def context_row():
    """무엇을 맥락으로 들고 있는지를 늘 보이게 둔다 — 대화가 아니라 tooling 으로 다룬다."""
    return frame('컨텍스트',0,STATUS_H+APPBAR_H,W,CTX_H,BG_DEFAULT,children=[
        rect('chip · 파일',16,4,122,24,BG_NEUTRAL,radius=12),
        icon('icon/file',26,10,12,FG_MUTED,'file'),
        mtext('chip 이름',44,4,88,'concept.md',size=11,lh=24,color=FG_SECONDARY),
        rect('chip · 추가',146,4,74,24,BG_DEFAULT,radius=12),
        icon('icon/add',156,10,12,FG_MUTED,'add'),
        mtext('chip 추가',174,4,44,'컨텍스트',size=11,lh=24,color=FG_MUTED),
    ])

def user_bubble(y,s,lines,w):
    x=W-16-w
    return [rect('말풍선',x,y,w,lines*20+20,BG_NEUTRAL,radius=14),
            mtext('본문',x+12,y+10,w-24,s,lines=lines,size=13,color=FG_DEFAULT)]

def agent_block(y,s,lines):
    return [icon('icon/chat-sparkle',16,y+1,14,FG_ACCENT,'chat-sparkle'),
            mtext('말한 이',36,y,80,'에이전트',size=11,lh=16,color=FG_MUTED),
            mtext('본문',16,y+22,W-32,s,lines=lines,size=13,color=FG_SECONDARY)]

def callout(y,s,lines):
    """제품 원칙: 결정은 사용자가, 경고는 에이전트가."""
    h=34+lines*20+12
    return frame('경고 · 확인 필요',16,y,W-32,h,BG_MUTED,radius=8,children=[
        rect('accent',0,0,2,h,FG_ATTENTION),
        icon('icon/warning',12,11,14,FG_ATTENTION,'warning'),
        mtext('제목',32,10,120,'확인 필요',size=12,lh=16,color=FG_ATTENTION,weight=600),
        mtext('본문',12,34,W-32-24,s,lines=lines,size=12,color=FG_SECONDARY)])

def tool_card(y):
    """에이전트는 제안까지 하고 멈춘다 — 적용은 사용자가 누른다."""
    return frame('제안 · 파일 변경',16,y,W-32,84,BG_MUTED,radius=8,children=[
        icon('icon/file',12,13,14,FG_MUTED,'file'),
        mtext('파일',34,11,150,'concept.md',size=13,lh=18,weight=600),
        mtext('추가',236,11,34,'+1',size=12,lh=18,color=FG_SUCCESS,align='RIGHT'),
        mtext('삭제',276,11,34,'-1',size=12,lh=18,color=FG_DANGER,align='RIGHT'),
        rect('btn · 변경 보기',12,44,100,28,BG_NEUTRAL,radius=6),
        mtext('label 변경 보기',12,44,100,'변경 보기',size=12,lh=28,color=FG_SECONDARY,align='CENTER'),
        rect('btn · 적용',120,44,72,28,BG_EMPHASIS,radius=6),
        mtext('label 적용',120,44,72,'적용',size=12,lh=28,color=FG_ON_EMPHASIS,align='CENTER'),
    ])

def messages():
    ch=[]
    ch+=user_bubble(12,'차별성 네 항목 중에 v2 와\n겹치는 것이 있나?',2,254)
    ch+=agent_block(84,'있다. "남는 자리가 내 것이다"는 v2 의 지식\n관리와 같은 것을 말한다. v1 범위에는 그\n기능이 아직 없다.',3)
    ch.append(callout(176,'차별성에 두면 v1 이 지키지 못할 약속이 된다.\nv2 로 옮기거나, v1 이 실제로 주는 것(대화와\n산출물의 로컬 보관)으로 좁혀야 한다.',3))
    ch+=user_bubble(292,'v1 이 주는 것으로 좁혀줘',1,190)
    ch+=agent_block(364,'concept.md 14 행을 고쳤다. 적용하기 전에\n변경을 확인해라.',2)
    ch.append(tool_card(436))
    return frame('Messages',0,MSG_Y,W,MSG_H,BG_DEFAULT,children=ch)

def composer():
    return frame('Composer',0,MSG_Y+MSG_H,W,COMPOSER_H,BG_DEFAULT,children=[
        rect('border top',0,0,W,1,BORDER_DEFAULT),
        frame('btn · 첨부',2,6,44,44,radius=6),
        icon('icon/add',15,19,18,FG_MUTED,'add'),
        rect('입력',44,10,292,36,BG_MUTED,radius=18),
        mtext('placeholder',60,10,220,'무엇을 할까',size=13,lh=36,color=FG_MUTED),
        rect('btn · 보내기',344,10,36,36,BG_EMPHASIS,radius=18),
        icon('icon/send',354,20,16,FG_ON_EMPHASIS,'send'),
    ])

def screen_chat():
    return frame('shell',0,0,W,H,BG_DEFAULT,children=[
        status_bar(), chat_app_bar(), context_row(), messages(), composer(),
        tab_bar(MSG_Y+MSG_H+COMPOSER_H,active='에이전트'), home_indicator(H-HOME_H)])

if __name__=='__main__':
    from paths import OUT as out
    os.makedirs(out, exist_ok=True)
    for fn,tree in [('mobile-drawer.json',screen_drawer()),('mobile-chat.json',screen_chat())]:
        print(fn, emit(os.path.join(out,fn),tree), '노드')
