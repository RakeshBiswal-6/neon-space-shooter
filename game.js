(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const scoreEl = $("score"), bestEl = $("best"), livesEl = $("lives"), waveEl = $("wave");
  const overlay = $("overlay"), titleEl = $("overlay-title"), copyEl = $("overlay-copy");
  const kickerEl = $("overlay-kicker"), startBtn = $("start-btn"), statusEl = $("status-text");
  const W = canvas.width, H = canvas.height;
  const keys = new Set();
  let state = "ready", score = 0, lives = 3, wave = 1, best = 0;
  let player, bullets = [], enemies = [], enemyBullets = [], particles = [], stars = [];
  let lastTime = 0, spawnTimer = 0, fireTimer = 0, enemyFireTimer = 0, frame = 0;
  let touchLeft = false, touchRight = false, touchFire = false;
  try { best = Number(localStorage.getItem("neonStrikeBest") || 0); } catch (_) {}
  bestEl.textContent = format(best);
  $("year").textContent = new Date().getFullYear();

  function format(n) { return String(Math.max(0, n)).padStart(6, "0"); }
  function reset() {
    score = 0; lives = 3; wave = 1;
    player = { x: W / 2, y: H - 58, w: 34, h: 30, speed: 360, invuln: 0 };
    bullets = []; enemies = []; enemyBullets = []; particles = [];
    spawnTimer = .5; fireTimer = 0; enemyFireTimer = 1.2;
    updateHud();
  }
  function updateHud() {
    scoreEl.textContent = format(score);
    bestEl.textContent = format(best);
    livesEl.textContent = Array.from({length:3},(_,i)=>i<lives?"♥":"·").join(" ");
    waveEl.textContent = String(wave).padStart(2,"0");
  }
  function start() {
    reset(); state = "playing"; overlay.classList.add("hidden");
    $("pause-indicator").classList.add("hidden"); statusEl.textContent = "MISSION IN PROGRESS";
  }
  function endGame() {
    state = "over"; statusEl.textContent = "MISSION COMPLETE";
    if (score > best) { best = score; try { localStorage.setItem("neonStrikeBest", String(best)); } catch (_) {} }
    updateHud(); kickerEl.textContent = "MISSION REPORT";
    titleEl.innerHTML = "GAME <span>OVER.</span>";
    copyEl.textContent = `You scored ${format(score)} points. ${score >= best ? "New personal best — excellent flying!" : "Ready for another run?"}`;
    startBtn.innerHTML = "PLAY AGAIN <span>→</span>"; overlay.classList.remove("hidden");
  }
  function togglePause() {
    if (state === "playing") { state = "paused"; $("pause-indicator").classList.remove("hidden"); statusEl.textContent = "PAUSED"; }
    else if (state === "paused") { state = "playing"; $("pause-indicator").classList.add("hidden"); statusEl.textContent = "MISSION IN PROGRESS"; }
  }
  function addBurst(x,y,color,count=12) {
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*180;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.45,max:.8,color,size:1+Math.random()*3});}
  }
  function spawnEnemy() {
    const type = Math.random() < .23 ? "heavy" : "scout";
    const size = type === "heavy" ? 24 : 17;
    enemies.push({x:30+Math.random()*(W-60),y:-30,w:size*1.5,h:size,speed:(type==="heavy"?75:105)+wave*8,hp:type==="heavy"?2:1,type,phase:Math.random()*6.2});
  }
  function shoot() {
    bullets.push({x:player.x,y:player.y-19,vy:-510});
    addBurst(player.x,player.y-20,"#54f6ff",3);
  }
  function hit(a,b) { return Math.abs(a.x-b.x)<(a.w+b.w)*.42 && Math.abs(a.y-b.y)<(a.h+b.h)*.42; }
  function damagePlayer() {
    if(player.invuln>0) return;
    lives--; player.invuln=1.25; addBurst(player.x,player.y,"#ff4fd8",24); updateHud();
    if(lives<=0) endGame();
  }
  function update(dt) {
    frame++;
    if(state!=="playing") return;
    const left=keys.has("ArrowLeft")||keys.has("a")||keys.has("A")||touchLeft;
    const right=keys.has("ArrowRight")||keys.has("d")||keys.has("D")||touchRight;
    const firing=keys.has(" ")||touchFire;
    if(left) player.x-=player.speed*dt;
    if(right) player.x+=player.speed*dt;
    player.x=Math.max(22,Math.min(W-22,player.x));
    player.invuln=Math.max(0,player.invuln-dt);
    fireTimer-=dt;
    if(firing&&fireTimer<=0){shoot();fireTimer=.19;}
    spawnTimer-=dt;
    if(spawnTimer<=0){spawnEnemy();spawnTimer=Math.max(.34,1.05-wave*.055)+Math.random()*.35;}
    enemyFireTimer-=dt;
    if(enemyFireTimer<=0&&enemies.length){const e=enemies[Math.floor(Math.random()*enemies.length)];enemyBullets.push({x:e.x,y:e.y+12,vy:180+wave*9});enemyFireTimer=Math.max(.38,1.35-wave*.06);}
    bullets.forEach(b=>b.y+=b.vy*dt); bullets=bullets.filter(b=>b.y>-20);
    enemyBullets.forEach(b=>b.y+=b.vy*dt); enemyBullets=enemyBullets.filter(b=>b.y<H+20);
    enemies.forEach(e=>{e.y+=e.speed*dt;e.x+=Math.sin(frame*.025+e.phase)*35*dt;});
    for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];
      if(e.y>H+25){enemies.splice(i,1);damagePlayer();continue;}
      if(hit(e,player)){enemies.splice(i,1);addBurst(e.x,e.y,"#ff4fd8",18);damagePlayer();continue;}
      for(let j=bullets.length-1;j>=0;j--){if(hit(e,bullets[j])){bullets.splice(j,1);e.hp--;if(e.hp<=0){score+=e.type==="heavy"?30:10;addBurst(e.x,e.y,e.type==="heavy"?"#ff4fd8":"#a88aff",16);enemies.splice(i,1);updateHud();}break;}}
    }
    for(let i=enemyBullets.length-1;i>=0;i--){if(hit(enemyBullets[i],player)){enemyBullets.splice(i,1);damagePlayer();}}
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy*=.98;p.life-=dt;});
    particles=particles.filter(p=>p.life>0);
    if(score>=wave*150){wave++;updateHud();}
  }
  function drawShip(x,y) {
    ctx.save();ctx.translate(x,y);
    ctx.shadowBlur=22;ctx.shadowColor="#54f6ff";
    ctx.fillStyle="#54f6ff";ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(16,13);ctx.lineTo(5,9);ctx.lineTo(0,15);ctx.lineTo(-5,9);ctx.lineTo(-16,13);ctx.closePath();ctx.fill();
    ctx.shadowBlur=8;ctx.fillStyle="#f5ffff";ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
    ctx.fillStyle="#ff4fd8";ctx.shadowColor="#ff4fd8";ctx.shadowBlur=14;ctx.fillRect(-3,14,6,Math.random()*9+5);
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save();ctx.translate(e.x,e.y);ctx.shadowBlur=18;ctx.shadowColor=e.type==="heavy"?"#ff4fd8":"#a783ff";
    ctx.fillStyle=e.type==="heavy"?"#ff4fd8":"#9b72ff";ctx.beginPath();ctx.moveTo(0,15);ctx.lineTo(18,-10);ctx.lineTo(7,-7);ctx.lineTo(0,-15);ctx.lineTo(-7,-7);ctx.lineTo(-18,-10);ctx.closePath();ctx.fill();
    ctx.fillStyle="#fff";ctx.fillRect(-3,-3,6,4);ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    const grad=ctx.createRadialGradient(W/2,H/2,10,W/2,H/2,520);grad.addColorStop(0,"#111735");grad.addColorStop(1,"#050716");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    for(let i=0;i<95;i++){const x=(i*137.5)%W,y=(i*83+frame*(i%3+1)*.25)%H;ctx.fillStyle=i%8===0?"#54f6ff88":"#d9e4ff66";ctx.fillRect(x,y,i%8===0?2:1,i%8===0?2:1);}
    ctx.strokeStyle="#54f6ff0b";ctx.lineWidth=1;for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    bullets.forEach(b=>{ctx.save();ctx.shadowColor="#54f6ff";ctx.shadowBlur=15;ctx.fillStyle="#b9fcff";ctx.fillRect(b.x-2,b.y-9,4,15);ctx.restore();});
    enemyBullets.forEach(b=>{ctx.save();ctx.shadowColor="#ff4fd8";ctx.shadowBlur=13;ctx.fillStyle="#ff83e5";ctx.fillRect(b.x-3,b.y-4,6,10);ctx.restore();});
    enemies.forEach(drawEnemy);
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;});
    if(player&&(state==="playing"||state==="paused")){if(player.invuln<=0||Math.floor(frame/5)%2===0)drawShip(player.x,player.y);}
    ctx.fillStyle="#54f6ff";ctx.font="10px Orbitron";ctx.fillText("SECTOR 07 // DEEP SPACE",18,24);
    ctx.fillStyle="#ff4fd877";ctx.fillText("RB-06",W-58,24);
  }
  function loop(t) {const dt=Math.min((t-lastTime)/1000||0,.033);lastTime=t;update(dt);draw();requestAnimationFrame(loop);}
  startBtn.addEventListener("click",()=>{kickerEl.textContent="PERSONAL ARCADE // 001";titleEl.innerHTML="THE GALAXY<br><span>NEEDS YOU.</span>";copyEl.textContent="Destroy the incoming drones and survive as long as you can.";startBtn.innerHTML="START MISSION <span>→</span>";start();});
  window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==="p"&&!e.repeat)togglePause();if(e.key==="Enter"&&(state==="ready"||state==="over"))startBtn.click();});
  window.addEventListener("keyup",e=>keys.delete(e.key));
  window.addEventListener("blur",()=>{keys.clear();if(state==="playing")togglePause();});
  function holdButton(id,setter){const el=$(id);el.addEventListener("pointerdown",e=>{e.preventDefault();setter(true);});["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>setter(false)));}
  holdButton("left-btn",v=>touchLeft=v);holdButton("right-btn",v=>touchRight=v);holdButton("fire-btn",v=>touchFire=v);
  reset();requestAnimationFrame(loop);
})();
