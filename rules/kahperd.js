'use strict';
const Kahperd = (() => {
  const ok = '정상', error = '수정 필요', review = '확인 필요';
  const types = {auto:'자동 판별', journal:'학술지 논문', book:'단행본', thesis:'석·박사 학위논문', news:'신문기사', conference:'학술대회·심포지엄 자료', report:'보고서'};
  const rules = {
    year:'제11조 · 출판연도 표기', author:'제11조 제1항 · 학술지 저자 표기',
    titleSeparator:'제11조 제1항 · 논문 제목과 학술지명 표기 예시', title:'제11조 제1항 · 영문 논문 제목', journal:'제11조 제1항 · 학술지명',
    volume:'제11조 제1항 · 권·호·페이지', doi:'제11조 · DOI 표기 예시',
    long:'제11조 · 외국어 저자 8인 이상 표기 예시', order:'제11조 · 참고문헌 배열',
    book:'제11조 · 단행본', thesis:'제11조 · 학위논문', news:'제11조 · 신문기사',
    conference:'제11조 · 학술대회·심포지엄 자료', report:'제11조 · 보고서',
    type:'제11조 · 문헌 유형별 작성 예시', citation:'제10조 · 본문 저자·연도 표기',
    count:'제10조 · 저자 수와 첫 인용·반복 인용', multiple:'제10조 · 동시 인용 및 동일 저자 복수 문헌'
  };
  const initial = String.raw`[\p{Lu}]\.(?:[\s-]*[\p{Lu}]\.)*`;
  const family = String.raw`[\p{L}][\p{L}’'-]*(?:\s+[\p{L}][\p{L}’'-]*)*`;
  const person = new RegExp('('+family+')(\\s*,\\s*|\\s+)('+initial+')','dgu');
  const yearToken = '(?:\\d{4}[a-z]?|n\\.d\\.)';
  const normalYear = new RegExp('\\(\\s*(' + yearToken + ')(?:,\\s*([^()]+?))?\\s*\\)');
  const brokenYear = new RegExp('(?:^|\\s|(?<=[가-힣.]))(\\(?' + yearToken + '\\)?)(?=\\s*[.,:;]|\\s+\\p{L}|$)','u');
  const sourcePrompt = '원자료에서 해당 정보를 확인해 직접 입력하세요.';
  function record(original) {
    return {original, issues:[], edits:[], suggested:original, status:ok, type:'auto',author:''};
  }
  function note(r,id,level,ref,start,end,message,advice,replacement) {
    const item={id,level,ref:rules[ref],start,end,message,advice};
    r.issues.push(item);
    if (replacement !== undefined) r.edits.push({start,end,replacement});
  }
  function finish(r) {
    let cursor=0, result='';
    for(const e of r.edits.sort((a,b)=>a.start-b.start || a.end-b.end)) {
      if(e.start<cursor) continue;
      result+=r.original.slice(cursor,e.start)+e.replacement;
      cursor=e.end;
    }
    r.suggested=result+r.original.slice(cursor);
    r.status=r.issues.some(i=>i.level===error)?error:r.issues.length?review:ok;
    return r;
  }
  function separator(r,id,ref,start,end,expected,message,advice) {
    if(r.original.slice(start,end)!==expected)
      note(r,id,error,ref,start,end,message,advice,expected);
  }
  function datePart(r) {
    const s=r.original, m=normalYear.exec(s), b=brokenYear.exec(s);
    const brokenStart=b?b.index+b[0].indexOf(b[1]):-1;
    const useBroken=b && (!m || brokenStart<m.index) && !normalYear.test(b[1]);
    if(!m && !useBroken) {
      note(r,'year-unknown',review,'year',0,s.length,'저자와 출판연도의 경계를 확인하기 어렵습니다.',sourcePrompt);
      return null;
    }
    const token=useBroken?b[1]:m[0];
    const pos=useBroken?brokenStart:m.index;
    r.author=s.slice(0,pos).trim();
    const candidate=r.author.replace(/\((?:편|Eds?\.?)\)\.?$/i,'').trim();
    if ((useBroken && /^,\s*(?:\d{1,2}월|[A-Za-z]+\s+\d|\w+\))/.test(s.slice(pos+token.length))) ||
        /[?!:;]|\p{Ll}{2,}\.\s|\p{Script=Hangul}\.\s/u.test(candidate) ||
        (useBroken && !/^(?:[가-힣]{2,6}(?:,\s*[가-힣]{2,6})*|.*\p{Lu}\.)$/u.test(candidate))) {
      note(r,'year-unknown',review,'year',pos,pos+token.length,'저자 다음의 출판연도인지 확인하세요.',sourcePrompt);
      return null;
    }
    if(!r.author) note(r,'author-empty',review,'type',0,pos,'저자 정보가 비어 있습니다.',sourcePrompt);
    if(!useBroken && /^\(\s|\s\)$/.test(token)){
      separator(r,'year-brackets','year',pos,pos+token.length,'('+token.slice(1,-1).trim()+')','연도 괄호 안쪽의 공백을 확인하세요.','괄호 안쪽의 불필요한 공백을 제거합니다.');
    }
    if(useBroken) {
      // Do not treat numbers from free text or a title as an author's publication year.
      const plausible=/^[가-힣a-zA-ZÀ-ž,.\s&'’\-]+$/u.test(r.author) && !/[가-힣]\.\s|[a-z]{2}\.\s/i.test(r.author);
      if(!plausible) {
        note(r,'year-unknown',review,'year',pos,pos+token.length,'이 숫자가 출판연도인지 확인하세요.',sourcePrompt);
        return null;
      }
      note(r,'year-brackets',error,'year',pos,pos+token.length,'출판연도의 괄호가 빠졌습니다.','입력된 연도를 한 쌍의 괄호로 감싸세요.','('+token.replace(/[()]/g,'')+')');
    }
    const end=pos+token.length, after=s.slice(end), punctuation=/^\s*([.,:;])\s*/.exec(after);
    const body=end+(punctuation?.[0].length??after.match(/^\s*/)[0].length);
    separator(r,'year-stop','year',end,body,body<s.length?'. ':'.','출판연도 뒤의 마침표와 공백을 확인하세요.','연도 괄호 뒤에 마침표를 붙이고 제목 앞에서 한 칸 띕니다.');
    return {body,yearStart:pos,date:useBroken?token:m[0],month:useBroken?'':m[2]||''};
  }
  function doiPart(r) {
    const s=r.original, m=/(?:(?<!\S)|(?<=\d[-–—~]\d{1,12}[.,;]?)(?=doi\s*:|https?:\/\/(?:dx\.)?doi\.org\/))(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*|(?=10\.\d{4,9}\/))\S*\s*$/i.exec(s);
    if(!m || (m.index>0 && !/\s/.test(s[m.index-1]) && !journalTail.test(s.slice(0,m.index))))
      return s.trimEnd().length;
    const segment=m[0].trimEnd(), value=segment.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*)/i,'');
    if(!/^10\.\d{4,9}\/\S+$/i.test(value)) {
      note(r,'doi-value',review,'doi',m.index,m.index+segment.length,'DOI 식별자 구조를 확인하세요.',sourcePrompt);
    } else if(segment!=='doi: '+value) {
      note(r,'doi-prefix',error,'doi',m.index,m.index+segment.length-value.length,'DOI 접두 표기가 제공된 학회 예시와 다릅니다.','식별자 앞에 doi: 와 공백을 씁니다.','doi: ');
    }
    if(/[.,;)]$/.test(value)) note(r,'doi-ending',review,'doi',m.index+segment.length-1,m.index+segment.length,'DOI 끝의 기호가 식별자에 포함되는지 확인하세요.',sourcePrompt);
    r.doiStart=m.index;
    return s.slice(0,m.index).trimEnd().length;
  }
  function journalAuthors(r,yearStart) {
    const a=r.author, pos=r.original.indexOf(a);
    const flag=(id,msg,ref='author')=>note(r,id,review,ref,pos,pos+a.length,msg,sourcePrompt);
    if(/[가-힣]/.test(a)) {
      if(/^[가-힣]{2,6}(?:\s*,\s*[가-힣]{2,6})*$/.test(a)){
        for(const gap of a.matchAll(/\s*,\s*/g))
          separator(r,'ko-author-comma','author',pos+gap.index,pos+gap.index+gap[0].length,', ','국문 저자 사이의 쉼표와 공백을 확인하세요.','앞 저자명에 쉼표를 붙이고 다음 저자까지 한 칸 띕니다.');
        separator(r,'year-position','year',pos+a.length,yearStart,'','국문 저자와 연도 괄호 사이에 공백이 있습니다.','국문 학술지 예시처럼 마지막 저자명에 연도 괄호를 붙입니다.');
      }
      if(/(?:\s등|외\s*\d*\s*인?|et al\.)$/.test(a)) flag('ko-authors','국문 저자명을 모두 기재했는지 확인하세요.');
      else if(/^[가-힣]{2,5}(?:\s+[가-힣]{2,5})+$/.test(a)) flag('ko-separator','여러 저자의 이름이라면 쉼표로 구분하세요.');
      return;
    }
    if(/\.{3}|…|\bet al\b/i.test(a)) {
      flag('eight-authors','원자료의 저자가 8명 이상인지, 앞 6명·생략표·마지막 저자 순인지 확인하세요.','long'); return;
    }
    if(/\band\b/i.test(a)) {
      flag('author-conjunction','저자 사이의 연결어인지 단체명에 포함된 단어인지 확인하세요.');return;
    }
    const names=[...a.matchAll(person)];
    if(!names.length || names[0].index!==0 || names.at(-1).index+names.at(-1)[0].length!==a.length || !/^[\s,&]*$/.test(a.replace(person,''))){
      flag('author-shape','성·이니셜 또는 단체저자 표기를 확인하세요.');return;
    }
    if(names.length>=8){flag('eight-authors','저자가 8인 이상으로 보입니다. 생략할 저자와 마지막 저자를 원자료에서 확인하세요.','long');return;}
    separator(r,'year-position','year',pos+a.length,yearStart,' ','영문 저자와 연도 괄호 사이의 공백을 확인하세요.','마지막 이니셜 뒤에서 한 칸 띄우고 연도 괄호를 씁니다.');
    names.forEach((name,i)=>{
      const [from,to]=name.indices[2];
      separator(r,'surname-comma','author',pos+from,pos+to,', ','외국인 저자의 성 뒤 쉼표와 공백을 확인하세요.','성에 쉼표를 붙이고 이니셜까지 한 칸 띕니다.');
      if(!i)return;
      const begin=names[i-1].index+names[i-1][0].length;
      const last=i===names.length-1, gap=a.slice(begin,name.index);
      if(!/^\s*,?\s*&?\s*$/.test(gap) || (!last && gap.includes('&'))){
        flag('ampersand-position','저자 사이의 연결 기호와 저자 경계를 확인하세요.');return;
      }
      separator(r,last?'ampersand':'author-comma','author',pos+begin,pos+name.index,last?', & ':', ','영문 저자 사이의 구분 기호와 공백을 확인하세요.',last?'마지막 저자 앞에 쉼표, 공백, &, 공백을 씁니다.':'두 이름 사이에 쉼표와 한 칸의 공백을 씁니다.');
    });
  }
  function journalStyle(r,styles,field,start,end,key,ref){
    const label=key==='bold'?'굵게':'이탤릭';
    let missing=false,unavailable=false;
    for(let p=start;p<end;p++){
      if(/\s/.test(r.original[p]))continue;
      const value=styles?.[p]?.[key];
      if(value===false)missing=true;
      if(value==null)unavailable=true;
    }
    const status=missing?error:unavailable?review:ok;
    r.formatChecks.push({field,label,status,ref:rules[ref]});
    if(missing)note(r,'journal-style-missing',error,ref,start,end,field+'에 '+label+' 서식이 필요한 부분이 있습니다.','일반체로 명시된 글자를 확인하고 원고에서 '+label+' 서식을 적용하세요.');
    else if(unavailable)note(r,'journal-format',review,ref,start,end,'서식 확인 필요 · '+field,'서식 정보가 전달되지 않아 굵게/이탤릭은 확인할 수 없습니다. 해당 부분을 원자료에서 확인하세요.');
  }
  // Match numeric fields from the right so commas in prose and DOI suffixes stay intact.
  const journalTail=/(\s*[,;]\s*|\s+|(?<=학회지|학술지))(\d+)(?:\s*\((\d+)\))?(\s*[,;]\s*|\s+|(?<=\)))(\d+)(\s*[-–—~]\s*)(\d+)(\s*[.,;]?)$/d;
  function journal(r,start,end,styles,yearStart) {
    journalAuthors(r,yearStart);
    const body=r.original.slice(start,end);
    const numeric=journalTail.exec(body);
    const partial=/(?:,\s*|\s+)\d+(?:\s*\([^)]*\))?(?:,\s*[\w–—~-]+)?\.?\s*$/.exec(body);
    const stop=numeric?.index??partial?.index??body.length;
    const heading=body.slice(0,stop);
    let split=heading.match(/^([\s\S]+[.?!])\s+([^.!?]+)$/);
    const field=(id,ref,group,value,message,advice)=>{
      const [from,to]=numeric.indices[group];
      separator(r,id,ref,start+from,start+to,value,message,advice);
    };
    if(numeric){
      field('journal-comma','journal',1,', ','학술지명 뒤의 쉼표 또는 공백을 확인하세요.','학술지명에 쉼표를 붙이고 권 번호 앞에서 한 칸 띕니다.');
      field('volume-comma','volume',4,', ','권·호 뒤의 쉼표 또는 공백을 확인하세요.','페이지 앞에 쉼표와 한 칸의 공백을 씁니다.');
      if(/[–—]/.test(numeric[6])){
        const [p,q]=numeric.indices[6];
        note(r,'page-dash',review,'volume',start+p,start+q,'페이지 범위의 대시가 예시의 하이픈과 다릅니다.','대시의 폭까지 지정하는지 명확하지 않아 원문을 유지합니다.');
      } else field('page-separator','volume',6,'-','페이지 범위의 하이픈 또는 공백을 확인하세요.','두 페이지 번호 사이에 하이픈을 붙여 씁니다.');
      field('page-stop','volume',8,'.','페이지 범위 뒤의 마침표를 확인하세요.','끝 페이지 번호 뒤에 마침표를 붙입니다.');
      if(r.doiStart!==undefined)
        separator(r,'doi-space','doi',end,r.doiStart,' ','페이지와 DOI 사이의 공백을 확인하세요.','페이지의 마침표 다음에 한 칸 띄우고 DOI를 씁니다.');
    }
    if(!numeric?.[3])
      note(r,'volume-incomplete',review,'volume',start+stop,end,'권·호·페이지를 모두 식별하기 어렵습니다.','원자료에서 권, 호와 시작·끝 페이지를 확인하세요. 없는 숫자는 추가하지 않습니다.');

    // A pasted style transition can identify a journal name even without its delimiter.
    // Without markup, only correct an explicit delimiter before a recognizable journal field.
    if(numeric){
      const candidate=/^(.+?)(\s*[,;]\s*|\.\s*|\s+)((?:[가-힣]+(?:학회지|학술지)|(?:Journal of |The Journal of )[^.,;!?]+))$/d.exec(heading);
      if(candidate && !/[.!?]\s+\S/.test(candidate[1]) && !/[.!?]$/.test(candidate[1])){
        const [from,to]=candidate.indices[2];
        const punct=/[.,;]/.test(candidate[2]);
        const key=/^[가-힣]/.test(candidate[3])?'bold':'italic';
        const styled=styles?.[start+from-1]?.[key]!==true &&
          [...candidate[3]].every((c,i)=>/\s/.test(c)||styles?.[start+to+i]?.[key]===true);
        if(punct || styled){
          separator(r,'title-stop','titleSeparator',start+from,start+to,'. ','논문 제목 뒤의 마침표와 공백을 확인하세요.','제목을 마침표로 끝내고 학술지명 앞에서 한 칸 띕니다.');
          split=[heading,candidate[1],candidate[3]];
        }
      }
    }
    if(split && /[.?!]$/.test(split[1])){
      const from=start+split[1].length, to=start+heading.lastIndexOf(split[2]);
      separator(r,'title-space','titleSeparator',from,to,' ','제목과 학술지명 사이의 공백을 확인하세요.','제목 뒤에서 한 칸 띄우고 학술지명을 씁니다.');
    }
    if(!split)note(r,'title-boundary',review,'titleSeparator',start,start+stop,'제목 뒤의 마침표와 학술지명이 시작되는 위치를 확인하세요.','제목과 학술지의 경계를 원자료에서 확인하세요. 경계가 불명확해 마침표를 자동으로 삽입하지 않습니다.');
    if(split && /^[A-Za-z]/.test(split[1])) {
      const title=split[1], suspicious=/^[a-z]|:\s*[a-z]|(?<=\s)[A-Z][a-z]+/.exec(title);
      if(suspicious) note(r,'title-case',review,'title',start,start+title.length,'영문 제목의 대소문자를 확인하세요.','제목·하위제목의 첫 글자와 고유명사를 원자료와 대조하세요.');
    }
    r.formatChecks=[];
    const journalName=split?.[2].trim();
    const key=/[가-힣]/.test(journalName||'')?'bold':/^[\p{Script=Latin}]/u.test(journalName||'')?'italic':null;
    if(!journalName || !key || !numeric){
      note(r,'journal-format',review,'journal',start,start+stop,'서식 확인 필요','학술지명·권의 범위와 표기 언어를 원자료에서 확인하세요.');
      return;
    }
    const nameStart=start+heading.lastIndexOf(journalName);
    const volStart=start+numeric.index+numeric[1].length;
    journalStyle(r,styles,'학술지명',nameStart,nameStart+journalName.length,key,'journal');
    journalStyle(r,styles,'권 번호',volStart,volStart+numeric[2].length,key,'volume');
    if(numeric[3]){
      const issueStart=start+numeric.indices[3][0], issueEnd=start+numeric.indices[3][1];
      if(styles?.slice(issueStart,issueEnd).some(s=>s?.bold===true||s?.italic===true)){
        note(r,'issue-emphasis',error,'volume',issueStart,issueEnd,'호 번호에 강조 서식이 있습니다.','원고에서 호 번호의 굵게·이탤릭 서식을 해제하세요.');
      }
    }
  }
  function guess(body,date) {
    if(/학위논문|dissertation|master['’]s thesis/i.test(body)) return 'thesis';
    if(journalTail.exec(body)?.[3] || /,\s*\d+\s*\(\d+\)\s*,\s*\d+/.test(body) ||
       /[.!?]\s+[^,.]+,\s*\d+,\s*\d+\s*[-–—]\s*\d+\.?\s*$/.test(body)) return 'journal';
    if(/세미나|심포지엄|학술대회|poster session|presented at|symposium|proceedings/i.test(body)) return 'conference';
    if(date?.month && /(?:\d+일|[a-z]+\s+\d+)/i.test(date.month)) return 'news';
    if(/,\s*\d+\s*\(\d+\)|(?:학회지|저널|journal|review).*,\s*\d/i.test(body)) return 'journal';
    if(/보고서|연구소\.?$|\breport\b|\bcommittee\.?$/i.test(body)) return 'report';
    if(/(?:대학)?출판[사부]|press\.?$|publishers?\.?$|\(편\)|\(Eds?\.?\)/i.test(body)) return 'book';
    return 'auto';
  }
  const extraTypes={};
  function reference(original, selected='auto',styles) {
    const r=record(original), d=datePart(r);
    const end=doiPart(r), start=d?.body??0, body=original.slice(start,end);
    r.type=selected==='auto'?guess(body,d):selected;
    if(r.type==='journal' && d) journal(r,start,end,styles,d.yearStart);
    else if(extraTypes[r.type] && d) extraTypes[r.type](r,start,end,d);
    else if(r.type==='auto') note(r,'type-unknown',review,'type',0,original.length,'문헌 유형을 확정하기 어렵습니다.','이 항목의 문헌 유형을 선택해 다시 검사하세요.');
    return finish(r);
  }
  // Additional checks are registered below, independently of the interface.
  return {name:'한국체육학회',types,rules,ok,error,review,reference,extraTypes,record,note,finish,sourcePrompt};
})();
if(typeof module!=='undefined') module.exports=Kahperd;

Kahperd.sortReferences = function sortReferences(records) {
  const items=records.map((r,index)=>{
    const author=r.author.trim(), ko=/^[가-힣]/.test(author), latin=/^\p{Script=Latin}/u.test(author);
    return {index,group:ko?0:1,known:ko||latin,key:author.split(/[,，]/)[0].trim()};
  });
  const unknown=items.filter(i=>!i.known).map(i=>i.index);
  const sorted=items.filter(i=>i.known).sort((a,b)=>a.group-b.group ||
    a.key.localeCompare(b.key,a.group===0?'ko':'en',{sensitivity:'base'}) || a.index-b.index);
  // Leave unclassified entries in place and preserve ties on the first author's key.
  let j=0;
  const order=items.map(i=>i.known?sorted[j++].index:i.index);
  return {order,unknown,changed:order.some((index,slot)=>index!==slot),ref:Kahperd.rules.order};
};

Object.assign(Kahperd.extraTypes, (() => {
  const {note,review,sourcePrompt}=Kahperd;
  function check(r,start,end,id,message,advice=sourcePrompt) {
    note(r,id,review,r.type,start,end,message,advice);
  }
  function cityPublisher(text) {
    // Require the city to follow the title boundary; a subtitle colon is insufficient.
    return /[.?!]\s+[^:./\n]+:\s*[^:/\n]+\S\.?\s*$/.test(text);
  }
  function online(text) { return /https?:\/\/[^\s/]+/i.test(text); }
  function book(r,start,end) {
    const body=r.original.slice(start,end);
    if(!cityPublisher(body)) check(r,start,end,'publisher','책 제목 뒤 출판도시와 출판사를 확인하세요.','원자료에 따라 출판도시: 출판사 형태로 기재하세요.');
    if(/\(Eds?\)\.?$/i.test(r.author)) check(r,0,start,'editor','편집자 약어의 마침표를 확인하세요.','제시된 규정과 예시의 (Eds.) 및 (Eds). 표기가 달라 원문을 유지했습니다.');
    const titleEnd=body.lastIndexOf('. ');
    check(r,start,titleEnd>0?start+titleEnd:end,'book-format','서식 확인 필요','국문 책 제목은 굵게, 영문은 이탤릭으로 표시하세요. 재판 이상이면 제목 뒤 판수도 원자료와 대조하세요.');
  }
  function thesis(r,start,end) {
    const b=r.original.slice(start,end);
    const degree=/석사\s*학위\s*논문|박사\s*학위\s*논문|master['’]s thesis|doctoral dissertation|doctoral thesis/i.exec(b);
    if(!degree && !online(b) && cityPublisher(b)){
      check(r,start,end,'published-thesis','출간 학위논문의 출판 정보를 확인하세요.','출간 학위논문 예시는 제목 뒤에 출판도시와 출판사를 적습니다. 출간 여부를 원자료와 대조하세요.');
      return;
    }
    if(!degree) check(r,start,end,'degree','석·박사 학위논문의 종류를 확인하세요.');
    if(!degree || !b.slice(0,degree.index).replace(/[.(\s]|미간행|unpublished/gi,'')) check(r,start,end,'thesis-title','학위논문 제목을 확인하세요.');
    const after=degree?b.slice(degree.index+degree[0].length):b;
    const institution=/(?:대학(?:교|원)?|university|institute|college|school)/i.exec(after);
    if(!institution) check(r,start,end,'school','학위 수여 대학 또는 대학원을 확인하세요.');
    if(!institution || !/,\s*[^(),.\s][^(),.]*[.)]/.test(after.slice(institution.index).split(/retrieved|https?:/i)[0])) check(r,start,end,'region','학위 수여 기관의 소재지를 확인하세요.');
    if(/retrieved from/i.test(b) && !online(b)) check(r,start,end,'retrieval','온라인 학위논문의 URL을 확인하세요.');
    if(online(b) && !/retrieved from\s+https?:/i.test(b)) check(r,start,end,'thesis-online','온라인 학위논문의 출처 표기를 확인하세요.','제공된 예시에서 URL 앞에 Retrieved from을 사용합니다.');
  }
  function news(r,start,end,d) {
    const b=r.original.slice(start,end);
    if(!/^(?:\d{1,2}월\s*\d{1,2}일|[A-Za-z]+\s+\d{1,2})$/.test(d.month)) check(r,0,start,'news-date','기사 발행 연도·월·일을 확인하세요.');
    const parts=/^(.+?[.?!])\s+(.+)/.exec(b);
    if(!parts || /^(?:https?:|retrieved|pp?\.)/i.test(parts[2])) check(r,start,end,'newspaper','기사 제목과 신문명을 확인하세요.');
    if(!online(b) && !/\bpp?\.\s*[A-Za-z가-힣]*\d+/i.test(b)) check(r,start,end,'news-page','지면 기사의 페이지 또는 온라인 기사의 URL을 확인하세요.');
    if(/retrieved from/i.test(b) && !online(b)) check(r,start,end,'retrieval','온라인 기사의 URL을 확인하세요.');
  }
  function conference(r,start,end) {
    const b=r.original.slice(start,end);
    if(/poster session|presented at|포스터|발표회/i.test(b)) {
      if(!/^.+[.?!]\s+.+/.test(b) || !/(?:presented at|포스터|발표회).+[,，]\s*[^,.\s].+/i.test(b)) check(r,start,end,'presentation','발표 제목, 행사명과 개최지를 확인하세요.');
    } else {
      if(!/pp?\.\s*\d+\s*[-–—]\s*\d+/i.test(b)) check(r,start,end,'proceedings-pages','출간 자료집의 수록 페이지를 확인하세요.');
      if(!cityPublisher(b)) check(r,start,end,'proceedings-publisher','자료집의 출판도시와 발행처를 확인하세요.');
      if(!/(?:세미나|학술대회|심포지엄|proceedings|conference|symposium)/i.test(b)) check(r,start,end,'proceedings-title','행사명과 발표 자료명을 확인하세요.');
    }
  }
  function report(r,start,end) {
    const b=r.original.slice(start,end);
    if(/retrieved from/i.test(b) && !online(b)) check(r,start,end,'retrieval','온라인 보고서의 URL을 확인하세요.');
    if(online(b)) {
      if(!b.split(/retrieved from|https?:\/\//i)[0].trim()) check(r,start,end,'report-title','보고서 제목을 확인하세요.');
    } else if(!cityPublisher(b)) check(r,start,end,'report-publisher','보고서 제목, 출판도시와 발행처 또는 온라인 출처를 확인하세요.');
  }
  return {book,thesis,news,conference,report};
})());

Kahperd.citation = function citation(original,context={}) {
  const {record,note,finish,error,review}=Kahperd, r=record(original);
  const warn=(id,severity,rule,p,q,msg,advice,fix)=>note(r,id,severity,rule,p,q,msg,advice,fix);
  const s=original.trim(), offset=original.indexOf(s);
  const y='(?:\\d{4}[a-z]?|n\\.d\\.)';
  const yList=y+'(?:\\s*,\\s*'+y+')*';
  const enclosed=s.match(/^\(([^()]*)\)[.!?。]?$/);
  const narrative=new RegExp('^([^()]+?)\\s*\\(('+yList+')\\)(?:[가-힣]+)?[.!?。]?$').exec(s);
  if(!enclosed && !narrative) {
    warn('citation-structure',review,'citation',0,original.length,'저자와 연도의 범위를 확인하세요.','본문에서 한 인용 표현만 복사해 한 줄에 입력하세요.');
    return finish(r);
  }
  const groups=enclosed?enclosed[1].split(';'):[narrative[1]+', '+narrative[2]];
  const keys=[],seen=new Map(); let position=offset+(enclosed?1:0);
  for(const raw of groups) {
    const p=position+raw.length-raw.trimStart().length, g=raw.trim();
    position+=raw.length+1;
    const sameFamily=new RegExp('^([\\p{Script=Latin}’\\x27-]+,\\s*(?:\\p{Lu}\\.\\s*)+),?\\s*('+yList+')$','u').exec(g);
    const m=sameFamily||new RegExp('^(.+?),\\s*('+yList+')$').exec(g);
    if(enclosed && new RegExp(y+',\\s*[\\p{L}][^;]*,\\s*'+y+'$','u').test(g)) {
      warn('citation-delimiter',error,'multiple',p,p+g.length,'서로 다른 저자의 문헌 사이에 쉼표가 있습니다.','문헌 사이는 세미콜론으로 구분하세요.');
      continue;
    }
    if(!m || new RegExp(y+'\\s*[,，]\\s*[^\\d\\s]').test(m[1])) {
      warn('citation-delimiter',review,'multiple',p,enclosed?p+g.length:original.length,'저자·연도 또는 문헌 사이의 구분을 확인하세요.','괄호 안에서 저자와 연도는 쉼표, 서로 다른 문헌은 세미콜론으로 구분하세요.');
      continue;
    }
    const a=m[1].trim(), years=m[2].split(/\s*,\s*/), end=p+a.length;
    if(!a || /\d{4}/.test(a)) {warn('citation-author',review,'citation',p,end,'저자 표기의 범위를 확인하세요.','각 문헌의 저자와 연도를 대조하세요.');continue;}
    const yearPos=enclosed?p+g.lastIndexOf(m[2]):offset+s.lastIndexOf(m[2]);
    if(years.every(v=>/^\d{4}[a-z]?$/.test(v)) && years.some((v,i)=>i && v<years[i-1])) {
      warn('year-order',error,'multiple',yearPos,yearPos+m[2].length,'동일 저자의 연도가 시간순으로 배열되지 않았습니다.','기재된 연도를 오름차순으로 정렬하세요.',[...years].sort().join(', '));
    }
    if(new Set(years.map(v=>v.slice(0,4))).size<years.length &&
      (new Set(years).size<years.length || years.some(v=>v.length===4 && years.filter(w=>w.startsWith(v)).length>1))) {
      warn('year-suffix',review,'multiple',yearPos,yearPos+m[2].length,'동일 연도 문헌의 구분 문자를 확인하세요.','서로 다른 문헌인지 확인하고 참고문헌과 같은 a, b, c를 사용하세요.');
    }
    if(seen.has(a)) warn('author-repeat',error,'multiple',p,end,'동일 저자명이 반복되었습니다.','저자명 뒤에 여러 연도를 쉼표로 연결하세요.');
    seen.set(a,true);
    const ko=/^[가-힣]/.test(a), foreign=/^\p{Script=Latin}/u.test(a);
    if(!ko && !foreign) {warn('script',review,'citation',p,end,'저자명 표기 언어를 확인하세요.','원문과 대조하세요.');continue;}
    const shortened=ko?/\s등$/.test(a):/\set al\.$/i.test(a);
    const names=sameFamily?[a]:a.replace(/\s등$|\set al\.$/i,'').split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);
    const count=groups.length===1?Number(context.count)||0:0;
    if(!shortened && foreign && names.length>=2 && !/&\s*[^,&]+$/.test(a)) {
      warn('citation-amp',error,'count',p,end,'영문 복수저자 표기의 마지막 연결 기호를 확인하세요.','마지막 저자 앞에 &를 사용하세요.');
    }
    if(shortened && !count) warn('citation-count',review,'count',p,end,'축약 표기만으로 실제 저자 수를 알 수 없습니다.','원자료의 저자 수와 첫 인용·반복 인용 여부를 지정하세요.');
    if(!shortened && names.length>=6 || count>=6 && !shortened) warn('six-authors',error,'count',p,end,'6인 이상 문헌은 첫 인용부터 축약합니다.','첫 저자 뒤에 국문은 등, 영문은 et al.을 사용하세요.');
    if(count && !shortened && names.length!==count) warn('count-match',review,'count',p,end,'입력한 저자 수와 표시된 이름 수가 다릅니다.','원자료에서 저자 목록을 확인하세요.');
    if(shortened && count>0 && count<3) warn('short-one-two',error,'count',p,end,'1·2인 문헌에 축약 표기가 있습니다.','원자료에서 저자명을 확인해 모두 기재하세요.');
    const effective=count||(shortened?0:names.length);
    if(effective>=3 && effective<=5) {
      if(!context.occurrence) warn('citation-context',review,'count',p,end,'첫 인용인지 반복 인용인지 확인하세요.','첫 인용은 전원, 반복 인용은 첫 저자와 등 또는 et al.을 표기하세요.');
      else if((context.occurrence==='first')===shortened) warn('citation-occurrence',error,'count',p,end,'3~5인 문헌의 인용 차례와 표기가 일치하지 않습니다.','첫 인용은 모든 저자를 표시하고 반복 인용은 축약하세요.');
    }
    keys.push({ko,key:names[0],p,end});
  }
  for(const ko of [true,false]) {
    const list=keys.filter(i=>i.ko===ko);
    list.forEach((item,i)=>{if(i && list[i-1].key.localeCompare(item.key,ko?'ko':'en',{sensitivity:'base'})>0)
      warn('citation-order',error,'multiple',item.p,item.end,'동시 인용한 문헌의 저자 순서를 확인하세요.','국문 저자는 가나다순, 외국어 저자는 알파벳순으로 배열하세요.');
    });
  }
  return finish(r);
};

Kahperd.guide = [
  ['학술지 논문',Kahperd.rules.author,'국문 저자명은 모두 적고, 외국인 개인 저자는 성과 이니셜로 적습니다. 여러 외국인 저자의 마지막 이름 앞에는 &를 씁니다. 8인 이상 생략 예시는 앞 6명, 생략표, 마지막 저자 순입니다.'],
  ['학술지명과 권·호·페이지','제11조 제1항 · 학술지명과 수록 정보','학술지명은 축약하지 않고 원제를 씁니다. 영문 학술지명의 명사·대명사는 첫 글자를 대문자로 씁니다. 국문 학술지명과 권 번호는 굵게, 영문 학술지명과 권 번호는 이탤릭체로 쓰며 호 번호는 정체로 씁니다.','학술지명의 품사와 고유명사는 원자료와 대조하세요. 서식 정보가 전달된 부분만 굵게·이탤릭 여부를 판정합니다.'],
  ['영문 논문 제목',Kahperd.rules.title,'제목 첫머리와 콜론 뒤 하위제목의 첫 글자는 대문자입니다. 나머지는 원칙적으로 소문자이며 고유명사는 원자료와 대조하세요.'],
  ['DOI',Kahperd.rules.doi,'DOI가 있는 학술지 예시에서는 페이지 뒤에 마침표와 공백을 쓰고 doi: 다음에 한 칸 띄워 식별자를 적습니다.','식별자를 조회하거나 새로 만들지 않습니다. 끝의 기호가 식별자의 일부일 수 있으면 확인 필요로 표시합니다.'],
  ['전체 정렬',Kahperd.rules.order,'한국어 표기 문헌을 가나다순으로 먼저 배치하고, 이어서 외국어 표기 문헌을 알파벳순으로 배치합니다.','첫 저자 정렬 키가 같으면 입력 순서를 유지합니다. 정렬안은 사용자가 선택할 때 적용합니다.','프로그램 처리 방식'],
  ['단행본','제11조 제2항 · 단행본','국문 책 제목은 굵게 씁니다. 영문 책 제목은 이탤릭체로 쓰며 명사·대명사만 대문자로 표기합니다. 재판 이상은 제목 뒤에 판수를 적습니다. 편집자는 (편), (Ed.) 또는 (Eds.)로 쓰고 출판도시와 출판사 사이는 콜론으로 구분합니다.','영문 편저 예시에는 (Eds).가 나옵니다. 설명과 마침표 위치가 달라 확인 필요로 표시하고 원문을 유지합니다. 책 제목의 대소문자도 일괄 변경하지 않습니다.'],
  ['석·박사 학위논문','제11조 제3항 · 학위논문','출간 학위논문 예시는 제목 뒤에 출판도시와 출판사를 적습니다. 미간행 예시는 미간행 여부와 학위 유형, 대학·대학원과 지역을 표시합니다. 온라인 예시는 제목 뒤 괄호에 학위 유형·학교·지역을 적고 Retrieved from 뒤에 URL을 씁니다.','출판 정보만으로 단행본과 출간 학위논문을 구별하기 어려울 때는 원자료를 확인하고 문헌 유형을 선택하세요.'],
  ['신문기사',Kahperd.rules.news,'저자와 발행 연·월·일, 기사 제목, 신문명, 지면 페이지 또는 온라인 출처를 확인합니다.'],
  ['학술대회·심포지엄 자료',Kahperd.rules.conference,'출간 자료집은 자료명, 수록 페이지, 출판 정보를 확인합니다. 포스터 발표는 발표 제목, 행사와 개최지 표기를 확인합니다.'],
  ['보고서',Kahperd.rules.report,'지면 보고서는 제목, 출판도시와 발행처를 확인합니다. 온라인 보고서에는 URL 또는 Retrieved from이 올 수 있습니다.'],
  ['본문 저자 표기',Kahperd.rules.count,'1·2인 저자는 모두 표시합니다. 3~5인은 첫 인용에서 모두 표시하고 반복 인용에서 첫 저자와 등 또는 et al.을 사용합니다. 6인 이상은 처음부터 축약합니다.'],
  ['동일 연도에 성이 같은 저자','제10조 제8항 · 동일 성 저자의 구별','같은 해에 같은 성을 가진 서로 다른 외국인 저자를 인용하면 성과 이름의 이니셜을 함께 씁니다. 규정 예시의 Volicer, K. A.와 Volicer, M. Y.처럼 구분합니다. 한국인은 이름 전부를 씁니다.','원자료 없이 동명이인 여부와 이니셜을 추정하지 않습니다.'],
  ['여러 문헌의 본문 인용','제10조 제9~11항 · 복합·동시 인용','같은 저자의 문헌은 저자명을 한 번 쓰고 연도를 오름차순으로 나열합니다. 같은 해의 서로 다른 문헌은 연도 뒤에 a, b, c를 붙입니다. 다른 저자의 문헌을 한 괄호에 인용할 때는 세미콜론으로 문헌을 구분하고 한국인은 가나다순, 외국인은 알파벳순으로 배열합니다. 제공된 혼합 예시에서는 한국인 저자 문헌을 먼저 묶고 외국인 저자 문헌을 이어서 씁니다.'],
  ['각주와 미주','제10조 제3항 · 각주와 미주','필요에 따라 각주와 미주를 사용할 수 있습니다. 각주는 본문 중에, 미주는 참고문헌 뒤에 게재합니다.','참고문헌과 본문 인용 입력만으로 원고 전체의 주석 위치를 검사할 수 없습니다.','안내만 제공'],
  ['허용 축약형','제11조 · 허용 축약형','Chap. · p. · pp. · ed. · Vol. · Rev. ed. · vols. · 2nd ed. · No. · Ed. · Eds. · Pt. · Trans. · Suppl. · n.d.']
];
Kahperd.examples = {
 journal:['홍길동(2016). 학생체력검사의 평가방법 개선 방안. 한국체육학회지, 32(2), 512-530.','Klimoske, R., & Palmer, S. (1993). A study of teams. Consulting Psychology Journal: Practice and Research, 45(2), 10-36.'],
 book:['홍길동(2016). 체육 연구방법. 서울: 체육출판사.','Kim, C. S. (2000). Anthropological studies of Korea by westerners. Seoul: Yonsei University Press.'],
 thesis:['홍길남(1994). 준거지향 검사의 기준설정방법 비교. 미간행 박사학위논문. 서울대학교 대학원, 서울.','Kim, J. S. (2017). Effect of the knee extensor eccentric strength on mechanical efficiency during repetitive drop jumping. (Unpublished doctoral dissertation). Yonsei University, Seoul, Korea.'],
 news:['홍길동(1998, 7월 20일). 운동선수의 상해 실태. 동해일보, pp. A15, A16.','Rapaport, M. (2013, March 8). Loan-loss rule spat drags on. The Wall Street Journal, p. C2.'],
 conference:['김숙경(2005). 제24회 국민체육 진흥세미나, 국민체육진흥을 위한 전문체육인의 역할(pp. 29-56). 서울: 한국체육학회.','Durwith, N. (2001, June). Indexing surveys: Software that works. Poster session presented at the annual meeting of the Political Science Society, Washington, DC.'],
 report:['김천식(1993). 국민건강관리 프로그램 개발. 서울: 한국문화대학교 체육과학연구소.','Korean Sport & Olympic Committee (2010). A Study on the Career and Vocational Consciousness of School Players. Seoul: Korean Sport & Olympic Committee.'],
 citation:['(홍길동, 2016, 2018)','(Gide & Rist, 1994)']
};

