# data-src/<年份>/questions.json 的严格校验（build_data.py 生成前调用；也可单独运行）。
# 每条错误都写明：文件 → 题 → 字段 → 哪里不对 → 该怎么改。
import json, os, re, sys

TOPICS = ('建模', '时域分析', '根轨迹', '频域分析', '校正', '离散系统', '非线性系统', '状态空间')
ERRATA_LEVELS = ('severe', 'conflict', 'ok')  # 普通勘误：不写 errataLevel 字段
TOP_REQUIRED = {'year': int, 'questionPages': str, 'answerPages': str, 'questions': list}
TOP_OPTIONAL = {'contributor': str}
Q_REQUIRED = {'no': int, 'cats': list, 'stem': str, 'figures': list, 'answerImages': list}
Q_OPTIONAL = {'score': (int, type(None)), 'figureWidths': list, 'answer': str, 'explanation': str, 'notes': str, 'errataLevel': (str, type(None))}  # errataLevel 取值由下方单独检查
TEXT_IMAGES = re.compile(r'!\[[^\]]*\]\(([^)]+)\)')
MAX_NO = 10  # 题号转“第一…第十题”


def _tname(t):
    return '/'.join(x.__name__.replace('NoneType', 'null') for x in (t if isinstance(t, tuple) else (t,)))


def _type_ok(v, t):
    return isinstance(v, t) and not (isinstance(v, bool) and t is not bool)


def _fields(obj, where, req, opt, errs):
    for k, t in req.items():
        if k not in obj:
            errs.append(f'{where}: 缺少必填字段 "{k}"（{_tname(t)}）')
        elif not _type_ok(obj[k], t):
            errs.append(f'{where}: 字段 "{k}" 应为 {_tname(t)}，实际是 {type(obj[k]).__name__}: {json.dumps(obj[k], ensure_ascii=False)[:60]}')
    for k, v in obj.items():
        if k in req:
            continue
        if k not in opt:
            errs.append(f'{where}: 未知字段 "{k}"（允许的字段：{", ".join([*req, *opt])}；拼错了吗？）')
        elif not _type_ok(v, opt[k]):
            errs.append(f'{where}: 字段 "{k}" 应为 {_tname(opt[k])}，实际是 {type(v).__name__}: {json.dumps(v, ensure_ascii=False)[:60]}')


def validate_file(path, seen_ids, seen_imgs):
    errs = []
    rel = os.path.relpath(path)
    try:
        src = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as e:
        return [f'{rel}: 不是合法 JSON：{e}']
    if not isinstance(src, dict):
        return [f'{rel}: 顶层应为对象 {{year, questionPages, answerPages, questions}}']
    _fields(src, rel, TOP_REQUIRED, TOP_OPTIONAL, errs)
    y = src.get('year')
    if not isinstance(y, int):
        return errs
    folder = os.path.basename(os.path.dirname(path))
    if folder != str(y):
        errs.append(f'{rel}: year={y} 与所在目录 data-src/{folder}/ 不一致（目录名必须等于年份）')
    base = os.path.dirname(path)
    for i, q in enumerate(src.get('questions') or []):
        where = f'{rel} 第 {i + 1} 条'
        if not isinstance(q, dict):
            errs.append(f'{where}: 应为对象'); continue
        no = q.get('no')
        if isinstance(no, int) and not isinstance(no, bool):
            where = f'{rel} {y}年第{no}题'
        _fields(q, where, Q_REQUIRED, Q_OPTIONAL, errs)
        if not (isinstance(no, int) and not isinstance(no, bool)):
            continue
        if not 1 <= no <= MAX_NO:
            errs.append(f'{where}: 题号 no={no} 超出 1–{MAX_NO}')
        qid = y * 100 + no
        if qid in seen_ids:
            errs.append(f'{where}: 题目 id {qid} 重复（已在 {seen_ids[qid]} 出现）；同一年题号 no 不能重复')
        else:
            seen_ids[qid] = rel
        lv = q.get('errataLevel')
        if 'errataLevel' in q and lv not in ERRATA_LEVELS:
            errs.append(f'{where}: errataLevel={json.dumps(lv, ensure_ascii=False)} 非法；只能是 {"/".join(ERRATA_LEVELS)}，普通勘误请删掉这个字段（不要写 null 或空串）')
        if lv and not q.get('notes'):
            errs.append(f'{where}: 有 errataLevel={lv} 但 notes 为空；勘误等级必须配勘误正文 notes')
        if isinstance(q.get('score'), int) and q['score'] <= 0:
            errs.append(f'{where}: score={q["score"]} 应为正整数或 null')
        cats = q.get('cats')
        if isinstance(cats, list):
            if not cats:
                errs.append(f'{where}: cats 为空；至少要有一个“专题 / 小类”')
            for c in cats:
                if not isinstance(c, str) or c.split(' / ')[0] not in TOPICS:
                    errs.append(f'{where}: 分类 {json.dumps(c, ensure_ascii=False)} 的专题不在 {"、".join(TOPICS)} 之中')
                elif c.startswith('历年真题'):
                    errs.append(f'{where}: cats 不应含“历年真题”，年份分类由构建自动添加')
            if len(cats) != len(set(map(str, cats))):
                errs.append(f'{where}: cats 有重复项')
        for key, prefix in (('figures', 'q'), ('answerImages', 'a')):
            imgs = q.get(key)
            if not isinstance(imgs, list):
                continue
            for k, f in enumerate(imgs, 1):
                want = f'img/{prefix}{y}-{no}-{k}.png'
                if f != want:
                    errs.append(f'{where}: {key}[{k - 1}]={json.dumps(f, ensure_ascii=False)} 应命名为 "{want}"（按 img/{prefix}<年>-<题号>-<序号>.png）')
                    continue
                if not os.path.isfile(os.path.join(base, f)):
                    errs.append(f'{where}: {key} 引用的图片不存在：{os.path.relpath(os.path.join(base, f))}')
                name = os.path.basename(f)
                if name in seen_imgs:
                    errs.append(f'{where}: 图片名 {name} 与 {seen_imgs[name]} 重名，构建复制到 public/img/ 时会互相覆盖')
                seen_imgs[name] = where
        for field in ('answer', 'explanation'):
            text = q.get(field)
            if not isinstance(text, str):
                continue
            for image in TEXT_IMAGES.findall(text):
                if not re.fullmatch(rf'img/solution-{qid}-[a-z0-9-]+\.(png|svg)', image):
                    errs.append(f'{where}: {field} 图片须为本题本地 img/solution-{qid}-<名称>.png 或 .svg')
                elif not os.path.isfile(os.path.join(base, image)):
                    errs.append(f'{where}: {field} 引用的图片不存在：{image}')
        figs = q.get('figures') if isinstance(q.get('figures'), list) else []
        widths = q.get('figureWidths')
        if isinstance(widths, list):
            if len(widths) != len(figs):
                errs.append(f'{where}: figureWidths 长度应与 figures 一致（共 {len(figs)} 张）')
            for k, width in enumerate(widths):
                if not _type_ok(width, int) or width <= 0:
                    errs.append(f'{where}: figureWidths[{k}] 应为正整数 CSS 像素宽度')
        if isinstance(q.get('stem'), str):
            ph = [int(m) for m in re.findall(r'\[\[fig:(\d+)\]\]', q['stem'])]
            bad = sorted({p for p in ph if not 1 <= p <= len(figs)})
            missing = sorted(set(range(1, len(figs) + 1)) - set(ph))
            if bad:
                errs.append(f'{where}: stem 里的 [[fig:{bad[0]}]] 超出 figures 范围（共 {len(figs)} 张）')
            if missing:
                errs.append(f'{where}: figures 第 {missing} 张没有在 stem 里用 [[fig:N]] 引用')
    return errs


def validate_all(paths):
    if not paths:
        return ['data-src/ 下没有找到任何 <年份>/questions.json']
    seen_ids, seen_imgs, errs = {}, {}, []
    for p in paths:
        errs += validate_file(p, seen_ids, seen_imgs)
    return errs


if __name__ == '__main__':
    import glob
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths = sys.argv[1:] or sorted(glob.glob(os.path.join(root, 'data-src', '*', 'questions.json')))
    errs = validate_all(paths)
    print('\n'.join(errs) if errs else f'OK：{len(paths)} 个文件通过校验')
    sys.exit(1 if errs else 0)
