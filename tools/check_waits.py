"""Reject fixed browser/Python sleeps in tools; clock-driven scenarios use Playwright's clock."""
import ast
import hashlib
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
# Item 11 will replace these legacy screenshot scripts. Any edit loses the matching hash exception.
LEGACY = {
    'tools/shot.py': 'd5762d31ebb46f0348e6807565a6d47982f6632e728483cb0015035e98e58b68',
    'tools/shot2.py': '5c189d768d9ff393bf0467cf63270a98e6e9fa2adb7467557f37aa7fa322e198',
    'tools/shot3.py': '6f8de038199f1986fc956ee93bca1596fd660e9573e3fec96b17aa7719c84e67',
    'tools/shot_q.py': 'd412ff85fdcac87094d9fa51cde9123a1271c910a464b765b655cd45099d88b3',
}


def violations(source):
    tree = ast.parse(source)
    aliases = {'sleep', 'wait_for_timeout'}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module in {'time', 'asyncio'}:
            aliases.update(alias.asname or alias.name for alias in node.names if alias.name == 'sleep')
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id if isinstance(node.func, ast.Name) else ''
            if name in aliases:
                found.append((node.lineno, name))
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and re.search(r'\b(?:setTimeout|setInterval)\s*\(', node.value):
            found.append((node.lineno, 'JavaScript fixed timer'))
    return sorted(found)


def main():
    errors = []
    for path in sorted((ROOT / 'tools').rglob('*.py')):
        rel = path.relative_to(ROOT).as_posix()
        source = path.read_bytes()
        bad = violations(source.decode('utf-8'))
        if bad and LEGACY.get(rel) == hashlib.sha256(source).hexdigest():
            continue
        errors.extend(f'{rel}:{line}: {name}: use an observable assertion/idle(), or an explicit virtual-clock scenario' for line, name in bad)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print('No fixed browser/Python sleeps (unchanged legacy shot*.py excluded until item 11).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
