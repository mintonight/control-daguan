import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const question = id => JSON.parse(readFileSync(new URL(`../data-src/${Math.floor(id / 100)}/questions.json`, import.meta.url))).questions.find(q => q.no === id % 100);
const close = (a, b, eps=1e-9) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`);
const bisect = f => {let a=.001,b=20;for(let i=0;i<100;i++){const m=(a+b)/2;if(f(m)>0)a=m;else b=m;}return(a+b)/2;};
function matrix(text,name){const tail=text.split(`${name}=\\begin{bmatrix}`)[1];assert.ok(tail,name);return tail.split('\\end{bmatrix}')[0].split('\\\\').map(r=>r.split('&').map(Number));}
const mm=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
test('priority solutions use concise exam precision without replacing exact simple fractions or depending on scanned answers',()=>{
 for(const id of [202502,202603,202604,202608])for(const key of ['answer','explanation']){
  const text=question(id)[key];assert.doesNotMatch(text,/\d+\.\d{5,}/);assert.doesNotMatch(text,/原图|原答案|原解|答案中的/);
 }
});
test('202603 conventional positive root locus does not detour to the negative-gain branch',()=>{
 const q=question(202603),text=q.answer+q.explanation;assert.doesNotMatch(text,/负参数|K\^\*<-1|代数环/);assert.ok(text.includes('K^*>0'));
 for(const k of [.001,.05,.1,1,14,100]){const b=(2+10*k)/(1+k),c=24*k/(1+k);assert.ok(b>0&&c>0);assert.equal(b*b-4*c<0,k>7-4*Math.sqrt(3)&&k<7+4*Math.sqrt(3));}
});
test('202502 main teaches the labelled 5percent dominant-pole hand estimate, not an exact root-finding exercise',()=>{
 const q=question(202502),text=q.answer+q.explanation;assert.ok(text.includes('3.93'));assert.ok(text.includes('主导极点'));assert.ok(text.includes('工程'));assert.doesNotMatch(text,/4\.127|5\.327|唯一正根|\\rho/);
 const a=3-Math.sqrt(5),b=3+Math.sqrt(5),approx=3/a;
 close(approx,3.9270509831248424);assert.ok(Math.abs(approx-3.93)<.005);
 const residual=t=>(b*Math.exp(-a*t)-a*Math.exp(-b*t))/(b-a),exact=bisect(t=>residual(t)-.05);
 close(exact,4.127902579255095,1e-8);assert.ok(residual(approx)>.05);assert.ok(q.notes.includes('4.13'));
});
test('202604 hand-rounded two-lead design meets actual crossover, phase margin and all-order Routh stability',()=>{
 const q=question(202604),text=q.answer+q.explanation;assert.ok(text.includes('\\alpha=9'));assert.ok(text.includes('T=\\frac16'));assert.ok(text.includes('103.4'));
 const z=Number(q.answer.match(/T_z=([\d.]+)/)[1]);const p=1/Number(q.answer.match(/T_p=\\frac\{1\}\{(\d+)\}/)[1]);
 const gain=w=>(1+(z*w)**2)/((1+(p*w)**2)*w*w*Math.hypot(1,w)),w=bisect(w=>gain(w)-1);
 const pm=(-Math.atan(w)+2*Math.atan(z*w)-2*Math.atan(p*w))*180/Math.PI;
 close(w,2.0103717365739517);close(pm,42.7061599505346);assert.ok(pm>=40);assert.ok(Math.abs(w-2.01)<.005);assert.ok(Math.abs(pm-42.7)<.05);
 const coefficients=[p*p,p*p+2*p,1+2*p,1+z*z,2*z,1].map(x=>x*36);assert.deepEqual(coefficients.map(x=>Math.round(x)),[1,13,48,117,108,36]);
 const rows=Array.from({length:6},()=>[0,0,0]);rows[0]=coefficients.filter((_,i)=>i%2===0);rows[1]=coefficients.filter((_,i)=>i%2===1);
 for(let i=2;i<6;i++)for(let j=0;j<2;j++)rows[i][j]=(rows[i-1][0]*rows[i-2][j+1]-rows[i-2][0]*rows[i-1][j+1])/rows[i-1][0];assert.ok(rows.every(r=>r[0]>0));
});
test('202608 leads with the conventional augmented solution and its concise implementation condition',()=>{
 const q=question(202608);assert.ok(q.answer.startsWith('按增加积分状态'));assert.doesNotMatch(q.answer,/两种解释|无解/);assert.ok(q.explanation.includes('需允许积分扩阶'));assert.ok(q.notes.includes('静态状态反馈'));
 const A=matrix(q.explanation,'A'),B=matrix(q.explanation,'B'),C=matrix(q.explanation,'C'),Af=matrix(q.explanation,'A_f'),K=[[4,3,2]],bk=mm(B,K);
 assert.deepEqual(A.map((r,i)=>r.map((x,j)=>x-bk[i][j])),Af);assert.deepEqual(C,[[0,2,0]]);
 for(const s of [.1,1,2,5]){const den=s**3+4*s*s+6*s+4;close(den,(s+2)*(s*s+2*s+2));const x=[[1/den],[s/den],[s*s/den]],ax=mm(Af,x);for(let i=0;i<3;i++)close(s*x[i][0]-ax[i][0],B[i][0]);close(mm(C,x)[0][0],2*s/den);}
});
