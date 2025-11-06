// Go-Back-N interactive simulator (client-side)
(() => {
  // UI refs
  const winSizeEl = document.getElementById('winSize');
  const timeoutEl = document.getElementById('timeout');
  const lossEl = document.getElementById('loss');
  const lossVal = document.getElementById('lossVal');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stepBtn = document.getElementById('stepBtn');
  const resetBtn = document.getElementById('resetBtn');
  const autoSendEl = document.getElementById('autoSend');

  const senderWindow = document.getElementById('senderWindow');
  const senderQueue = document.getElementById('senderQueue');
  const recvArea = document.getElementById('recvArea');
  const channel = document.getElementById('channel');
  const events = document.getElementById('events');

  // state
  let N = parseInt(winSizeEl.value,10);
  let timeout = parseInt(timeoutEl.value,10);
  let lossProb = parseInt(lossEl ? lossEl.value : 15,10)/100;
  let base = 0, nextseq = 0;
  let seqLimit = 20;
  let sentFrames = []; // objects: {seq, dom, timerId, acked}
  let mainTimer = null;
  let running = false;
  let autoSend = autoSendEl.checked;

  function log(msg){
    const d = document.createElement('div');
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    events.prepend(d);
  }

  function buildWindow(){
    senderWindow.innerHTML = '';
    for(let i=0;i<N;i++){
      const f = document.createElement('div');
      f.className = 'frame';
      f.dataset.idx = i;
      f.textContent = (base + i) < seqLimit ? `#${base+i}` : '-';
      senderWindow.appendChild(f);
    }
  }

  function refreshWindow(){
    const frames = senderWindow.querySelectorAll('.frame');
    frames.forEach((f,i)=>{
      const seq = base + i;
      f.textContent = seq < seqLimit ? `#${seq}` : '-';
      f.classList.toggle('active', seq >= base && seq < nextseq);
    });
  }

  function resetSim(){
    base = 0; nextseq = 0; sentFrames = []; running=false; stopTimer();
    senderQueue.innerHTML=''; recvArea.innerHTML=''; events.innerHTML='';
    buildWindow(); log('Simulator reset. Ready.');
  }

  function sendIfPossible(){
    while(nextseq < base + N && nextseq < seqLimit){
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindow();
  }

  function createPacketDom(text, cls='packet'){
    const p = document.createElement('div');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  function sendFrame(seq){
    const dom = createPacketDom(`F${seq}`, 'packet');
    senderQueue.appendChild(dom);
    const item = { seq, dom, acked:false, timerId:null };
    sentFrames.push(item);
    log(`Sent frame ${seq}.`);
    if(base === seq) startTimer();
    // animate to receiver
    animateToReceiver(dom, seq);
  }

  function animateToReceiver(domEl, seq){
    const clone = domEl.cloneNode(true);
    clone.classList.add('moving');
    channel.appendChild(clone);
    const lost = Math.random() < lossProb;
    setTimeout(()=>{
      if(lost){
        clone.classList.add('lost');
        log(`Frame ${seq} lost in channel.`);
        setTimeout(()=>clone.remove(),700);
      } else {
        // delivered
        setTimeout(()=>{
          clone.remove();
          onReceiverGot(seq);
        }, 250);
      }
    }, 250);
  }

  function onReceiverGot(seq){
    const expected = recvArea.childElementCount;
    if(seq === expected){
      const r = createPacketDom(`F${seq}`);
      recvArea.appendChild(r);
      log(`Receiver accepted ${seq}. Sending ACK ${seq}.`);
      sendAck(seq);
    } else {
      // GBN: discard and send cumulative ack for last in-order
      const ackFor = expected - 1;
      log(`Receiver discarded ${seq} (expected ${expected}). Sending ACK ${ackFor}.`);
      sendAck(ackFor);
    }
  }

  function sendAck(ackSeq){
    const ackDom = createPacketDom(`ACK${ackSeq}`, 'packet ack');
    // ack travels back
    channel.appendChild(ackDom);
    const lost = Math.random() < lossProb;
    setTimeout(()=>{
      if(lost){
        ackDom.classList.add('lost');
        log(`ACK ${ackSeq} lost on return path.`);
        setTimeout(()=>ackDom.remove(),700);
      } else {
        // ack arrives
        setTimeout(()=>{ ackDom.remove(); onAckReceived(ackSeq); }, 250);
      }
    }, 180);
  }

  function onAckReceived(ackSeq){
    log(`Sender received ACK ${ackSeq}.`);
    // mark acked
    sentFrames.forEach(s => { if(s.seq <= ackSeq) s.acked = true; });
    // slide window
    while(sentFrames.length && sentFrames[0].acked){
      // remove oldest
      const removed = sentFrames.shift();
      removed.dom.classList.add('acked');
      base++;
    }
    if(sentFrames.length > 0) startTimer();
    else stopTimer();
    refreshWindow();
    if(autoSend) sendIfPossible();
  }

  function startTimer(){
    stopTimer();
    mainTimer = setTimeout(onTimeout, timeout);
  }
  function stopTimer(){ if(mainTimer){ clearTimeout(mainTimer); mainTimer = null; } }

  function onTimeout(){
    log(`Timeout at base ${base}. Retransmitting ${base}..${Math.min(base+N-1, seqLimit-1)}.`);
    // retransmit all outstanding frames starting from base
    const outstanding = sentFrames.map(s => s.seq);
    // re-send each (these become new distinct sends)
    outstanding.forEach(seq => {
      sendFrame(seq);
    });
    // restart timer
    if(sentFrames.length>0) startTimer();
  }

  // Controls wiring
  lossEl.addEventListener('input', e => {
    lossVal.textContent = `${e.target.value}%`;
    lossProb = parseInt(e.target.value,10)/100;
  });

  winSizeEl.addEventListener('change', e => {
    N = Math.max(1,parseInt(e.target.value,10));
    buildWindow();
    refreshWindow();
  });

  timeoutEl.addEventListener('change', e => timeout = parseInt(e.target.value,10));

  startBtn.addEventListener('click', ()=>{
    if(running) return;
    running = true; log('Started.');
    sendIfPossible();
  });

  pauseBtn.addEventListener('click', ()=>{
    running=false; stopTimer(); log('Paused.');
  });

  stepBtn.addEventListener('click', ()=>{
    // single step: send one frame if possible
    sendIfPossible();
    log('Step executed.');
  });

  resetBtn.addEventListener('click', ()=> resetSim());

  autoSendEl.addEventListener('change', e => autoSend = e.target.checked);

  // init
  buildWindow();
  log('Ready — hit Start.'); 
  window.SIM = { resetSim, sendIfPossible };
})();
