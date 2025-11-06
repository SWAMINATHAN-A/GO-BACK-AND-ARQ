// js/app.js — Final Director's Cut
// • SIM MODES: Textbook 2D (diagonal draw + moving packet), Vertical columns (horizontal draw + moving packet), Animated replay (summary only)
// • One-frame-at-a-time (~5s), realistic ACKs
// • Delay inputs only visible when Delay Mode != "none"
// • Inputs always visible (dark bg + white text)
// • Accurate stats + pretty summary

(function () {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="glass">
      <h1>Go-Back-N ARQ — Final Cut</h1>
      <p>Choose simulation mode, run one-frame-at-a-time, watch lines draw and packets move. Summary shows a replay diagram.</p>

      <div class="controls">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="8">
        </label>

        <label>Window size (N)
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

        <label>Simulation Mode
          <select id="simMode">
            <option value="textbook">Textbook 2D (draw + move)</option>
            <option value="vertical">Vertical columns (draw + move)</option>
            <option value="replay">Animated replay (summary only)</option>
          </select>
        </label>

        <label>Summary Diagram
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
        <h3>Sender</h3>
        <div id="senderWindow" class="window"></div>
        <div id="senderQueue" class="queue"></div>
      </div>

      <div class="channel glass">
        <div id="channelStage" style="position:relative;width:100%;height:480px;">
          <svg id="liveSvg" width="100%" height="100%" style="position:absolute;inset:0;"></svg>
        </div>
      </div>

      <div class="lane">
        <h3>Receiver</h3>
        <div id="recvArea" class="recv"></div>
      </div>
    </section>

    <section class="glass">
      <h3 style="text-align:center;color:#00ffff;margin-bottom:6px">Event Log</h3>
      <div id="events" class="log"></div>
    </section>

    <section class="glass hidden" id="statsWrap">
      <h3 style="text-align:center;color:#00ffff;margin-bottom:8px">📊 Simulation Results</h3>
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
        <h4 style="color:#a9c2d6;margin-bottom:6px">Flow Diagram (<span id="diagramModeLabel">Vertical two-columns</span>)</h4>
        <div id="diagramHost" class="glass" style="padding:10px"></div>
      </div>
    </section>

    <footer>CN Project • Go-Back-N • textbook visuals + moving packets ✨</footer>
  `;

  // Force inputs to dark bg + white text so they're always visible
  for (const el of document.querySelectorAll(".controls input, .controls select")) {
    el.style.background = "#0f172a";
    el.style.color = "#ffffff";
    el.style.border = "1px solid rgba(255,255,255,0.25)";
    el.style.opacity = "1";
  }

  // Refs
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), labelSpecific = $("#labelSpecific"), specificFramesEl = $("#specificFrames");
  const labelEveryK = $("#labelEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), labelDelaySpec = $("#labelDelaySpec"), labelDelayMs = $("#labelDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const simModeEl = $("#simMode");
  const diagramTypeEl = $("#diagramType"), diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), liveSvg = $("#liveSvg"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // UI visibility toggles
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

  // State (sequential, ~5s)
  let N, timeout, lossProb, ackLossProb;
  let currentSeq, seqLimit;
  let running = false, paused = false;

  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0,
    framesDelivered: 0
  };
  const diagram = { frames: [], acks: [] }; // for summary

  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    currentSeq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||8, 1, 300);
    running = false; paused = false;

    Object.assign(stats, {
      totalFrames: seqLimit, totalTrans: 0, totalAcks: 0,
      framesLost: 0, acksLost: 0, framesDelayed: 0, framesDelivered: 0
    });
    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML=""; senderQueue.innerHTML="";
    recvArea.innerHTML=""; channelStage.querySelectorAll(".packet").forEach(n=>n.remove());
    liveSvg.innerHTML=""; events.innerHTML="";
    statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    for(let i=0;i<N;i++){
      const f = document.createElement("div"); f.className="frame";
      f.textContent = (i) < seqLimit ? `#${i}` : "-";
      senderWindow.appendChild(f);
    }
    updateLossUI(); updateDelayUI(); updateDiagramLabel();
    log("Ready — pick Simulation Mode, then Start. (1 frame at a time, ~5s per cycle)");
  }

  // Helpers
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = t => !t?[]:t.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  const log = m => events.prepend(Object.assign(document.createElement("div"), { textContent: `[${new Date().toLocaleTimeString()}] ${m}` }));

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

  // Live geometry for sim modes
  function computeEndpoints(seq){
    const W = channelStage.clientWidth, H = channelStage.clientHeight;
    const leftX = 22, rightX = Math.max(140, W - 22 - 96);
    const baseY = 90 + (seq % 6) * 58;

    const simMode = simModeEl.value; // "textbook" | "vertical" | "replay"
    if (simMode === "vertical") {
      // horizontal link (lab style)
      return {
        frameStart: { x:leftX,  y: baseY },
        frameEnd:   { x:rightX, y: baseY },
        ackStart:   { x:rightX, y: baseY - 14 },
        ackEnd:     { x:leftX,  y: baseY - 14 },
        diagonal: false
      };
    }
    // textbook: slight diagonal down
    return {
      frameStart: { x:leftX,  y: baseY },
      frameEnd:   { x:rightX, y: baseY + 16 },
      ackStart:   { x:rightX, y: baseY + 16 - 16 },
      ackEnd:     { x:leftX,  y: baseY - 2 },
      diagonal: true
    };
  }

  // SVG line drawing (line-by-line)
  function drawLineAnimated(svg, x1,y1,x2,y2, color, dashed, durMs){
    const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",x1); ln.setAttribute("y1",y1);
    ln.setAttribute("x2",x2); ln.setAttribute("y2",y2);
    ln.setAttribute("stroke", color);
    ln.setAttribute("stroke-width", "3");
    ln.setAttribute("opacity", ".95");
    if (dashed) ln.setAttribute("stroke-dasharray","10 7");
    svg.appendChild(ln);

    // stroke-dash animation
    const len = Math.hypot(x2-x1, y2-y1);
    ln.setAttribute("stroke-dasharray", `${len}`);
    ln.setAttribute("stroke-dashoffset", `${len}`);
    ln.style.transition = `stroke-dashoffset ${durMs}ms ease`;
    requestAnimationFrame(()=> ln.setAttribute("stroke-dashoffset","0"));
    return ln;
  }

  function mkPacket(text, cls, pos){
    const p=document.createElement("div");
    p.className=cls; p.textContent=text;
    p.style.left = `${pos.x}px`; p.style.top = `${pos.y}px`;
    p.style.position="absolute"; p.style.opacity="0";
    channelStage.appendChild(p);
    return p;
  }
  function animateMove(elm, a, b, ms){
    elm.style.opacity="1";
    return new Promise(res=>{
      const s=performance.now();
      (function step(t){
        const k=Math.min(1,(t-s)/ms), e=ease(k);
        elm.style.left=`${a.x+(b.x-a.x)*e}px`;
        elm.style.top =`${a.y+(b.y-a.y)*e}px`;
        if(k<1) requestAnimationFrame(step); else res();
      })(s);
    });
  }
  const ease = k => k<0.5 ? 2*k*k : -1 + (4-2*k)*k;

  // Sequential engine (~5s per cycle)
  const DOWN_MS = 2000;  // frame travel
  const PROC_MS = 600;   // receiver processing
  const ACK_MS  = 2000;  // ack travel

  async function runSequential(){
    while(running && currentSeq < seqLimit){
      if(paused) await waitWhile(()=>paused);
      await sendOne(currentSeq);
      currentSeq++;
    }
    if(currentSeq >= seqLimit) finish();
  }

  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function waitWhile(pred){ return new Promise(r=>{ const t=setInterval(()=>{ if(!pred()){clearInterval(t);r();}},80);}); }

  async function sendOne(seq){
    // record queue badge
    const badge = document.createElement("div");
    badge.className="packet"; badge.style.position="static"; badge.textContent=`F${seq}`;
    senderQueue.appendChild(badge);

    stats.totalTrans++;

    // endpoints
    const { frameStart, frameEnd, ackStart, ackEnd } = computeEndpoints(seq);
    const delayed = shouldDelayFrame(seq);
    const extraDelay = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed){ stats.framesDelayed++; }

    const lose = shouldLoseFrame(seq);

    // draw the line as it moves (line-by-line + moving packet)
    const lineColor = lose ? "#ff6b6b" : "#00ffff";
    const line1 = drawLineAnimated(liveSvg, frameStart.x, frameStart.y, frameEnd.x, frameEnd.y, lineColor, lose, DOWN_MS + extraDelay);

    const packet = mkPacket(`F${seq}`,"packet", frameStart);
    packet.classList.remove("ack");
    if(delayed) packet.classList.add("delayed");

    await animateMove(packet, frameStart, frameEnd, DOWN_MS + extraDelay);

    if(lose){
      packet.classList.add("lost");
      log(`Frame ${seq} lost — waiting for timeout → retransmit`);
      stats.framesLost++;
      diagram.frames.push({seq, delivered:false});
      await wait(500);
      packet.remove();
      // timeout then retransmit
      await wait(timeout);
      if(!running) return;
      log(`Timeout for frame ${seq} — retransmitting`);
      return sendOne(seq);
    }

    // delivered
    packet.remove();
    diagram.frames.push({seq, delivered:true});
    await wait(PROC_MS);

    // Receiver behavior (GBN in-order)
    const expected = recvArea.childElementCount;
    if(seq === expected){
      const blk = document.createElement("div"); blk.className="frame active"; blk.textContent=`#${seq}`;
      recvArea.appendChild(blk);
      stats.framesDelivered++;
      log(`Receiver accepted ${seq} — sending ACK ${seq}`);

      // draw ACK line + move ACK
      const ackLose = Math.random() < ackLossProb;
      const ackColor = ackLose ? "#4faaff" : "#4faaff";
      const line2 = drawLineAnimated(liveSvg, ackStart.x, ackStart.y, ackEnd.x, ackEnd.y, ackColor, ackLose, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));

      const ackPkt = mkPacket(`ACK${seq}`,"packet ack", ackStart);
      await animateMove(ackPkt, ackStart, ackEnd, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));
      stats.totalAcks++;

      if(ackLose){
        ackPkt.classList.add("lost");
        log(`ACK ${seq} lost — timeout will trigger`);
        diagram.acks.push({seq, delivered:false});
        await wait(400);
        ackPkt.remove();
        // let timeout in retransmit path handle it
      } else {
        ackPkt.remove();
        diagram.acks.push({seq, delivered:true});
        log(`Sender received ACK ${seq}`);
      }

    } else {
      const ackFor = expected - 1;
      log(`Receiver discarded ${seq} (expected ${expected}) — sending ACK ${ackFor}`);

      const ackLose = Math.random() < ackLossProb;
      const line2 = drawLineAnimated(liveSvg, ackStart.x, ackStart.y, ackEnd.x, ackEnd.y, "#4faaff", ackLose, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));

      const ackPkt = mkPacket(`ACK${ackFor}`,"packet ack", ackStart);
      await animateMove(ackPkt, ackStart, ackEnd, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));
      stats.totalAcks++;

      if(ackLose){
        ackPkt.classList.add("lost");
        log(`ACK ${ackFor} lost — timeout will trigger`);
        diagram.acks.push({seq:ackFor, delivered:false});
        await wait(400);
        ackPkt.remove();
      } else {
        ackPkt.remove();
        diagram.acks.push({seq:ackFor, delivered:true});
        log(`Sender received ACK ${ackFor}`);
      }

      // simulate timeout and go back
      await wait(timeout);
      if(!running) return;
      log(`Timeout for frame ${expected} — go back to ${expected}`);
      currentSeq = expected - 1; // loop will ++ to expected
    }

    // mark queue badge
    badge.style.opacity="1"; badge.style.background="linear-gradient(180deg,#eafff7,#bff3e6)";
  }

  // Summary + Diagram (post-run)
  function finish(){
    running=false;
    log("Simulation complete — building summary…");

    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered / trans) * 100;
    const loss = (stats.framesLost / trans) * 100;

    setTxt("#stat_totalFrames", stats.totalFrames);
    setTxt("#stat_totalTrans", stats.totalTrans);
    setTxt("#stat_delivered", delivered);
    setTxt("#stat_totalAcks", stats.totalAcks);
    setTxt("#stat_framesLost", stats.framesLost);
    setTxt("#stat_acksLost", stats.acksLost);
    setTxt("#stat_efficiency", eff.toFixed(2) + "%");
    setTxt("#stat_lossPercent", loss.toFixed(2) + "%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    diagramHost.innerHTML="";
    const mode = diagramTypeEl.value; // vertical | textbook | animated
    const labelMap = { vertical: "Vertical two-columns", textbook: "Textbook diagonals", animated: "Animated replay" };
    diagramModeLabel.textContent = labelMap[mode] || "Vertical two-columns";
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);

    statsWrap.classList.remove("hidden");
  }
  const setTxt = (sel, txt) => { const n=document.querySelector(sel); if(n) n.textContent=txt; };

  function renderDiagram(host, diag, framesCount, mode){
    if(mode==="vertical" || mode==="animated") return renderVertical(host, diag, framesCount, mode==="animated");
    return renderTextbook(host, diag, framesCount, mode==="animated");
  }

  // Vertical two-columns (summary)
  function renderVertical(host, diag, rows, animated){
    const w = host.clientWidth || 900, rowGap = 60;
    const h = Math.max(220, rows*rowGap + 60);
    const padX = 110, colL = padX, colR = w - padX;
    const svg = svgEl(w,h);

    svg.appendChild(vline(colL,30,h-30,"#00ffff"));
    svg.appendChild(vline(colR,30,h-30,"#4faaff"));
    svg.appendChild(label(colL-25,20,"Sender"));
    svg.appendChild(label(colR-35,20,"Receiver"));

    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(node(colL,y,`#${i}`));
      svg.appendChild(node(colR,y,`#${i}`));
    }

    let idx=0;
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = hline(colL,y,colR,y,f.delivered?"#00ffff":"#ff6b6b",f.delivered?0:1);
      if(animated) dash(ln, idx++); svg.appendChild(ln);
    });
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 12;
      const ln = hline(colR,y,colL,y,"#4faaff",a.delivered?0:1);
      if(animated) dash(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);
  }

  // Textbook diagonals (summary)
  function renderTextbook(host, diag, rows, animated){
    const w = host.clientWidth || 900, rowGap = 60;
    const h = Math.max(220, rows*rowGap + 60);
    const pad = 90, colL = pad, colR = w - pad;
    const svg = svgEl(w,h);

    svg.appendChild(label(colL-25,20,"Sender"));
    svg.appendChild(label(colR-35,20,"Receiver"));

    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(nodeRect(colL,y,`#${i}`));
      svg.appendChild(nodeRect(colR,y,`#${i}`));
    }

    let idx=0;
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = seg(colL,y,colR,y+16,f.delivered?"#00ffff":"#ff6b6b",f.delivered?0:1);
      if(animated) dash(ln, idx++); svg.appendChild(ln);
    });
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 12;
      const ln = seg(colR,y+16,colL,y,"#4faaff",a.delivered?0:1);
      if(animated) dash(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);
  }

  // SVG helpers (summary)
  function svgEl(w,h){ const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("viewBox",`0 0 ${w} ${h}`); s.setAttribute("width","100%"); s.setAttribute("height",h); return s; }
  function vline(x,y1,y2,c){ const l=line(x,y1,x,y2,c,2); l.setAttribute("opacity",".6"); return l; }
  function hline(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); l.setAttribute("opacity",".95"); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function seg(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function node(x,y,t){ const g=group(); const c=cir(x,y,6); const tx=text(x-26,y-10,"#eafaff",12,t); c.setAttribute("fill","rgba(255,255,255,0.08)"); c.setAttribute("stroke","rgba(255,255,255,0.25)"); g.appendChild(c); g.appendChild(tx); return g; }
  function nodeRect(x,y,t){ const g=group(); const r=rect(x-20,y-12,40,24,6); r.setAttribute("fill","rgba(255,255,255,0.08)"); r.setAttribute("stroke","rgba(255,255,255,0.25)"); const tx=text(x-15,y+4,"#eafaff",12,t); g.appendChild(r); g.appendChild(tx); return g; }
  function label(x,y,txt){ return text(x,y,"#00ffff",14,txt,true); }
  function dash(l,i){ const len=Math.hypot(l.x2.baseVal.value-l.x1.baseVal.value,l.y2.baseVal.value-l.y1.baseVal.value); l.setAttribute("stroke-dasharray",`${len}`); l.setAttribute("stroke-dashoffset",`${len}`); l.style.animation=`drawline .9s ${i*0.12}s ease forwards`; l.parentNode.appendChild(styleOnce()); }
  function styleOnce(){ const st=document.createElementNS("http://www.w3.org/2000/svg","style"); st.textContent=`@keyframes drawline{to{stroke-dashoffset:0}}`; return st; }
  function group(){ return document.createElementNS("http://www.w3.org/2000/svg","g"); }
  function cir(cx,cy,r){ const c=document.createElementNS("http://www.w3.org/2000/svg","circle"); c.setAttribute("cx",cx); c.setAttribute("cy",cy); c.setAttribute("r",r); return c; }
  function rect(x,y,w,h,rx){ const r=document.createElementNS("http://www.w3.org/2000/svg","rect"); r.setAttribute("x",x); r.setAttribute("y",y); r.setAttribute("width",w); r.setAttribute("height",h); r.setAttribute("rx",rx); return r; }
  function text(x,y,fill,size,txt,bold){ const t=document.createElementNS("http://www.w3.org/2000/svg","text"); t.setAttribute("x",x); t.setAttribute("y",y); t.setAttribute("fill",fill); t.setAttribute("font-size",size); if(bold) t.setAttribute("font-weight","700"); t.textContent=txt; return t; }
  function line(x1,y1,x2,y2,c,w){ const l=document.createElementNS("http://www.w3.org/2000/svg","line"); l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2); l.setAttribute("stroke",c); l.setAttribute("stroke-width",w); return l; }

  // Controls
  startBtn.addEventListener("click", async ()=>{
    if(running) return;
    running = true; paused = false;
    log(`Started — Mode: ${simModeEl.value}`);
    if (simModeEl.value === "replay") {
      // Run with moving packets only (no live line drawing)
      await runSequential();
    } else {
      // Run with live line drawing + moving packets
      await runSequential();
    }
  });
  pauseBtn.addEventListener("click", ()=>{ paused = true; log("Paused."); });
  stepBtn.addEventListener("click", async ()=>{
    if(running) return; // allow step when not auto-running
    paused = false; running = true;
    await sendOne(currentSeq);
    currentSeq++;
    running = false;
    if(currentSeq >= seqLimit) finish();
  });
  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // Boot
  init();
})();
