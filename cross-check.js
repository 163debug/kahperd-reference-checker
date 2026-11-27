'use strict';
// Cross-check identities only. Format judgments belong to the society's format checker.
const CrossCheck=(()=>{
  const citations=typeof require==='function'?require('./citation-input.js'):CitationInput;
  const references=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  const norm=s=>s.normalize('NFC').trim().replace(/\s+/g,' ').replace(/[’‘]/g,"'").toLowerCase();
  const date=/\d{4}[a-z]?|n\.d\./gi;
  const dateValue=/^(?:\d{4}[a-z]?|n\.d\.)$/i;
  const org=/(학회|협회|재단|위원회|대학교|연구소|연구원|공단|청|부)$/;
  const family="[\\p{Script=Latin}\\p{M}’'-]+(?:\\s+[\\p{Script=Latin}\\p{M}’'-]+)*";
  const person=new RegExp('('+family+')[,，]?\\s+((?:\\p{Lu}\\.(?:\\s*[-‐]?\\s*(?=\\p{Lu}\\.))?)+)','uy');
  function author(name,initials=''){return {name:norm(name),initials:initials.replace(/[.\s‐-]/g,'').toUpperCase()};}
  function readNames(raw){
    const s=raw.trim().replace(/[,，]\s*$/,'');
    if(!s || /무명|익명|저자\s*(?:없음|미상)|anonymous|unknown|^미상$/i.test(s))return [];
    if(org.test(s) && /^[가-힣]+$/.test(s))return [author(s)];
    if(/^[A-Z]{2,12}$/.test(s))return [author(s)];
    if(references.personalList(s))return s.split(/\s*[,，.;·]\s*/).map(n=>author(n));
    const names=[];let pos=0;
    while(pos<s.length){
      person.lastIndex=pos;
      const m=person.exec(s);if(!m)return [];
      names.push(author(m[1],m[2]));pos=person.lastIndex;
      if(pos===s.length)break;
      const gap=/^(?:\s*[,，]\s*(?:&\s*)?|\s*&\s*)/.exec(s.slice(pos));
      if(!gap)return [];
      pos+=gap[0].length;
    }
    return names;
  }
  function citationNames(g){
    return g.names.map(n=>{
      const comma=n.indexOf(',');
      return comma<0?author(n):author(n.slice(0,comma),n.slice(comma+1));
    });
  }
  function identityKey(names,year,short=false){return JSON.stringify([names,year,short]);}
  const yearsOf=s=>Array.from(s.matchAll(date),m=>norm(m[0]));
  function readRef(entry){
    const text=entry.text.trim(),header=/^([^()]*?)\s*\(([^()]*)\)/.exec(text);
    const loose=!header && /^(.+?)[ ,]+(\d{4}[a-z]?|n\.d\.)\s*\.\s+/i.exec(text);
    const match=header||loose;
    const head=match?.[1]||'',stamp=match?.[2]?.trim()||'';
    const year=stamp.split(',')[0].trim().toLowerCase();
    const names=readNames(head);
    const body=match?text.slice(match[0].length).replace(/^[.\s]+/,''):'';
    const exceptional=/재인용|as cited in|원저\s*[:(]|\boriginal work published\b/i.test(text) ||
      /(?:\.{3}|…|\bet al\.|\s등$|\([^)]*\))/.test(head) || /[\/／]/.test(stamp);
    const ok=names.length>0 && dateValue.test(year) && !exceptional &&
      (!stamp.includes(',') || /^(?:\d{4}),\s*(?:\d{1,2}월|[A-Za-z]+\s*\d{1,2})/.test(stamp));
    // Only header evidence may limit the impact of an unreadable record.
    const lead=/^([가-힣]{2,4})(?=\s*[,，(])|^([\p{Script=Latin}’'-]+)(?=,\s*\p{Lu}\.)/u.exec(head||text);
    const alias=/[가-힣]\s*\([A-Za-z][^)]*\)\s*\(/.test(text);
    const hints=alias || /재인용|as cited in/i.test(text)?[]:names.length?[names[0].name]:lead?[norm(lead[1]||lead[2])]:[];
    const years=match?yearsOf(stamp):[];
    // Require visible publication details as well as a title before asserting duplication.
    const detailed=/[.!?]\s+\S[\s\S]*(?:[,:]|https?:|학위논문|대학교|University|presented at)/i.test(body);
    const signature=ok && detailed?JSON.stringify([names,year,stamp.normalize('NFC'),body.normalize('NFC').trim().replace(/\s+/g,' ')]):null;
    return {...entry,names,year,ok,signature,hints,years,reason:ok?'':'저자 목록 또는 출판연도를 온전히 식별할 수 없습니다.'};
  }
  // Recover potential new headers or unreadable records that ordinary line folding absorbed.
  function readList(text){
    const list=[];
    for(const entry of references.entries(text,'ref')){
      const lines=entry.raw.split('\n');let begin=0;
      function flush(end){
        const raw=lines.slice(begin,end).join('\n');
        list.push(readRef({raw,text:raw.replace(/[^\S\n]*\n[^\S\n]*/g,' '),firstLine:entry.firstLine+begin,lastLine:entry.firstLine+end-1,index:list.length+1}));
        begin=end;
      }
      for(let i=1;i<lines.length;i++){
        const line=lines[i].trim(),prev=lines[i-1].trim();
        if(/^[^()]{0,120}\((?:in press|출판\s*중|연도\s*미상|\d{4}\s*\/|n\.d\.|\d{4}[a-z]?\s*\))/.test(line) && !/^[.,&]/.test(line) && !/[,，&]$/.test(prev) && !/^\(/.test(line))flush(i);
        else if(/[.!?]$/.test(prev) && /(?:https?:\/\/|\d+\s*[-–]\s*\d+\.?$|:\s*[^:.]+[.]$)/.test(prev) &&
          !/^(?:doi\b|https?:|retrieved\b|(?:원저|번역)|\d)/i.test(line))flush(i);
      }
      flush(lines.length);
    }
    return list;
  }
  const special=/재인용|as cited in|번역 연도|원저|in press|저자\s*(?:없음|미상)|연도\s*(?:없음|미상)|출판\s*중|\d{4}[a-z]?\s*[\/／]\s*\d{4}/i;
  function auditText(text){
    const layout=text.replace(/（/g,'(').replace(/）/g,')');
    const known=citations.extract(layout),expressions=[],failures=[];
    function failed(start,end,reason,hints=[],years=[]){
      failures.push({start,end,text:text.slice(start,end),reason,hints,years});
    }
    // Mask accepted spans so that their dates cannot become separate failures.
    const mask=layout.split('');
    function maskSpan(a,b){for(let i=a;i<b;i++)if(mask[i]!=='\n')mask[i]=' ';}
    for(const e of known){
      let start=e.start,end=e.end;
      const preceding=text.slice(Math.max(0,start-110),start),after=text.slice(end,end+50);
      const secondary=/\b(?:as cited in)\s*$|재인용\s*[:：]?\s*$/i.exec(preceding);
      const secondaryAfter=/^\s*(?:에서\s*)?재인용/.exec(after);
      const multiName=e.narrative && /(?:^|[^\p{L}])(\p{Lu}[\p{L}’'-]+)\s+$/u.exec(preceding);
      const alias=e.narrative && /[가-힣]+\s*\([A-Za-z ’'-]+\)\s*$/.exec(preceding);
      if(secondary || secondaryAfter || alias || multiName && !/^(?:In|By|See|According|The|And|But|Meanwhile)$/i.test(multiName[1]) ||
        e.groups.some(g=>/[;；]/.test(e.text.slice(g.yearStart,g.yearEnd)))){
        if(secondary)start-=secondary[0].length;
        if(multiName)start-=multiName[1].length+1;
        if(secondaryAfter)end+=secondaryAfter[0].length;
        failed(start,end,'복합 저자명·재인용 또는 연도의 소속을 확인하세요.',[],secondary||secondaryAfter?[]:yearsOf(e.text));
      }else expressions.push({...e,text:text.slice(start,end)});
      maskSpan(start,end);
    }
    function inspect(start,end,raw){
      const s=raw.trim();
      if(!s || /^(?:N|n|p|t|F|r|SD|M|CI|OR|β|χ²)\s*[=<>≤≥]|^\d+(?:\.\d+)?\s*%|^(?:이하|단위|표\s*\d|그림\s*\d)/i.test(s))return;
      if(/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(s))return;
      const ys=yearsOf(s),prefix=text.slice(Math.max(0,start-120),start);
      const lead=/^([가-힣]{2,4}|[A-Z][\p{Script=Latin}’'-]+)(?=\s*[,，]|\s+et al\b|\s+등(?:\s|$))/u.exec(s);
      const possible=/[,，;&；?]|et al\.?|\s등\b/i.test(s) || special.test(s) || /[A-Z가-힣][^()]{0,65}\s+\d{4}/.test(s);
      const unknownSlots=/^[?？…\s,，;；]+$/.test(s) && /[,，;]/.test(s);
      const bilingual=/(?:[가-힣]{2,12}\s*\([A-Za-z ’'-]+\)|[A-Za-z’'-]+\s*\([가-힣]{2,12}\))\s*$/.exec(prefix);
      if(bilingual && ys.length){failed(start-bilingual[0].length,end,'한글·영문 병기 저자의 범위를 확인하세요.',[],ys);return;}
      const narrative=/([가-힣]{2,12}|\p{Lu}[\p{Script=Latin}’'-]+)\s*$/u.exec(prefix);
      const onlyDate=/^(?:\d{4}[a-z]?|n\.d\.)(?:\s*[,–-]\s*\d{4}[a-z]?)*$/i.test(s);
      if(onlyDate && (!narrative || /^(?:결과|기간|연도|연구|자료|표|그림|during|in|year)$/i.test(narrative[1]) || !/^[가-힣]{2,4}$|^[A-Z]/.test(narrative[1])))return;
      const missingDate=lead && /(?:[,，]|\bet al\.?|\s등)\s*$/i.test(s);
      if(!onlyDate && !unknownSlots && !missingDate && !special.test(s) && !(possible && (ys.length || lead && /\?|미상|연도|[12]\d{2}[x?]/i.test(s))))return;
      if((onlyDate || special.test(s) && !lead) && narrative)start-=narrative[0].length;
      failed(start,end,'인용으로 보이는 부분의 저자·연도를 확인하세요.',
        lead && !special.test(s) && !/[;；]/.test(s)?[norm(lead[1])]:[],
        s.split(/[;；]/).some(part=>!yearsOf(part).length)?[]:ys);
    }
    const unmasked=mask.join('');
    for(const m of unmasked.matchAll(/\(([^()\n]*(?:\n(?!\s*\n)[^()\n]*)*)(?:\)|(?=\(|\n\s*\n|$))/g)){
      inspect(m.index,m.index+m[0].length,m[1]);maskSpan(m.index,m.index+m[0].length);
    }
    // Clear author–year fragments outside parentheses may reflect a missing bracket.
    for(const m of mask.join('').matchAll(/(?:[A-Z][\p{Script=Latin}’'-]+|[가-힣]{2,4})(?:\s+et al\.|\s+등)?\s*[,，]\s*(?:\d{4}[a-z]?|n\.d\.)\b/gu)){
      failed(m.index,m.index+m[0].length,'괄호 밖의 저자·연도 표현을 확인하세요.',[],yearsOf(m[0]));
    }
    return {expressions,failures:failures.sort((a,b)=>a.start-b.start)};
  }
  const sameAuthor=(a,b)=>a.name===b.name && (!a.initials || a.initials===b.initials);
  function exact(c,r){
    if(c.year!==r.year || !sameAuthor(c.names[0],r.names[0]))return false;
    return c.short?r.names.length>=3:c.names.length===r.names.length && c.names.every((a,i)=>sameAuthor(a,r.names[i]));
  }
  function incompleteIdentity(c,r){
    if(c.year.slice(0,4)!==r.year.slice(0,4))return false;
    const names=c.short?r.names.slice(0,1):r.names;
    return (!c.short || r.names.length>=3) && c.names.length===names.length && c.names.every((a,i)=>
      a.name===names[i].name && (!a.initials || !names[i].initials || names[i].initials.startsWith(a.initials)));
  }
  function partialCould(f,c){
    return (!f.years.length || f.years.some(y=>y.slice(0,4)===c.year.slice(0,4))) &&
      (!f.hints.length || f.hints.includes(c.names[0].name));
  }
  // A near spelling is only a veto on a definitive absence. Never rank it or use it as a match.
  function nearName(a,b){
    if(a===b)return true;
    if(Math.abs(a.length-b.length)>1 || Math.min(a.length,b.length)<3)return false;
    const longer=a.length>=b.length?a:b,shorter=a.length>=b.length?b:a;
    let i=0;while(i<shorter.length && longer[i]===shorter[i])i++;
    return longer.slice(i+1)===shorter.slice(i+(longer.length===shorter.length?1:0)) ||
      longer.length===shorter.length && longer[i]===shorter[i+1] && longer[i+1]===shorter[i] && longer.slice(i+2)===shorter.slice(i+2);
  }
  function plausible(c,r){
    const a=c.names.map(n=>n.name),b=r.names.map(n=>n.name);
    if(a.join('|')===b.join('|') || c.short && a[0]===b[0])return true;
    if(c.year.slice(0,4)!==r.year.slice(0,4))return false;
    return a[0]===b[0] || a.length===b.length && (a.slice().sort().join('|')===b.slice().sort().join('|') || a.every((n,i)=>nearName(n,b[i])));
  }
  function analyze(text,list,scope='partial'){
    const refs=readList(list),{expressions,failures}=auditText(text);
    const units=[],bySignature=new Map();
    for(const ref of refs){
      let u=ref.signature && bySignature.get(ref.signature);
      if(!u){u={...ref,rows:[],used:false,possible:false,id:units.length};units.push(u);if(ref.signature)bySignature.set(ref.signature,u);}
      u.rows.push(ref);
    }
    const valid=units.filter(u=>u.ok),invalid=units.filter(u=>!u.ok);
    const found=new Map(),keys=new Set();let occurrences=0;
    for(const e of expressions)for(const g of e.groups)for(const year of g.years){
      const c={names:citationNames(g),short:g.short,year:norm(year)};
      const key=identityKey(c.names,c.year,c.short);keys.add(key);occurrences++;
      const matches=valid.filter(r=>exact(c,r)),uncertain=invalid.filter(r=>partialCould(r,c));
      const incomplete=matches.length?[]:valid.filter(r=>incompleteIdentity(c,r));
      const candidates=[...matches,...incomplete,...uncertain];
      let kind='missing',reason='입력한 참고문헌 목록에서 대응 문헌을 찾지 못했습니다.';
      if(!list.trim()){kind='review';reason='참고문헌 목록을 입력해야 대응 여부를 검사할 수 있습니다.';}
      else if(matches.length===1 && !uncertain.length){kind='match';matches[0].used=true;reason='저자·연도로 목록의 문헌 한 편을 식별했습니다.';}
      else if(candidates.length){kind='review';reason=uncertain.length?'식별에 실패한 참고문헌이 이 인용에 대응할 가능성이 있습니다.':incomplete.length?'연도 접미사 또는 이니셜을 대조해야 문헌을 식별할 수 있습니다.':'같은 인용에 대응할 수 있는 문헌이 여러 편입니다.';}
      else{
        const blockers=valid.filter(r=>plausible(c,r));
        if(blockers.length){kind='review';reason='저자·연도 정보만으로 같은 문헌일 가능성을 배제하기 어렵습니다.';for(const r of blockers)r.possible=true;}
      }
      if(kind==='review')for(const r of candidates)r.possible=true;
      const id=kind==='match'?'ref:'+matches[0].id:key;
      if(!found.has(id))found.set(id,{kind,reason,candidates,locations:[]});
      found.get(id).locations.push({text:e.text,start:e.start,end:e.end,author:g.author,year:c.year});
    }
    const rows=[...found.values()];
    for(const u of units){
      if(!u.ok){u.kind='failure';continue;}
      const sameKey=valid.some(v=>v!==u && identityKey(v.names,v.year)===identityKey(u.names,u.year));
      if(u.used)u.kind='used';
      else if(u.possible || failures.some(f=>partialCould(f,u)) || sameKey)u.kind='review';
      else if(scope!=='full' || !text.trim())u.kind='held';
      else u.kind='unused';
    }
    const count=(xs,kind)=>xs.filter(x=>x.kind===kind).length;
    const stats={expressions:expressions.length,occurrences,keys:keys.size,references:refs.length,matches:count(rows,'match'),
      missing:count(rows,'missing'),unused:count(units,'unused'),duplicates:units.reduce((n,u)=>n+u.rows.length-1,0),
      review:count(rows,'review')+count(units,'review')+invalid.length+failures.length,held:count(units,'held'),
      citeOk:expressions.length,citeFail:failures.length,refOk:refs.filter(r=>r.ok).length,refFail:invalid.length};
    return {rows,units,failures,stats};
  }
  return {analyze};
})();
if(typeof module!=='undefined')module.exports=CrossCheck;
