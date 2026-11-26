'use strict';
const ValidationSuite = (() => {
  const k=typeof require==='function'?require('./rules/kahperd.js'):Kahperd;
  const ko='홍길동(2016). 학생체력검사의 평가방법 개선 방안. 한국체육학회지, 32(2), 512-530.';
  const en='Klimoske, R., & Palmer, S. (1993). A study of teams. Consulting Psychology Journal: Practice and Research, 45(2), 10-36.';
  const cases=[];
  function ref(name,input,type,status,expected=input,ids=[]) {
    cases.push({name,input,expected:status+' · '+expected, run() {
      const r=k.reference(input,type);
      return {pass:r.status===status && r.suggested===expected && ids.every(id=>r.issues.some(i=>i.id===id)),actual:r.status+' · '+r.suggested};
    }});
  }
  ref('국문 학술지 · 형식 일치, 원본 서식 확인',ko,'auto',k.review,ko,['journal-format']);
  ref('영문 학술지 · 형식 일치, 원본 서식 확인',en,'auto',k.review,en,['journal-format']);
  ref('연도 양쪽 괄호 누락',ko.replace('(2016)','2016'),'journal',k.error,ko,['year-brackets']);
  ref('연도 닫는 괄호 누락',ko.replace('(2016)','(2016'),'journal',k.error,ko);
  ref('마지막 영문 저자 앞 & 누락',en.replace('& ',''),'journal',k.error,en,['ampersand']);
  const missing=ko.replace('32(2), 512-530.','32(2).');
  ref('페이지 누락 · 숫자 보존',missing,'journal',k.review,missing,['volume-incomplete']);
  const volume=ko.replace('32(2), ','');
  ref('권·호 누락 · 페이지 보존',volume,'journal',k.review,volume,['volume-incomplete']);
  const doi=ko+' doi: 10.23949/kjpe.2017.05.56.3.2';
  ref('DOI 예시 표기',doi,'auto',k.review);
  ref('DOI URL 접두부만 수정',doi.replace('doi: ','https://doi.org/'),'auto',k.error,doi,['doi-prefix']);
  ref('DOI 없음 · 추가하지 않음',ko,'journal',k.review);
  ref('권(호) 뒤 쉼표 누락',ko.replace('(2),','(2)'),'journal',k.error,ko);
  ref('페이지 범위 구분 기호',ko.replace('512-530','512~530'),'journal',k.error,ko);
  ref('연도 뒤 마침표 누락',ko.replace('(2016).','(2016)'),'journal',k.error,ko);
  const eight=en.replace('Klimoske, R., & Palmer, S.','Snyder, C. R., Harris, C., Anderson, J. R., Holleran, S. A., Irving, L. M., Sigmon, S. T., ... Harney, P.');
  ref('8인 이상 생략 예시 · 원저자 수 확인',eight,'auto',k.review,eight,['eight-authors']);
  function run(){return cases.map(c=>({...c,...c.run()}));}
  return {k,ko,en,ref,cases,run};
})();
if(typeof module!=='undefined') module.exports=ValidationSuite;

{
  const {k,ko,en,cases}=ValidationSuite;
  const list=[en.replace('Klimoske','Smith'),ko,en,ko.replace('홍길동','김길동')];
  cases.push({name:'국문 우선 · 가나다순 및 영문 알파벳순',input:list.join('\n'),expected:'4 → 2 → 3 → 1',run(){
    const r=k.sortReferences(list.map(s=>k.reference(s))), actual=r.order.map(i=>i+1).join(' → ');
    return {pass:r.changed && actual===this.expected,actual};
  }});
}

{
  const {ref,k}=ValidationSuite;
  ref('단행본 · 출판도시와 출판사','Kim, C. S. (2000). Anthropological studies of Korea by westerners. Seoul: Yonsei University Press.','auto',k.review);
  ref('국문 미간행 학위논문','홍길남(1994). 준거지향 검사의 기준설정방법 비교. 미간행 박사학위논문. 서울대학교 대학원, 서울.','auto',k.ok);
  ref('영문 미간행 학위논문','Kim, J. S. (2017). Effect of strength. (Unpublished doctoral dissertation). Yonsei University, Seoul, Korea.','auto',k.ok);
  ref('온라인 학위논문','Lee, A. (2010). Study of sport (Master’s thesis, Yonsei University, Seoul). Retrieved from https://example.org/thesis','auto',k.ok);
  ref('지면 신문기사','홍길동(1998, 7월 20일). 운동선수의 상해 실태. 동해일보, pp. A15, A16.','auto',k.ok);
  ref('온라인 신문기사','Rapaport, M. (2013, March 8). Loan-loss rule spat drags on. The Wall Street Journal. Retrieved from https://example.org/news','auto',k.ok);
  ref('출간된 학술대회 자료','김숙경(2005). 제24회 국민체육 진흥세미나, 국민체육진흥을 위한 전문체육인의 역할(pp. 29-56). 서울: 한국체육학회.','auto',k.ok);
  ref('학술대회 포스터','Durwith, N. (2001, June). Indexing surveys: Software that works. Poster session presented at the annual meeting of the Political Science Society, Washington, DC.','auto',k.ok);
  ref('국문 지면 보고서','김천식(1993). 국민건강관리 프로그램 개발. 서울: 한국문화대학교 체육과학연구소.','auto',k.ok);
  ref('단체저자 영문 보고서','Korean Sport & Olympic Committee (2010). A Study on the Career and Vocational Consciousness of School Players. Seoul: Korean Sport & Olympic Committee.','auto',k.ok);
  ref('온라인 보고서 · n.d. 허용','연구소(n.d.). 체육 보고서. Retrieved from https://example.org/report','report',k.ok);
  const unclear='홍길동(2016). 스포츠 연구. 서울: 체육학회.';
  ref('단행본·보고서 구분 불확실',unclear,'auto',k.review,unclear,['type-unknown']);
}

{
  const {k,cases}=ValidationSuite;
  function cite(name,input,context,status,expected=input) {
    cases.push({name,input,expected:status+' · '+expected,run(){
      const r=k.citation(input,context);
      return {pass:r.status===status && r.suggested===expected,actual:r.status+' · '+r.suggested};
    }});
  }
  cite('본문 · 1인 서술형','홍길동(2019)은',{},k.ok);
  cite('본문 · 2인 괄호형','(Gide & Rist, 1994)',{},k.ok);
  cite('본문 · 3인 첫 인용','Williams, Johnes & Lee(2016)',{count:3,occurrence:'first'},k.ok);
  cite('본문 · 3인 반복 인용','(홍길동 등, 2016)',{count:3,occurrence:'repeat'},k.ok);
  cite('본문 · 첫 인용의 잘못된 축약','Williams et al.(2016)',{count:4,occurrence:'first'},k.error);
  cite('본문 · 저자 수 미상','Williams et al.(2016)',{},k.review);
  cite('본문 · 6인 이상 첫 인용','Wolchik et al.(2000)',{count:6,occurrence:'first'},k.ok);
  cite('본문 · 동일 저자의 연대순','(Price, 2015, 2004)',{},k.error,'(Price, 2004, 2015)');
  cite('본문 · 동일 연도 다른 문헌','(Price, 2016a, 2016b)',{},k.ok);
  cite('본문 · 동일 연도 구분 불확실','(Price, 2016, 2016)',{},k.review);
  cite('본문 · 동시 인용 순서','(최경수, 2001; 김성태, 1978)',{},k.error);
  cite('본문 · 문헌 간 기호 확인','(김성태, 1978, 남해구, 1997)',{},k.error);
}

{
  const {ref,k,ko}=ValidationSuite;
  const n='Park J. (2019). Research on exercise. Research Journal, 12(1), 1-10.';
  ref('영문 단일 저자 성 뒤 쉼표',n,'journal',k.error,n.replace('Park J.','Park, J.'),['surname-comma']);
  const d='김길동(2019). 연구 보고서. Retrieved from https://example.org/search?q=10.1234/sample';
  ref('온라인 출처 URL 안의 숫자 보존',d,'report',k.ok);
  const titleYear='연구 문헌. 조사 대상(2019)과 방법. 학회지, 12(1), 1-10.';
  ref('제목 속 연도를 출판연도로 수정하지 않음',titleYear,'journal',k.review,titleYear,['year-unknown']);
  const editor='Gibbs, T. T., & Huang, L. N. (Eds). (1991). Children of color: Psychological interventions with minority youth. San Francisco, CA: Jossey-Bass.';
  ref('편집자 규정·예시 충돌 보존',editor,'book',k.review,editor,['editor']);
  const multiple=ko.replace('(2016).','2016,').replace('32(2),','32(2)').replace('512-530','512~530');
  ref('한 항목의 여러 교정 위치 유지',multiple,'auto',k.error,ko);
}

{
  const {ref,k,en}=ValidationSuite;
  const uncertain=en.replace('& Palmer','and Palmer');
  ref('and를 저자명으로 오인하여 수정하지 않음',uncertain,'journal',k.review,uncertain,['author-conjunction']);
}

{
  const {cases,k}=ValidationSuite;
  const parser=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  const koLines=['강길환, 진종백(2006). 기업의 소유구조와 기업가치의 관련성에 관한 실증연구.','상업교육연구, 12, 257-274.'];
  const enLines=['Smith, J., & Lee, K. (2020). Participation in sport.','Journal of Sport, 15(2), 10-24.','doi: 10.1234/example'];
  const ko=koLines.join(' '), en=enLines.join(' ');
  function describe(items){return items.map((v,i)=>(i+1)+'. '+v).join('\n');}
  function grouping(name,input,expected,mode='ref'){
    cases.push({name,input,expected:expected.length+'개\n'+describe(expected),run(){
      const groups=parser.entries(input,mode), actual=groups.map(g=>g.text);
      const lines=input.split(/\r\n|[\n\r\u2028\u2029]/u);
      const intact=mode!=='ref'||groups.every(g=>g.raw===lines.slice(g.firstLine-1,g.lastLine).join('\n'));
      return {pass:intact && JSON.stringify(actual)===JSON.stringify(expected),actual:actual.length+'개\n'+describe(actual)};
    }});
  }
  grouping('붙여넣기 · 국문 문헌 2줄',koLines.join('\n'),[ko]);
  grouping('붙여넣기 · 영문 문헌과 DOI 3줄',enLines.join('\r\n'),[en]);
  grouping('붙여넣기 · 여러 문헌이 각각 여러 줄',[...koLines,...enLines,...koLines].join('\n'),[ko,en,ko]);
  const singles=['홍길동(2020). 가.','홍길동, 김철수(2020). 나.','Kim, J. S. (2020). C.','Smith, J., & Lee, K. (2020). D.'];
  grouping('붙여넣기 · 한 줄에 한 문헌',singles.join('\n'),singles);
  grouping('붙여넣기 · 빈 줄 뒤에 저자·연도가 없어도 새 항목',koLines.join('\n')+'\n \t\n출처 불명\n자료 A',[ko,'출처 불명 자료 A']);
  grouping('붙여넣기 · 앞뒤 빈 줄과 들여쓰기','\n'+koLines[0]+'  \n\t'+koLines[1]+'\n\n',[ko]);
  grouping('붙여넣기 · 저자 목록 중간 줄바꿈',ko+'\nSmith, J.,\n& Lee, K. (2020). Participation in sport.\n'+enLines.slice(1).join('\n'),[ko,en]);
  grouping('붙여넣기 · 저자와 연도 사이 줄바꿈',ko+'\nKim, J. S.\n(2020). C.',[ko,singles[2]]);
  grouping('붙여넣기 · 신문기사의 날짜와 단체저자 n.d.',ko+'\n연구위원회(n.d.). 보고서.\nPark, S. (2020, May 8). News.',[ko,'연구위원회(n.d.). 보고서.','Park, S. (2020, May 8). News.']);
  grouping('붙여넣기 · 연도 괄호가 누락된 문헌도 분리',ko+'\n홍길동2016. 체육연구.',[ko,'홍길동2016. 체육연구.']);
  grouping('붙여넣기 · 제목에 들어간 연도와 권(호)',enLines[0]+'\nStudy results (2020) and discussion.\nJournal of Sport, 15(2020), 10-24.',[enLines[0]+' Study results (2020) and discussion. Journal of Sport, 15(2020), 10-24.']);
  grouping('붙여넣기 · 본문 인용은 줄 단위 유지','홍길동(2020)은\n(Lee, 2017)',['홍길동(2020)은','(Lee, 2017)'],'cite');
  grouping('붙여넣기 · 빈 입력',' \n\t\n',[]);
  function checkCard(name,input,expectedType,expectedMessage,expectedText){
    cases.push({name,input,expected:[expectedType,expectedMessage||'수정 제안',expectedText].join(' · '),run(){
      const groups=parser.entries(input,'ref'),r=k.reference(groups[0].text);
      const message=parser.suggestionMessage(r,'ref');
      return {pass:groups.length===1 && r.type===expectedType && r.suggested===expectedText && message===expectedMessage,actual:[r.type,message||'수정 제안',r.suggested].join(' · ')};
    }});
  }
  checkCard('결과 · 사용자 예문을 학술지 1건으로 검사',koLines.join('\n'),'journal','자동으로 수정할 항목이 없습니다. 위의 확인 사항을 검토해 주세요.',ko);
  checkCard('결과 · 유형 미확정 및 수정 없음','홍길동(2020). 연구 설계.','auto','문헌 유형을 먼저 확인해 주세요.','홍길동(2020). 연구 설계.');
  checkCard('결과 · 유형 미확정이어도 확실한 교정은 표시','홍길동2020. 연구 설계.','auto','','홍길동(2020). 연구 설계.');
  checkCard('결과 · 결합한 영문 문헌의 수정안',enLines.join('\n').replace('& ',''),'journal','',en);
}

{
  const {cases,k}=ValidationSuite;
  const rich=typeof require==='function'?require('./rich-input.js'):RichInput;
  const parser=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  // Browser runs use the real HTML clipboard path. Node runs exercise the same
  // traversal, alignment, grouping and rule checks with equivalent DOM nodes.
  function node(tag,children,style={},attrs={}){
    if(typeof document!=='undefined'){
      const n=document.createElement(tag);Object.assign(n.style,style);
      for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);
      // Test cases reuse inline examples. Appending a live DOM node would move
      // it out of the other case's HTML before that case reaches the clipboard.
      n.append(...children.map(child=>typeof child==='string'?child:child.cloneNode(true)));
      return n;
    }
    return {nodeType:1,tagName:tag.toUpperCase(),style,hasAttribute:key=>key in attrs,
      childNodes:children.map(x=>typeof x==='string'?{nodeType:3,nodeValue:x}:x)};
  }
  const koPrefix='강길환, 진종백(2006). 기업의 소유구조와 기업가치의 관련성에 관한 실증연구.';
  const enPrefix='Kim, J. S. (2020). Team sport.';
  const koName='상업교육연구',enName='Journal of Sport';
  const ko=koPrefix+' '+koName+', 12, 257-274.';
  const en=enPrefix+' '+enName+', 45(2), 10-36.';
  const inline=(tag,text,style)=>node(tag,[text],style);
  function formatted(name,plain,children,expected,extra=()=>true){
    cases.push({name,input:plain,expected,run(){
      const root=node('div',children);
      let snapshot;
      if(typeof document!=='undefined'){
        snapshot=rich.clipboard({getData:type=>type==='text/plain'?plain:root.innerHTML});
      }else snapshot=rich.align(plain,rich.read(root));
      const groups=parser.entries(snapshot.text,'ref',snapshot.styles);
      const records=groups.map(g=>k.reference(g.text,'journal',g.styles));
      const actual=records.map(r=>r.formatChecks.map(f=>f.field+' '+f.status).join(' / ')).join('\n');
      return {actual,pass:actual===expected && extra(records,groups)};
    }});
  }
  const both='학술지명 정상 / 권 번호 정상',none='학술지명 확인 필요 / 권 번호 확인 필요';
  const koRich=[inline('strong',koName),', ',inline('b','12'),', 257-274.'];
  const enRich=[inline('em',enName),', ',inline('i','45'),'(2), 10-36.'];
  formatted('서식 · 국문 strong·b와 호 없는 학술지',ko,[koPrefix+' ',...koRich],both);
  formatted('서식 · 영문 em·i와 일반 호',en,[enPrefix+' ',...enRich],both);
  formatted('서식 · Word 인라인 CSS와 명시적 일반체',ko,[koPrefix+' ',inline('span',koName,{fontWeight:'700'}),', ',inline('span','12',{fontWeight:'400'}),', 257-274.'],'학술지명 정상 / 권 번호 수정 필요');
  formatted('서식 · 영문 학술지명에 명시적인 일반체',en,[enPrefix+' ',inline('span',enName,{fontStyle:'normal'}),', ',inline('span','45',{fontStyle:'italic'}),'(2), 10-36.'],'학술지명 수정 필요 / 권 번호 정상');
  formatted('서식 · 강조 없는 HTML은 판정 보류',ko,[ko],none);
  formatted('서식 · 일부만 전달된 강조',en,[enPrefix+' ',inline('em','Journal'),' of Sport, ',inline('i','45'),'(2), 10-36.'],'학술지명 확인 필요 / 권 번호 정상');
  formatted('서식 · 클래스 정보만 있는 경우',en,[enPrefix+' ',node('span',[enName],{},{class:'italicText'}),', 45(2), 10-36.'],none);
  formatted('서식 · 자식의 명시적 덮어쓰기',ko,[koPrefix+' ',node('b',[koName,', ',inline('span','12',{fontWeight:'normal'})]),', 257-274.'],'학술지명 정상 / 권 번호 수정 필요');
  formatted('서식 · HTML과 일반 텍스트가 다르면 일반 텍스트 보존',ko,[koPrefix+' ',...koRich,'별도 내용'],none,(_,g)=>g[0].text===ko);
  formatted('서식 · 여러 줄과 두 언어의 위치 보존',koPrefix+'\r\n   '+koName+', 12, 257-274.\r\n\r\n'+en,[node('p',[koPrefix]),node('p',koRich),node('p',[enPrefix+' ',...enRich])],both+'\n'+both,(_,g)=>g[0].text===ko && g[1].text===en);
  formatted('서식 · 호의 이탤릭을 권과 분리',en,[enPrefix+' ',inline('em',enName+', 45(2)'),', 10-36.'],both,rs=>rs[0].issues.some(i=>i.id==='issue-emphasis' && rs[0].original.slice(i.start,i.end)==='2'));
  formatted('서식 · 내용에 없는 이미지와 비표시 요소 제외',ko,[koPrefix+' ',node('style',['.unused{color:blue}']),node('img',[]),...koRich],both);
  formatted('서식 · 같은 학술지명이 제목에도 등장',en.replace('Team sport',enName),[enPrefix.replace('Team sport',enName)+' ',...enRich],both);
  cases.push({name:'서식 · 순수 텍스트 클립보드',input:ko,expected:'서식 정보 없음 · 1개 문헌',run(){
    const snap=rich.clipboard({getData:type=>type==='text/plain'?ko:''});
    const groups=parser.entries(snap.text,'ref',snap.styles);
    const r=k.reference(groups[0].text,'journal',groups[0].styles);
    const pass=groups.length===1 && r.status===k.review && r.issues.some(i=>i.advice.includes('서식 정보가 전달되지 않아'));
    return {pass,actual:pass?this.expected:r.status};
  }});
}

{
  const {cases,ref,k,en}=ValidationSuite;
  const fixed='강호정, 송강영(2008). 프로축구 시민구단의 재무비율 분석. 한국콘텐츠학회지, 8(7), 224-232.';
  const doi=fixed+' doi: 10.1234/example.1';
  const corrected=[
    ['실제 참고문헌 · 국문 저자 뒤 공백','강호정,송강영', '강호정, 송강영','ko-author-comma'],
    ['국문 저자 사이 쉼표 양옆 공백','강호정 ,  송강영','강호정, 송강영','ko-author-comma'],
    ['국문 연도 괄호 위치','송강영 (2008)','송강영(2008)','year-position'],
    ['연도 괄호 안쪽 공백','( 2008 )','(2008)','year-brackets'],
    ['연도 뒤 마침표에 붙은 제목','(2008).프로','(2008). 프로','year-stop'],
    ['제목 뒤 쉼표','분석, 한국콘텐츠','분석. 한국콘텐츠','title-stop'],
    ['제목 뒤 공백 누락','분석.한국콘텐츠','분석. 한국콘텐츠','title-stop'],
    ['학술지명 뒤 쉼표 누락','학회지 8','학회지, 8','journal-comma'],
    ['학술지명과 권 번호가 붙은 경우','학회지8','학회지, 8','journal-comma'],
    ['학술지명 뒤 쉼표 공백 누락','학회지,8','학회지, 8','journal-comma'],
    ['권호 뒤 쉼표 공백 누락','(7),224','(7), 224','volume-comma'],
    ['권호와 페이지가 붙은 경우','(7)224','(7), 224','volume-comma'],
    ['페이지 범위의 공백','224 - 232','224-232','page-separator'],
    ['끝 페이지 뒤 마침표 누락','232','232.','page-stop'],
    ['페이지 뒤 마침표 위치','232 .','232.','page-stop']
  ];
  for(const [name,wrong,right,id] of corrected)ref(name,fixed.replace(right,wrong),'auto',k.error,fixed,[id]);
  for(const [name,wrong,right,id] of [
    ['영문 성 뒤 공백 누락','Klimoske,R.','Klimoske, R.','surname-comma'],
    ['영문 성 뒤 쉼표 누락','Palmer S.','Palmer, S.','surname-comma'],
    ['마지막 & 양옆 공백','R.,&Palmer','R., & Palmer','ampersand'],
    ['영문 연도 괄호 앞 공백','S.(1993)','S. (1993)','year-position']
  ])ref(name,en.replace(right,wrong),'auto',k.error,en,[id]);
  for(const [name,wrong,ids] of [
    ['DOI 앞 공백 누락','232.doi: ',['doi-space']],
    ['DOI 앞 페이지 마침표 누락','232 doi: ',['page-stop']],
    ['DOI 앞 마침표·공백과 접두부 동시 수정','232DOI:', ['page-stop','doi-space','doi-prefix']],
    ['DOI 접두부 주위 공백','232.  doi :  ',['doi-prefix','doi-space']]
  ])ref(name,doi.replace('232. doi: ',wrong),'auto',k.error,doi,ids);
  ref('수정안을 다시 검사하면 구두점 유지',fixed,'auto',k.review,fixed,['journal-format']);
  const boundary=fixed.replace('분석. 한국콘텐츠','분석 한국콘텐츠');
  ref('제목 끝 위치 불명확 · 원문 보존',boundary,'auto',k.review,boundary,['title-boundary']);
  const question=fixed.replace('분석.','분석인가?');
  ref('제목 끝 물음표 보존',question,'auto',k.review,question,['journal-format']);
  const dash=fixed.replace('224-232','224–232');
  ref('페이지 대시 폭 · 원문 보존',dash,'auto',k.review,dash,['page-dash']);
  ref('DOI 식별자 끝 기호 보존',doi+'.','auto',k.review,doi+'.',['doi-ending']);
  const literal='( Volicer, K. A. 2016 ; Volicer, M. Y. 2016)';
  cases.push({name:'제10조 제8항 · 원문 예시의 두 Volicer 구별',input:literal,expected:k.ok,run(){
    const r=k.citation(literal);
    return {pass:r.status===k.ok && r.suggested===literal,actual:r.status+' · '+r.suggested};
  }});
}

