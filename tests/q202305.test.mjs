import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const row=JSON.parse(readFileSync(new URL('../data-src/2023/questions.json',import.meta.url))).questions.find(q=>q.no===5);
const close=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const E=Math.exp(-2), h=(1-E)/2, hold=.5-(1-E)/4;
const poleRadius=(linear,constant)=>{
 const disc=linear*linear-4*constant;
 return disc<0?Math.sqrt(constant):Math.max(Math.abs((-linear+Math.sqrt(disc))/2),Math.abs((-linear-Math.sqrt(disc))/2));
};

test('202305 explicitly adopts T=1 and unit step, keeps the given starting samples, and follows the exam workflow',()=>{
 for(const field of ['answer','explanation']){
  assert.ok(row[field].startsWith('以下按采样周期 $T=\\tau=1'));
  assert.ok(row[field].includes('单位阶跃'));
  assert.doesNotMatch(row[field],/原答案|原图|原解|通常默认|一般默认|满分|h\(t\)|a=e|b=T|d=\(/);
 }
 const steps=['部分分式','变换对应表','由单位负反馈关系','二阶Jury','三、写出差分方程','四、代入起始样本'];
 const positions=steps.map(s=>row.explanation.indexOf(s));assert.ok(positions.every(p=>p>=0));assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert.ok(row.explanation.includes('c(0)=0'));assert.ok(row.explanation.includes('c(1)=0.5'));assert.ok(row.explanation.includes('n\\ge2'));
 assert.ok(row.notes.includes('未给输入'));assert.ok(row.notes.includes('不声称'));
});

test('202305 partial fractions, Z-table expression and sampled state resolvent yield the displayed pulse transfer',()=>{
 const text=row.answer+row.explanation;
 assert.ok(text.includes('k[(1+e^{-2})z+1-3e^{-2}]'));
 assert.ok(text.includes('4z^2+(k-4)(1+e^{-2})z+4e^{-2}+k(1-3e^{-2})'));
 for(const s of [.1,.3,1,3,8])close(1/(s*s*(s+2)),1/(2*s*s)-1/(4*s)+1/(4*(s+2)));
 for(const k of [.1,2,5.82])for(const z of [1.1,2,3,7]){
  const table=k*(z-1)/z*(z/(2*(z-1)**2)-z/(4*(z-1))+z/(4*(z-E)));
  const numerator=k*((1+E)*z+1-3*E),plantDen=4*(z-1)*(z-E);
  close(table,numerator/plantDen);
  const phi=numerator/(4*z*z+(k-4)*(1+E)*z+4*E+k*(1-3*E));
  close(phi,table/(1+table));
  const det=(z-1+k*hold)*(z-E)+k*h*h;
  close(phi,k*(hold*(z-E)+h*h)/det);
 }
});

test('202305 Jury bound is exact and distinguishes stable5.82 from unstable5.83 without early coefficient rounding',()=>{
 const bound=4*(1-E)/(1-3*E);
 assert.ok(row.answer.includes('\\frac{4(1-e^{-2})}{1-3e^{-2}}'));assert.ok(row.answer.includes('5.82'));
 close(bound,5.822715367422422);close(2*(Math.exp(2)+1),16.7781121978613);
 for(const k of [-10,-1,0,.01,2,5.81,5.82,bound-.000001,bound+.000001,5.83,17]){
  const p=(k/4-1)*(1+E),q=E+k*(1-3*E)/4;
  const jury=Math.abs(q)<1&&k*(1-E)/2>0&&2*(1+E)-k*E>0;
  assert.equal(jury,k>0&&k<bound);
  if(k!==0)assert.equal(poleRadius(p,q)<1,k>0&&k<bound);
 }
 close(E+bound*(1-3*E)/4,1);
 assert.ok(bound>5.82&&bound<5.83);
});

test('202305 difference equation and literal c0/c1 reproduce independent held-input continuous-state samples',()=>{
 const text=row.explanation;
 for(const term of ['(1+e^{-2})c(n-1)','(1-3e^{-2})r(n-2)','1+e^{-2}}2c(n-1)','1-e^{-2}}2c(n-2)'])assert.ok(text.includes(term),term);
 for(const k of [.2,2,5.82]){
  const input=[.3,1,-.5,2,0,.4],ys=[.23];let y=.23,v=.17;
  for(const r of input){const error=r-y;[y,v]=[y+h*v+k*hold*error,E*v+k*h*error];ys.push(y);}
  for(let n=2;n<ys.length;n++){
   const lhs=ys[n]+(k/4-1)*(1+E)*ys[n-1]+(E+k*(1-3*E)/4)*ys[n-2];
   const rhs=k*(1+E)/4*input[n-1]+k*(1-3*E)/4*input[n-2];close(lhs,rhs);
  }
 }
 // Integrate y'=v, v'=-2v+2(r-y_sample) exactly on each held interval.
 let y=0,v=(.5-2*hold)/h;const sampled=[y];
 for(let n=0;n<25;n++){
  const error=1-y;
  [y,v]=[y+h*v+2*hold*error,E*v+2*h*error];sampled.push(y);
 }
 close(sampled[1],.5);
 for(let n=2;n<sampled.length;n++){
  const recurrence=(1+E)/2*sampled[n-1]-(1-E)/2*sampled[n-2]+1-E;
  close(sampled[n],recurrence);
 }
 const c2=(5-3*E)/4,c3=(11-4*E-3*E*E)/8;
 close(sampled[2],c2);close(sampled[3],c3);
 close(c2,1.148498537572541);close(c3,1.300463993798418);
 // The supplied c1 is not overwritten by the zero-state step's first sample.
 assert.ok(Math.abs(2*hold-.5)>.06);
});

test('202305 final three-significant-figure samples round the exact sequence, not a repeatedly rounded template',()=>{
 const c2=(5-3*E)/4,c3=(11-4*E-3*E*E)/8;
 for(const [n,value,expected] of [[2,c2,'1.15'],[3,c3,'1.30']]){
  const match=row.answer.match(new RegExp(`c\\(${n}\\)=.*?\\\\approx([0-9]+\\.[0-9]+)`));assert.ok(match);
  assert.equal(match[1],expected);close(Number(match[1]),value,.005);
 }
 assert.doesNotMatch(row.answer+row.explanation,/1\.1495|1\.3013|5\.81|0\.26375|-11\.135/);
 const prematurelyRounded=.567*(.567*.5+.866)-.433*.5+.866;
 assert.ok(Math.abs(prematurelyRounded-c3)>.0008);
});
