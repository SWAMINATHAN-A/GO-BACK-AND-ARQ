// Basic Go-Back-N simulator (client-side)
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
  const senderWindow = document.getElementById('senderWindow');
  const senderQueue = document.getElementById('senderQueue');
  const recvArea = document.getElementById('recvArea');
  const events = document.getElementById('events');

  // Simulation state
  let N = parseInt(winSizeEl.value,10);
  let timeout = parseInt(timeoutEl.value,10);
  let lossProb = parseInt(lossEl.value,10)/100;
  let base = 0, nextseq = 0;
  let maxSeq = 256;
  let timer = null;
  let running = false;
  let seqLimit = 20; // total frames to send in this demo
  let sentFrames = []; // {seq,acked,dom}
  let rttEstimate = 600;

  function log(msg){
    const el = document.createElement('div');
    el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    events.prepend(el);
  }

  function resetSim(){
    base = 0; nextseq = 0; sentFrames = []; clearInterval(timer); timer=null;
    senderWindow.innerHTML=''; senderQueue.innerHTML=''; recvArea.innerHTML=''; events.innerHTML='';
    buildWindow();
    running=false;
    log('Simulator reset.');
  }

  function buildWindow(){
    senderWindow.innerHTML='';
    for(let i=0;i<N;i++){
      const f = document.createElement('div');
      f.className='frame';
      f.dataset.idx = i;
      f.textContent = `-${i}-`;
      senderWindow.appendChild(f);
    }
  }

  function refreshWindowVisual(){
    const frames = senderWindow.querySelectorAll('.frame');
    frames.forEach((f,i)=>{
      const seq = base + i;
      f.textContent = seq < seqLimit ? `#${seq}` : '-';
      f.classList.toggle('active', seq >= base && seq < nextseq);
      const found = sentFrames.find(s=>s.seq===seq);
      if(found){
        f.style.background = found.acked ? 'linear-gradient(#c7f9fb,#a7f3f3)' : '';
      } else {
        f.style.background = '';
      }
    });
  }

  function sendIfPossible(){
    while(nextseq < base + N && nextseq < seqLimit){
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindowVisual();
  }

  function sendFrame(seq){
    const p = document.createElement('span');
    p.className='packet';
    p.textContent = `F${seq}`;
    senderQueue.appendChild(p);
    sentFrames.push({seq, acked:false, dom:p});
    log(`Sent frame ${seq}.`);
    // start timer if base frame
    if(base === seq){
      startTimer();
    }
    // animate to channel & then to receiver after short delay
    animateToReceiver(p, seq);
  }

  function animateToReceiver(packetEl, seq){
    // clone for channel travel, keep original in queue
    const clone = packetEl.cloneNode(true);
    clone.style.position='relative';
    clone.style.transition='transform 0.8s linear, opacity 0.2s';
    const channel = document.getElementById('channelVisual');
    channel.appendChild(clone);
    // decide loss
    const lost = Math.random() < lossProb;
    setTimeout(() => {
      if(lost){
        clone.classList.add('lost');
        log(`Frame ${seq} lost in channel.`);
        // disappear slowly
        setTimeout(()=>clone.remove(), 800);
      } else {
        // deliver to receiver
        clone.style.transform='translateY(30px)';
        setTimeout(()=>{
          clone.remove();
          onReceiverGot(seq);
        }, 900);
      }
    }, 220);
  }

  function onReceiverGot(seq){
    // receiver only accepts in-order; if expected == seq, accept and send ACK
    const expected = recvArea.childElementCount;
    if(seq === expected){
      const r = document.createElement('div');
      r.className='packet';
      r.textContent = `F${seq}`;
      recvArea.appendChild(r);
      log(`Receiver accepted frame ${seq}. Sending ACK ${seq}.`);
      sendAck(seq);
    } else {
      // drop out-of-order (GBN), but still send ACK for last in-order received (expected-1)
      const ackFor = expected - 1;
      log(`Receiver discarded frame ${seq} (expected ${expected}). Sending ACK ${ackFor}.`);
      sendAck(ackFor);
    }
  }

  function sendAck(ackSeq){
    // ack travels back with possible loss
    const ackEl = document.createElement('span');
    ackEl.className='packet ack';
    ackEl.textContent = `ACK${ackSeq}`;
    const channel = document.getElementById('channelVisual');
    channel.appendChild(ackEl);
    const lost = Math.random() < lossProb;
    setTimeout(()=>{
      if(lost){
        ackEl.classList.add('lost');
        log(`ACK ${ackSeq} lost on return path.`);
        setTimeout(()=>ackEl.remove(),700);
      } else {
        ackEl.style.transform='translateY(-30px)';
        setTimeout(()=>{ ackEl.remove(); onAckReceived(ackSeq);}, 700);
      }
    }, 180);
  }

  function onAckReceived(ackSeq){
    log(`Sender received ACK ${ackSeq}.`);
    // cumulative ack: ackSeq acknowledges all <= ackSeq
    const prevBase = base;
    for(let f of sentFrames){
      if(f.seq <= ackSeq) f.acked = true;
    }
    // slide window
    while(sentFrames.length && sentFrames[0].acked){
      sentFrames.shift();
      base++;
    }
    if(base !== prevBase){
      // if there are still outstanding frames, restart timer for new base
      if(sentFrames.length>0) startTimer();
      else stopTimer();
    }
    refreshWindowVisual();
    sendIfPossible();
  }

  function startTimer(){
    stopTimer();
    timer = setTimeout(onTimeout, timeout);
  }
  function stopTimer(){
    if(timer){ clearTimeout(timer); timer = null; }
  }

  function onTimeout(){
    log(`Timeout for base ${base}. Go-back-n: retransmitting from ${base} to ${Math.min(base+N-1, seqLimit-1)}.`);
    // retransmit all outstanding frames
    for(let f of Array.from(sentFrames)){
      // visual indication
      f.dom.classList.add('lost'); // mark visually that it's been retransmitted
      sendFrame(f.seq); // re-send new copy
    }
    // restart timer
    if(sentFrames.length>0) startTimer();
  }

  // Controls
  lossEl.addEventListener('input', e => {
    lossVal.textContent = `${e.target.value}%`;
    lossProb = e.target.value/100;
  });
  winSizeEl.addEventListener('change', e=>{
    N = Math.max(1,parseInt(e.target.value,10));
    buildWindow();
    refreshWindowVisual();
  });
  timeoutEl.addEventListener('change', e=> timeout = parseInt(e.target.value,10));

  startBtn.addEventListener('click', ()=>{
    if(running) return;
    running = true;
    log('Starting simulator.');
    sendIfPossible();
  });
  pauseBtn.addEventListener('click', ()=> {
    running = false;
    stopTimer();
    log('Paused.');
  });
  stepBtn.addEventListener('click', ()=>{
    // do one send/ack cycle step
    if(!running){
      sendIfPossible();
      // don't auto-run timers; step mode focuses on single events
      log('Step executed.');
    }
  });
  resetBtn.addEventListener('click', ()=> {
    resetSim();
  });

  // init
  buildWindow();
  log('Ready — hit Start.');
  // expose for debug
  window.GBN = { resetSim, sendIfPossible };
})();
