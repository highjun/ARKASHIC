# ruff: noqa
"""이 도구들이 읽고 쓰는 자리.

**스크립트는 `tools/figma/`(추적됨)에 살고 산출물은 `.output/`(추적 안 됨)에 남는다.**
파이프라인을 고칠 때마다 이력이 남아야 해서 갈랐다 — 2026-09-15까지는 스크립트도
`.output/` 안에 있어서 크게 고쳐도 아무 기록이 없었다.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))

#: 보드·화면 JSON이 나오는 자리.
OUT = os.path.join(REPO, '.output', 'figma')

#: `extract.mjs` 가 스토리를 떨어뜨리는 자리. 모드·폼팩터마다 하위 디렉터리가 하나씩 선다.
CLIENT_OUT = os.path.join(REPO, 'packages', 'client', '.output', 'figma')


def out(*parts):
    """`OUT` 아래 경로를 만들고 디렉터리를 보장한다."""
    os.makedirs(OUT, exist_ok=True)
    return os.path.join(OUT, *parts)
