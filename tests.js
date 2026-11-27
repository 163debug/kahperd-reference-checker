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
  ref('페이지 누락 · 숫자 보존',missing,'journal',k.error,missing,['journal-pages']);
  const volume=ko.replace('32(2), ','');
  ref('권·호 누락 · 페이지 보존',volume,'journal',k.error,volume,['journal-volume']);
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
  const {k,cases}=ValidationSuite;
  const input=typeof require==='function'?require('./citation-input.js'):CitationInput;
  function passage(name,source,expected,fromBeginning=false){
    cases.push({name:'본문 자동 추출 · '+name,input:source,expected:JSON.stringify(expected),run(){
      const entries=input.extract(source),contexts=input.history(entries,fromBeginning);
      const actual=entries.map((entry,i)=>{
        const r=k.citation(entry.text,{entry,history:contexts[i]});
        const spans=source.slice(entry.start,entry.end)===entry.text &&
          (i===0 || entries[i-1].end<=entry.start) &&
          r.issues.every(issue=>issue.ref && issue.start>=0 && issue.end>=issue.start && issue.end<=entry.text.length);
        return [entry.text,r.status,r.suggested,spans];
      });
      const target=expected.map(([text,status,suggestion=text])=>[text,status,suggestion,true]);
      return {pass:JSON.stringify(actual)===JSON.stringify(target),actual:JSON.stringify(actual)};
    }});
  }
  const huang='(Huang & Chiu, 2024)',cury='(Cury, Kennelly, & Howes, 2023)',short='Cury et al.(2023)';
  passage('마라톤 연구 문단', '이러한 운영과정은 참가자에게 대회 경험을 제공하는 동시에 교통, 자원과 에너지의 소비, 폐기물 발생 등 환경적 영향을 수반한다(Huang & Chiu, 2024). 스포츠 분야에서도 이러한 환경적 영향을 줄이기 위한 관리와 운영은 환경적 지속가능성을 실현하기 위한 주요 과제로 논의되고 있다(Cury, Kennelly, & Howes, 2023).',[[huang,k.ok],[cury,k.review]]);
  passage('국문 서술형과 조사의 경계','선행연구에서 홍길동(2024)은 효과를 확인했다.',[['홍길동(2024)',k.ok]]);
  passage('서술형 국내외 복수 저자','따라서 김영수, 박영희(2019)와 Gide & Rist(1994)의 결과를 비교했다.',[['김영수, 박영희(2019)',k.ok],['Gide & Rist(1994)',k.ok]]);
  passage('통계·연도·보충 설명 제외','참가자(N=300)의 평균(p=.05)을 비교했다(이하 참가자). 표본은 2024년에 수집했다. 기간(2024), (2019, 2020), (March 2024), (95% CI, 2019–2024).',[]);
  passage('일반 설명에 든 숫자','참가자 수(총 2024명), 설문 조건(자료 수집, 2024년), 결과(2024)를 확인했다.',[]);
  passage('통계와 인용이 섞인 문단','표본(N=300)은 유의했다(p=.05). 선행연구'+huang+'와 일치한다.',[[huang,k.ok]]);
  const simultaneous='(김성태, 1978; 남해구, 1997; Brown & Smith, 1975; Lee, 1954)';
  passage('동시 인용은 표현 한 개','관련 논의'+simultaneous+'가 있다.',[[simultaneous,k.ok]]);
  passage('같은 저자의 복수 연도','연구(Price, 2015, 2004)를 비교했다.',[['(Price, 2015, 2004)',k.error,'(Price, 2004, 2015)']]);
  passage('동일 연도 a b c 표시','홍길동(2016a, 2016b, 2016c)은 이를 검토했다.',[['홍길동(2016a, 2016b, 2016c)',k.ok]]);
  passage('저자 연도 쉼표 누락','효과가 있었다(Huang & Chiu 2024).',[['(Huang & Chiu 2024)',k.error,huang]]);
  passage('영문 저자 기호 및 연도 공백','효과가 있었다(Huang&Chiu,2024).',[['(Huang&Chiu,2024)',k.error,huang]]);
  passage('영문 마지막 저자 앞 연결 기호','효과가 있었다(Huang and Chiu, 2024).',[['(Huang and Chiu, 2024)',k.error,huang]]);
  passage('국문 저자 구두점과 조사','김영수,박영희(2019)의 연구 결과다.',[['김영수,박영희(2019)',k.error,'김영수, 박영희(2019)']]);
  passage('문헌과 문헌 사이의 쉼표','검토했다(Kim, 2010, Lee, 2012).',[['(Kim, 2010, Lee, 2012)',k.error,'(Kim, 2010; Lee, 2012)']]);
  passage('연도의 소속이 모호하면 원문 보존','자료(Price, 2016; 2018).',[['(Price, 2016; 2018)',k.review]]);
  passage('전각 쉼표와 세미콜론','자료(Kim，2010；Lee，2012).',[['(Kim，2010；Lee，2012)',k.error,'(Kim, 2010; Lee, 2012)']]);
  passage('줄바꿈과 여러 문단의 원문 위치','한 문단(Huang\n& Chiu,\n2024).\n\n다음 문단은 홍길동(2019)에 따른다.',[['(Huang\n& Chiu,\n2024)',k.ok],['홍길동(2019)',k.ok]]);
  passage('독립 문단을 가로질러 서술형을 만들지 않음','이름을 열거했다. 홍길동\n\n(2024)',[]);
  passage('여러 번 등장한 완전한 저자 목록',cury+'의 연구다.\n\n후속 연구'+cury+'와 같다.',[[cury,k.review],[cury,k.error,'(Cury et al., 2023)']]);
  passage('완전한 인용 이후 영문 축약형',cury+' 이후 '+short+'에 따른다.',[[cury,k.review],[short,k.ok]]);
  passage('일부 문단 첫 축약형은 인용 이력 미상',short+'의 결과다.',[[short,k.review]]);
  passage('혼합 표기 공동저자의 연결 기호 보존','결과(김영수 & Smith, 2020)를 보았다.',[['(김영수 & Smith, 2020)',k.review]]);
  passage('첫 인용부터 입력한 경우 전체 저자명 판정',cury+' 다음 '+short,[[cury,k.ok],[short,k.ok]],true);
  passage('첫 인용부터 입력해도 앞선 축약형의 소속을 추정하지 않음',short+' 다음 '+cury,[[short,k.review],[cury,k.review]],true);
  passage('첫 인용 범위라도 축약형 저자 수는 미상',short,[[short,k.review]],true);
  passage('제10조 제8항 이니셜 예시 유지','관련 문헌( Volicer, K. A. 2016 ; Volicer, M. Y. 2016)을 보았다.',[['( Volicer, K. A. 2016 ; Volicer, M. Y. 2016)',k.ok]]);
  passage('괄호 안의 중첩된 실제 인용','설명이 있다(결과는 일치했다 '+huang+').',[[huang,k.ok]]);
  passage('불완전한 괄호와 통계 약어는 자동 수정하지 않음','근거(Huang & Chiu, 2024, 통계값(N 2024)과 범주(SD 2023).',[]);

  passage('나중의 자료를 앞선 인용 이력으로 사용하지 않음',short+' 이후 '+cury+'를 검토했다.',[[short,k.review],[cury,k.review]]);
  passage('국문 축약형의 반복 판정','김영수, 박영희, 홍길동(2020)은 이를 보였다. 김영수 등(2020)은 이를 보고했다.',[['김영수, 박영희, 홍길동(2020)',k.review],['김영수 등(2020)',k.ok]]);
  const other='(Cury, Park, & Lee, 2023)';
  passage('동일 첫 저자·연도에 공동저자 충돌',cury+'와 '+other+' 이후 '+short+'를 인용했다.',[[cury,k.review],[other,k.review],[short,k.review]]);
  passage('다른 연도 접미사는 반복으로 간주하지 않음',cury.replace('2023','2023a')+'와 '+short.replace('2023','2023b'),[[cury.replace('2023','2023a'),k.review],[short.replace('2023','2023b'),k.review]]);
  passage('동시 인용 내부의 개별 인용 이력',cury+' 이후 (Cury et al., 2023; Lee, 2020).',[[cury,k.review],['(Cury et al., 2023; Lee, 2020)',k.ok]]);
  passage('괄호형 축약 기호 누락','인용(Smith et al 2020)을 제시했다.',[['(Smith et al 2020)',k.error,'(Smith et al., 2020)']]);
  passage('6인 이상 전원 표기','결과(Kim, Lee, Park, Choi, Kang, & Shin, 2020)가 있다.',[['(Kim, Lee, Park, Choi, Kang, & Shin, 2020)',k.error]]);
  passage('단순 저자표현 한 줄씩 자동 추출',huang+'\n홍길동(2019)',[[huang,k.ok],['홍길동(2019)',k.ok]]);
}

{
  const {k,cases}=ValidationSuite;
  const sample='Huang, Y., & Chiu, W. (2024). Let’s run green! Impact of runners’ environmental consciousness on their green perceived quality and supportive intention at participatory sport events. International Journal of Sports Marketing and Sponsorship, 25(3), 541–559.';
  const title='Let’s run green! Impact of runners’ environmental consciousness on their green perceived quality and supportive intention at participatory sport events.';
  const journal='International Journal of Sports Marketing and Sponsorship, 25';
  function check(name,input,styles,ids,expected=input,word=''){
    cases.push({name,input,expected:(ids.join(', ')||k.ok)+' · '+expected,run(){
      const r=k.reference(input,'auto',styles),actual=r.issues.map(i=>i.id);
      const status=ids.includes('page-separator')||ids.includes('journal-style-missing')?k.error:ids.length?k.review:k.ok;
      const issue=r.issues.find(i=>i.id==='title-case');
      return {pass:r.type==='journal' && r.status===status && r.suggested===expected &&
        actual.join()===ids.join() && (!word || input.slice(issue?.start,issue?.end)===word),
        actual:r.status+' · '+actual.join(', ')+' · '+r.suggested};
    }});
  }
  const styleFor=(input,italic=true)=>{
    const start=input.indexOf(journal);
    return Array.from({length:input.length},(_,i)=>({italic:italic && i>=start && i<start+journal.length}));
  };
  check('제보 원문 · 일반 텍스트는 서식 두 곳만 확인',sample,null,['journal-format','journal-format']);
  for(const [label,range] of [['하이픈','541-559'],['엔 대시','541–559'],['엠 대시','541—559']]){
    const input=sample.replace('541–559',range);
    check('숫자 페이지 범위 · '+label+' 유지',input,styleFor(input),[]);
  }
  const spaced=sample.replace('541–559','541 – 559');
  check('엔 대시 주위 공백 · 대시 종류 보존',spaced,styleFor(spaced),['page-separator'],sample);
  for(const [label,newTitle,word] of [
    ['물음표 뒤 새 문장','Why run green? Impact on runners.'],
    ['학회 예시의 마침표 뒤 새 문장','Sport participation across the life cycle. A review of the literature and suggestions for future research.'],
    ['콜론 뒤 부제','Running green: Impact on runners.'],
    ['닫는 따옴표 뒤 새 문장','Why say “run green!” Impact on runners.'],
    ['여는 따옴표 안의 문장 첫 글자','What next? “Running green” for fun.'],
    ['문장 첫 글자 뒤의 고유명사 후보','Why run green? Impact of Seoul events.','Seoul'],
    ['소문자 부제 확인 유지','Running green: impact on runners.','impact'],
    ['소문자 제목 확인 유지','running green.','running']
  ]){
    const input=sample.replace(title,newTitle);
    check('영문 논문 제목 · '+label,input,styleFor(input),word?['title-case']:[],input,word);
  }
  check('명시적인 일반체 · 이탤릭 누락 두 곳 유지',sample,styleFor(sample,false),['journal-style-missing','journal-style-missing']);
  if(typeof document!=='undefined'){
    cases.push({name:'제보 원문 · 이탤릭 HTML 붙여넣기',input:sample,expected:k.ok,run(){
      const data=new DataTransfer();
      data.setData('text/plain',sample);
      data.setData('text/html',sample.replace(journal,'<i>'+journal+'</i>'));
      const clip=RichInput.clipboard(new ClipboardEvent('paste',{clipboardData:data}).clipboardData);
      const r=k.reference(clip.text,'auto',clip.styles);
      return {pass:clip.status==='emphasis' && r.suggested===sample && r.status===k.ok &&
        r.issues.length===0 && r.formatChecks.length===2 && r.formatChecks.every(f=>f.status===k.ok),actual:r.status};
    }});
  }
}

{
  const {k,cases}=ValidationSuite;
  const parser=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  function required(name,type,input,ids){
    cases.push({name:'필수 필드 · '+name,input,expected:ids.length?'수정 필요 · '+ids.join(', '):'확정 누락 없음',run(){
      const result=k.reference(input,type), manual=result.issues.filter(i=>i.manual);
      const actual=manual.map(i=>i.id).sort().join(', ');
      const pass=actual===ids.slice().sort().join(', ') && result.suggested===input &&
        manual.every(i=>i.level===k.error && i.ref.includes('제11조') && i.advice.includes('원자료에서 확인해 직접 입력')) &&
        (ids.length ? result.status===k.error && parser.suggestionMessage(result,'ref').includes('직접 입력') : result.status!==k.error);
      return {pass,actual:result.status+' · '+(actual||'확정 누락 없음')+' · '+result.suggested};
    }});
  }
  const author='홍길남(2018). ', thesis=author+'체육 연구. 미간행 박사학위논문. ';
  required('국문 미간행 학위논문 소재지','auto',thesis+'서울대학교 대학원.',['region']);
  required('영문 미간행 학위논문 소재지','auto','Kim, J. (2018). Exercise. (Unpublished doctoral dissertation). Yonsei University.',['region']);
  required('학위수여기관·소재지 모두 생략','thesis',thesis.trim(),['school','region']);
  required('학위수여기관만 생략','thesis',thesis+', 서울.',['school']);
  required('학위 수여 기관과 소재지의 경계가 불분명','thesis',thesis+'서울대학교 대학원 서울.',[]);
  required('학위수여기관 약칭과 소재지가 있음','thesis',thesis+'KAIST, 대전.',[]);
  required('학위 구분이 생략된 미간행 학위논문','thesis',thesis.replace('박사','')+'서울대학교 대학원, 서울.',['degree']);
  required('출간 학위논문에 대학·소재지를 강제하지 않음','thesis',author+'체육 연구. 서울: 체육출판사.',[]);
  required('출간 학위논문 출판사 빈칸','thesis',author+'체육 연구. 서울: .',['publication-publisher']);
  required('온라인 학위논문 URL로 소재지를 채우지 않음','thesis',author+'체육 연구 (Master’s thesis, Yonsei University). Retrieved from https://example.org/t',['region']);
  required('온라인 학위논문 URL 생략','thesis',author+'체육 연구 (Master’s thesis, Yonsei University, Seoul). Retrieved from',['retrieval']);
  required('학위논문 제목 빈칸','thesis',author+'미간행 박사학위논문. 서울대학교 대학원, 서울.',['thesis-title']);
  required('단행본 출판도시 빈칸','book',author+'체육 연구. : 체육출판사.',['publication-city']);
  required('단행본 출판사 빈칸','book',author+'체육 연구. 서울: .',['publication-publisher']);
  required('단행본 출판정보 생략','book',author+'체육 연구.',['publication-source']);
  required('단행본 부제 콜론을 출판정보로 해석하지 않음','book',author+'체육 연구: 새로운 접근. 서울 / 체육출판사.',[]);
  required('단행본 출판사만 기재','book',author+'체육 연구. 체육출판사.',['publication-city']);
  required('보고서 발행지 빈칸','report',author+'훈련 보고서. : 체육연구소.',['publication-city']);
  required('보고서 발행기관 빈칸','auto',author+'훈련 보고서. 서울: .',['publication-publisher']);
  required('보고서 장소만 기재','report',author+'훈련 보고서. 서울.',['publication-publisher']);
  required('보고서 출처 전체 생략','auto',author+'훈련 보고서.',['publication-source']);
  required('온라인 보고서 URL 빈칸','report',author+'훈련 보고서. Retrieved from .',['retrieval']);
  required('보고서 온라인 출처가 있으면 지면 필드 제외','report',author+'훈련 보고서. https://example.org/report',[]);
  required('온라인 보고서 비표준 출처 유지','report',author+'훈련 보고서. Retrieved from www.example.org',[]);
  const print='홍길남(2018, 3월 8일). 체육 소식. 동해일보, p. A2.';
  required('기사 월·일 생략','auto',print.replace(', 3월 8일',''),['news-date']);
  required('기사 일 생략','news',print.replace('3월 8일','3월'),['news-date']);
  required('기사 비표준 날짜에는 값이 있음','news',print.replace('3월 8일','03/08'),[]);
  required('신문명 빈칸','news',print.replace('동해일보',''),['newspaper']);
  required('신문기사 페이지 빈칸','news',print.replace('A2',''),['news-page']);
  required('지면 페이지·온라인 출처 둘 다 없음','news',print.replace(', p. A2',''),['news-page']);
  required('지면 기사 비표준 페이지 표기는 보존','news',print.replace('p. A2','2면'),[]);
  required('온라인 기사 URL 빈칸','news',print.replace(', p. A2.','. Retrieved from'),['retrieval']);
  required('국문 온라인 예시에서 신문명 생략 가능성','news',print.replace('동해일보, p. A2.','https://example.org/news'),[]);
  const conf=author+'제24회 체육 세미나, 전문체육인의 역할(pp. 29-56). 서울: 한국체육학회.';
  required('자료집 수록 페이지 빈칸','auto',conf.replace('29-56',''),['proceedings-pages']);
  required('자료집 수록 페이지 생략','auto',conf.replace('(pp. 29-56)',''),['proceedings-pages']);
  required('자료집 페이지 기호만 다른 경우','auto',conf.replace('pp. 29-56','29–56'),[]);
  required('자료집 발행처 빈칸','auto',conf.replace('한국체육학회.','.'),['publication-publisher']);
  required('자료집 발표 자료명 빈칸','auto',conf.replace('전문체육인의 역할',''),['proceedings-work']);
  required('포스터 개최지 빈칸·수록 페이지 제외','conference',author+'운동 연구. Poster session presented at the Sports Society, .',['presentation-place']);
  required('논문 권만 있고 페이지 빈칸','journal',author+'운동 연구. 한국체육학회지, 32(2), .',['journal-pages']);
  required('논문 권 누락·페이지 유지','journal',author+'운동 연구. 한국체육학회지, 21-32.',['journal-volume']);
  required('호를 발행하는지 불확실한 학술지','journal',author+'운동 연구. 한국체육학회지, 32, 21-32.',[]);
  required('연도 괄호가 비어 있음','book','홍길남(). 체육 연구. 서울: 체육출판사.',['year-empty']);
  required('학술지명이 들어갈 자리만 비어 있음','journal',author+'운동 연구. , 32(2), 21-32.',['journal-name']);
  required('저자 칸이 비어 있음','book','(2018). 체육 연구. 서울: 체육출판사.',['author-empty']);
  required('도시와 출판사만 적힌 단행본','book',author+'서울: 체육출판사.',['publication-title']);
  required('온라인 보고서의 제목 빈칸','report',author+'Retrieved from https://example.org/report',['report-title']);
  required('기관명만 적힌 지면 보고서','report',author+'훈련 보고서. 한국문화대학교 체육과학연구소.',['publication-city']);
  required('온라인인지 확정되지 않은 학위논문','thesis',author+'체육 연구 (Master’s thesis, Yonsei University, Seoul).',[]);
  required('제공된 n.d. 표기 보존','report','홍길남(n.d.). 훈련 보고서. 서울: 체육연구소.',[]);
  required('내용만으로 문헌 유형을 판별하기 어려움','auto',author+'체육 연구.',[]);
}

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
  cite('본문 · 문헌 간 기호 확인','(김성태, 1978, 남해구, 1997)',{},k.error,'(김성태, 1978; 남해구, 1997)');
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
  ref('엔 대시 · 원문 보존 및 서식 확인',dash,'auto',k.review,dash,['journal-format']);
  ref('DOI 식별자 끝 기호 보존',doi+'.','auto',k.review,doi+'.',['doi-ending']);
  const literal='( Volicer, K. A. 2016 ; Volicer, M. Y. 2016)';
  cases.push({name:'제10조 제8항 · 원문 예시의 두 Volicer 구별',input:literal,expected:k.ok,run(){
    const r=k.citation(literal);
    return {pass:r.status===k.ok && r.suggested===literal,actual:r.status+' · '+r.suggested};
  }});
}

{
  const {cases,k,ref}=ValidationSuite;
  const parser=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  const first='강다희, 임금정, 김현우(2024). 노년층의 온라인 스포츠 경기 관람권 구매 의도 분석: 확장된 기술수용모델을 중심으로. 한국스포츠학회, 22(1), 23-34.';
  const second='김가은, (2024). IPA 분석을 통한 프로스포츠 관람 제약 요인 개선 방안 연구. 한국콘텐츠학회논문지, 24(9), 361-379';
  const fixed=second.replace('김가은, ','김가은')+'.';
  function division(name,input,expected){
    cases.push({name,input,expected:expected.join('\n'),run(){
      const lines=parser.entries(input,'ref').map(g=>g.text);
      return {pass:JSON.stringify(lines)===JSON.stringify(expected),actual:lines.join('\n')};
    }});
  }
  division('실제 제보 · 마지막 저자 뒤 쉼표가 있어도 두 문헌',first+'\n'+second,[first,second]);
  const continuation='한국스포츠학회, 22(1), 23-34.';
  const heading=first.slice(0,first.indexOf(continuation)).trimEnd();
  division('학술지·권호가 이어지는 줄 보존',heading+'\n'+continuation+'\n'+second,[first,second]);
  division('제목 안의 연도는 연속 줄',heading+'\n국내 관람 추이(2020)와 비교. '+continuation,[heading+' 국내 관람 추이(2020)와 비교. '+continuation]);
  division('학술지명과 연도가 이어지는 줄 보존',heading+'\n학술지, (2024). 부록',[heading+' 학술지, (2024). 부록']);
  division('줄이 나뉜 복수 저자와 연도 앞 쉼표',first+'\n임금정,\n김가은, (2024). 연구.',[first,'임금정, 김가은, (2024). 연구.']);
  ref('국문 단독 저자 끝 쉼표와 페이지 마침표 동시 교정',second,'auto',k.error,fixed,['ko-author-year-comma','page-stop']);
  ref('국문 복수 저자 구분과 끝 쉼표 동시 교정',second.replace('김가은, ','강다희,김가은 ,  '),'auto',k.error,fixed.replace('김가은','강다희, 김가은'),['ko-author-comma','ko-author-year-comma']);
  ref('국문 연도 앞 공백만 있는 경우',fixed.replace('김가은(','김가은  ('),'auto',k.error,fixed,['year-position']);
  ref('교정한 국문 저자 표기는 다시 수정하지 않음',fixed,'auto',k.review,fixed,['journal-format']);
}

if(typeof document!=='undefined'){
  const {cases,k}=ValidationSuite;
  const ko=['김가은(2024). 관람 연구. ','한국콘텐츠학회논문지','24'];
  const en=['Smith, J. (2024). Sport participation. ','Journal of Sport','24'];
  function pasteCase(name,parts,markup,key,state,visible){
    const [prefix,journal,volume]=parts;
    const input=prefix+journal+', '+volume+'(9), 361-379.';
    const field=journal+', '+volume;
    cases.push({name,input,expected:state,run(){
      const editor=document.createElement('div');
      editor.contentEditable='true';
      document.body.append(editor);
      try{
        const html=markup?markup(prefix,field)+'(9), 361-379.':'';
        const clip=RichInput.clipboard({getData:type=>type==='text/html'?html:input});
        RichInput.insert(editor,clip);
        const snapshot=RichInput.read(editor,true);
        const group=ReferenceInput.entries(snapshot.text,'ref',snapshot.styles)[0];
        const checks=k.reference(group.text,'journal',group.styles).formatChecks;
        const fieldSpan=[...editor.children].find(n=>n.textContent.includes(journal.split(' ')[0]));
        const rendered=fieldSpan?getComputedStyle(fieldSpan)[key]:'서식 요소 없음';
        const actual=checks.map(c=>c.status).join(' / ');
        return {pass:snapshot.text===input && actual===state+' / '+state && rendered===visible,actual:actual+' · '+rendered};
      }finally{editor.remove();}
    }});
  }
  pasteCase('브라우저 붙여넣기 · Word 클래스의 굵게 표시·검사',ko,(p,f)=>'<style>span.MsoEmphasis{font-weight:700}</style>'+p+'<span class="MsoEmphasis">'+f+'</span>','fontWeight',k.ok,'700');
  pasteCase('브라우저 붙여넣기 · Docs 클래스의 이탤릭 표시·검사',en,(p,f)=>'<style>.c2{font-style:italic}</style><b style="font-weight:normal">'+p+'<span class="c2">'+f+'</span></b>','fontStyle',k.ok,'italic');
  pasteCase('브라우저 붙여넣기 · 클래스가 있는 자식에 강조 상속',ko,(p,f)=>p+'<strong><span class="wordlang">'+f+'</span></strong>','fontWeight',k.ok,'700');
  pasteCase('브라우저 붙여넣기 · 명시적 일반체 우선',ko,(p,f)=>'<style>.w{font-weight:bold}</style>'+p+'<span class="w" style="font-weight:400">'+f+'</span>','fontWeight',k.error,'400');
  pasteCase('브라우저 붙여넣기 · 중요한 클래스 선언 우선',en,(p,f)=>'<style>.c{font-style:italic!important}</style>'+p+'<span class="c" style="font-style:normal">'+f+'</span>','fontStyle',k.ok,'italic');
  pasteCase('브라우저 붙여넣기 · HTML에만 있는 폭 없는 공백',en,(p,f)=>p+'\u200b<em>'+f+'</em>','fontStyle',k.ok,'italic');
  pasteCase('브라우저 붙여넣기 · 복합 선택자 충돌은 확인 필요',ko,(p,f)=>'<style>.w{font-weight:bold}div .w{font-weight:normal}</style>'+p+'<div><span class="w">'+f+'</span></div>','fontWeight',k.review,'400');
  pasteCase('브라우저 붙여넣기 · 순수 텍스트는 서식 확인 필요',en,null,'fontStyle',k.review,'normal');
}

{
  const {k,ref,cases}=ValidationSuite;
  const parser=typeof require==='function'?require('./reference-input.js'):ReferenceInput;
  const report='김준식, 김정운. 한소원, 김연수(2018). 장노년층 스마트폰 활용능력에 따른 체질량 지수 차이. 대한스포츠의학회지, 36(4), 189-196.';
  const fixed=report.replace('김정운.','김정운,');
  for(const [name,separator] of [['제보의 마침표','. '],['세미콜론','; '],['가운뎃점','·']]){
    const input=fixed.replace('김정운, ','김정운'+separator);
    cases.push({name:'저자 구분 · '+name,input,expected:fixed,run(){
      const r=k.reference(input),errors=r.issues.filter(i=>i.level===k.error);
      const pass=r.suggested===fixed && r.status===k.error && errors.length===1 &&
        errors[0].id==='ko-author-comma' && errors[0].ref===k.rules.author &&
        input.slice(errors[0].start,errors[0].end)===separator &&
        !r.issues.some(i=>i.id.startsWith('year-')) && r.formatChecks.length===2;
      return {pass,actual:r.suggested+' · '+r.issues.map(i=>i.id).join(', ')};
    }});
  }
  ref('정상 복수 저자 · 저자명·연도 원문 유지',fixed,'auto',k.review,fixed,['journal-format']);
  const prev='김가은(2024). 관람 연구. 한국체육학회지, 12(3), 43-56.';
  for(const [name,body] of [['한 줄씩',report],['저자 중간 줄바꿈',report.replace('김정운. ','김정운.\n')],
    ['권호 앞 줄바꿈',report.replace(' 대한스포츠의학회지','\n대한스포츠의학회지')]]){
    const input=prev+'\n'+body;
    cases.push({name:'오류 포함 복수 문헌 경계 · '+name,input,expected:'2개 · '+fixed,run(){
      const g=parser.entries(input,'ref'),r=g[1]&&k.reference(g[1].text);
      return {pass:g.length===2 && g[0].text===prev && g[1].raw===body && r.suggested===fixed,
        actual:g.length+'개 · '+(r?.suggested||'')};
    }});
  }
  const org=report.replace('김준식, 김정운. 한소원, 김연수','체육연구소; 스포츠의학회');
  const short=report.replace('김준식, 김정운. 한소원, 김연수','김준; 이솔');
  cases.push({name:'모호한 짧은 저자명과 독립적으로 연도 식별',input:short,expected:k.review,run(){
    const r=k.reference(short);
    return {pass:r.status===k.review && r.suggested===short && !r.issues.some(i=>i.id==='year-unknown') &&
      r.issues.some(i=>i.id==='ko-author-boundary'),actual:r.issues.map(i=>i.id).join(', ')};
  }});
  cases.push({name:'단체명 구분 불확실 · 원문과 명확한 연도 보존',input:org,expected:k.review,run(){
    const r=k.reference(org);
    return {pass:r.status===k.review && r.suggested===org && !r.issues.some(i=>i.id.startsWith('year-')) &&
      r.issues.some(i=>i.id==='ko-author-boundary' && i.ref===k.rules.parsing),actual:r.status+' · '+r.suggested};
  }});
  const prose='연구 문헌. 조사 대상(2019)과 방법. 학회지, 12(1), 1-10.';
  cases.push({name:'제목 속 연도 · 파싱 한계를 규정 위반과 구분',input:prose,expected:k.review,run(){
    const r=k.reference(prose,'journal');
    return {pass:r.suggested===prose && r.status===k.review && r.issues.some(i=>i.id==='year-unknown'&&i.ref===k.rules.parsing),actual:r.status+' · '+r.issues.map(i=>i.ref).join(', ')};
  }});
}

if(typeof document!=='undefined'){
  const {cases,k}=ValidationSuite;
  const text='김준식(2018). 관람 연구. 대한스포츠의학회지, 36(4), 189-196.';
  const field='대한스포츠의학회지, 36';
  const emph=text.replace(field,'<strong><em>'+field+'</em></strong>');
  const examples=[
    ['텍스트만 제공',null,'text',k.review],
    ['HTML·강조 정보 없음','<p>'+text+'</p>','html',k.review],
    ['HTML·일반체만 명시',text.replace(field,'<span style="font-weight:400">'+field+'</span>'),'normal',k.error],
    ['HTML·굵게와 이탤릭',emph,'emphasis',k.ok],
    ['HTML·선택 영역 밖 내용 제외','앞 문단<!--StartFragment-->'+emph+'<!--EndFragment-->다음 문단','emphasis',k.ok],
    ['HTML·선택 영역에 상위 요소의 강조 상속','<b><i>제외<!--StartFragment-->'+text+'<!--EndFragment-->제외</i></b>','emphasis',k.ok],
    ['HTML·텍스트 불일치 시 내용 보존',emph+'다른 글자','mismatch',k.review]
  ];
  for(const [name,html,status,fieldStatus] of examples){
    cases.push({name:'브라우저 클립보드 진단 · '+name,input:text,expected:RichInput.pasteMessages[status],run(){
      const transfer=new DataTransfer();
      transfer.setData('text/plain',text);
      if(html!==null)transfer.setData('text/html',html);
      const event=new ClipboardEvent('paste',{clipboardData:transfer});
      const clip=RichInput.clipboard(event.clipboardData);
      const r=k.reference(clip.text,'journal',clip.styles);
      const i=text.indexOf(field);
      const style=clip.styles[i];
      const preserved=status==='emphasis' ? style?.bold===true && style?.italic===true :
        status==='normal' ? style?.bold===false : style?.bold==null && style?.italic==null;
      return {pass:clip.text===text && clip.status===status && preserved &&
        r.formatChecks.every(f=>f.status===fieldStatus) && r.formatChecks.length===2,
        actual:RichInput.pasteMessages[clip.status]+' · '+r.formatChecks.map(f=>f.status).join(' / ')};
    }});
  }
}



