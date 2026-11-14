# 生成 public/data/library.json 与 public/data/questions/<id>.json
import json, os, re, sys, importlib.util
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','data'); os.makedirs(os.path.join(OUT,'questions'),exist_ok=True)
CN='一二三四五六七八九十'
# 数据源：一个 Python 模块 + 每题图片映射（crops.json）。新年份追加到这里即可。
SOURCES=[dict(module='questions_2023_2025.py', crops='crops.json',
              qpages={2023:'47–50',2024:'51–54',2025:'55–57'}, apages={2023:'170–180',2024:'181–191',2025:'192–202'})]
questions=[]; details={}
for src in SOURCES:
  spec=importlib.util.spec_from_file_location('m',os.path.join(ROOT,'tools',src['module'])); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
  crops=json.load(open(os.path.join(ROOT,'tools',src['crops'])))
  for d in m.Q:
    key=f"{d['year']}-{d['no']}"; qid=d['year']*100+d['no']
    figs=crops['figs'].get(key,[])
    stem=d['stem']
    used=set()
    def rep(mo):
      i=int(mo.group(1)); used.add(i)
      from PIL import Image
      w=Image.open(os.path.join(ROOT,'public',figs[i-1])).width
      return f'![图{i}|{round(w*0.55)}]({figs[i-1]})'
    stem=re.sub(r'\[\[fig:(\d+)\]\]',rep,stem)
    assert len(used)==len(figs), (key, used, figs)
    cats=[f"历年真题 / {d['year']}"]+d['cats']
    plain=re.sub(r'\$+[^$]*\$+',' ',stem)
    source=f"{d['year']}重大844 · 第{CN[d['no']-1]}题"+(f"（{d['score']}分）" if d['score'] else '')
    questions.append(dict(id=qid,year=d['year'],number=d['no'],score=d['score'],source=source,
        categories=cats,tags=[c.split(' / ')[0] for c in d['cats']],hasFigure=bool(figs),
        stem=stem,pdfPage=src['qpages'][d['year']],
        search=' '.join([str(qid),source,*cats,stem])))
    det=dict(answer=d['answer'],explanation=d['explanation'],
        originalImages=[dict(src=a,w=round(__import__('PIL.Image',fromlist=['x']).open(os.path.join(ROOT,'public',a)).width*0.6)) for a in crops['ans'].get(key,[])],answerPdfPages=src['apages'][d['year']])
    if d.get('notes'): det['notes']=d['notes']
    if d.get('errataLevel'): det['errataLevel']=d['errataLevel']
    details[qid]=det
# JSON 数据源：data-src/<年份>/questions.json（格式见 incoming/SPEC.md）
import glob, shutil
from PIL import Image
for qf in sorted(glob.glob(os.path.join(ROOT,'data-src','*','questions.json'))):
  src=json.load(open(qf)); y=src['year']; base=os.path.dirname(qf)
  os.makedirs(os.path.join(ROOT,'public','img'),exist_ok=True)
  def pub(rel):
    fn=os.path.basename(rel); shutil.copy(os.path.join(base,rel),os.path.join(ROOT,'public','img',fn)); return 'img/'+fn
  for d in src['questions']:
    qid=y*100+d['no']; assert qid not in details,(qid,'duplicate')
    figs=[pub(f) for f in d['figures']]
    stem=d['stem']; used=set()
    def rep(mo):
      i=int(mo.group(1)); used.add(i); w=Image.open(os.path.join(ROOT,'public',figs[i-1])).width
      return f'![图{i}|{round(w*0.55)}]({figs[i-1]})'
    stem=re.sub(r'\[\[fig:(\d+)\]\]',rep,stem)
    assert len(used)==len(figs),(qid,used,figs)
    # 统一不同录入者的分类命名（不改源数据）
    ALIAS={'离散系统 / 输出响应':'离散系统 / 时间响应','建模 / 机电系统传递函数':'建模 / 机电系统 / 传递函数','建模 / 机电系统 / 直流电动机':'建模 / 机电系统 / 传递函数'}
    d['cats']=list(dict.fromkeys(ALIAS.get(c,c) for c in d['cats']))
    cats=[f"历年真题 / {y}"]+d['cats']
    source=f"{y}重大844 · 第{CN[d['no']-1]}题"+(f"（{d['score']}分）" if d.get('score') else '')
    questions.append(dict(id=qid,year=y,number=d['no'],score=d.get('score'),source=source,categories=cats,
        tags=[c.split(' / ')[0] for c in d['cats']],hasFigure=bool(figs),stem=stem,pdfPage=src.get('questionPages',''),
        contributor=src.get('contributor',''),search=' '.join([str(qid),source,*cats,stem])))
    ans=[pub(a) for a in d['answerImages']]
    det=dict(answer=d.get('answer',''),explanation=d.get('explanation',''),notes=d.get('notes',''),
        originalImages=[dict(src=a,w=round(Image.open(os.path.join(ROOT,'public',a)).width*0.6)) for a in ans],
        answerPdfPages=src.get('answerPages',''))
    if d.get('errataLevel'): det['errataLevel']=d['errataLevel']
    details[qid]=det
questions.sort(key=lambda x:(-x['year'],x['number']))
years=sorted({q['year'] for q in questions},reverse=True)
TOPIC_ORDER=['建模','时域分析','根轨迹','频域分析','校正','离散系统','非线性系统','状态空间']
# 考点页点名的重点题目（按章节、点名顺序）。站内没有的年份在生成时跳过。
FEATURED=[
  ('第二章',2023,1),('第二章',2019,1),('第二章',2018,1),
  ('第三章',2019,2),('第三章',2023,2),('第三章',2024,2),
  ('第四章',2016,3),('第四章',2020,3),('第四章',2014,4),('第四章',2019,3),
  ('第五章',2011,5),('第五章',2016,4),('第五章',2011,6),
  ('第六章',2011,6),('第六章',2016,5),('第六章',2015,5),('第六章',2018,5),
  ('第七章',2023,6),('第七章',2011,7),('第七章',2017,6),('第七章',2015,6),('第七章',2022,5),
  ('第八章',2011,8),('第八章',2018,7),
  ('第九章',2017,8),('第九章',2020,6),('第九章',2015,8),
  ('其他点名',2017,1),('其他点名',2012,6),('其他点名',2014,6),('其他点名',2019,5),
  ('其他点名',2017,5),('其他点名',2012,7),('其他点名',2020,5),('其他点名',2021,5),
]
CHAPTER_ORDER=['第二章','第三章','第四章','第五章','第六章','第七章','第八章','第九章','其他点名']
available={q['id'] for q in questions}
feat_entries=[]; feat_skipped=[]; feat_seen=set()
for ch,y,no in FEATURED:
  qid=y*100+no
  if qid in feat_seen: continue
  if qid not in available:
    feat_skipped.append((ch,y,no)); continue
  feat_seen.add(qid); feat_entries.append((ch,qid))
if feat_skipped:
  print('featured skipped (year not in bank):', ', '.join(f'{y}年第{no}题（{ch}）' for ch,y,no in feat_skipped))
by_id={q['id']:q for q in questions}
feat_qs=[by_id[qid] for _,qid in feat_entries]
feat_ch={qid:ch for ch,qid in feat_entries}
def lst(id,name,qs,catfn):
  return dict(id=id,name=name,questionIds=[q['id'] for q in qs],categoryByQuestion={str(q['id']):catfn(q) for q in qs})
def topic_cats(q): return [c for c in q['categories'] if not c.startswith('历年真题')]
def year_cat(q): return [f"历年真题 / {q['year']}"]
def with_featured(cats,q):
  ch=feat_ch.get(q['id'])
  return ([f'重点题目 / {ch}']+cats) if ch else cats
lists=[lst('complete','完整题库',questions,lambda q:with_featured(topic_cats(q)+year_cat(q),q)),
       lst('exam-by-year','真题按年',questions,lambda q:with_featured(year_cat(q),q)),
       lst('by-topic','专题分类',questions,topic_cats),
       lst('featured','重点题目',feat_qs,lambda q:[feat_ch[q['id']]])]
for y in years: lists.append(lst(f'exam-{y}',f'{y} 真题',[q for q in questions if q['year']==y],lambda q:topic_cats(q)))
for t in TOPIC_ORDER:
  qs=[q for q in questions if t in q['tags']]
  if qs: lists.append(lst(f'topic-{t}',f'专题·{t}',qs,lambda q:[c for c in topic_cats(q)]))
lib=dict(subject='自动控制原理（重庆大学 844）',source=f'重庆大学 {min(q["year"] for q in questions)}–{max(q["year"] for q in questions)} 初试真题',
         topicOrder=['历年真题','重点题目']+TOPIC_ORDER+CHAPTER_ORDER,years=years,lists=lists,questions=questions)
json.dump(lib,open(os.path.join(OUT,'library.json'),'w'),ensure_ascii=False)
for k,v in details.items(): json.dump(v,open(os.path.join(OUT,'questions',f'{k}.json'),'w'),ensure_ascii=False)
print(len(questions),'questions;',{y:sum(1 for q in questions if q['year']==y) for y in years},
      'with figures',sum(q['hasFigure'] for q in questions),'with answers',sum(1 for v in details.values() if v['answer']),
      'answer images',sum(len(v['originalImages']) for v in details.values()))
