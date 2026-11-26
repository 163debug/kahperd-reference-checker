'use strict';
const ReferenceInput = (() => {
  // These patterns identify entry boundaries, not errors in citation style.
  const year = /(?:\(\s*(?:\d{4}[a-z]?|n\.d\.)(?:\s*,[^()]*)?\s*\)?|\d{4}[a-z]?\)?)(?=\s|[.,:;]|$)/i;
  const korean = /^[가-힣]{2,6}(?:\s*[,·，&]\s*[가-힣]{2,6})*(?:\s+(?:등|외))?$/u;
  const western = /^[\p{Script=Latin}\p{M}\s.,’'&…-]+$/u;
  const institution = /(?:협회|학회|위원회|연구원|연구소|대학교?|재단|공단|진흥원|체육회|통계청|교육부|문화체육관광부|committee|university|association|institute|organization|council|department|society|agency|press)$/i;
  // Positive parsing evidence, never a validity test for a Korean name.
  // Only recover nonstandard delimiters between strongly name-like tokens.
  function looksPersonal(name){
    return name.length>=3 && name.length<=4 &&
      /^(?:남궁|선우|독고|제갈|사공|황보|서문|[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민진류나엄채공천방])[가-힣]+$/.test(name) &&
      !institution.test(name) && !/(?:학회지|논문지|학술지|연구팀|학과|병원)$/.test(name);
  }
  function personalList(text){
    if(/^[가-힣]{2,6}(?:\s*,\s*[가-힣]{2,6})*$/.test(text))return true;
    const names=text.split(/\s*[,，.;·]\s*/);
    return names.length>1 && names.every(looksPersonal);
  }
  function koreanDateHeader(prefix,afterDate){
    const names=prefix.trim().replace(/\s*[,，]$/,'');
    if(personalList(names))return true;
    // Other list evidence can establish the year without identifying each
    // personal name or deciding whether punctuation belongs to an institution.
    return /^[가-힣]{2,12}(?:\s*[,，.;·]\s*[가-힣]{2,12})+$/.test(names) &&
      (/[,，]/.test(names) || names.split(/\s*[,，.;·]\s*/).some(n=>institution.test(n)) ||
       /^\s*\.\s*.+?[.?!]\s+.+?,\s*\d+(?:\(\d+\))?,\s*\d+\s*[-–—~]\s*\d+/.test(afterDate));
  }

  function authors(text) {
    const name=text.trim().replace(/\s*\((?:편|Eds?\.?)\)\.?$/i,'').trim();
    return korean.test(name) || personalList(name) ||
      (western.test(name) && /(?:,\s*\p{Lu}|\b\p{Lu}\.|\bet al\.)/u.test(name)) ||
      /^[A-Z]{2,}$/.test(name) ||
      (/^[\p{L}\p{M} &'’.-]+$/u.test(name) && institution.test(name));
  }

  function startsEntry(line) {
    const m=year.exec(line);
    if(!m)return false;
    const prefix=line.slice(0,m.index);
    if(authors(prefix))return true;
    const after=line.slice(m.index+m[0].length);
    if(m[0].startsWith('(') && m[0].endsWith(')') && /^\s*\./.test(after) &&
       /[.;·]/.test(prefix) && koreanDateHeader(prefix,after))return true;
    // Tolerate one trailing comma only for a plausible Korean author list
    // followed by a parenthesized date. Keep the actual punctuation for review.
    const names=prefix.trimEnd().replace(/[,，]$/,'').trimEnd();
    return names!==prefix.trimEnd() && m[0].startsWith('(') && (korean.test(names)||personalList(names)) &&
      !/(?:학회지|학회|논문지|학술지|저널)$/.test(names);
  }

  function authorFragment(line) {
    if(/[가-힣]/.test(line) && /[.;·]$/.test(line))
      return line.slice(0,-1).trim().split(/\s*[,，.;·]\s*/).every(looksPersonal);
    return authors(line.replace(/(?:,\s*&?|&)\s*$/,''));
  }

  function split(text,styles) {
    const lines=text.split(/\r\n|[\n\r\u2028\u2029]/u);
    const offsets=[0];
    if(styles?.length)for(const m of text.matchAll(/\r\n|[\n\r\u2028\u2029]/gu))offsets.push(m.index+m[0].length);
    const groups=[];
    let first=-1, authorStart=-1;
    function flush(end) {
      if(first<0)return;
      const parts=lines.slice(first,end), raw=parts.join('\n');
      const joined=raw.replace(/[^\S\n]*\n[^\S\n]*/g,' ');
      const group={text:joined,raw,firstLine:first+1,lastLine:end};
      if(styles?.length===text.length){
        group.styles=[];
        parts.forEach((line,index)=>{
          const value=index>0?line.trimStart():line;
          const from=offsets[first+index]+line.length-value.length;
          const size=(index<parts.length-1?value.trimEnd():value).length;
          if(index)group.styles.push(null);
          for(let p=from;p<from+size;p++)group.styles.push(styles[p]);
        });
      }
      groups.push(group);
      first=-1;
    }
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(!line){flush(i);authorStart=-1;continue;}
      let start=startsEntry(line)?i:-1;
      // A line ending with an author delimiter can belong to a wrapped author list.
      // Also support a complete author line followed by the year on its own line.
      const prev=lines[i-1]||'';
      const continuesAuthors=authorStart>=0 && (/[,&]\s*$/.test(prev) ||
        (/[가-힣]/.test(prev) && /[.;·]\s*$/.test(prev)) || line.startsWith('('));
      if(continuesAuthors && year.test(line)){
        const head=lines.slice(authorStart,i+1).map(s=>s.trim()).join(' ');
        if(startsEntry(head))start=authorStart;
      }
      if(start>=0){if(first!==start)flush(start);first=start;}
      else if(first<0)first=i;
      authorStart=authorFragment(line)?(continuesAuthors?authorStart:i):-1;
    }
    flush(lines.length);
    return groups;
  }

  function entries(text,mode,styles) {
    if(mode==='ref')return split(text,styles);
    return text.split(/\r\n|[\n\r\u2028\u2029]/u).filter(s=>s.trim()).map(s=>({text:s,raw:s}));
  }
  function suggestionMessage(record,mode) {
    if(record.original!==record.suggested)return '';
    if(mode==='ref' && record.type==='auto')return '문헌 유형을 먼저 확인해 주세요.';
    return record.issues.length?'자동으로 수정할 항목이 없습니다. 위의 확인 사항을 검토해 주세요.':'자동으로 수정할 항목이 없습니다.';
  }
  return {entries,suggestionMessage,personalList,koreanDateHeader};
})();
if(typeof module!=='undefined')module.exports=ReferenceInput;
