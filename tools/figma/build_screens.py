# ruff: noqa
"""추출한 스토리를 화면으로 조립한다.

`workbench-shellview--split` 은 셸 뼈대만 진짜고 탭 내용은 "파일탭의 내용" 같은 대역이다.
그 자리에 같은 크기로 따로 뽑은 진짜 컴포넌트를 끼워 넣는다 — 이게 "컴포넌트 기반 화면"이다.

손질(폰트 대체·형제 순서 복원)은 보드와 같은 `retune` 을 끼운 **뒤에** 한 번만 돌린다.
라이브러리와 화면이 갈리면 안 된다.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_boards import retune

from paths import CLIENT_OUT, out
SRC=os.path.join(CLIENT_OUT,'screens')

def load(name): return json.load(open(os.path.join(SRC,f'{name}.json')))
def count(n): return 1+sum(count(c) for c in n.get('children',[]) or [])

def walk(n):
    yield n
    for c in n.get('children',[]) or []: yield from walk(c)

def find_all(root,name,w=None):
    return [n for n in walk(root) if n.get('name')==name and (w is None or round(n.get('width',0))==w)]

def fill(slot, tree, label):
    """대역 내용을 진짜 컴포넌트로 갈아 끼운다."""
    t=json.loads(json.dumps(tree))   # 같은 트리를 두 곳에 쓰는 일이 있으니 복사한다
    t['x']=0; t['y']=0; t['name']=label
    slot['children']=[t]
    slot['clipsContent']=True

def desktop_split():
    shell=load('desktop-shell-split')
    root=next(n for n in walk(shell) if n.get('name')=='Shell')
    root['x']=0; root['y']=0
    root['name']='Desktop · 셸 (스토리북 컴포넌트 조립)'
    root['clipsContent']=True

    panes=find_all(root,'div.groupPanelContent',568)
    assert len(panes)==2, f'탭 패널 슬롯 {len(panes)}개 — 2개여야 한다'
    fill(panes[0], load('slot-editor'), 'TextEditor · concept.md')
    fill(panes[1], load('slot-chat'),   'ChatRoom · 에이전트')

    panel=find_all(root,'Panel',256)
    assert len(panel)==1, f'탐색기 패널 슬롯 {len(panel)}개 — 1개여야 한다'
    fill(panel[0], load('slot-tree'), 'DirectoryTreeView')
    return retune(root)

if __name__=='__main__':
    dest=out('screen-desktop-split.json')
    tree=desktop_split()
    json.dump(tree,open(dest,'w'),ensure_ascii=False)
    print(f"screen-desktop-split.json  {tree['width']}x{tree['height']}  {count(tree)} 노드")
