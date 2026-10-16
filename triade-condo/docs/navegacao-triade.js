(()=>{
const root=document.documentElement;
try{root.dataset.theme=localStorage.getItem('triade-theme')||'light'}catch{root.dataset.theme='light'}
const theme=document.querySelector('.theme-switch');
function label(){theme.textContent=root.dataset.theme==='dark'?'☀ Tema claro':'☾ Tema escuro';theme.setAttribute('aria-label',theme.textContent)}label();
theme.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('triade-theme',root.dataset.theme)}catch{}label()});
const sidebar=document.querySelector('.app-sidebar'),menu=document.querySelector('.menu-toggle');
menu.addEventListener('click',()=>{const open=sidebar.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(open))});
const links=[...sidebar.querySelectorAll('a[href^="#"]')];
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');const target=document.getElementById(a.hash.slice(1));if(target){history.replaceState(null,'',a.hash);target.scrollIntoView({behavior:'instant',block:'start'});}}));
const sections=[...document.querySelectorAll('section[aria-labelledby]')];
const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){links.forEach(a=>{const active=a.hash==='#'+e.target.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}},{rootMargin:'-90px 0px -65% 0px'});sections.forEach(s=>observer.observe(s));
const search=document.querySelector('#section-search'),results=document.querySelector('.search-results');
search.addEventListener('input',()=>{results.replaceChildren();const q=search.value.trim().toLocaleLowerCase('pt-BR');results.hidden=!q;if(!q)return;const found=sections.filter(s=>s.textContent.toLocaleLowerCase('pt-BR').includes(q));found.forEach(s=>{const a=document.createElement('a');a.href='#'+s.id;a.textContent=s.querySelector('h2').textContent;a.addEventListener('click',()=>{results.hidden=true;search.value='';s.setAttribute('tabindex','-1');s.focus({preventScroll:true})});results.append(a)});if(!found.length)results.textContent='Nenhuma seção encontrada.'});
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))results.hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape'){results.hidden=true;sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false')}});
})();