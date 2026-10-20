const MOVIES = [
  {id:'bbb',title:'Big Buck Bunny',zh:'大雄兔',year:'2008',type:'动画',time:'10 分钟',poster:'posters/bbb.svg',video:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',desc:'一只温和的大兔子用聪明而幽默的方式，反击森林里爱捉弄别人的小动物。Blender Foundation 开放电影。'},
  {id:'ed',title:'Elephants Dream',zh:'大象之梦',year:'2006',type:'科幻',time:'11 分钟',poster:'posters/ed.svg',video:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',desc:'世界首部完全使用开源工具制作的开放电影，在充满机械生命的奇异世界中展开探索。'},
  {id:'sintel',title:'Sintel',zh:'辛特尔',year:'2010',type:'奇幻',time:'15 分钟',poster:'posters/sintel.svg',video:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',desc:'一位年轻女孩踏上寻找小龙伙伴的旅程，在时间、记忆与执念之间发现真相。Blender Foundation 开放电影。'},
  {id:'tos',title:'Tears of Steel',zh:'钢铁之泪',year:'2012',type:'科幻',time:'12 分钟',poster:'posters/tos.svg',video:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',desc:'一群战士与科学家在未来阿姆斯特丹试图修正过去，阻止机器人摧毁世界。Blender Foundation 开放电影。'}
];
const $=(s,p=document)=>p.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let filter='全部', query='';
function categories(){return ['全部',...new Set(MOVIES.map(m=>m.type))]}
function renderCats(){ $('#catsIn').innerHTML=categories().map(c=>`<button class="cat${filter===c?' on':''}" data-cat="${c}">${c}</button>`).join('') }
function visible(){ const q=query.trim().toLowerCase(); return MOVIES.filter(m=>(filter==='全部'||m.type===filter)&&(!q||[m.title,m.zh,m.type,m.year].join(' ').toLowerCase().includes(q))) }
function render(){ const list=visible(); $('#app').innerHTML=`<div class="sec-hd"><h2>${query?`搜索：${esc(query)}`:'精选开放电影'}</h2><span class="meta">共 ${list.length} 部 · 全部免费观看</span></div>${list.length?`<div class="grid">${list.map(m=>`<article class="card" data-id="${m.id}" tabindex="0"><div class="thumb"><span class="badge badge-hd">HD</span><img src="${m.poster}" alt="${esc(m.zh)}" loading="lazy"><span class="play-hint"><span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></span></div><div class="c-name">${esc(m.zh)} <small>${esc(m.title)}</small></div><div class="c-sub"><span class="c-cat">${m.type}</span><span>${m.year}</span><span class="free-tag">开放观看</span></div></article>`).join('')}</div>`:`<div class="state"><p>没有找到影片</p><small>换个关键词试试</small></div>`}<div class="license-note">片库仅收录 Blender Foundation / Blender Studio 开放电影。影片权利归各自创作者所有；请依据其项目页面标注的 Creative Commons 许可使用与传播。本站不接入未提供公开传播授权的第三方聚合片源。</div>` }
function play(id){ const m=MOVIES.find(x=>x.id===id); if(!m)return; $('#pTitle').textContent=`${m.zh} · ${m.title}`; $('#pDesc').textContent=`${m.year} · ${m.type} · ${m.time} — ${m.desc}`; const v=$('#video'); v.src=m.video; $('#pmask').hidden=false; document.body.style.overflow='hidden'; v.play().catch(()=>{}); }
function close(){ const v=$('#video'); v.pause(); v.removeAttribute('src'); v.load(); $('#pmask').hidden=true; document.body.style.overflow=''; }
document.addEventListener('click',e=>{ const cat=e.target.closest('.cat'); if(cat){filter=cat.dataset.cat;renderCats();render();return} const card=e.target.closest('.card'); if(card){play(card.dataset.id);return} if(e.target.closest('#pclose')||e.target===$('#pmask'))close(); if(e.target.closest('#clr')){$('#q').value='';query='';$('#clr').hidden=true;render()} });
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pmask').hidden)close(); const card=e.target.closest?.('.card'); if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();play(card.dataset.id)}});
$('#searchForm').addEventListener('submit',e=>{e.preventDefault();query=$('#q').value;$('#clr').hidden=!query;render()});
$('#q').addEventListener('input',e=>{$('#clr').hidden=!e.target.value;if(!e.target.value){query='';render()}});
renderCats();render();
