'use strict';
const societies = {kahperd:Kahperd};
const rule = societies.kahperd;
const $ = id => document.getElementById(id);
const icons={
 book:'<path d="M3 4.5c3.2-.8 5.8-.3 9 1.6 3.2-1.9 5.8-2.4 9-1.6v14c-3.2-.8-5.8-.3-9 1.6-3.2-1.9-5.8-2.4-9-1.6z"/><path d="M12 6v14"/>',
 papers:'<rect x="6" y="3" width="13" height="16" rx="2"/><path d="M3 7v13a1 1 0 0 0 1 1h11M9 8h7M9 12h7"/>',
 quote:'<path d="M4 6h6v7l-4 5H4l3-6H4zM14 6h6v7l-4 5h-2l3-6h-3z"/>',
 check:'<path d="m5 12 4 4 10-10"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.7c-1.2 1-2 1.2-2 3M12 16.5h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
 x:'<path d="m6 6 12 12M18 6 6 18"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h5"/>',
 scan:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4m4-4 3 3 5-6"/>',
 list:'<path d="m3 6 1.5 1.5L7 4m3 2h10M4 12h2m4 0h10M4 18h2m4 0h10"/>',
 external:'<path d="M14 4h6v6m0-6-9 9M11 6H5v13h13v-6"/>'
};
for(const i of document.querySelectorAll('[data-icon]')) i.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24">'+icons[i.dataset.icon]+'</svg>';
function el(tag,text,cls){
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
function button(text,handler,cls='secondary'){
  const b=el('button',text,cls);b.onclick=handler;return b;
}
function selectTypes(select,value='auto') {
  for(const [key,label] of Object.entries(rule.types)) select.add(new Option(label,key));
  select.value=value;
}
selectTypes($('type'));
let mode='ref',lang=0,timer;
const editor=$('entry'), citationEditor=$('citeEntry');
const activeInput=()=>mode==='ref'?editor:citationEditor;
let lastPasteStatus=null;
const passageMode=()=>mode==='cite' && $('citationMode').value==='passage';
function snapshot(){return mode==='ref'?RichInput.read(editor,true):{text:citationEditor.value};}
function setInput(text){
  if(mode==='ref'){editor.textContent=text;lastPasteStatus=null;}
  else citationEditor.value=text;
}
let entries=[],overrides={},records=[],sorting;
function toast(msg){$('toast').textContent=msg;clearTimeout(timer);timer=setTimeout(()=>$('toast').textContent='',2400);}
function dialog(title,...content){$('modalTitle').textContent=title;$('modalBody').replaceChildren(...content);if(!$('modal').open)$('modal').showModal();}
$('close').onclick=()=>$('modal').close();
$('modal').onclick=e=>{if(e.target===$('modal')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('modal').close();}};
$('help').onclick=()=>dialog('이용 방법',el('p','참고문헌 목록을 그대로 붙여넣으세요. 저자·연도 표기로 새 문헌을 찾아 이어지는 줄을 묶습니다. 표시된 문헌 수가 예상과 다르면 문헌 사이에 빈 줄을 넣으세요.'),el('p','결과 카드에서 문헌 유형을 변경하고 지적된 위치와 수정 근거를 확인할 수 있습니다. 여러 줄을 묶은 항목은 붙여넣은 줄도 펼쳐 볼 수 있습니다.'),el('p','본문 인용 검사에 문단을 붙여넣으면 인용을 찾아 개별로 검사합니다. 개별 인용 직접 입력에서는 한 줄에 한 표현을 넣고 저자 수와 인용 차례를 지정할 수 있습니다.'));
async function copy(s){
  try{await navigator.clipboard.writeText(s);toast('복사했습니다.');}
  catch{const t=el('textarea',undefined,'manualcopy');t.value=s;t.readOnly=true;dialog('직접 복사',el('p','아래 선택된 내용을 복사하세요.'),t);t.focus();t.select();}
}
function invalidate(){records=[];overrides={};$('results').hidden=true;updateCount();}
function updateCount(){
  const input=snapshot();
  entries=passageMode()?CitationInput.extract(input.text):ReferenceInput.entries(input.text,mode,input.styles);
  const notice=$('formatNotice');
  notice.hidden=mode!=='ref'||!input.text.trim();
  if(!notice.hidden)notice.textContent=lastPasteStatus
    ?'최근 붙여넣기 · '+RichInput.pasteMessages[lastPasteStatus]
    :'학술지명과 권 번호의 서식은 검사 결과에서 확인할 수 있습니다.';
  $('lineCount').textContent=entries.length+(mode==='ref'?'개 문헌':'개 인용');
  const merged=entries.filter(e=>e.lastLine>e.firstLine).length;
  $('joinNotice').hidden=!merged;
  $('joinNotice').textContent=merged?'여러 줄로 분리된 참고문헌 '+merged+'개를 자동으로 결합했습니다. 문헌 수를 확인해 주세요.':'';
  $('clear').disabled=input.text.length===0;
}
function sampleCard(){
  const key=mode==='cite'?'citation':$('type').value==='auto'?'journal':$('type').value;
  $('exampleType').textContent=key==='citation'?'본문 인용':rule.types[key];
  $('example').title='형식 설명용 예시';
  $('example').textContent=rule.examples[key][lang];
  $('ko').setAttribute('aria-pressed',lang===0);$('en').setAttribute('aria-pressed',lang===1);
}
$('ko').onclick=()=>{lang=0;sampleCard();};$('en').onclick=()=>{lang=1;sampleCard();};
function switchMode(next){
  if(mode===next)return;mode=next;
  const ref=mode==='ref',cross=mode==='cross';editor.hidden=!ref;citationEditor.hidden=ref;
  $('refMode').setAttribute('aria-pressed',ref);$('citeMode').setAttribute('aria-pressed',mode==='cite');$('crossMode').setAttribute('aria-pressed',cross);
  $('standardForm').hidden=cross;$('crossForm').hidden=!cross;$('crossHelp').hidden=!cross;$('formatExample').hidden=cross;
  $('results').hidden=true;
  if(cross)return;
  $('citationModeField').hidden=ref;$('typeLabel').hidden=!ref;
  $('inputTitle').textContent=ref?'참고문헌 입력':'본문 인용 입력';
  $('inputTitle').htmlFor=activeInput().id;
  citationHints();
  $('inspect').lastElementChild.textContent=ref?'참고문헌 검사하기':'본문 인용 검사하기';invalidate();sampleCard();
}
function citationHints(){
  const ref=mode==='ref',passage=passageMode();
  $('context').hidden=ref || passage;$('scopeField').hidden=!passage;
  citationEditor.placeholder=passage?'검사할 논문 본문이나 문단을 붙여넣으세요.':'예: (홍길동, 2019) 또는 Gide & Rist(1994)';
  $('hint').lastElementChild.textContent=ref?'줄바꿈은 자동으로 묶습니다. 문헌 사이에 빈 줄을 넣으면 구분됩니다.':
    passage?'괄호형·서술형 인용을 찾습니다. 입력 범위를 기준으로 인용 차례를 검사합니다.':'한 줄에 인용 표현 하나씩 입력하세요.';
}
$('citationMode').onchange=()=>{citationHints();invalidate();};
$('citationScope').onchange=invalidate;
$('refMode').onclick=()=>switchMode('ref');$('citeMode').onclick=()=>switchMode('cite');
$('crossMode').onclick=()=>switchMode('cross');
CrossCheckUI.bind();
editor.oninput=()=>{lastPasteStatus=null;invalidate();};citationEditor.oninput=invalidate;
function insertClipboard(data){
  const pasted=RichInput.clipboard(data);
  if(!pasted.text)return;
  RichInput.insert(editor,pasted);
  lastPasteStatus=pasted.status;
  invalidate();
}
editor.addEventListener('paste',event=>{
  event.preventDefault();
  if(event.clipboardData)insertClipboard(event.clipboardData);
});
editor.addEventListener('drop',event=>{
  event.preventDefault();
  if(event.dataTransfer){
    editor.focus();insertClipboard(event.dataTransfer);
  }
});
$('inputTitle').onclick=()=>activeInput().focus();
$('clear').onclick=()=>{setInput('');invalidate();activeInput().focus();};
for(const id of ['type','count','occurrence']) $(id).onchange=()=>{invalidate();sampleCard();};
$('sample').onclick=()=>{
  const inject=()=>{
    const type=$('type').value;
    setInput(passageMode()?'선행연구에서는 관람 의도를 분석했다(Huang & Chiu, 2024). 홍길동(2019)은 참가 경험을 조사했다. 다른 연구에서도 유사한 결과가 나타났다(Price, 2015, 2004).':mode==='cite'?'(Price, 2015, 2004)\n홍길동 등(2016)\n(Gide & Rist, 1994)':
      type==='auto'?[rule.examples.journal[1].replace('& ',''),rule.examples.journal[0],rule.examples.report[0]].join('\n'):
      rule.examples[type].join('\n'));
    invalidate();activeInput().focus();
  };
  if(!snapshot().text.trim())inject();
  else dialog('예시로 바꿀까요?',el('p','현재 입력한 내용이 예시 문헌으로 바뀝니다.'),button('예시 불러오기',()=>{$('modal').close();inject();},'primary'));
};
function badge(status){return el('span',status,'pill '+(status===rule.ok?'good':status===rule.error?'bad':'warn'));}
function originalText(r,styles) {
  const p=el('div',undefined,'original');let at=0;
  const formatted=styles?.some(s=>s?.bold||s?.italic);
  const segment=(a,b)=>formatted?RichInput.fragment({text:r.original,styles},a,b):r.original.slice(a,b);
  const ranges=r.issues.filter(i=>i.end>i.start && (!passageMode() || i.level===rule.error)).slice().sort((a,b)=>a.start-b.start||Number(b.level===rule.error)-Number(a.level===rule.error));
  for(const i of ranges){
    const start=Math.max(at,i.start);if(i.end<=start)continue;
    p.append(segment(at,start));const mark=el('mark',undefined,i.level===rule.error?'err':'');mark.append(segment(start,i.end));mark.title=i.message;p.append(mark);at=i.end;
  }
  p.append(segment(at,r.original.length));return p;
}
function compare(r){
  const before=el('div',undefined,'original'),after=el('div',undefined,'suggest');
  let pos=0;
  for(const e of r.edits){if(e.start<pos)continue;const common=r.original.slice(pos,e.start);before.append(common);after.append(common);before.append(el('del',r.original.slice(e.start,e.end)));after.append(el('ins',e.replacement));pos=e.end;}
  before.append(r.original.slice(pos));after.append(r.original.slice(pos));
  dialog('원문과 비교',el('b','수정 전'),before,el('b','수정 후'),after,...(r.suggested===r.original?[el('p','자동으로 변경한 부분이 없습니다.','muted')]:[]));
}
function card(r,index) {
  const node=el('article',undefined,'resultcard'),head=el('div',undefined,'cardhead'),title=el('div',undefined,'buttons');
  title.style.marginTop='0';title.append(el('h3',(mode==='ref'?'참고문헌 ':'본문 인용 ')+(index+1)),badge(r.status));head.append(title);
  if(mode==='ref'){
    const label=el('label','문헌 유형','type-inline'),select=el('select');
    selectTypes(select,overrides[index]||$('type').value);
    select.options[0].textContent='자동 판별 · '+(r.type==='auto'?'미확정':rule.types[r.type]);
    select.setAttribute('aria-label','참고문헌 '+(index+1)+' 문헌 유형');select.onchange=()=>{overrides[index]=select.value;render();document.querySelectorAll('.type-inline select')[index]?.focus({preventScroll:true});};
    label.append(select);head.append(label);
  }
  const input=entries[index], merged=input.lastLine>input.firstLine;
  node.append(head,el('h4',merged?'검사 원문 · 입력 '+input.firstLine+'–'+input.lastLine+'줄 결합':'원문'),originalText(r,input.styles));
  if(r.formatChecks?.length){
    node.append(el('h4','학술지 서식 검사'));
    for(const f of r.formatChecks){
      const row=el('div',undefined,'format-row');
      row.append(badge(f.status),el('span',f.field+' · '+f.label),el('small',f.ref,'loc'));node.append(row);
    }
  }
  if(merged){
    const details=el('details');
    details.append(el('summary','붙여넣은 줄바꿈 보기'),el('div',input.raw,'original'));
    node.append(details);
  }
  if(r.issues.length){
    node.append(el('h4','발견된 문제'));const ul=el('ul',undefined,'issues');
    for(const i of r.issues){
      const li=el('li');li.append(badge(i.level),el('strong',i.message),el('p',i.advice));
      const loc=i.start===i.end?'삽입 위치 '+(i.start+1):'원문 '+(i.start+1)+'–'+i.end+'번째 문자';
      li.append(el('div',loc+' · '+i.ref,'loc'));ul.append(li);
    }node.append(ul);
  }else node.append(el('p','검사한 표기에서 형식상 문제를 발견하지 못했습니다.','muted'),el('p',mode==='ref'?rule.rules[r.type]||rule.rules.type:rule.rules.citation,'loc'));
  const message=ReferenceInput.suggestionMessage(r,mode);
  if(message){node.append(el('p',message,'muted'));return node;}
  node.append(el('h4','수정 제안'),el('div',r.suggested,'suggest'));
  const actions=el('div',undefined,'buttons');actions.append(button('수정안 복사',()=>copy(r.suggested)),button('원문과 비교',()=>compare(r)));node.append(actions);return node;
}
function sortPanel(){
  const box=el('div',undefined,'sortbox');
  box.append(el('h3','전체 참고문헌 정렬'),el('p',sorting.changed?'입력 순서와 규정에 따른 배열이 다릅니다.':sorting.unknown.length?'일부 항목의 정렬 키를 확인하세요.':'가나다순·알파벳순 배열을 확인했습니다.'),el('p',sorting.ref,'loc'));
  if(sorting.unknown.length)box.append(el('p','확인 필요 · '+sorting.unknown.map(i=>i+1).join(', ')+'번은 저자 표기를 분류하기 어려워 원래 위치에 두었습니다.','muted'));
  if(sorting.changed){
    const d=el('details'),l=el('ol');sorting.order.forEach(i=>l.append(el('li','원문 '+(i+1)+' · '+records[i].suggested)));d.append(el('summary','제안 순서 보기'),l);box.append(d);
    const check=el('input');check.id='sortedCopy';check.type='checkbox';const label=el('label');label.append(check,' 전체 수정안 복사에 제안 순서 적용');d.append(label);
  }return box;
}
function render(){
  const history=passageMode()?CitationInput.history(entries,$('citationScope').value==='complete'):null;
  records=entries.map((entry,i)=>mode==='ref'?rule.reference(entry.text,overrides[i]||$('type').value,entry.styles):
    rule.citation(entry.text,history?{entry,history:history[i]}:{count:$('count').value,occurrence:$('occurrence').value}));
  const out=$('results');out.hidden=false;out.replaceChildren();const head=el('div',undefined,'sectionhead');head.append(el('h2','검사 결과'));out.append(head);
  const summary=el('div',undefined,'summary resultstats');
  for(const label of [mode==='ref'?'총 참고문헌':'총 인용',rule.ok,rule.error,rule.review]){
    const box=el('div');box.append(el('span',label),el('b',label.startsWith('총')?records.length:records.filter(r=>r.status===label).length));summary.append(box);
  }out.append(summary);
  if(passageMode()){
    if(!records.length){
      out.append(el('p','인용 표현이 발견되지 않았습니다. 따로 검사할 표현은 개별 인용 직접 입력에서 확인하세요.'));
      return;
    }
    const preview=el('div',undefined,'original');preview.id='passagePreview';
    const source=citationEditor.value;let at=0;
    records.forEach((r,i)=>{
      if(r.status!==rule.error)return;
      const entry=entries[i];preview.append(source.slice(at,entry.start));
      const mark=el('mark',entry.text,'err');mark.title='본문 인용 '+(i+1)+' · 수정 필요';preview.append(mark);at=entry.end;
    });
    preview.append(source.slice(at));
    const details=el('details');details.open=records.some(r=>r.status===rule.error);
    details.append(el('summary','입력 본문 · 수정 필요 인용 위치'),preview);out.append(details);
  }
  if(mode==='ref'&&records.length>1){sorting=rule.sortReferences(records);out.append(sortPanel());}
  for(let i=0;i<records.length;i++)out.append(card(records[i],i));
  const actions=el('div',undefined,'buttons');
  const copyResults=()=>{
    if(passageMode()){
      let at=0;const parts=[];
      entries.forEach((e,i)=>{parts.push(citationEditor.value.slice(at,e.start),records[i].suggested);at=e.end;});
      copy(parts.join('')+citationEditor.value.slice(at));
    }else copy(($('sortedCopy')?.checked?sorting.order.map(i=>records[i]):records).map(r=>r.suggested).join('\n'));
  };
  actions.append(button(passageMode()?'수정안 반영 본문 복사':'전체 수정안 복사',copyResults,'primary'),button('다시 검사하기',()=>inspect()));out.append(actions);
}
function inspect(){
  updateCount();if(!entries.length && !(passageMode() && citationEditor.value.trim())){toast('검사할 내용을 먼저 입력하세요.');activeInput().focus();return;}
  render();$('results').focus({preventScroll:true});$('results').scrollIntoView({block:'start'});
}
$('inspect').onclick=inspect;
function guidePage(){
  const grid=el('div',undefined,'guidegrid');
  for(const [title,ref,desc,handling,label] of rule.guide){
    const box=el('article',undefined,'guidebox');
    box.append(el('h2',title),el('span',ref,'loc'),el('h3','학회 규정'),el('p',desc));
    if(handling)box.append(el('h3',label||'검사기 처리 원칙'),el('p',handling));
    grid.append(box);
  }
  $('guide').replaceChildren(grid);
}
function testPage(){
  const list=ValidationSuite.run(), p=$('tests'),head=el('div',undefined,'sectionhead');
  head.append(el('h2',list.length+'개 중 '+list.filter(c=>c.pass).length+'개 통과'),button('테스트 다시 실행',()=>{testPage();toast('테스트를 다시 실행했습니다.');}));p.replaceChildren(head);
  for(const c of list){const box=el('details',undefined,'testrow'),summary=el('summary');summary.append(el('span',c.pass?'통과':'실패','pill '+(c.pass?'good':'bad')),c.name);box.append(summary);
    for(const [label,value] of [['입력',c.input],['기대 결과',c.expected],['실제 결과',c.actual]])box.append(el('h4',label),el('div',value,'casecontent'));p.append(box);}
}
const descriptions={workspace:$('intro').innerHTML,guide:'제공된 한국체육학회 제10조와 제11조의 검사 기준을 항목별로 확인하세요.',tests:'테스트 항목을 열어 입력 예시, 기대 결과와 현재 검사기의 실제 결과를 비교하세요.'};
function route(){
  const key=location.hash==='#guide'?'guide':location.hash==='#tests'?'tests':'workspace';
  for(const id of ['workspace','guide','tests'])$(id).hidden=id!==key;
  for(const a of document.querySelectorAll('nav a')){if(a.hash==='#'+key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  $('heading').textContent=key==='guide'?'규정 안내':key==='tests'?'테스트 결과':'한국체육학회 참고문헌 검사기';
  $('intro').innerHTML=descriptions[key];
  if(key==='guide')guidePage();if(key==='tests')testPage();window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);sampleCard();route();updateCount();
