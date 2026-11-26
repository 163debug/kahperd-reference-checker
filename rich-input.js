'use strict';
const RichInput=(()=>{
  // Per UTF-16 character: each property is true, false (explicit normal), or unknown.
  const unknown=Object.freeze({bold:null,italic:null});
  const blocks=new Set('ADDRESS ARTICLE ASIDE BLOCKQUOTE DIV FOOTER H1 H2 H3 H4 H5 H6 HEADER LI MAIN OL P PRE SECTION TR UL'.split(' '));
  const skip=new Set('SCRIPT STYLE LINK META BASE HEAD TEMPLATE NOSCRIPT IFRAME OBJECT SVG MATH IMG'.split(' '));
  function properties(tag,weight,slant,parent=unknown){
    let {bold,italic}=parent;
    if(tag==='B'||tag==='STRONG')bold=true;
    if(tag==='I'||tag==='EM')italic=true;
    if(weight){
      if(weight==='bold')bold=true;
      else if(weight==='normal')bold=false;
      else if(/^\d+(?:\.\d+)?$/.test(weight))bold=Number(weight)>=700?true:Number(weight)<=500?false:null;
      else if(weight!=='inherit')bold=null;
    }
    if(slant){
      if(slant==='italic')italic=true;
      else if(slant==='normal')italic=false;
      else if(slant!=='inherit')italic=null;
    }
    return {bold,italic};
  }
  // Inspect embedded CSS in a detached stylesheet. Never attach clipboard
  // styles, fetch linked sheets, or insert clipboard elements in the editor.
  function clipboardRules(root){
    const rules=[];
    for(const element of root.querySelectorAll('style')){
      if(element.media && element.media.trim()!=='all')continue;
      if(element.type && element.type!=='text/css')continue;
      if(typeof CSSStyleSheet==='undefined'||!CSSStyleSheet.prototype.replaceSync)break;
      const sheet=new CSSStyleSheet();
      sheet.replaceSync(element.textContent);
      for(const rule of sheet.cssRules){
        if(!rule.selectorText || !rule.style || !(rule.style.fontWeight||rule.style.fontStyle))continue;
        const selectors=rule.selectorText.split(',').map(s=>s.trim());
        // Word and Docs commonly use .class, tag.class, or a tag selector.
        if(!selectors.every(s=>s && /^(?:[a-z][\w-]*)?(?:\.[a-z_][\w-]*)*$/i.test(s))){
          // A competing complex selector can make the cascade ambiguous.
          rules.push({selector:rule.selectorText,style:rule.style,uncertain:true});
          continue;
        }
        for(const selector of selectors){
          const specificity=(selector.match(/\./g)||[]).length*10+Number(selector[0]!=='.');
          rules.push({selector,specificity,style:rule.style});
        }
      }
    }
    return rules;
  }
  function fontStyle(node,rules){
    if(!rules.length)return node.style;
    const result={}, ranks={};
    function apply(style,priority,uncertain=false){
      if(!style)return;
      for(const key of ['font-weight','font-style']){
        const value=style.getPropertyValue(key);
        if(!value)continue;
        const rank=priority+(style.getPropertyPriority(key)==='important'?1e6:0);
        if(rank<(ranks[key]??-1))continue;
        ranks[key]=rank;
        result[key==='font-weight'?'fontWeight':'fontStyle']=uncertain?'unknown':value;
      }
    }
    for(const rule of rules){
      let matches;
      try{matches=node.matches(rule.selector);}catch{matches=rule.uncertain;}
      if(matches)apply(rule.style,rule.uncertain?9e4:rule.specificity,rule.uncertain);
    }
    apply(node.style,1e5);
    return result;
  }
  function read(root,editor=false,rules=[],range=null){
    const pieces=[],styles=[];let last='',blockEnded=false;
    function append(s,style=unknown){
      if(!s)return;
      pieces.push(s);last=s.at(-1);
      for(let i=0;i<s.length;i++)styles.push(style);
    }
    function boundary(){if(last && last!=='\n')append('\n');blockEnded=false;}
    function visit(n,parent){
      if(range && !range.intersectsNode(n))return;
      if(n.nodeType===3){
        const value=n.nodeValue.replace(/\r\n?/g,'\n');
        if(!editor && /^\s+$/.test(value) && value.includes('\n'))return;
        if(blockEnded)boundary();
        append(value,parent);return;
      }
      if(n.nodeType!==1)return;
      const tag=n.tagName.toUpperCase();
      if(skip.has(tag)||n.hidden||n.style?.display==='none')return;
      if(tag==='BR'){if(blockEnded)boundary();append('\n');return;}
      const block=blocks.has(tag);
      if(block)boundary();
      const s=fontStyle(n,rules);
      let style=properties(tag,s?.fontWeight,s?.fontStyle,parent);
      if(editor && n.hasAttribute('data-paste-style')){
        const decode=c=>c==='1'?true:c==='0'?false:null;
        const code=n.getAttribute('data-paste-style');
        style={bold:decode(code[0]),italic:decode(code[1])};
      }
      for(const child of n.childNodes)visit(child,style);
      if(block)blockEnded=true;
    }
    for(const node of root.childNodes)visit(node,unknown);
    return {text:pieces.join(''),styles};
  }

  // Use clipboard plain text as the spelling and line-break authority. Only transfer
  // formatting if both clipboard representations agree on every non-space character.
  function align(plain,rich){
    if(!plain)return rich;
    const text=plain.replace(/\r\n?/g,'\n'),styles=[];
    let j=0;
    for(let i=0;i<text.length;i++){
      if(/[\s\u200b]/.test(text[i])){
        styles.push(text[i]===rich.text[j]?rich.styles[j++]:unknown);
        continue;
      }
      while(j<rich.text.length && /[\s\u200b]/.test(rich.text[j]))j++;
      if(text[i]!==rich.text[j])return {text,styles:[]};
      styles.push(rich.styles[j++]);
    }
    if(/[^\s\u200b]/.test(rich.text.slice(j)))return {text,styles:[]};
    return {text,styles};
  }
  function fragmentRange(root){
    const comments=root.ownerDocument.createTreeWalker(root,NodeFilter.SHOW_COMMENT);
    let start=null;
    for(let node=comments.nextNode();node;node=comments.nextNode()){
      if(node.data.trim()==='StartFragment')start=node;
      if(node.data.trim()==='EndFragment' && start){
        const range=root.ownerDocument.createRange();
        range.setStartAfter(start);range.setEndBefore(node);return range;
      }
    }
    return null;
  }
  const pasteMessages={
    text:'텍스트만 전달되어 굵게/이탤릭을 확인할 수 없습니다.',
    html:'HTML은 전달되었지만 해당 부분의 서식을 확인할 수 없습니다.',
    emphasis:'붙여넣은 굵게/이탤릭 서식을 감지했습니다.',
    normal:'HTML에 일반체로 명시된 문자가 있습니다. 굵게/이탤릭으로 지정된 문자는 감지되지 않았습니다.',
    mismatch:'HTML에서 강조 서식을 감지했지만 일반 텍스트와 내용이 달라 적용 위치를 확인할 수 없습니다.'
  };
  function hasEmphasis(styles){
    return styles.some(s=>s?.bold===true || s?.italic===true);
  }
  function clipboard(data){
    const plain=data.getData('text/plain'),html=data.getData('text/html');
    if(!html){
      const htmlOffered=Array.from(data.types||[]).includes('text/html');
      return {text:plain.replace(/\r\n?/g,'\n'),styles:[],status:htmlOffered?'html':'text'};
    }
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=template.content;
    const rich=read(root,false,clipboardRules(root),fragmentRange(root));
    const result=align(plain,rich);
    if(hasEmphasis(result.styles))result.status='emphasis';
    else if(!result.styles.length && hasEmphasis(rich.styles))result.status='mismatch';
    else if(result.styles.some(s=>s?.bold===false || s?.italic===false))result.status='normal';
    else result.status='html';
    return result;
  }
  function fragment(snapshot,start=0,end=snapshot.text.length){
    const root=document.createDocumentFragment();
    const {text,styles}=snapshot;
    for(let i=start;i<end;){
      const st=styles[i]||unknown;let j=i+1;
      while(j<end && (styles[j]?.bold??null)===st.bold && (styles[j]?.italic??null)===st.italic)j++;
      const span=document.createElement('span');
      const code=v=>v===null?'?':v?'1':'0';
      span.dataset.pasteStyle=code(st.bold)+code(st.italic);
      if(st.bold!=null)span.style.fontWeight=st.bold?'700':'400';
      if(st.italic!=null)span.style.fontStyle=st.italic?'italic':'normal';
      span.textContent=text.slice(i,j);
      root.append(span);i=j;
    }
    return root;
  }
  function insert(editor,snapshot){
    if(!snapshot.text)return;
    const sel=editor.ownerDocument.getSelection();
    const range=sel.rangeCount?sel.getRangeAt(0):document.createRange();
    if(!editor.contains(range.commonAncestorContainer)){range.selectNodeContents(editor);range.collapse(false);}
    range.deleteContents();
    const frag=fragment(snapshot),end=frag.lastChild;
    range.insertNode(frag);range.setStartAfter(end);range.collapse(true);
    sel.removeAllRanges();sel.addRange(range);
  }
  return {read,clipboard,insert,align,properties,fragment,unknown,pasteMessages};
})();
if(typeof module!=='undefined')module.exports=RichInput;
