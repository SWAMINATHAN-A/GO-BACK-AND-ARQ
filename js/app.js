// js/app.js — Go-Back-N ARQ Visual Simulator (Final True ARQ)
// By: Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai

(function () {
  const root = document.getElementById("app");

  // --------- UI cleanup (remove Pause/Step) ---------
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stepBtn = document.getElementById("stepBtn");
  if (pauseBtn) pauseBtn.remove();
  if (stepBtn) stepBtn.remove();

  // --------- Utility functions ---------
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const parseNums = t => !t ? [] : t.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  const log = m => $("#events").prepend(Object.assign(document.createElement("div"), { textContent: `[${new Date().toLocaleTimeString()}] ${m}` }));

  // --------- Element refs ---------
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossModeEl = $("#lossMode"), specificFramesEl = $("#specificFrames"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackDelayMsEl = $("#ackDelayMs");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), liveSvg = $("#liveSvg"), statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // --------- Simulation state ---------
  let N, timeout, lossProb, ackLossProb;
  let base, nextSeq, seqLimit;
  let running = false, timer = null;
  const record = new Map();
  const stats = { totalFrames: 0, totalTrans: 0, totalAcks: 0, framesLost: 0, acksLost: 0, framesDelivered: 0 };
  const diagram = { frames: [], acks: [] };

  // --------- Visual helpers ---------
  function endpoints(seq) {
    const cont = liveSvg.getBoundingClientRect();
    const width = cont.width || 800;
    const leftX = 40, rightX = Math.max(160, width - 100);
    const baseY = 100 + (seq % 6) * 60;
    return {
      frameStart: { x: leftX, y: baseY },
      frameEnd: { x: rightX, y: baseY },
      ackStart: { x: rightX, y: baseY - 16 },
      ackEnd: { x: leftX, y: baseY - 16 }
    };
  }

  function drawLine(x1, y1, x2, y2, color, dashed, ms) {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", x1); ln.setAttribute("y1", y1);
    ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
    ln.setAttribute("stroke", color); ln.setAttribute("stroke-width", "3");
    if (dashed) ln.setAttribute("stroke-dasharray", "10 7");
    liveSvg.appendChild(ln);
    const len = Math.hypot(x2 - x1, y2 - y1);
    ln.setAttribute("stroke-dasharray", len);
    ln.setAttribute("stroke-dashoffset", len);
    ln.style.transition = `stroke-dashoffset ${ms}ms ease`;
    requestAnimationFrame(() => ln.setAttribute("stroke-dashoffset", "0"));
  }

  function packet(label, color, pos) {
    const d = document.createElement("div");
    d.className = "pkt travel";
    d.textContent = label;
    d.style.position = "absolute";
    d.style.left = pos.x + "px";
    d.style.top = pos.y + "px";
    d.style.background = color;
    d.style.width = "38px";
    d.style.height = "38px";
    d.style.borderRadius = "50%";
    d.style.display = "grid";
    d.style.placeItems = "center";
    d.style.color = "#fff";
    d.style.fontWeight = "600";
    d.style.fontSize = "14px";
    d.style.opacity = "0";
    channelStage.appendChild(d);
    return d;
  }

  function movePacket(el, a, b, ms) {
    el.style.opacity = "1";
    return new Promise(resolve => {
      const start = performance.now();
      function step(t) {
        const k = Math.min(1, (t - start) / ms);
        const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
        el.style.left = a.x + (b.x - a.x) * e + "px";
        el.style.top = a.y + (b.y - a.y) * e + "px";
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // --------- Probabilities ---------
  function shouldLoseFrame(seq) {
    const mode = lossModeEl.value;
    if (mode === "none") return false;
    if (mode === "random") return Math.random() < lossProb;
    if (mode === "specific") return parseNums(specificFramesEl.value).includes(seq);
    if (mode === "everyk") {
      const k = parseInt(everyKEl.value, 10) || 1;
      return ((seq + 1) % k) === 0;
    }
    return false;
  }

  // --------- Timer / Reset ---------
  function startTimer() { clearTimer(); timer = setTimeout(onTimeout, timeout); }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function init() {
    N = clamp(parseInt(winSizeEl.value, 10) || 4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value, 10) || 6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value, 10) || 0) / 100;
    ackLossProb = (parseInt(ackLossPercentEl.value, 10) || 0) / 100;
    seqLimit = clamp(parseInt(numFramesEl.value, 10) || 12, 1, 300);

    base = 0; nextSeq = 0; running = false;
    clearTimer(); record.clear();

    Object.assign(stats, { totalFrames: seqLimit, totalTrans: 0, totalAcks: 0, framesLost: 0, acksLost: 0, framesDelivered: 0 });
    senderWindow.innerHTML = ""; senderQueue.innerHTML = ""; recvArea.innerHTML = "";
    liveSvg.innerHTML = ""; channelStage.innerHTML = ""; $("#events").innerHTML = "";
    statsWrap.classList.add("hidden"); diagramHost.innerHTML = "";
    log("Ready — Go-Back-N ARQ initialized.");
  }

  // --------- GBN logic ---------
  async function sendFrame(seq) {
    stats.totalTrans++;
    const geom = endpoints(seq);
    const lost = shouldLoseFrame(seq);
    drawLine(geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y, lost ? "#ff4040" : "#00aaff", lost, 2500);
    const p = packet("F" + seq, lost ? "#ff4040" : "#007bff", geom.frameStart);
    await movePacket(p, geom.frameStart, geom.frameEnd, 2500);
    if (lost) {
      stats.framesLost++;
      p.remove();
      log(`Frame ${seq} lost in channel.`);
      return false;
    }
    p.remove();
    await receiveFrame(seq, geom);
    return true;
  }

  async function receiveFrame(seq, geom) {
    const expected = recvArea.childElementCount;
    let ackNum;
    if (seq === expected) {
      stats.framesDelivered++;
      const frameDiv = document.createElement("div");
      frameDiv.textContent = "#" + seq;
      frameDiv.style.cssText = "padding:6px 8px;margin-bottom:6px;border-radius:10px;background:#002244;color:#aee;";
      recvArea.appendChild(frameDiv);
      ackNum = seq;
      log(`Receiver accepted frame ${seq}, sent ACK ${ackNum}.`);
    } else {
      ackNum = expected - 1;
      log(`Receiver discarded frame ${seq}, sent ACK ${ackNum}.`);
    }

    stats.totalAcks++;
    const ackLost = Math.random() < ackLossProb;
    drawLine(geom.ackStart.x, geom.ackStart.y, geom.ackEnd.x, geom.ackEnd.y, ackLost ? "#ff6b6b" : "#00cc88", ackLost, 2000);
    const ack = packet("A" + ackNum, ackLost ? "#ff6b6b" : "#00cc88", geom.ackStart);
    await movePacket(ack, geom.ackStart, geom.ackEnd, 2000);
    ack.remove();
    if (ackLost) {
      stats.acksLost++;
      log(`ACK ${ackNum} lost.`);
      return;
    }
    handleAck(ackNum);
  }

  function handleAck(ackNum) {
    if (ackNum >= base) {
      base = ackNum + 1;
      if (base === nextSeq) clearTimer();
      else startTimer();
    }
  }

  async function pumpWindow() {
    while (running && base < seqLimit) {
      while (nextSeq < base + N && nextSeq < seqLimit) {
        sendFrame(nextSeq);
        nextSeq++;
      }
      await sleep(6000);
    }
    finish();
  }

  async function onTimeout() {
    log(`Timeout! Retransmitting from frame ${base} onward.`);
    for (let i = base; i < nextSeq; i++) {
      await sendFrame(i);
    }
    startTimer();
  }

  // --------- Summary ---------
  function finish() {
    running = false;
    clearTimer();
    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered / trans) * 100;
    $("#stat_totalFrames").textContent = stats.totalFrames;
    $("#stat_totalTrans").textContent = stats.totalTrans;
    $("#stat_delivered").textContent = stats.framesDelivered;
    $("#stat_totalAcks").textContent = stats.totalAcks;
    $("#stat_framesLost").textContent = stats.framesLost;
    $("#stat_acksLost").textContent = stats.acksLost;
    $("#stat_efficiency").textContent = eff.toFixed(2) + "%";
    $("#eff_fill").style.width = `${Math.max(0, Math.min(100, eff))}%`;
    $("#stat_lossPercent").textContent = ((stats.framesLost / trans) * 100).toFixed(2) + "%";
    statsWrap.classList.remove("hidden");
    log("Simulation complete.");
  }

  // --------- Controls ---------
  startBtn.addEventListener("click", async () => {
    if (running) return;
    running = true;
    log("Simulation started.");
    pumpWindow();
  });

  resetBtn.addEventListener("click", () => {
    init();
    log("Simulation reset.");
  });

  init();
})();
