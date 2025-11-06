// js/app.js — Stop-and-Study™ GBN (light theme, 1-frame-at-a-time, realistic ACKs)
// Features:
// - One frame at a time (teaching pace ~5s per send→ACK cycle)
// - Realistic ACKs (ACK launches only after frame reaches receiver)
// - Delay inputs only show when Delay Mode ≠ "None"
// - Diagram Type selector works: Vertical two-columns / Textbook diagonals / Animated replay
// - Always-visible dropdowns (forcefully styled so no hover weirdness)
// - Accurate stats + pretty summary

(function () {
  // Build UI (keeps your HTML minimal)
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="glass">
      <h1 style="color:#0b1e2b">Go-Back-N ARQ — Light Mode</h1>
      <p style="color:#3e5566">Sender (left) → Receiver (right). Single-frame cinematic flow. Summary after final ACK.</p>

      <div class="controls">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="8">
        </label>

        <label>Window size (N)  <!-- kept for syllabus, but we send sequentially -->
          <input id="winSize" type="number" min="1" max="32" value="4">
        </label>

        <label>Timeout (ms)
          <input id="timeout" type="number" min="2000" value="6000">
        </label>

        <label>Loss %
          <input id="lossPercent" type="range" min="0" max="80" value="15">
          <span id="lossPercentVal">15%</span>
        </label>

        <label>Frame Loss Mode
          <select id="lossMode">
            <option value="random">Random (by Loss %)</option>
            <option value="specific">Specific frame(s)</option>
            <option value="everyk">Every k-th</option>
            <option value="none">None</option>
          </select>
        </label>

        <label id="labelSpecific" class="hidden">Specific frames (comma)
          <input id="specificFrames" type="text" placeholder="e.g. 2,7,9">
        </label>

        <label id="labelEveryK" class="hidden">k (every k-th)
          <input id="everyK" type="number" min="1" value="3">
        </label>

        <label>Frame Delay Mode
          <select id="frameDelayMode">
            <option value="none">None</option>
            <option value="specific">Delay specific frame(s)</option>
            <option value="everyk">Delay every k-th</option>
          </select>
        </label>

        <label id="labelDelaySpec" class="hidden">Delay frame # / k
          <input id="frameDelaySpec" type="text" placeholder="e.g. 5 or 3,6">
        </label>

        <label id="labelDelayMs" class="hidden">Frame delay (ms)
          <input id="frameDelayMs" type="number" min="0" value="1200">
        </label>

        <label>ACK Loss %
          <input id="ackLossPercent" type="range" min="0" max="80" value="5">
          <span id="ackLossVal">5%</span>
        </label>

        <label>ACK Delay (ms)
          <input id="ackDelayMs" type="number" min="0" value="800">
        </label>

        <label>Diagram Type
          <select id="diagramType">
            <option value="vertical">Vertical two-columns</option>
            <option value="textbook">Textbook diagonals</option>
            <option value="animated">Animated replay</option>
          </select>
        </label>
      </div>

      <div class="buttons">
        <button id="startBtn">Start</button>
        <button id="pauseBtn">Pause</button>
        <button id="stepBtn">Step</button>
        <button id="resetBtn">Reset</button>
      </div>
    </header>

    <section class="glass sim-area">
      <div class="lane">
        <h3 style="color:#0b1e2b">Sender</h3>
        <div id="senderWindow" class="window"></div>
        <div id="senderQueue" class="queue"></div>
      </div>

      <div class="channel glass">
        <div id="channelStage"></div>
      </div>

      <div class="lane">
        <h3 style="color:#0b1e2b">Receiver</h3>
        <div id="recvArea" class="recv"></div>
      </div>
    </section>

    <section class="glass">
      <h3 style="text-align:center;color:#0b1e2b;margin-bottom:6px">Event Log</h3>
      <div id="events" class="log"></div>
    </section>

    <section class="glass hidden" id="statsWrap">
      <h3 style="text-align:center;color:#0b1e2b;margin-bottom:8px">📊 Simulation Results</h3>
      <div class="stats">
        <div class="stat-card"><div class="stat-label">Total original frames</div><div class="stat-value" id="stat_totalFrames">0</div></div>
        <div class="stat-card"><div class="stat-label">Total transmissions</div><div class="stat-value" id="stat_totalTrans">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames delivered</div><div class="stat-value" id="stat_delivered">0</div></div>
        <div class="stat-card"><div class="stat-label">Total ACKs generated</div><div class="stat-value" id="stat_totalAcks">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames lost</div><div class="stat-value" id="stat_framesLost">0</div></div>
        <div class="stat-card"><div class="stat-label">ACKs lost</div><div class="stat-value" id="stat_acksLost">0</div></div>
        <div class="stat-card">
          <div class="stat-label">Efficiency</div>
          <div class="stat-value" id="stat_efficiency">0%</div>
          <div class="eff-bar"><div id="eff_fill" class="eff-fill" style="width:0%"></div></div>
        </div>
        <div class="stat-card"><div class="stat-label">Loss percent (frames/transmissions)</div><div class="stat-value" id="stat_lossPercent">0%</div></div>
      </div>

      <div style="margin-top:12px">
        <h4 style="color:#3e5566;margin-bottom:6px">Flow Diagram (<span id="diagramModeLabel">Vertical two-columns</span>)</h4>
        <div id="diagramHost" class="glass" style="padding:10px"></div>
      </div>
    </section>

    <footer style="color:#3e5566;text-align:center">CN Project • Go-Back-N • light, realistic, cinematic ✨</footer>
  `;

  // ---------- Quick light styling for inputs/selects so they're always visible ----------
  Array.from(document.querySelectorAll(".controls input, .controls select")).forEach(el=>{
    el.style.background = "rgba(255,255,255,0.85)";
    el.style.color = "#0b1e2b";
    el.style.border = "1px solid rgba(0,0,0,0.15)";
    el.style.opacity = "1";
  });

  // ---------- Refs ----------
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), labelSpecific = $("#labelSpecific"), specificFramesEl = $("#specificFrames");
  const labelEveryK = $("#labelEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), labelDelaySpec = $("#labelDelaySpec"), labelDelayMs = $("#labelDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const diagramTypeEl = $("#diagramType"), diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // ---------- UI toggles (delay inputs + loss mode extras) ----------
  const updateLossUI = () => {
    const v = lossModeEl.value;
    labelSpecific.classList.toggle("hidden", v !== "specific");
    labelEveryK.classList.toggle("hidden", v !== "everyk");
  };
  const updateDelayUI = () => {
    const on = frameDelayModeEl.value !== "none";
    labelDelaySpec.classList.toggle("hidden", !on);
    labelDelayMs.classList.toggle("hidden", !on);
  };
  const updateDiagramLabel = () => {
    const map = { vertical: "Vertical two-columns", textbook: "Textbook diagonals", animated: "Animated replay" };
    diagramModeLabel.textContent = map[diagramTypeEl.value] || "Vertical two-columns";
  };

  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", updateLossUI);
  frameDelayModeEl.addEventListener("change", updateDelayUI);
  diagramTypeEl.addEventListener("change", updateDiagramLabel);

  // ---------- State (sequential mode) ----------
  let N, timeout, lossProb, ackLossProb;
  let currentSeq, seqLimit;
  let running = false, paused = false, timer = null;

  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0,
    framesDelivered: 0
  };

  const diagram = { frames: [], acks: [] }; // {seq, delivered}

  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32); // not used for send burst in this mode
    timeout = clamp(parseInt(timeoutEl.value,10)||6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    currentSeq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||8, 1, 300);
    running = false; paused = false; clearTimer();

    Object.assign(stats, {
      totalFrames: seqLimit, totalTrans: 0, totalAcks: 0,
      framesLost: 0, acksLost: 0, framesDelayed: 0, framesDelivered: 0
    });
    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML=""; senderQueue.innerHTML="";
    recvArea.innerHTML=""; channelStage.innerHTML="";
    events.innerHTML=""; statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    // Build sender "window" slots (informative)
    for(let i=0;i<N;i++){
      const f = document.createElement("div"); f.className="frame";
      f.textContent = (i) < seqLimit ? `#${i}` : "-";
      senderWindow.appendChild(f);
    }

    // Apply visibility on load
    updateLossUI(); updateDelayUI(); updateDiagramLabel();

    log("Ready — one-frame-at-a-time, realistic ACKs, ~5s per cycle.");
  }

  // ---------- Helpers ----------
  const $new = (t,c,txt)=>{ const e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e; };
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = txt => !txt?[]:txt.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  const log = msg => events.prepend($new("div", null, `[${new Date().toLocaleTimeString()}] ${msg}`));

  const shouldLoseFrame = seq => {
    const m = lossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < lossProb;
    if(m==="specific") return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(everyKEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  };
  const shouldDelayFrame = seq => {
    const m = frameDelayModeEl.value;
    if(m==="none") return false;
    const arr = parseNums(frameDelaySpecEl.value);
    if(m==="specific") return arr.includes(seq);
    if(m==="everyk"){ const k=parseInt(frameDelaySpecEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  };

  // ---------- Sequential engine ----------
  // Target ~5s: 2.0s down + 0.6s process + 2.0s up (plus user delays)
  const BASE_DOWN_MS = 2000;
  const BASE_PROC_MS = 600;
  const BASE_ACK_MS  = 2000;

  async function runSequential(){
    while(running && currentSeq < seqLimit){
      if(paused) { await waitWhile(()=>paused); if(!running) break; }
      await sendOne(currentSeq);
      currentSeq++;
    }
    if(currentSeq >= seqLimit){
      finish();
    }
  }

  function wait(ms){ return new Promise(res=>setTimeout(res,ms)); }
  function waitWhile(pred){ return new Promise(res=>{ const t=setInterval(()=>{ if(!pred()) {clearInterval(t); res();} }, 80); }); }

  async function sendOne(seq){
    // queue badge
    const badge = $new("div","packet","F"+seq); badge.style.position="static";
    senderQueue.appendChild(badge);

    stats.totalTrans++;

    // geometry (responsive)
    const W = channelStage.clientWidth, leftX = 18, rightX = Math.max(120, W - 18 - 90);
    const y = 90 + (seq % 6) * 56;
    const start = {x:leftX, y}, end = {x:rightX, y:y+36};

    // line + packet
    const line = mkLine(start,end,"neon-line");
    const p = mkPacket(`F${seq}`,"packet",start);
    channelStage.appendChild(line); channelStage.appendChild(p);

    // delay/loss
    const delayed = shouldDelayFrame(seq);
    const extraDelay = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed){ p.classList.add("delayed"); stats.framesDelayed++; }
    const lose = shouldLoseFrame(seq);

    // animate down (frame travel)
    await animatePromise(p, start, end, BASE_DOWN_MS + extraDelay);

    if(lose){
      p.classList.add("lost");
      line.classList.add("neon-line-lost");
      log(`Frame ${seq} lost → will timeout & retransmit`);
      stats.framesLost++;
      diagram.frames.push({seq, delivered:false});
      await wait(500);
      safeRemove(p); fade(line);
      // timeout → retransmit same seq
      await wait(timeout);
      if(!running) return;
      log(`Timeout for frame ${seq} — retransmitting`);
      return sendOne(seq); // retry same frame
    }

    // delivered to receiver
    safeRemove(p); fade(line);
    diagram.frames.push({seq, delivered:true});

    // receiver processes
    await wait(BASE_PROC_MS);

    // receiver behavior (GBN check in-order)
    const expected = recvArea.childElementCount;
    if(seq === expected){
      const blk=$new("div","frame active",`#${seq}`); recvArea.appendChild(blk);
      stats.framesDelivered++;
      log(`Receiver accepted ${seq} — sending ACK ${seq}`);
      await sendAck(seq, y+36);  // realistic: ACK starts now
    } else {
      const ackFor = expected - 1;
      log(`Receiver discarded ${seq} (expected ${expected}) — sending ACK ${ackFor}`);
      await sendAck(ackFor, y+36);
      // now timeout will hit and we’ll retransmit earlier seq; simulate by forcing timeout path:
      await wait(timeout);
      if(!running) return;
      log(`Timeout for frame ${expected} — retransmitting from ${expected}`);
      currentSeq = expected; // roll back to expected (GBN spirit)
    }

    // mark acked badge visually
    badge.style.opacity="1";
    badge.style.background="linear-gradient(180deg,#eafff7,#bff3e6)";
  }

  async function sendAck(ackSeq, baseY){
    stats.totalAcks++;
    const W = channelStage.clientWidth, leftX = 18, rightX = Math.max(120, W - 18 - 90);
    const start = {x:rightX, y:baseY}, end = {x:leftX, y:baseY-36};

    const line = mkLine(start,end,"neon-line neon-line-ack");
    const a = mkPacket(`ACK${ackSeq}`,"packet ack",start);
    channelStage.appendChild(line); channelStage.appendChild(a);

    const loseAck = Math.random() < ackLossProb;
    await animatePromise(a, start, end, BASE_ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));

    if(loseAck){
      a.classList.add("lost");
      line.classList.add("neon-dash");
      log(`ACK ${ackSeq} lost — timeout will trigger`);
      diagram.acks.push({seq:ackSeq, delivered:false});
      await wait(500);
      safeRemove(a); fade(line);
      // Let timeout handle retransmission in sendOne
      return;
    }

    safeRemove(a); fade(line);
    diagram.acks.push({seq:ackSeq, delivered:true});
    log(`Sender received ACK ${ackSeq}`);
  }

  // ---------- Anim helpers ----------
  function mkLine(a,b,cls){ const d=document.createElement("div"); d.className=cls||"neon-line"; placeLine(d,a,b); return d; }
  function placeLine(line,a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.sqrt(dx*dx+dy*dy), ang=Math.atan2(dy,dx)*180/Math.PI;
    line.style.width=`${len}px`; line.style.left=`${a.x}px`; line.style.top=`${a.y}px`;
    line.style.transform=`rotate(${ang}deg)`;
  }
  function mkPacket(text, cls, pos){ const p=document.createElement("div"); p.className=cls; p.textContent=text; p.style.left=`${pos.x}px`; p.style.top=`${pos.y}px`; return p; }
  function animatePromise(elm,a,b,ms){
    elm.style.opacity="1";
    return new Promise(res=>{
      const s=performance.now();
      (function step(t){
        const k=Math.min(1,(t-s)/ms), e=ease(k);
        elm.style.left=`${a.x+(b.x-a.x)*e}px`; elm.style.top=`${a.y+(b.y-a.y)*e}px`;
        if(k<1) requestAnimationFrame(step); else res();
      })(s);
    });
  }
  const ease = k => k<0.5 ? 2*k*k : -1 + (4-2*k)*k;
  const fade = el=>{ el.style.transition="opacity .45s"; el.style.opacity="0"; setTimeout(()=>safeRemove(el),470); };
  const safeRemove = el=>{ if(el && el.parentNode) el.parentNode.removeChild(el); };

  // ---------- Finish + Summary + Diagram ----------
  function finish(){
    running=false; clearTimer(); log("Simulation complete — composing summary…");

    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered / trans) * 100;
    const loss = (stats.framesLost / trans) * 100;

    setText("#stat_totalFrames", stats.totalFrames);
    setText("#stat_totalTrans", stats.totalTrans);
    setText("#stat_delivered", delivered);
    setText("#stat_totalAcks", stats.totalAcks);
    setText("#stat_framesLost", stats.framesLost);
    setText("#stat_acksLost", stats.acksLost);
    setText("#stat_efficiency", eff.toFixed(2) + "%");
    setText("#stat_lossPercent", loss.toFixed(2) + "%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    // render diagram per selection
    diagramHost.innerHTML="";
    const mode = diagramTypeEl.value; // vertical | textbook | animated
    const labelMap = { vertical: "Vertical two-columns", textbook: "Textbook diagonals", animated: "Animated replay" };
    diagramModeLabel.textContent = labelMap[mode] || "Vertical two-columns";
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);

    statsWrap.classList.remove("hidden");
  }
  const setText=(sel,txt)=>{const n=document.querySelector(sel); if(n) n.textContent=txt;};

  function renderDiagram(host, diag, framesCount, mode){
    if(mode==="vertical" || mode==="animated") return renderVertical(host, diag, framesCount, mode==="animated");
    return renderTextbook(host, diag, framesCount, mode==="animated");
  }

  // Vertical two-columns (exactly like you asked): two vertical rails + horizontal links
  function renderVertical(host, diag, rows, animated){
    const w = host.clientWidth || 900, rowGap = 60;
    const h = Math.max(220, rows*rowGap + 60);
    const padX = 110, colL = padX, colR = w - padX;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
    svg.setAttribute("width","100%"); svg.setAttribute("height",h);

    // rails
    svg.appendChild(vline(colL, 30, h-30, "#0b1e2b"));
    svg.appendChild(vline(colR, 30, h-30, "#0b1e2b"));
    svg.appendChild(label(colL-25, 20, "Sender"));
    svg.appendChild(label(colR-35, 20, "Receiver"));

    // nodes
    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(node(colL, y, `#${i}`));
      svg.appendChild(node(colR, y, `#${i}`));
    }

    // frame lines
    let idx=0;
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = hline(colL, y, colR, y, f.delivered ? "#00a3ad" : "#ff6b6b", f.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    // ack lines slightly above
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 12;
      const ln = hline(colR, y, colL, y, "#4faaff", a.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);

    function vline(x,y1,y2,color){
      const l = line(x,y1,x,y2,color,2); l.setAttribute("opacity",".55"); return l;
    }
    function hline(x1,y1,x2,y2,color,dashed){
      const l = line(x1,y1,x2,y2,color,3); l.setAttribute("opacity",".9");
      if(dashed) l.setAttribute("stroke-dasharray","10 7"); return l;
    }
    function node(x,y,t){
      const g = document.createElementNS(svgNS,"g");
      const c = document.createElementNS(svgNS,"circle");
      c.setAttribute("cx",x); c.setAttribute("cy",y); c.setAttribute("r","6");
      c.setAttribute("fill","rgba(0,0,0,0)"); c.setAttribute("stroke","rgba(0,0,0,0.35)");
      const tx = document.createElementNS(svgNS,"text");
      tx.setAttribute("x",x-26); tx.setAttribute("y",y-10); tx.setAttribute("fill","#0b1e2b");
      tx.setAttribute("font-size","12"); tx.textContent=t;
      g.appendChild(c); g.appendChild(tx); return g;
    }
    function label(x,y,txt){
      const t=document.createElementNS(svgNS,"text");
      t.setAttribute("x",x); t.setAttribute("y",y);
      t.setAttribute("fill","#0b1e2b"); t.setAttribute("font-size","14"); t.setAttribute("font-weight","700");
      t.textContent=txt; return t;
    }
    function line(x1,y1,x2,y2,color,wid){
      const l=document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x1); l.setAttribute("y1",y1);
      l.setAttribute("x2",x2); l.setAttribute("y2",y2);
      l.setAttribute("stroke",color); l.setAttribute("stroke-width",wid); return l;
    }
    function dashDraw(ln, idx){
      const len = Math.hypot(ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value);
      ln.setAttribute("stroke-dasharray", `${len}`); ln.setAttribute("stroke-dashoffset", `${len}`);
      ln.style.animation = `drawline 0.9s ${idx*0.14}s ease forwards`;
      const style = document.createElement("style"); style.textContent = `@keyframes drawline{to{stroke-dashoffset:0}}`;
      svg.appendChild(style);
    }
  }

  // Textbook diagonals renderer (light)
  function renderTextbook(host, diag, rows, animated){
    const w = host.clientWidth || 900, rowGap = 60;
    const h = Math.max(220, rows*rowGap + 60);
    const pad = 90, colL = pad, colR = w - pad;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`); svg.setAttribute("width","100%"); svg.setAttribute("height",h);

    svg.appendChild(label(colL-25, 20, "Sender"));
    svg.appendChild(label(colR-35, 20, "Receiver"));

    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(node(colL, y, `#${i}`));
      svg.appendChild(node(colR, y, `#${i}`));
    }

    let idx=0;
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = seg(colL, y, colR, y+14, f.delivered ? "#00a3ad" : "#ff6b6b", f.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 12;
      const ln = seg(colR, y+14, colL, y, a.delivered ? "#4faaff" : "#4faaff", a.delivered ? 0 : 1);
      if(!a.delivered) ln.setAttribute("stroke-dasharray","10 7");
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);

    function node(x,y,t){
      const g=document.createElementNS(svgNS,"g");
      const r=document.createElementNS(svgNS,"rect");
      r.setAttribute("x",x-20); r.setAttribute("y",y-12); r.setAttribute("width",40); r.setAttribute("height",24);
      r.setAttribute("rx",6); r.setAttribute("fill","rgba(0,0,0,0.05)"); r.setAttribute("stroke","rgba(0,0,0,0.2)");
      const tx=document.createElementNS(svgNS,"text");
      tx.setAttribute("x",x-15); tx.setAttribute("y",y+4); tx.setAttribute("fill","#0b1e2b"); tx.setAttribute("font-size","12"); tx.textContent=t;
      g.appendChild(r); g.appendChild(tx); return g;
    }
    function seg(x1,y1,x2,y2,color,dashed){
      const l=document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2);
      l.setAttribute("stroke",color); l.setAttribute("stroke-width","3"); l.setAttribute("opacity",".9");
      if(dashed) l.setAttribute("stroke-dasharray","10 7"); return l;
    }
    function label(x,y,txt){
      const t=document.createElementNS(svgNS,"text");
      t.setAttribute("x",x); t.setAttribute("y",y);
      t.setAttribute("fill","#0b1e2b"); t.setAttribute("font-size","14"); t.setAttribute("font-weight","700");
      t.textContent=txt; return t;
    }
    function dashDraw(ln, idx){
      const len = Math.hypot(ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value);
      ln.setAttribute("stroke-dasharray", `${len}`); ln.setAttribute("stroke-dashoffset", `${len}`);
      ln.style.animation = `drawdiag 0.9s ${idx*0.14}s ease forwards`;
      const style = document.createElement("style"); style.textContent = `@keyframes drawdiag{to{stroke-dashoffset:0}}`;
      svg.appendChild(style);
    }
  }

  // ---------- Controls ----------
  startBtn.addEventListener("click", async ()=>{
    if(running) return;
    paused = false; running = true;
    log("Started.");
    await runSequential();
  });

  pauseBtn.addEventListener("click", ()=>{
    paused = true; running = true;
    clearTimer();
    log("Paused.");
  });

  stepBtn.addEventListener("click", async ()=>{
    if(running) return;  // step only when not auto-running
    paused = false; running = true;
    await sendOne(currentSeq);
    currentSeq++;
    running = false;
    if(currentSeq >= seqLimit) finish();
  });

  resetBtn.addEventListener("click", ()=>{
    init(); log("Reset.");
  });

  // ---------- Timer (used only for retransmission waits in this sequential model) ----------
  function startTimer(cb, ms){ clearTimer(); timer = setTimeout(cb, ms); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }

  // ---------- Boot ----------
  init();
})();
