import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const q=id=>JSON.parse(readFileSync(new URL(`../data-src/${Math.floor(id/100)}/questions.json`,import.meta.url))).questions.find(r=>r.no===id%100);
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const root=f=>{let a=.001,b=30;for(let i=0;i<100;i++){const m=(a+b)/2;if(f(m)>0)a=m;else b=m;}return(a+b)/2;};
const published=(text,re)=>{const m=text.match(re);assert.ok(m,re.toString());return Number.parseFloat(m[1]);};
test('202305 keeps the general period and input instead of inventing a numerical second problem',()=>{
 const text=q(202305).answer+q(202305).explanation;
 assert.doesNotMatch(text,/T=1|1\.14875|例如附加|作为明确附加条件/);assert.ok(text.includes('T=\\tau'));assert.ok(text.includes('r(0)'));assert.ok(text.includes('r(2)'));assert.ok(text.includes('不能唯一'));
 const sample=(T,r0,r1)=>{const a=Math.exp(-2*T),b=T/2-(1-a)/4,d=(1-a)/4-T*a/2;near(b,T/2-.25+.25*a);return .5*(1+a-2*b)+2*b*r1+2*d*r0;};
 assert.ok(Math.abs(sample(.5,1,1)-sample(1,1,1))>.1);assert.ok(Math.abs(sample(1,0,1)-sample(1,1,1))>.1);
});
test('201907 one consistent exact-parameter model produces useful four-significant-figure samples',()=>{
 const row=q(201907);assert.doesNotMatch(row.answer+row.explanation,/0\.0655|1\.4769|另一套/);
 const T=.07,a=Math.exp(-10*T),b=T-(1-a)/10,d=(1-a)/10-T*a,seq=[0,b];
 for(let n=2;n<=3;n++)seq.push((1+a-b)*seq[n-1]-(a+d)*seq[n-2]+b+d);
 for(const [n,tol] of [[1,.000005],[2,.000005],[3,.00005]])near(published(row.answer,new RegExp(`c_${n}\\\\approx([\\d.]+)`)),seq[n],tol);
 for(const s of [.1,1,4]){
  const nr=.01966*s+.01558,ne=b*s+d,dr=s*s-1.477*s+.5122,de=s*s+(b-1-a)*s+a+d;
  const en=.000005*(Math.abs(s)+1),ed=.0005*Math.abs(s)+.00005;
  assert.ok(Math.abs(nr-ne)<en);assert.ok(Math.abs(dr-de)<ed);
  near(nr/dr,ne/de,en/Math.abs(dr)+Math.abs(ne)*ed/Math.abs(de*dr)+1e-12);
 }
});
test('202105 sample rounding preserves the exact parameter and all-n closed form',()=>{
 const row=q(202105);assert.doesNotMatch(row.answer+row.explanation,/0\.367879|1\.399576/);assert.ok(row.answer.includes('a=e^{-1}'));assert.ok(row.answer.includes('2-2a+a^2'));
 const a=Math.exp(-1),rho=Math.sqrt(1-a),theta=Math.acos(1/(2*rho)),b=(.5-a)/Math.sqrt(.75-a),closed=n=>1-rho**n*(Math.cos(n*theta)+b*Math.sin(n*theta));
 near(published(row.answer,/c_1[^\n]*?\\approx([\d.]+)/),a,.00005);near(published(row.answer,/c_3[^\n]*?\\approx([\d.]+)/),2-2*a+a*a,.0005);
 const seq=[0,a];for(let n=2;n<40;n++)seq.push(seq[n-1]-(1-a)*seq[n-2]+1-a);for(let n=0;n<40;n++)near(seq[n],closed(n));
});
test('202306 rounded small root stays distinguishable from the dead-zone boundary',()=>{
 const row=q(202306);assert.ok(row.answer.includes('0.5004'));assert.ok(row.answer.includes('12.72'));const h=.5,Q=(40/Math.PI)**2,large=(Q+Math.sqrt(Q*Q-4*Q*h*h))/2,small=Q*h*h/large;
 near(12.72,Math.sqrt(large),.005);near(.5004,Math.sqrt(small),.00005);assert.ok(.5004>h);
 for(const A of [Math.sqrt(large),Math.sqrt(small)])near(8/(Math.PI*A)*Math.sqrt(1-(h/A)**2)*5,1,1e-10);
});
test('frequency answers round final values, not the exact model or phase-trend calculation',()=>{
 const first=q(201705);assert.doesNotMatch(first.explanation,/23\.07560|5\.23095|17\.83035/);assert.ok(first.explanation.includes('1480/9'));assert.ok(first.explanation.includes('1/3'));
 const w=root(w=>16*Math.hypot(1,w/3)/(w*w*Math.hypot(1,w/10)*Math.hypot(1,w/20))-1),pm=(Math.atan(w/3)-Math.atan(w/10)-Math.atan(w/20))*180/Math.PI;near(w,5.257,.0005);near(pm,17.83,.005);
 const row=q(202304),text=row.answer+row.explanation;assert.doesNotMatch(text,/8\.20008|114\.48757|73\.65777/);assert.ok(text.includes('先上升'));
 const gain=w=>500*Math.hypot(w,2)*Math.hypot(w,3)/(w*Math.hypot(.8*w,2)*Math.hypot(w,10)*Math.hypot(w,50));
 const phase=w=>90+(Math.atan(w/2)+Math.atan(w/3)-Math.atan(w/2.5)-Math.atan(w/10)-Math.atan(w/50))*180/Math.PI;
 const wc=root(w=>gain(w)-1);near(wc,8.200,.0005);near(phase(wc),114.5,.05);near(phase(12.5),103.3,.05);
});
test('202202 teaches standard metrics with rounded output and preserves exact determining formulas',()=>{
 const row=q(202202),text=row.answer+row.explanation;assert.doesNotMatch(text,/35785713|07412446|44159380|若反馈非单位|\\cos\\omega_dt/);assert.ok(text.includes('0–100%'));assert.ok(text.includes('单位负反馈'));assert.ok(text.includes('四位有效数字'));
 const z=-Math.log(.3)/Math.hypot(Math.PI,Math.log(.3)),wn=(Math.PI-Math.acos(z))/Math.sqrt(1-z*z);near(.3579,z,.00005);near(2.074,wn,.0005);
 near(Math.exp(-Math.PI*z/Math.sqrt(1-z*z)),.3);near((Math.PI-Math.acos(z))/(wn*Math.sqrt(1-z*z)),1);
});
test('phase-portrait and positive-gain tasks keep the main workflow rather than optional generality',()=>{
 assert.doesNotMatch(q(201706).explanation,/1\+a\(e\^t-1\)|t_\*/);assert.ok(q(201706).notes.includes('1+a(e^t-1)'));assert.ok(q(201706).answer.includes('(0,\\infty)'));
 assert.doesNotMatch(q(201707).answer+q(201707).explanation,/K\\le-1|若考虑任意实增益/);assert.ok(q(201707).notes.includes('-1<K\\le1'));
 for(const K of [1.1,2,10]){const limit=Math.log((K+1)/(K-1));for(const scale of [.9,1.1])assert.equal(Math.abs(Math.exp(-limit*scale)-K*(1-Math.exp(-limit*scale)))<1,scale<1);}
});
test('shortened descriptions preserve necessary approximation, feedback, stability and incomplete-data conditions',()=>{
 for(const id of [201806,201906,202106,202306,202506,202606])for(const key of ['answer','explanation'])assert.ok(q(id)[key].includes('近似'),`${id} ${key}`);
 for(const key of ['answer','explanation']){assert.ok(q(202606)[key].includes('M>0'));assert.ok(q(202606)[key].includes('单位负反馈'));assert.doesNotMatch(q(202606)[key],/严格全局证明|若 \\$M=0/);}
 assert.doesNotMatch(q(202602).explanation,/\*\*[^*\n]*\$[^*\n]*\*\*/);
 assert.ok(q(202602).explanation.includes('0<K<198'));assert.ok(q(202602).explanation.includes('未注明误差带'));assert.doesNotMatch(q(202602).explanation,/43\.73469|任意其他积分增益|不能为了/);
 assert.doesNotMatch(q(202505).explanation,/20\.33893|真实指数，界限/);assert.ok(q(202505).answer.includes('190/9'));
});
