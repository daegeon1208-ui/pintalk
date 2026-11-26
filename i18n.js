/* 4.65 화면 언어 (한국어 · English · 中文)
   설정 › 언어에서 고르면 localStorage "ptLang"에 저장하고 다시 연다.
   한국어가 아니면 화면에 나오는 한국어 문구를 lang.js 사전(PT_DICT)으로 바꿔 보여 준다.
   - 정확히 같은 문구 → 바로 바꿈
   - 바뀌는 값이 든 문구(예: "핀 12개") → 틀(⟨n⟩)에 값을 끼워 바꿈
   - 사전에 없는 문구(사용자가 쓴 메모·도면 이름 등)는 그대로 둔다
   내보내기 PDF·엑셀 양식은 현장 제출용이라 한국어 그대로 둔다. */
(function(){
  "use strict";
  const KEY="ptLang";
  let L="ko"; try{ L=localStorage.getItem(KEY)||"ko"; }catch(e){}
  if(!["ko","en","zh"].includes(L)) L="ko";
  window.PT_LANG=L;
  window.ptSetLang=function(l){ try{ localStorage.setItem(KEY,l); }catch(e){} location.reload(); };
  window.ptT=function(s){ return s; };
  if(L==="ko"||!window.PT_DICT) return;
  document.documentElement.lang= L==="en"?"en":"zh-CN";
  const C= L==="en"?1:2, KO=/[가-힣]/;
  const exact=new Map(), pats=[];
  for(const r of window.PT_DICT){
    const ko=r[0], t=r[C]; if(!t) continue;
    if(ko.indexOf("\u0001")<0){ exact.set(ko,t); continue; }
    const parts=ko.split("\u0001");
    const lit=parts.reduce((a,b)=>b.length>a.length?b:a,"").trim();
    if(!KO.test(lit)) continue;
    const re=new RegExp("^"+parts.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/ /g,"\\s*")).join("([\\s\\S]*?)")+"$");
    const koN=(parts.join("").match(/[가-힣]/g)||[]).length;
    pats.push({lit,re,t,len:ko.length,weak:koN<4&&/[가-힣]\u0001|\u0001[가-힣]/.test(ko)});
  }
  pats.sort((a,b)=>b.len-a.len);
  const WD={일:["Sun","日"],월:["Mon","一"],화:["Tue","二"],수:["Wed","三"],목:["Thu","四"],금:["Fri","五"],토:["Sat","六"]};
  function core(k,depth){
    if(!KO.test(k)) return k;
    const e=exact.get(k); if(e!=null) return e;
    if(depth<3) for(const p of pats){
      if(k.indexOf(p.lit)<0) continue;
      const m=p.re.exec(k); if(!m) continue;
      // 고정 글자가 짧은 틀(예: "⟨⟩쪽")은 사용자 글 속 낱말에도 걸리므로, 끼워진 값이 한국어로 남으면 쓰지 않는다
      if(p.weak&&m.slice(1).some(v=>KO.test(v)&&KO.test(tr(v.trim(),depth+1)))) continue;
      return p.t.replace(/⟨(\d)⟩/g,(_,i)=>{ const v=m[+i]||""; const s=v.trim(); return s?v.replace(s,depth<2?tr(s,depth+1):s):v; });
    }
    // 날짜의 요일 (예: 11.26(목))
    const w=k.replace(/\(([일월화수목금토])\)/g,(_,d)=>"("+WD[d][C-1]+")");
    if(w!==k&&!KO.test(w)) return w;
    return null;
  }
  /* 사전 문구 여러 개가 이어 붙은 글(예: "1쪽 · 연습용 · 참가 8명")은 끊을 수 있는 자리에서 나눠
     조각마다 바꾼다. 한국어 조각이 하나라도 사전에 없으면 손대지 않는다(사용자가 쓴 글 보호) */
  const BRK=/[\s·,.!?)\]」”:]/;
  function piece(t){
    const y=t.replace(/^[\s·]+|[\s·]+$/g,""); if(!y) return t; if(!KO.test(y)) return t;
    let r=core(y,1); if(r!=null) return t.replace(y,r);
    r=core("· "+y,1); if(r!=null) return t.replace(y,r.replace(/^·\s*/,""));
    return null;
  }
  function cover(k){
    if(k.length>500) return null;
    const n=k.length, cut=[0];
    for(let i=1;i<n;i++) if(BRK.test(k[i-1])&&!BRK.test(k[i])) cut.push(i);
    cut.push(n);
    const memo=new Map();
    function go(ci){
      if(ci===cut.length-1) return "";
      if(memo.has(ci)) return memo.get(ci);
      let res=null;
      for(let cj=cut.length-1;cj>ci&&res==null;cj--){
        if(ci===0&&cj===cut.length-1) continue;
        const t=piece(k.slice(cut[ci],cut[cj])); if(t==null) continue;
        const rest=go(cj); if(rest==null) continue;
        res=t+rest;
      }
      memo.set(ci,res); return res;
    }
    const r=go(0);
    return r==null?null:r.replace(/\s+/g," ").trim();
  }
  const cache=new Map();
  function tr(s,depth){
    depth=depth||0;
    if(s==null) return s; s=String(s);
    if(!KO.test(s)) return s;
    if(!depth&&cache.has(s)) return cache.get(s);
    const lead=s.match(/^\s*/)[0], trail=s.match(/\s*$/)[0];
    const k1=s.replace(/[ \t\u00a0]+/g," ").replace(/ *\n */g,"\n").trim(), k=s.replace(/\s+/g," ").trim();
    let r=core(k1,depth); if(r==null&&k!==k1) r=core(k,depth);
    if(!depth&&(r==null||KO.test(r))){ const c=cover(k); if(c!=null) r=c; }
    if(r==null){
      // 여러 줄로 된 알림창 문구: 줄마다 바꿔 본다
      const lines=s.split(/\n/); if(lines.length>1){ const t=lines.map(x=>{const y=x.trim(); return y?(core(y.replace(/\s+/g," "),depth)??x):x;}); r=t.join("\n"); }
    }
    const out= r==null ? s : lead+r+trail;
    if(!depth&&cache.size<5000) cache.set(s,out);
    return out;
  }
  window.ptT=tr;
  const SKIP=new Set(["SCRIPT","STYLE","TEXTAREA","CODE","PRE"]);
  const ATTRS=["placeholder","title","aria-label"];
  function skip(el,attr){ for(let e=el;e&&e.nodeType===1;e=e.parentElement){ if(attr&&e===el&&e.tagName==="TEXTAREA") continue; if(SKIP.has(e.tagName)||e.isContentEditable||e.hasAttribute("data-noi18n")) return true; } return false; }
  function doText(n){ const v=n.nodeValue; if(!v||!KO.test(v)) return; if(n.parentElement&&skip(n.parentElement)) return; let t=tr(v); if(t===v) return;
    if(C===1){ // 영어는 굵은 글씨 앞뒤 띄어쓰기가 필요하다 (한국어는 조사가 붙어 있어 빈칸이 없음)
      const p=n.previousSibling, x=n.nextSibling;
      if(p&&p.nodeType===1&&/^[A-Za-z0-9(“]/.test(t)&&!/^\s/.test(v)) t=" "+t;
      if(x&&x.nodeType===1&&x.tagName!=="BR"&&/[A-Za-z0-9.,:;)”]$/.test(t)&&!/\s$/.test(v)) t=t+" ";
    }
    n.nodeValue=t; }
  function doAttrs(el){ if(skip(el,true)) return; for(const a of ATTRS){ const v=el.getAttribute(a); if(v&&KO.test(v)){ const t=tr(v); if(t!==v) el.setAttribute(a,t);} } }
  function walk(root){
    if(root.nodeType===3){ doText(root); return; }
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11) return;
    if(root.nodeType===1){ if(root.tagName==="TEXTAREA"){ doAttrs(root); return; } if(skip(root)) return; doAttrs(root); }
    const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,null);
    let n; while((n=it.nextNode())){ if(n.nodeType===3) doText(n); else if(!SKIP.has(n.tagName)||n.tagName==="TEXTAREA") doAttrs(n); }
  }
  const mo=new MutationObserver(ms=>{ for(const m of ms){
    if(m.type==="childList") m.addedNodes.forEach(walk);
    else if(m.type==="characterData") doText(m.target);
    else if(m.type==="attributes") doAttrs(m.target);
  }});
  function start(){ walk(document.body); mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS}); document.title=tr(document.title); }
  if(document.body) start(); else document.addEventListener("DOMContentLoaded",start);
  const A=window.alert.bind(window), Cf=window.confirm.bind(window), P=window.prompt.bind(window);
  window.alert=m=>A(tr(m)); window.confirm=m=>Cf(tr(m)); window.prompt=(m,d)=>P(tr(m),d);
})();
