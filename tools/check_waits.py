"""Reject fixed browser/Python sleeps in tools; clock-driven scenarios use Playwright's clock."""
import ast
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


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
        errors.extend(f'{rel}:{line}: {name}: use an observable assertion/idle(), or an explicit virtual-clock scenario' for line, name in bad)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print('No fixed browser/Python sleeps. No exceptions.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
