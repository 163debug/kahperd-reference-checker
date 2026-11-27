'use strict';
// Locate author–year spans. These patterns are recognition heuristics, not society rules.
const CitationInput=(()=>{
  const year=String.raw`(?:\d{4}[a-z]?|n\.d\.)`;
  const yearGap=String.raw`(?:\s*[,，;；]\s*|\s+)`;
  const dates=year+'(?:'+yearGap+year+')*';
  const splitYears=text=>text.match(new RegExp(year,'g'));
  const korean=String.raw`[가-힣]{2,12}`;
  const latin=String.raw`(?:(?:de la|van der|van|von|de)\s+)?\p{Lu}[\p{Script=Latin}\p{M}’'-]*`;
  const person='(?:'+korean+'|'+latin+')';
  const join=String.raw`(?:\s*[,，]\s*(?:&\s*)?|\s*&\s*|\s+and\s+)`;
  const initials=latin+String.raw`,\s*(?:\p{Lu}\.\s*)*\p{Lu}\.`;
  const initialsOnly=new RegExp('^'+initials+'$','u');
  const author='(?:'+initials+'|'+person+'(?:'+join+person+')*(?:\\s+(?:등|et\\s+al\\.?))?)';
  const groupPattern=new RegExp('('+author+')([\\s,，;；:：]*)('+dates+')','duy');
  const yearsOnly=new RegExp('^\\s*('+dates+')\\s*$','u');
  const beforeYear=new RegExp('(?<![\\p{L}\\p{N}])('+author+')([\\s,，]*)$','u');
  const koreanPerson=/^(?:남궁|선우|독고|제갈|사공|황보|서문|[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민진류나엄채공천방허지길반명봉두표추모설여마육탁빈려])[가-힣]{1,3}$/;
  const nonAuthor=/^(?:이하|이후|이전|이때|이상|정도|정부|조사|조사결과|조사기간|연구|선행연구|참가자|참여자|결과|기간|연도|지난해|이번|보고서|기준|표본|표|그림|또한|반면|한편|다만|예시|year|in|since|from|during|between|table|figure|fig|spring|summer|fall|winter|sample|survey|phase|season|wave|data|model)$/i;
  function identity(authorText){
    if(initialsOnly.test(authorText))return {names:[authorText.trim().replace(/\s+/g,' ')],short:false,withInitials:true};
    const short=/\s(?:등|et\s+al\.?)$/i.test(authorText);
    const names=authorText.replace(/\s+(?:등|et\s+al\.?)$/i,'').split(/\s*(?:[,，]\s*&?|&|\band\b)\s*/).map(s=>s.trim().replace(/\s+/g,' '));
    if(!names.every(n=>!nonAuthor.test(n) && (!/[가-힣]/.test(n) || koreanPerson.test(n) || /(?:학회|협회|연구원|연구소|위원회|공단|부|청)$/.test(n))))return null;
    return {names,short};
  }
  const calendar=/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)$/i;
  function work(m,base=0){
    const who=identity(m[1]);
    if(!who || !m[2] || calendar.test(m[1]) && !m[2].trim() || /^(?:N|P|CI|SD|SE|OR)$/i.test(m[1]))return null;
    return {...who,author:m[1],start:base+m.indices[1][0],authorEnd:base+m.indices[1][1],
      yearStart:base+m.indices[3][0],yearEnd:base+m.indices[3][1],years:splitYears(m[3])};
  }
  function parenthetical(text){
    const groups=[];let at=1;
    while(at<text.length-1){
      while(/\s/.test(text[at]))at++;
      groupPattern.lastIndex=at;
      const match=groupPattern.exec(text);
      if(!match)return null;
      const part=work(match);if(!part)return null;
      groups.push(part);at=part.yearEnd;
      const gap=/^[\s;,，；:：]*/.exec(text.slice(at))[0];at+=gap.length;
      if(at===text.length-1)return gap.trim()?null:groups;
      if(!gap || !text[at])return null;
    }
    return null;
  }
  function extract(source){
    const entries=[];
    for(const match of source.matchAll(/\(([^()]*)\)/g)){
      if(/\n\s*\n/.test(match[0]))continue;
      let start=match.index,groups;
      const end=start+match[0].length, date=yearsOnly.exec(match[1]);
      if(date){
        // Only inspect the nearby author list. Do not cross a paragraph boundary.
        const left=source.slice(Math.max(0,start-1024),start).split(/\r?\n\s*\r?\n/).pop();
        let candidate=beforeYear.exec(left);
        while(candidate && !identity(candidate[1])){
          const skip=candidate.index+candidate[1].match(/^[^\s,，&]+/)[0].length;
          const rest=beforeYear.exec(left.slice(skip));
          if(rest)rest.index+=skip;
          candidate=rest;
        }
        if(!candidate || calendar.test(candidate[1]) || /\n\s*\n/.test(candidate[0]))continue;
        start-=left.length-candidate.index;
        const yearStart=match.index-start+1+match[1].indexOf(date[1]);
        groups=[{...identity(candidate[1]),author:candidate[1],start:0,authorEnd:candidate[1].length,yearStart,yearEnd:yearStart+date[1].length,years:splitYears(date[1])}];
      }else{
        groups=parenthetical(match[0]);if(!groups)continue;
      }
      entries.push({text:source.slice(start,end),start,end,groups,narrative:!!date});
    }
    return entries;
  }
  // Distinct author lists sharing a lead author and year cannot identify a short form.
  function history(entries,fromBeginning=false){
    const authors=new Map(),seenFull=new Set(),seenShort=new Set();
    const shortKey=(g,y)=>JSON.stringify([g.names[0],y]);
    const fullKey=(g,y)=>JSON.stringify([g.names,y]);
    const ambiguousYears=(e,g)=>/[;；]/.test(e.text.slice(g.yearStart,g.yearEnd));
    for(const e of entries){
      for(const g of e.groups){
        if(g.short || ambiguousYears(e,g))continue;
        for(const y of g.years){
          const key=shortKey(g,y);
          if(!authors.has(key))authors.set(key,new Map());
          authors.get(key).set(fullKey(g,y),g.names.length);
        }
      }
    }
    return entries.map(e=>{
      const contexts=e.groups.map(g=>{
        if(ambiguousYears(e,g))return {};
        const keys=g.years.map(y=>{
          if(!g.short)return [fullKey(g,y),g.names.length];
          const candidates=authors.get(shortKey(g,y));
          if(candidates?.size!==1)return null;
          const full=[...candidates][0];
          return full[1]>=3?full:null;
        });
        if(keys.every(k=>k && seenFull.has(k[0]))){
          const count=keys.every(k=>k[1]===keys[0][1])?keys[0][1]:0;
          return {occurrence:'repeat',count};
        }
        if(fromBeginning && !g.short && g.years.every(y=>!seenShort.has(shortKey(g,y)) && !seenFull.has(fullKey(g,y))))
          return {occurrence:'first',count:g.names.length};
        return {};
      });
      for(const g of e.groups){
        if(ambiguousYears(e,g))continue;
        for(const y of g.years){
          if(g.short)seenShort.add(shortKey(g,y));
          else seenFull.add(fullKey(g,y));
        }
      }
      return contexts;
    });
  }
  return {extract,history};
})();
if(typeof module!=='undefined')module.exports=CitationInput;
