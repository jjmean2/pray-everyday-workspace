#!/usr/bin/env python3
"""설계 문서 정합성 검사. 규칙은 design/README.md를 따른다.

오류가 있으면 종료 코드 1로 끝난다. 경고와 안내는 커밋을 막지 않는다.
"""
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRUNE_DIRS = {".git", "node_modules", ".venv", "dist", "build", "archive", "templates"}
ADR_STATUSES = {"Proposed", "Accepted", "Superseded", "Rejected"}
REQ_STATUSES = {"제안", "확정", "구현됨", "보류"}
REQ_CLASSES = {"미분석", "적합", "확장", "재설계"}
ARCH_LINE_BUDGET = 400
FRICTION_THRESHOLD = 3

ADR_FILE = re.compile(r"^(\d{4})-.+\.md$")
ADR_STATUS = re.compile(r"^-\s*\*\*상태\*\*:\s*(\S+)", re.MULTILINE)
LINK = re.compile(r"\]\(([^)#\s]+)")
REQ_ID = re.compile(r"^R-\d+$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

errors, warnings, notes = [], [], []


def rel(path):
    return path.relative_to(ROOT).as_posix() or "."


def find_scopes():
    scopes = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in PRUNE_DIRS]
        if Path(dirpath).name == "design" and "ARCHITECTURE.md" in filenames:
            scopes.append(Path(dirpath))
    return sorted(scopes)


def table_rows(path):
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("|") and not re.match(r"^\|[\s|:-]+\|$", line):
            rows.append([cell.strip() for cell in line.strip("|").split("|")])
    return rows


def adr_status(path):
    match = ADR_STATUS.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def check_adrs(design):
    """ADR 위치와 상태를 확인하고, decisions/의 ADR을 {경로: 상태}로 돌려준다."""
    active = {}
    numbers = Counter()
    for folder, is_archive in ((design / "decisions", False), (design / "archive" / "decisions", True)):
        if not folder.exists():
            continue
        for path in sorted(folder.glob("*.md")):
            match = ADR_FILE.match(path.name)
            if not match:
                errors.append(f"{rel(path)}: ADR 파일명은 NNNN-제목.md 형식이어야 합니다")
                continue
            numbers[match.group(1)] += 1
            status = adr_status(path)
            if status not in ADR_STATUSES:
                errors.append(f"{rel(path)}: 상태가 없거나 잘못됐습니다 ({status})")
                continue
            if not is_archive and status in {"Superseded", "Rejected"}:
                errors.append(f"{rel(path)}: {status} ADR은 archive/decisions/로 옮겨야 합니다")
            if is_archive and status == "Proposed":
                errors.append(f"{rel(path)}: Proposed ADR이 archive에 있습니다")
            if not is_archive:
                active[path.resolve()] = status
    for number, count in numbers.items():
        if count > 1:
            errors.append(f"{rel(design)}: ADR 번호 {number}가 {count}번 쓰였습니다")
    return active


def check_architecture(design, active_adrs):
    arch = design / "ARCHITECTURE.md"
    text = arch.read_text(encoding="utf-8")
    linked = set()
    for target in LINK.findall(text):
        if re.match(r"^[a-z]+:", target):
            continue
        resolved = (arch.parent / target).resolve()
        if not resolved.exists():
            errors.append(f"{rel(arch)}: 없는 파일을 링크합니다 ({target})")
            continue
        if "archive" in resolved.relative_to(ROOT).parts:
            errors.append(f"{rel(arch)}: archive를 링크합니다. 현재 설계는 archive에 기대면 안 됩니다 ({target})")
            continue
        linked.add(resolved)

    for path, status in active_adrs.items():
        if path in linked:
            continue
        if status == "Accepted":
            warnings.append(f"{rel(path)}: ARCHITECTURE.md가 근거로 링크하지 않는 Accepted ADR입니다. archive 후보입니다")
        elif status == "Proposed":
            warnings.append(f"{rel(path)}: 결정 대기 목록에 링크되지 않은 Proposed ADR입니다")
    for path, status in active_adrs.items():
        if status == "Proposed":
            notes.append(f"결정 대기: {rel(path)}")

    lines = text.count("\n") + 1
    if lines > ARCH_LINE_BUDGET:
        warnings.append(f"{rel(arch)}: {lines}줄입니다. {ARCH_LINE_BUDGET}줄을 넘으면 스코프 분리를 검토하세요")


def check_requirements(design):
    current = [row for row in table_rows(design / "REQUIREMENTS.md") if REQ_ID.match(row[0])]
    archived = {row[0] for row in table_rows(design / "archive" / "requirements.md") if REQ_ID.match(row[0])}
    seen = Counter(row[0] for row in current)
    for req_id, count in seen.items():
        if count > 1:
            errors.append(f"{rel(design)}/REQUIREMENTS.md: {req_id}가 {count}번 나옵니다")
        if req_id in archived:
            errors.append(f"{rel(design)}/REQUIREMENTS.md: {req_id}는 archive에 있는 ID입니다. ID는 재사용하지 않습니다")
    for row in current:
        if len(row) < 5:
            errors.append(f"{rel(design)}/REQUIREMENTS.md: {row[0]} 행의 열이 부족합니다")
            continue
        status, design_class = row[2], row[4]
        if status not in REQ_STATUSES:
            errors.append(f"{rel(design)}/REQUIREMENTS.md: {row[0]}의 상태 '{status}'는 현재 요구사항에 둘 수 없습니다. 폐기·대체는 archive로 옮기세요")
        if design_class not in REQ_CLASSES:
            errors.append(f"{rel(design)}/REQUIREMENTS.md: {row[0]}의 설계 분류 '{design_class}'가 잘못됐습니다")
        elif design_class == "미분석":
            notes.append(f"영향 분석 필요: {rel(design)}/REQUIREMENTS.md {row[0]}")


def check_friction(design):
    rows = [row for row in table_rows(design / "friction-log.md") if DATE.match(row[0])]
    counts = Counter(row[2] for row in rows if len(row) > 2 and row[2])
    for decision, count in counts.items():
        if count >= FRICTION_THRESHOLD:
            warnings.append(f"{rel(design)}/friction-log.md: {decision}에 마찰이 {count}건 쌓였습니다. 재설계를 검토하세요")


def check_scope_registry(scopes):
    root_design = ROOT / "design"
    root_arch = root_design / "ARCHITECTURE.md"
    if not root_arch.exists():
        errors.append("design/ARCHITECTURE.md(루트 스코프)가 없습니다")
        return
    registry = root_arch.read_text(encoding="utf-8")
    for design in scopes:
        if design == root_design:
            continue
        scope_path = rel(design.parent)
        if f"`{scope_path}`" not in registry:
            errors.append(f"{scope_path}: 루트 ARCHITECTURE.md의 스코프 목록에 등록되지 않은 스코프입니다")


def main():
    scopes = find_scopes()
    check_scope_registry(scopes)
    for design in scopes:
        active = check_adrs(design)
        check_architecture(design, active)
        check_requirements(design)
        check_friction(design)

    for label, items in (("오류", errors), ("경고", warnings), ("안내", notes)):
        for item in items:
            print(f"[{label}] {item}")
    if not (errors or warnings or notes):
        print("설계 문서 검사: 문제 없음")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
