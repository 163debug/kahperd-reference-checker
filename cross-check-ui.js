'use strict';
const CrossCheckUI=(()=>{
  const sample={
    body:'가상 연구에서 참여 경험을 검토했다(홍가람, 김하늘, 2024).\n\n홍가람, 김하늘(2024)은 같은 자료를 분석했다. 다른 연구도 보고되었다(박새봄, 2021).',
    refs:'홍가람, 김하늘(2024). 가상 달리기 대회의 참여 경험. 가상체육연구, 2(1), 1-9.\n윤다온(2022). 가상 관람객 조사. 가상체육연구, 1(2), 10-18.'
  };
  function bind(){
    const body=$('crossBody'),refs=$('crossRefs'),scope=$('crossScope'),out=$('results');
    function invalidate(){out.hidden=true;}
    body.oninput=refs.oninput=scope.onchange=invalidate;
    $('crossExample').onclick=()=>{
      const fill=()=>{body.value=sample.body;refs.value=sample.refs;invalidate();body.focus();};
      if(!body.value && !refs.value)fill();
      else dialog('가상 예시로 바꿀까요?',el('p','두 입력창의 내용이 예시로 바뀝니다.'),button('예시 불러오기',()=>{$('modal').close();fill();},'primary'));
    };
    $('crossInspect').onclick=()=>{
      if(!body.value.trim() && !refs.value.trim()){toast('본문과 참고문헌 목록을 입력하세요.');body.focus();return;}
      render(out,CrossCheck.analyze(body.value,refs.value,scope.value),body.value);
      out.hidden=false;out.focus({preventScroll:true});out.scrollIntoView({block:'start'});
    };
  }
  function render(out,result,source){
    const {stats:s,rows,units,failures}=result;
    out.replaceChildren(el('h2','교차검사 결과'));
    const groups=new Map(['수정 필요','확인 필요','미인용 판정 보류','정상 일치'].map(k=>[k,el('div')]));
    let serial=0;
    function fold(parent,label,context=''){
      const panel=el('div'),toggle=button(label,()=>{
        panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));
      },'secondary cross-toggle');
      panel.id='cross-detail-'+(++serial);panel.hidden=true;
      toggle.type='button';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
      if(context)toggle.setAttribute('aria-label',context+' '+label);
      parent.append(toggle,panel);return panel;
    }
    const problems=[['누락',s.missing],['미인용',s.unused],['중복 추가 기재',s.duplicates]].filter(pair=>pair[1]);
    const top=el('div',undefined,'cross-overview');
    for(const [label,value] of [['정상 일치',s.matches+'건'],['수정 필요',problems.map(([k,n])=>k+' '+n+'건').join(' · ')||'0건'],['확인 필요',s.review+'건']]){
      const item=el('div');item.append(el('span',label),el('strong',value));top.append(item);
    }
    out.append(top,el('p','본문 인용 '+s.occurrences+'회 · 참고문헌 '+s.references+'건','muted'));
    if(s.matches && !problems.length && !s.review && !s.held)out.append(el('p','입력한 본문 인용과 참고문헌이 모두 일치합니다.'));
    if(s.citeFail || s.refFail)out.append(el('p','파싱 확인 필요 · 본문 추출 실패 후보 '+s.citeFail+'건 · 참고문헌 식별 실패 '+s.refFail+'건. 관련 항목의 누락·미인용 판정을 확정하기 어렵습니다.','cross-notice'));
    const statistics=el('div');
    const counts=el('div',undefined,'summary resultstats crossstats');
    for(const [label,value] of [
      ['본문 인용 표현',s.expressions],['개별 문헌 인용 횟수',s.occurrences],['반복 제외 식별 정보',s.keys],['참고문헌 입력 항목',s.references],
      ['대응 참고문헌 일치',s.matches],['대응 참고문헌 누락',s.missing],['미인용 참고문헌',s.unused],['중복 추가 기재',s.duplicates],['확인 필요 항목',s.review],['미인용 판정 보류',s.held]
    ]){const cell=el('div');cell.append(el('span',label),el('b',String(value)));counts.append(cell);}
    statistics.append(counts,el('p','인용 횟수는 추출한 표현 안의 각 문헌·연도를 셉니다. 반복 제외 식별 정보는 입력된 저자 표기와 연도 조합의 수입니다. 전원 표기와 축약형은 서로 다른 식별 정보여도 같은 문헌에 대응할 수 있습니다.','muted'),
      el('p','일치는 식별된 문헌 수, 누락은 반복을 제외한 인용 식별 정보 수입니다. 중복은 첫 기재를 뺀 추가 행 수입니다. 확인 필요는 아래 본문·목록의 검토 항목 수이므로 이 수치들을 합산하지 않습니다.','muted'),
      el('p','본문 표현 파싱 성공 '+s.citeOk+' · 실패 후보 '+s.citeFail+'  |  참고문헌 식별 정보 파싱 성공 '+s.refOk+' · 실패 '+s.refFail,'loc'));
    if(!s.expressions)out.append(el('p',failures.length?'식별에 성공한 인용이 없습니다. 아래의 추출 실패 후보를 확인하세요.':'입력한 본문에서 인용 표현이 발견되지 않았습니다.'));
    function position(loc){
      const previous=source.lastIndexOf('\n',loc.start-1);
      return (source.slice(0,loc.start).split('\n').length)+'행 '+(loc.start-previous)+'열 · 본문 '+(loc.start+1)+'–'+loc.end+'번째 문자';
    }
    function card(label,title,status,reason,advice){
      const node=el('article',undefined,'resultcard cross-item'),head=el('div',undefined,'cardhead');
      head.append(el('h4',label),status==='판정 보류'?el('span',status,'pill'):badge(status));
      node.append(head,el('strong',title),el('p',status===rule.review?reason:advice||reason,'muted'));
      const detail=fold(node,'상세보기',label+' '+title);
      detail.append(el('p',reason));if(advice)detail.append(el('p',advice));
      groups.get(status===rule.ok?'정상 일치':status==='판정 보류'?'미인용 판정 보류':status).append(node);
      return detail;
    }
    function refLabel(u){
      const text=u.text.trim(),year=u.ok && u.year && text.indexOf(u.year);
      if(u.ok && year>=0)return text.slice(0,year+u.year.length).replace(/\(\s*$/,'')+(text[year+u.year.length]===')'?')':'');
      return text.length>64?text.slice(0,64)+'…':text;
    }
    function refText(node,u){
      for(const r of u.rows)node.append(el('div','목록 '+r.index+'번 · '+r.firstLine+'–'+r.lastLine+'행','loc'),el('div',r.raw,'original'));
    }

    for(const r of rows){
      const ok=r.kind==='match',absent=r.kind==='missing';
      const node=card(r.locations[0].author+' ('+r.locations[0].year+')',ok?'대응 참고문헌 일치':absent?'대응 참고문헌 누락':'대응 문헌 확인',ok?rule.ok:absent?rule.error:rule.review,r.reason,
        ok?'':absent?'원자료를 대조하고 해당 문헌을 입력 목록에 추가하세요.':'저자·연도·제목을 원자료와 대조해 직접 식별하세요.');
      const loc=r.locations[0];node.append(el('strong',loc.author+' · '+loc.year+' ('+r.locations.length+'회)'));
      const positions=el('div');
      positions.append(el('h4','본문 인용 위치 '+r.locations.length+'곳'));
      for(const l of r.locations)positions.append(el('p',position(l),'loc'),el('div',l.text,'original'));
      node.append(positions);
      if(r.candidates.length)node.append(el('h4',ok?'대응 참고문헌':'확인할 후보'));
      for(const u of r.candidates)refText(node,u);
    }
    for(const f of failures){
      const node=card(f.text.length>64?f.text.slice(0,64)+'…':f.text,'본문 인용 추출 실패 후보',rule.review,f.reason,'원문에서 인용 여부, 저자와 연도, 괄호 경계를 확인하세요.');
      node.append(el('div',position(f),'loc'),el('div',f.text,'original'));
    }

    for(const u of units){
      if(u.rows.length>1)refText(card(refLabel(u),'동일 참고문헌 중복 기재',rule.error,'저자·날짜와 제목을 포함한 전체 서지 표기가 같습니다. 추가 기재 '+(u.rows.length-1)+'건입니다.','원자료와 확인한 후 중복 행을 정리하세요.'),u);
      if(u.kind==='used')continue;
      if(u.kind==='held'){
        refText(card(refLabel(u),'입력 범위에서 인용을 찾지 못함','판정 보류','본문 범위가 충분하지 않아 미인용 판정을 보류했습니다.','논문 전체를 입력해 다시 확인하세요.'),u);continue;
      }
      const failed=u.kind==='failure',unused=u.kind==='unused';
      refText(card(refLabel(u),failed?'참고문헌 파싱 실패':unused?'미인용 참고문헌':'참고문헌 대응 확인',unused?rule.error:rule.review,
        failed?u.reason:unused?'논문 전체로 지정한 본문에서 이 문헌의 인용을 찾지 못했습니다.':'복수 후보, 불완전한 인용 또는 겹치는 식별 정보가 있어 미인용을 확정하기 어렵습니다.',
        failed?'붙여넣은 줄과 저자·연도를 대조하세요.':unused?'본문의 인용과 목록 수록 여부를 원자료에서 확인하세요.':'본문 표기와 목록의 저자·연도·제목을 확인하세요.'),u);
    }
    for(const [name,group] of groups){
      if(!group.childElementCount)continue;
      if(name==='미인용 판정 보류')out.append(el('p','입력한 본문 범위가 충분하지 않아 미인용 판정 '+s.held+'건을 보류했습니다.','cross-notice'));
      if(name==='정상 일치' || name==='미인용 판정 보류')fold(out,name+' 문헌 '+group.childElementCount+'건 보기').append(group);
      else out.append(el('h3',name+' 항목'),group);
    }
    fold(out,'검사 통계 상세보기').append(statistics);
  }
  return {bind,render};
})();
