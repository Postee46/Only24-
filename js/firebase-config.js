const FILMES = [
  {id:1, titulo:"Vingadores: Ultimato", tipo:"filme", categoria:"Ação", ano:2019, nota:"8.4", img:"https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg", desc:"Os heróis tentam reverter o estalo de Thanos.", video:"https://www.youtube.com/embed/TcMBFSGVi1c"},
  {id:2, titulo:"Homem-Aranha: Sem Volta", tipo:"filme", categoria:"Ação", ano:2021, nota:"8.2", img:"https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg", desc:"Peter Parker pede ajuda ao Doutor Estranho.", video:"https://www.youtube.com/embed/JfVOs4VSpmA"},
  {id:3, titulo:"Batman", tipo:"filme", categoria:"Ação", ano:2022, nota:"7.7", img:"https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg", desc:"Batman investiga crimes em Gotham.", video:"https://www.youtube.com/embed/mqqft2x_Aa4"},
  {id:4, titulo:"Avatar 2", tipo:"filme", categoria:"Aventura", ano:2022, nota:"7.6", img:"https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg", desc:"Jake Sully e Neytiri protegem Pandora.", video:"https://www.youtube.com/embed/d9MyW72ELq0"},
  {id:5, titulo:"Top Gun: Maverick", tipo:"filme", categoria:"Ação", ano:2022, nota:"8.3", img:"https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg", desc:"Maverick volta para treinar novos pilotos.", video:"https://www.youtube.com/embed/qSqVVswa420"},
  {id:6, titulo:"Stranger Things", tipo:"serie", categoria:"Terror", ano:2016, nota:"8.7", img:"https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg", desc:"Crianças enfrentam o Mundo Invertido.", video:"https://www.youtube.com/embed/b9EkMc79ZSU"},
  {id:7, titulo:"La Casa de Papel", tipo:"serie", categoria:"Crime", ano:2017, nota:"8.2", img:"https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg", desc:"Um assalto perfeito à Casa da Moeda.", video:"https://www.youtube.com/embed/_InqQJRqGW4"},
  {id:8, titulo:"Round 6", tipo:"serie", categoria:"Drama", ano:2021, nota:"8.0", img:"https://image.tmdb.org/t/p/w500/dQb5Z9x3yq6yqS33g2uY5n4r0r.jpg", desc:"Jogos mortais por dinheiro.", video:"https://www.youtube.com/embed/oqxAJKy0ii4"},
  {id:9, titulo:"The Witcher", tipo:"serie", categoria:"Fantasia", ano:2019, nota:"8.0", img:"https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg", desc:"Geralt caça monstros.", video:"https://www.youtube.com/embed/ndl1W4ltcmg"},
  {id:10, titulo:"Wednesday", tipo:"serie", categoria:"Comédia", ano:2022, nota:"8.5", img:"https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20NpMygczOkv.jpg", desc:"Wednesday Addams na escola Nevermore.", video:"https://www.youtube.com/embed/Q73UhUTs6y0"},
  {id:11, titulo:"Duna: Parte 2", tipo:"filme", categoria:"Ficção", ano:2024, nota:"8.5", img:"https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", desc:"Paul Atreides une-se aos Fremen.", video:"https://www.youtube.com/embed/Way9Dexny3w"},
  {id:12, titulo:"Joker", tipo:"filme", categoria:"Drama", ano:2019, nota:"8.4", img:"https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg", desc:"A origem do Coringa em Gotham.", video:"https://www.youtube.com/embed/zAGVQLHvwOY"}
];

let favoritos = JSON.parse(localStorage.getItem('fav')||'[]');
let filtroAtual = 'todos';

function card(f){
  const fav = favoritos.includes(f.id) ? '❤️' : '🤍';
  return `<div class="card" onclick="abrir(${f.id})">
    <img src="${f.img}" onerror="this.src='https://via.placeholder.com/300x450/111/fff?text=${encodeURIComponent(f.titulo)}'">
    <div class="card-info"><h3>${f.titulo}</h3><p>${f.ano} • ⭐ ${f.nota} • ${f.categoria}</p><button onclick="event.stopPropagation();favToggle(${f.id})">${fav} Favoritar</button></div>
  </div>`;
}

function render(){
  const busca = (document.getElementById('searchInput')?.value||'').toLowerCase();
  let lista = FILMES.filter(f => {
    let ok = true;
    if(filtroAtual==='filme' && f.tipo!=='filme') ok=false;
    if(filtroAtual==='serie' && f.tipo!=='serie') ok=false;
    if(filtroAtual==='favoritos' && !favoritos.includes(f.id)) ok=false;
    if(busca && !f.titulo.toLowerCase().includes(busca)) ok=false;
    return ok;
  });
  let html = `<div class="filtros">
    <button onclick="setFiltro('todos')" class="${filtroAtual==='todos'?'active':''}">Todos</button>
    <button onclick="setFiltro('filme')" class="${filtroAtual==='filme'?'active':''}">🎬 Filmes</button>
    <button onclick="setFiltro('serie')" class="${filtroAtual==='serie'?'active':''}">📺 Séries</button>
    <button onclick="setFiltro('favoritos')" class="${filtroAtual==='favoritos'?'active':''}">❤️ Favoritos</button>
  </div>
  <h2>${filtroAtual==='favoritos'?'Teus Favoritos':filtroAtual==='filme'?'Filmes':filtroAtual==='serie'?'Séries':'🔥 Em Alta'}</h2>
  <div class="grid">${lista.map(card).join('') || '<p style="padding:20px">Nenhum filme encontrado.</p>'}</div>`;

  let main = document.getElementById('conteudo') || document.querySelector('main') || document.body;
  if(document.getElementById('conteudo')) document.getElementById('conteudo').innerHTML = html;
  else {
    let div = document.createElement('div'); div.id='conteudo'; div.innerHTML=html;
    document.body.appendChild(div);
  }
}

function setFiltro(f){ filtroAtual=f; render(); }
function favToggle(id){
  if(favoritos.includes(id)) favoritos=favoritos.filter(x=>x!==id);
  else favoritos.push(id);
  localStorage.setItem('fav', JSON.stringify(favoritos));
  render();
}
function abrir(id){
  let f = FILMES.find(x=>x.id===id);
  document.body.innerHTML += `<div id="modal" style="position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:999;padding:20px;overflow:auto">
    <button onclick="document.getElementById('modal').remove()" style="background:red;color:white;border:none;padding:10px 20px;border-radius:20px">✖ Fechar</button>
    <h2>${f.titulo}</h2><p>${f.ano} • ⭐ ${f.nota} • ${f.categoria}</p><p>${f.desc}</p>
    <iframe width="100%" height="300" src="${f.video}" frameborder="0" allowfullscreen></iframe>
    <br><br><button onclick="favToggle(${f.id});document.getElementById('modal').remove()" style="background:#e50914;color:white;border:none;padding:12px 20px;border-radius:20px">❤️ Favoritar</button>
  </div>`;
}
document.addEventListener('DOMContentLoaded', ()=>{
  let inp = document.getElementById('searchInput');
  if(inp) inp.addEventListener('input', render);
  let btn = document.querySelector('button');
  render();
});
window.setFiltro=setFiltro; window.favToggle=favToggle; window.abrir=abrir;
render();