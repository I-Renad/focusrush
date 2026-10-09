(function(){
  const DURATION = 60;
  const $ = id => document.getElementById(id);
  const arena = $('arena');
  const COLORS = {blue:'أزرق', yellow:'أصفر', red:'أحمر'};
  const SHAPES = {circle:'دائرة', square:'مربع', triangle:'مثلث'};
  const NAMES = {circle:{blue:'الدوائر الزرقاء',yellow:'الدوائر الصفراء',red:'الدوائر الحمراء'},
                 square:{blue:'المربعات الزرقاء',yellow:'المربعات الصفراء',red:'المربعات الحمراء'},
                 triangle:{blue:'المثلثات الزرقاء',yellow:'المثلثات الصفراء',red:'المثلثات الحمراء'}};
  const TARGETS = [{s:'circle',c:'blue'},{s:'square',c:'yellow'},{s:'triangle',c:'red'}];
  const SPAWN = [950, 720, 560];


  // ---- Sound (Web Audio, no files) ----
  let actx=null, muted=false;
  try{ muted = localStorage.getItem('focusrush_muted')==='1' }catch(e){}
  function tone(f,d,type,vol,delay){
    if(muted||!actx) return;
    const t=actx.currentTime+(delay||0), o=actx.createOscillator(), g=actx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(vol||0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+d);
  }
  const SFX={
    ok:()=>{tone(660,.12,'sine',.18);tone(880,.12,'sine',.15,.06)},
    bonus:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.18,'triangle',.18,i*.07)),
    bad:()=>{tone(160,.25,'sawtooth',.12);tone(120,.25,'sawtooth',.1,.08)},
    ping:()=>{tone(740,.15,'sine',.15);tone(740,.15,'sine',.15,.18)},
    begin:()=>[392,523,659].forEach((f,i)=>tone(f,.15,'square',.08,i*.09)),
    end:()=>[784,659,523,392].forEach((f,i)=>tone(f,.22,'triangle',.16,i*.14)),
    win:()=>[523,659,784,1047,1318].forEach((f,i)=>tone(f,.2,'triangle',.17,i*.1))
  };
  function initAudio(){
    try{ if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume() }catch(e){}
  }
  const muteBtn=document.getElementById('mute');
  function paintMute(){ muteBtn.textContent = muted?'🔇':'🔊' }
  muteBtn.onclick=()=>{ initAudio(); muted=!muted; try{localStorage.setItem('focusrush_muted',muted?'1':'0')}catch(e){}; paintMute(); if(!muted) SFX.ok() };
  paintMute();

  let st = null; // game state; null when no round is running
  let timers = [];

  function loadBest(){ try{ return +localStorage.getItem('focusrush_best')||0 }catch(e){ return 0 } }
  function saveBest(v){ try{ localStorage.setItem('focusrush_best', String(v)) }catch(e){} }
  function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on', s.id===id)) }
  function refreshBest(){ const b=loadBest(); $('bestStart').textContent = b ? 'أفضل نتيجة: '+b : '' }

  function shapeEl(s,c,cls){ const e=document.createElement('span'); e.className='sh '+cls+' '+c+' '+(s==='triangle'?'triangle':s==='circle'?'circle':''); return e }

  function setGoal(flash){
    const t = st.target, g = $('goal');
    g.innerHTML = '';
    g.appendChild(shapeEl(t.s,t.c,''));
    g.append('اجمع '+NAMES[t.s][t.c]+' فقط');
    if(flash){ g.classList.add('flash'); setTimeout(()=>g.classList.remove('flash'),900) }
  }

  function startGame(){
    initAudio(); SFX.begin();
    clearAll();
    st = {score:0, streak:0, correct:0, wrong:0, rts:[], level:1, start:performance.now(), target:TARGETS[0], lastSwitch:0};
    arena.innerHTML='';
    $('score').textContent=0; $('time').textContent=DURATION; $('level').textContent=1; $('barFill').style.width='100%';
    show('game'); setGoal(false);
    timers.push(setInterval(tick,100));
    scheduleSpawn();
  }

  function clearAll(){ timers.forEach(t=>{clearInterval(t);clearTimeout(t)}); timers=[] }

  function tick(){
    if(!st) return;
    const el = (performance.now()-st.start)/1000, left = Math.max(0, DURATION-el);
    $('time').textContent = Math.ceil(left);
    $('barFill').style.width = (left/DURATION*100)+'%';
    const lvl = el<20?1:el<40?2:3;
    if(lvl!==st.level){ SFX.ping(); st.level=lvl; $('level').textContent=lvl }
    // Level 3: target changes at 40s, then every 10s
    if(lvl===3){
      const slot = Math.floor((el-40)/10);
      if(slot!==st.lastSwitch){
        st.lastSwitch=slot;
        let n; do{ n=TARGETS[Math.floor(Math.random()*3)] }while(n===st.target);
        st.target=n; setGoal(true); SFX.ping();
      }
    }
    if(left<=0) endGame();
  }

  function scheduleSpawn(){
    if(!st) return;
    spawn();
    timers.push(setTimeout(scheduleSpawn, SPAWN[st.level-1]*(0.8+Math.random()*0.4)));
  }

  function spawn(){
    const t = st.target, lvl = st.level;
    const isTarget = Math.random() < 0.4;
    let s,c;
    if(isTarget){ s=t.s; c=t.c }
    else{
      // Level 1: only 2 simple distractor types; higher levels: any other combination
      let pool = [];
      Object.keys(SHAPES).forEach(a=>Object.keys(COLORS).forEach(b=>{ if(!(a===t.s&&b===t.c)) pool.push({s:a,c:b}) }));
      if(lvl===1) pool = TARGETS.filter(x=>x!==t);
      const p = pool[Math.floor(Math.random()*pool.length)]; s=p.s; c=p.c;
    }
    const d = document.createElement('div');
    d.className='shape';
    const inner = shapeEl(s,c,'');
    inner.style.width=inner.style.height='100%';
    if(s==='square') inner.style.borderRadius='6px';
    d.appendChild(inner);
    const w=arena.clientWidth-58, h=arena.clientHeight-58;
    d.style.left=Math.random()*Math.max(w,0)+'px';
    d.style.top=Math.random()*Math.max(h,0)+'px';
    const born=performance.now();
    d.addEventListener('pointerdown', ev=>{
      ev.preventDefault();
      if(!st || d.dataset.done) return; // block clicks after round ends
      d.dataset.done=1;
      const ok = (s===st.target.s && c===st.target.c);
      hit(ok, performance.now()-born, ev, d);
      d.remove();
    });
    arena.appendChild(d);
    timers.push(setTimeout(()=>d.remove(), 2200-(lvl-1)*250));
  }

  function hit(ok, rt, ev, el){
    let pts;
    if(ok){
      st.correct++; st.streak++; st.rts.push(rt); pts=10;
      if(st.streak%5===0){ pts+=25; SFX.bonus() } else SFX.ok();
    } else { st.wrong++; st.streak=0; pts=-5; SFX.bad() }
    st.score += pts;
    $('score').textContent = st.score;
    const fx=document.createElement('div');
    fx.className='fx'; fx.textContent=(pts>0?'+':'')+pts;
    fx.style.color = ok?'var(--yellow)':'var(--red)';
    fx.style.left=el.style.left; fx.style.top=el.style.top;
    arena.appendChild(fx); setTimeout(()=>fx.remove(),700);
  }

  function endGame(){
    const r = st; st = null; clearAll(); arena.innerHTML='';
    const total = r.correct + r.wrong;
    const best = loadBest(), isNew = r.score > best;
    if(isNew) saveBest(r.score);
    $('rScore').textContent = r.score;
    $('rBest').textContent = Math.max(best, r.score);
    $('rAcc').textContent = total ? Math.round(r.correct/total*100)+'%' : '—';
    $('rWrong').textContent = r.wrong;
    $('rRt').textContent = r.rts.length ? Math.round(r.rts.reduce((a,b)=>a+b,0)/r.rts.length)+' ms' : '—';
    $('newbest').textContent = isNew && r.score>0 ? 'رقم قياسي جديد!' : '';
    if(isNew && r.score>0) SFX.win(); else SFX.end();
    show('end');
  }

  $('startBtn').onclick = startGame;
  $('againBtn').onclick = startGame;
  $('menuBtn').onclick = ()=>{ refreshBest(); show('start') };
  refreshBest();
})();
