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
  function read(root,editor=false){
    const pieces=[],styles=[];let last='',blockEnded=false;
    function append(s,style=unknown){
      if(!s)return;
      pieces.push(s);last=s.at(-1);
      for(let i=0;i<s.length;i++)styles.push(style);
    }
    function boundary(){if(last && last!=='\n')append('\n');blockEnded=false;}
    function visit(n,parent){
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
      const s=n.style;
      const inherited=!editor && n.hasAttribute('class')?unknown:parent;
      let style=properties(tag,s?.fontWeight,s?.fontStyle,inherited);
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
      if(/\s/.test(text[i])){styles.push(unknown);continue;}
      while(j<rich.text.length && /\s/.test(rich.text[j]))j++;
      if(text[i]!==rich.text[j])return {text,styles:[]};
      styles.push(rich.styles[j++]);
    }
    if(rich.text.slice(j).trim())return {text,styles:[]};
    return {text,styles};
  }
  function clipboard(data){
    const plain=data.getData('text/plain'),html=data.getData('text/html');
    if(!html)return {text:plain.replace(/\r\n?/g,'\n'),styles:[]};
    const template=document.createElement('template');
    template.innerHTML=html;
    return align(plain,read(template.content));
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
  return {read,clipboard,insert,align,properties,fragment,unknown};
})();
if(typeof module!=='undefined')module.exports=RichInput;
