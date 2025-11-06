// js/app.js — Go-Back-N ARQ Visual Simulator (Light Theme, Strict UI, Final)
// By: Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai

(function () {
  // --------- Mount root ---------
  let root = document.getElementById("app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }

  // --------- UI scaffold (light theme) ---------
  root.innerHTML = `
    <header class="glass" style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);padding:14px 16px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h1 style="margin:0 0 4px;color:#0b1e2b;font-size:24px">Go-Back-N ARQ — Visual Simulator</h1>
      <p style="margin:0 0 8px;color:#314a5a">Sliding window up to N. Timeout → retransmit from base. ACKs only after arrival.</p>
      <p style="margin:0 0 8px;color:#0b1e2b;font-weight:700">Guide: Dr. Swaminathan Annadurai</p>

      <div class="controls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="12">
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

        <label id="wrapSpecific" class="hidden">Specific frames (comma)
          <input id="specificFrames" type="text" placeholder="e.g. 2,7,9">
        </label>

        <label id="wrapEveryK" class="hidden">k (every k-th)
          <input id="everyK" type="number" min="1" value="3">
        </label>

        <label>Frame Delay Mode
          <select id="frameDelayMode">
            <option value="none">None</option>
            <option value="specific">Delay specific frame(s)</option>
            <option value="everyk">Delay every k-th</option>
          </select>
        </label>

        <label id="wrapDelaySpec" class="hidden">Delay frame # / k
          <input id="frameDelaySpec" type="text" placeholder="e.g. 5 or 3">
        </label>

        <label id="wrapDelayMs" class="hidden">Frame delay (ms)
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

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button id="startBtn">Start</button>
        <button id="pauseBtn">Pause</button>
        <button id="stepBtn">Step</button>
        <button id="resetBtn">Reset</button>
      </div>
    </header>

    <section class="glass" style="background:rgba(255,255,255,.65);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <div class="sim-area" style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:12px;align-items:start">
        <div class="lane">
          <h3 style="margin:0 0 6px;color:#0b1e2b">Sender</h3>
          <div id="senderWindow" class="window"></div>
          <div id="senderQueue" class="queue"></div>
        </div>

        <div class="channel glass" style="background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:6px;position:relative;height:480px">
          <svg id="liveSvg" width="100%" height="100%" style="position:absolute;inset:0;"></svg>
          <div id="channelStage" style="position:absolute;inset:0;"></div>
        </div>

        <div class="lane">
          <h3 style="margin:0 0 6px;color:#0b1e2b">Receiver</h3>
          <div id="recvArea" class="recv"></div>
        </div>
      </div>
    </section>

    <section class="glass" style="background:rgba(255,255,255,.6);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h3 style="text-align:center;margin:0 0 6px;color:#0b1e2b">Event Log</h3>
      <div id="events" class="log" style="height:170px;overflow:auto;font-family:ui-monospace,monospace;color:#324a59"></div>
    </section>

    <section class="glass hidden" id="statsWrap" style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h3 style="text-align:center;margin:0 0 10px;color:#0b1e2b">📊 Simulation Results</h3>
      <div class="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div class="stat-card"><div class="stat-label">Total original frames</div><div class="stat-value" id="stat_totalFrames">0</div></div>
        <div class="stat-card"><div class="stat-label">Total transmissions</div><div class="stat-value" id="stat_totalTrans">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames delivered</div><div class="stat-value" id="stat_delivered">0</div></div>
        <div class="stat-card"><div class="stat-label">Total ACKs generated</div><div class="stat-value" id="stat_totalAcks">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames lost</div><div class="stat-value" id="stat_framesLost">0</div></div>
        <div class="stat-card"><div class="stat-label">ACKs lost</div><div class="stat-value" id="stat_acksLost">0</div></div>
        <div class="stat-card">
          <div class="stat-label">Efficiency</div>
          <div class="stat-value" id="stat_efficiency">0%</div>
          <div class="eff-bar" style="height:6px;background:#e6f4ef;border-radius:999px;margin-top:6px"><div id="eff_fill" style="height:6px;width:0%;background:#1faa8a;border-radius:999px"></div></div>
        </div>
        <div class="stat-card"><div class="stat-label">Loss percent</div><div class="stat-value" id="stat_lossPercent">0%</div></div>
      </div>

      <div style="margin-top:12px">
        <h4 style="margin:0 0 6px;color:#3e5566">Flow Diagram (<span id="diagramModeLabel">Vertical two-columns</span>)</h4>
        <div id="diagramHost" class="glass" style="padding:10px;background:rgba(255,255,255,.65);border:1px solid rgba(0,0,0,.06);border-radius:12px"></div>
      </div>
    </section>

    <footer style="text-align:center;color:#3e5566;margin:16px 0 20px">
      Created by <b>Sunesh Krishnan N</b> & <b>Aravind G</b> | Guided by <b>Dr. Swaminathan Annadurai</b>
    </footer>
  `;

  // --------- Input styling (always readable) ---------
  document.querySelectorAll(".controls input, .controls select, .controls span").forEach(el=>{
    if(el.tagName === "SPAN") return;
    el.style.background = "rgba(255,255,255,.95)";
    el.style.color = "#0b1e2b";
    el.style.border = "1px solid rgba(0,0,0,.2)";
    el.style.padding = "6px 8px";
    el.style.borderRadius = "10px";
    el.style.width = "100%";
    el.style.boxSizing = "border-box";
    el.style.opacity = "1";
  });

  // --------- Shorthand refs ---------
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), wrapSpecific = $("#wrapSpecific"), specificFramesEl = $("#specificFrames");
  const wrapEveryK = $("#wrapEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), wrapDelaySpec = $("#wrapDelaySpec"), wrapDelayMs = $("#wrapDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const simModeEl = $("#simMode");
  const diagramTypeEl = $("#diagramType"), diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), liveSvg = $("#liveSvg"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // --------- STRICT conditional UI logic ---------
  function showStrictUI() {
    // Loss mode
    const lm = lossModeEl.value;
    wrapSpecific.classList.toggle("hidden", lm !== "specific");
    wrapEveryK.classList.toggle("hidden", lm !== "everyk");

    // Delay mode
    const dm = frameDelayModeEl.value;
    const on = dm !== "none";
    wrapDelaySpec.classList.toggle("hidden", !on);
    wrapDelayMs.classList.toggle("hidden", !on);
  }
  function updateDiagramLabel(){
    const map = { vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay" };
    diagramModeLabel.textContent = map[diagramTypeEl.value] || "Vertical two-columns";
  }
  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", showStrictUI);
  frameDelayModeEl.addEventListener("change", showStrictUI);
  diagramTypeEl.addEventListener("change", updateDiagramLabel);

  // --------- Small helpers ---------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = t => !t?[]:t.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const setTxt = (sel, txt) => { const n=document.querySelector(sel); if(n) n.textContent=txt; };
  const log = m => events.prepend(Object.assign(document.createElement("div"), { textContent: `[${new Date().toLocaleTimeString()}] ${m}` }));

  // --------- State (true GBN) ---------
  let N, timeout, lossProb, ackLossProb;
  let base, nextSeq, seqLimit;
  let running=false, paused=false, timer=null;

  const record = new Map(); // seq -> {sentCount, delivered, acked}

  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0,
    framesDelivered: 0
  };
  const diagram = { frames: [], acks: [] }; // for summary

  // --------- Geometry for live view ---------
  function endpoints(seq){
    const cont = liveSvg.getBoundingClientRect();
    const width = cont.width || 800;
    const leftX = 22, rightX = Math.max(140, width - 22 - 96);
    const baseY = 90 + (seq % 6) * 58;

    if (simModeEl.value === "vertical") {
      return {
        frameStart:{x:leftX, y:baseY}, frameEnd:{x:rightX, y:baseY},
        ackStart:{x:rightX, y:baseY-14}, ackEnd:{x:leftX, y:baseY-14}
      };
    }
    return { // textbook
      frameStart:{x:leftX, y:baseY}, frameEnd:{x:rightX, y:baseY+16},
      ackStart:{x:rightX, y:baseY},  ackEnd:{x:leftX, y:baseY-2}
    };
  }

  // --------- SVG drawing + packet motion ---------
  function drawLineAnimated(svg, x1,y1,x2,y2, color, dashed, durMs){
    const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",x1); ln.setAttribute("y1",y1);
    ln.setAttribute("x2",x2); ln.setAttribute("y2",y2);
    ln.setAttribute("stroke", color); ln.setAttribute("stroke-width","3");
    if(dashed) ln.setAttribute("stroke-dasharray","10 7");
    svg.appendChild(ln);
    const len = Math.hypot(x2-x1,y2-y1);
    ln.setAttribute("stroke-dasharray",`${len}`); ln.setAttribute("stroke-dashoffset",`${len}`);
    ln.style.transition = `stroke-dashoffset ${durMs}ms ease`;
    requestAnimationFrame(()=> ln.setAttribute("stroke-dashoffset","0"));
    return ln;
  }
  function mkPacket(text, cls, pos){
    const p=document.createElement("div");
    p.className=cls; p.textContent=text;
    p.style.position="absolute"; p.style.left=pos.x+"px"; p.style.top=pos.y+"px"; p.style.opacity="0";
    channelStage.appendChild(p); return p;
  }
  function animateMove(elm, a, b, ms){
    elm.style.opacity="1";
    return new Promise(res=>{
      const s=performance.now();
      (function step(t){
        const k=Math.min(1,(t-s)/ms);
        const e = k<0.5 ? 2*k*k : -1+(4-2*k)*k;
        elm.style.left = (a.x+(b.x-a.x)*e) + "px";
        elm.style.top  = (a.y+(b.y-a.y)*e) + "px";
        if(k<1) requestAnimationFrame(step); else res();
      })(s);
    });
  }

  // --------- Probabilities ---------
  function shouldLoseFrame(seq){
    const m = lossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < lossProb;
    if(m==="specific") return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(everyKEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }
  function shouldDelayFrame(seq){
    const m = frameDelayModeEl.value;
    if(m==="none") return false;
    if(m==="specific") return parseNums(frameDelaySpecEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(frameDelaySpecEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }

  // --------- Engine constants (≈5s cycle) ---------
  const DOWN_MS = 2000, PROC_MS = 600, ACK_MS = 2000;

  // --------- Timer helpers ---------
  function startTimer(){ clearTimer(); timer = setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }

  // --------- Init ---------
  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    base = 0; nextSeq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||12, 1, 300);
    running = false; paused = false; clearTimer();
    record.clear();

    Object.assign(stats, { totalFrames:seqLimit, totalTrans:0,totalAcks:0,framesLost:0,acksLost:0,framesDelayed:0,framesDelivered:0 });
    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML = ""; senderQueue.innerHTML = ""; recvArea.innerHTML = "";
    liveSvg.innerHTML = ""; events.innerHTML = ""; statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    for(let i=0;i<N;i++){
      const d=document.createElement("div"); d.className="frame"; d.textContent=(i<seqLimit)?`#${i}`:"-";
      d.style.background="rgba(0,0,0,.04)"; d.style.border="1px solid rgba(0,0,0,.12)"; d.style.padding="6px 8px"; d.style.borderRadius="10px"; d.style.marginBottom="6px";
      senderWindow.appendChild(d);
    }

    showStrictUI();
    updateDiagramLabel();
    log("Ready — true Go-Back-N. Pick your options and Start.");
  }

  // --------- Timeout (GBN retransmit) ---------
  async function onTimeout(){
    if(!running) return;
    if(base < nextSeq){
      log(`Timeout at base ${base} — retransmit ${base}..${Math.min(nextSeq-1,seqLimit-1)} (GBN).`);
      for(let s=base; s<nextSeq; s++) await retransmitFrame(s);
      startTimer();
    }
  }

  function refreshWindow(){
    const slots=[...senderWindow.children];
    for(let i=0;i<slots.length;i++){
      const seq = base + i; const el=slots[i];
      el.textContent = seq<seqLimit?`#${seq}`:"-";
      const inflight = seq>=base && seq<nextSeq && seq<seqLimit;
      el.style.outline = inflight ? "2px solid rgba(31,170,138,.6)" : "none";
    }
  }

  async function pumpWindow(){
    while(running && !paused && nextSeq < base + N && nextSeq < seqLimit){
      await sendFrame(nextSeq);
      nextSeq++; refreshWindow();
      if(base === nextSeq-1) startTimer();
    }
  }

  // --------- SEND / RTX / ACK handling ---------
  async function sendFrame(seq){
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false }; rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    const badge=document.createElement("div"); badge.textContent=`F${seq}`; badge.className="packet";
    badge.style.cssText="display:inline-block;padding:4px 8px;background:#e9f7f4;border:1px solid #bfe8dd;border-radius:999px;margin:0 6px 6px 0;color:#0b1e2b";
    senderQueue.appendChild(badge);

    const geom = endpoints(seq);
    const delayed = shouldDelayFrame(seq);
    const extra = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed) stats.framesDelayed++;

    const lose = shouldLoseFrame(seq);
    drawLineAnimated(liveSvg, geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
                     lose ? "#ff6b6b" : "#00a3ad", lose, DOWN_MS + extra);

    const pkt = mkPacket(`F${seq}`,"packet", geom.frameStart);
    if(delayed){ pkt.style.filter="drop-shadow(0 0 6px #ffb703)"; }
    await animateMove(pkt, geom.frameStart, geom.frameEnd, DOWN_MS + extra);

    if(lose){
      pkt.style.opacity=".4"; pkt.style.background="#ffd6d6";
      log(`Frame ${seq} lost in channel.`);
      stats.framesLost++; diagram.frames.push({seq, delivered:false});
      await sleep(300); pkt.remove(); return;
    }

    pkt.remove(); diagram.frames.push({seq, delivered:true}); rec.delivered = true;
    await sleep(PROC_MS);
    await receiverHandle(seq, geom); // ACK strictly after arrival
  }

  async function retransmitFrame(seq){
    if(!running) return;
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false }; rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    const geom = endpoints(seq);
    const lose = shouldLoseFrame(seq);
    drawLineAnimated(liveSvg, geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
                     lose ? "#ff6b6b" : "#00a3ad", lose, DOWN_MS);

    const pkt = mkPacket(`F${seq}`,"packet", geom.frameStart);
    await animateMove(pkt, geom.frameStart, geom.frameEnd, DOWN_MS);

    if(lose){
      pkt.style.opacity=".4"; pkt.style.background="#ffd6d6";
      log(`(RTX) Frame ${seq} lost again.`);
      stats.framesLost++; diagram.frames.push({seq, delivered:false});
      await sleep(250); pkt.remove(); return;
    }

    pkt.remove(); diagram.frames.push({seq, delivered:true});
    await sleep(PROC_MS);
    await receiverHandle(seq, geom);
  }

  async function receiverHandle(seq, geom){
    const expected = recvArea.childElementCount;
    let ackNum;
    if(seq === expected){
      const ok=document.createElement("div");
      ok.className="frame"; ok.textContent=`#${seq}`;
      ok.style.cssText="background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.12);padding:6px 8px;border-radius:10px;margin-bottom:6px;outline:2px solid rgba(42,107,255,.35)";
      recvArea.appendChild(ok);
      stats.framesDelivered++; ackNum = seq;
      log(`Receiver accepted ${seq} → ACK ${ackNum}`);
    } else {
      ackNum = expected - 1;
      log(`Receiver discarded ${seq} (expected ${expected}) → ACK ${ackNum}`);
    }

    // ACK only after arrival:
    stats.totalAcks++;
    const ackLose = Math.random() < ackLossProb;
    drawLineAnimated(liveSvg, geom.ackStart.x, geom.ackStart.y, geom.ackEnd.x, geom.ackEnd.y,
                     "#2a6bff", ackLose, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));
    const ackPkt = mkPacket(`ACK${ackNum}`,"packet ack", geom.ackStart);
    ackPkt.style.background="#e8efff"; ackPkt.style.border="1px solid #c6d7ff";
    await animateMove(ackPkt, geom.ackStart, geom.ackEnd, ACK_MS + (parseInt(ackDelayMsEl.value,10)||0));

    if(ackLose){
      ackPkt.style.opacity=".4"; ackPkt.style.background="#e0e9ff";
      log(`ACK ${ackNum} lost — sender waits for timeout.`);
      stats.acksLost++; diagram.acks.push({seq:ackNum, delivered:false});
      await sleep(250); ackPkt.remove(); return;
    }

    ackPkt.remove(); diagram.acks.push({seq:ackNum, delivered:true});
    onAck(ackNum);
  }

  function onAck(ackNum){
    log(`Sender received cumulative ACK ${ackNum}.`);
    if(ackNum >= base){
      base = ackNum + 1;
      refreshWindow();
      if(base === nextSeq) clearTimer(); else startTimer();
      pumpWindow();
      if(base >= seqLimit) finish();
    }
  }

  // --------- Summary diagram ---------
  function finish(){
    running=false; clearTimer(); log("Simulation complete — composing summary…");
    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered/trans)*100;
    const loss = (stats.framesLost/trans)*100;

    setTxt("#stat_totalFrames", stats.totalFrames);
    setTxt("#stat_totalTrans", stats.totalTrans);
    setTxt("#stat_delivered", delivered);
    setTxt("#stat_totalAcks", stats.totalAcks);
    setTxt("#stat_framesLost", stats.framesLost);
    setTxt("#stat_acksLost", stats.acksLost);
    setTxt("#stat_efficiency", eff.toFixed(2)+"%");
    setTxt("#stat_lossPercent", loss.toFixed(2)+"%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    diagramHost.innerHTML = "";
    const mode = diagramTypeEl.value;
    const lbl = {vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay"}[mode] || "Vertical two-columns";
    diagramModeLabel.textContent = lbl;
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);
    statsWrap.classList.remove("hidden");
  }

  function renderDiagram(host, diag, rows, mode){
    if(mode==="vertical" || mode==="animated") return renderVertical(host, diag, rows, mode==="animated");
    return renderTextbook(host, diag, rows, mode==="animated");
  }

  function svgEl(w,h){ const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("viewBox",`0 0 ${w} ${h}`); s.setAttribute("width","100%"); s.setAttribute("height",h); return s; }
  function vline(x,y1,y2,c){ const l=line(x,y1,x,y2,c,2); l.setAttribute("opacity",".6"); return l; }
  function hline(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); l.setAttribute("opacity",".95"); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function seg(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function nodeCircle(x,y,t){ const g=ns("g"); const c=cir(x,y,6); c.setAttribute("fill","rgba(0,0,0,0)"); c.setAttribute("stroke","rgba(0,0,0,.35)"); const tx=txt(x-26,y-10,"#0b1e2b",12,t); g.appendChild(c); g.appendChild(tx); return g; }
  function nodeRect(x,y,t){ const g=ns("g"); const r=rect(x-20,y-12,40,24,6); r.setAttribute("fill","rgba(0,0,0,.05)"); r.setAttribute("stroke","rgba(0,0,0,.2)"); const tx=txt(x-15,y+4,"#0b1e2b",12,t); g.appendChild(r); g.appendChild(tx); return g; }
  function label(x,y,txtc){ return txt(x,y,"#0b1e2b",14,txtc,true); }
  function dash(l,i){ const len=Math.hypot(l.x2.baseVal.value-l.x1.baseVal.value,l.y2.baseVal.value-l.y1.baseVal.value); l.setAttribute("stroke-dasharray",`${len}`); l.setAttribute("stroke-dashoffset",`${len}`); l.style.animation=`drawline .9s ${i*0.12}s ease forwards`; l.parentNode.appendChild(styleOnce()); }
  function styleOnce(){ const st=ns("style"); st.textContent=`@keyframes drawline{to{stroke-dashoffset:0}}`; return st; }
  const ns = n=>document.createElementNS("http://www.w3.org/2000/svg", n);
  function cir(cx,cy,r){ const c=ns("circle"); c.setAttribute("cx",cx); c.setAttribute("cy",cy); c.setAttribute("r",r); return c; }
  function rect(x,y,w,h,rx){ const r=ns("rect"); r.setAttribute("x",x); r.setAttribute("y",y); r.setAttribute("width",w); r.setAttribute("height",h); r.setAttribute("rx",rx); return r; }
  function txt(x,y,fill,size,txtc,bold){ const t=ns("text"); t.setAttribute("x",x); t.setAttribute("y",y); t.setAttribute("fill",fill); t.setAttribute("font-size",size); if(bold) t.setAttribute("font-weight","700"); t.textContent=txtc; return t; }
  function line(x1,y1,x2,y2,c,w){ const l=ns("line"); l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2); l.setAttribute("stroke",c); l.setAttribute("stroke-width",w); return l; }

  function renderVertical(host, diag, rows, animated){
    const w = host.clientWidth || 900, gap = 60, h = Math.max(240, rows*gap+60);
    const pad = 110, L=pad, R=w-pad, svg=svgEl(w,h);
    svg.appendChild(vline(L,30,h-30,"#0b1e2b"));
    svg.appendChild(vline(R,30,h-30,"#0b1e2b"));
    svg.appendChild(label(L-25,20,"Sender"));
    svg.appendChild(label(R-35,20,"Receiver"));
    for(let i=0;i<rows;i++){ const y=40+i*gap; svg.appendChild(nodeCircle(L,y,`#${i}`)); svg.appendChild(nodeCircle(R,y,`#${i}`)); }
    let idx=0;
    diag.frames.forEach(f=>{ const y=40+f.seq*gap; const ln=hline(L,y,R,y,f.delivered?"#00a3ad":"#ff6b6b",f.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    diag.acks.forEach(a=>{ const y=40+Math.max(0,a.seq)*gap-12; const ln=hline(R,y,L,y,"#2a6bff",a.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    host.appendChild(svg);
  }

  function renderTextbook(host, diag, rows, animated){
    const w = host.clientWidth || 900, gap = 60, h = Math.max(240, rows*gap+60);
    const pad = 90, L=pad, R=w-pad, svg=svgEl(w,h);
    svg.appendChild(label(L-25,20,"Sender"));
    svg.appendChild(label(R-35,20,"Receiver"));
    for(let i=0;i<rows;i++){ const y=40+i*gap; svg.appendChild(nodeRect(L,y,`#${i}`)); svg.appendChild(nodeRect(R,y,`#${i}`)); }
    let idx=0;
    diag.frames.forEach(f=>{ const y=40+f.seq*gap; const ln=seg(L,y,R,y+16,f.delivered?"#00a3ad":"#ff6b6b",f.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    diag.acks.forEach(a=>{ const y=40+Math.max(0,a.seq)*gap-12; const ln=seg(R,y+16,L,y,"#2a6bff",a.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    host.appendChild(svg);
  }

  // --------- Controls ---------
  startBtn.addEventListener("click", async ()=>{
    if(running) return;
    running=true; paused=false;
    log(`Started — mode: ${simModeEl.value}`);
    await pumpWindow();
  });

  pauseBtn.addEventListener("click", ()=>{ paused=true; log("Paused."); });

  stepBtn.addEventListener("click", async ()=>{
    if(running) return;
    running=true; paused=false;
    if(nextSeq < base + N && nextSeq < seqLimit){
      await sendFrame(nextSeq); nextSeq++; refreshWindow();
      if(base === nextSeq-1) startTimer();
    } else {
      log("Step: window full or finished.");
    }
    running=false;
  });

  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // --------- Boot ---------
  init();
})();
