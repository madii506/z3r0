// z3r0 more: pulse (the whole market at a glance), vault (your portfolio), docs (an ASCII story driven by scroll), ops (the operator console)
(() => {
  'use strict';
  const Z = window.Z, FX = Z.FX, { $, $$, esc, usd, big, kf, pct, cls, short, ago, logo, num, S, WL, api, post, toast } = Z;
  const RUN = () => (S.status && S.status.run) || 7;
  const card = (title, sub, body, wide, id) => `<section class="pn${wide ? ' w' : ''}"${id ? ` id="${id}"` : ''}><div class="ph"><b>${title}</b>${sub ? `<i>${sub}</i>` : ''}</div><div class="pb">${body}</div></section>`;
  const row = (s, v, w, right, i) => `<a class="pl" href="#/l/${s.sym}" style="animation:vin .4s var(--ease) both;animation-delay:${(i || 0) * 30}ms">${logo(s.icon, s.sym, 20)}<b>${esc(s.sym)}</b><span class="ab ${right ? '' : cls(v)}">${FX.bar(Math.max(2, Math.min(100, w)), 24)}</span><em class="${right ? '' : cls(v)}">${right || pct(v, 1)}</em></a>`;
  const mover = s => `<a class="mv" href="#/l/${s.sym}">${logo(s.icon, s.sym, 24)}<span style="min-width:0"><b>${esc(s.sym)}</b><small>${esc(s.name)}</small></span><span class="sp2 ${cls(s.ch24)}">${FX.blocks(s.closes, 14)}</span><span class="r"><b>${usd(s.usd, 2)}</b><small class="${cls(s.ch24)}">${pct(s.ch24, 2)}</small></span></a>`;
  // ================================================================ pulse
  Z.views.pulse = { nav: 'pulse',
    render() { const B = S.board, C = S.coins ? S.coins.coins : [], T = S.status; if (!B) return `<div class="vh"><h1><span data-scr>pulse</span></h1></div><div class="pn"><div class="empty">${Z.wait('board')}</div></div>`;
      const st = B.stocks, by24 = st.filter(s => s.ch24 != null).sort((a, b) => b.ch24 - a.ch24), up = by24.filter(s => s.ch24 > 0).length, dn = by24.filter(s => s.ch24 < 0).length;
      const p30 = st.filter(s => s.perf30 != null).sort((a, b) => b.perf30 - a.perf30), maxP = Math.max(1, ...p30.map(s => Math.abs(s.perf30)));
      const cap = [...st].sort((a, b) => (b.mcap || 0) - (a.mcap || 0)).slice(0, 10), maxC = Math.max(1, ...cap.map(s => s.mcap || 0)), vol = [...st].sort((a, b) => (b.vol24 || 0) - (a.vol24 || 0)).slice(0, 10), maxV = Math.max(1, ...vol.map(s => s.vol24 || 0));
      const lanes = {}; C.forEach(c => { const l = lanes[c.stock] || (lanes[c.stock] = { n: 0, mcap: 0 }); l.n++; l.mcap += c.mcap || 0; }); const L = Object.entries(lanes).map(([sym, v]) => ({ ...v, s: Z.stock(sym) || { sym, name: sym } })).sort((a, b) => b.n - a.n || b.mcap - a.mcap).slice(0, 10), maxN = Math.max(1, ...L.map(x => x.n));
      const now = Date.now() / 1000, hours = Array.from({ length: 24 }, (_, i) => C.filter(c => c.at > now - (24 - i) * 3600 && c.at <= now - (23 - i) * 3600).length), maxH = Math.max(1, ...hours), day = hours.reduce((a, b) => a + b, 0);
      const kinds = {}; st.forEach(s => { kinds[s.kind] = (kinds[s.kind] || 0) + 1; }); const pays = { 'their own token': st.filter(s => s.route).length, SOL: st.filter(s => !s.route).length };
      const mc = C.reduce((a, c) => a + (c.mcap || 0), 0), cv = C.reduce((a, c) => a + (c.vol24 || 0), 0), grads = C.filter(c => c.curve >= 100).length, br = up + dn ? up / (up + dn) * 100 : 50;
      const kv = [['SOL', usd(B.sol, 2)], ['layers on the wall', `${st.length} / ${B.size}`], ['coins launched', num(C.length, 0)], ['coins’ market cap', big(mc)], ['coins’ 24h volume', big(cv)], ['graduated', num(grads, 0)], ['payout rounds', T ? num(T.rounds || 0, 0) : '—'], ['ranked by', B.basis === '30d' ? '30 days' : '24 hours']];
      return `<div class="vh"><h1><span data-scr>pulse</span><small>privacy at a glance. live from the wall and the chain.</small></h1></div>
        <div class="pn" style="margin-bottom:12px"><div class="kv c4" style="border:0">${kv.map(([k, v]) => `<div><span class="lab">${k}</span><b>${v}</b></div>`).join('')}</div></div>
        <div class="pg">
          ${card('breadth', `${up} up · ${dn} down today`, `<div class="brd2"><i style="width:${br.toFixed(1)}%;background:var(--up)"></i><i style="width:${(100 - br).toFixed(1)}%;background:var(--dn);opacity:.8"></i></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px"><span class="up">${up} rising</span><span class="dn">${dn} falling</span></div>`, true)}
          ${card('live log', 'what changed while you watched', `<div id="logBox" class="lgb">${Z.logHtml()}</div>`, true)}
          ${card('the field', 'every layer · 30 days across, today up and down · hover a point', `<div style="position:relative"><canvas id="pF" style="display:block;width:100%;height:340px"></canvas><div id="pFt" class="chart" style="position:absolute;inset:0;margin:0;pointer-events:none"><div class="tip"></div></div></div>`, true)}
          ${card('top movers', 'last 24 hours', by24.slice(0, 6).map(mover).join(''))}
          ${card('biggest drops', 'last 24 hours', by24.slice(-6).reverse().map(mover).join(''))}
          ${card('30-day leaders', p30.length + ' with 30 days of prices', p30.slice(0, 10).map((s, i) => row(s, s.perf30, Math.abs(s.perf30) / maxP * 100, '', i)).join('') || `<div class="empty">${FX.spin()} reading 30-day prices</div>`)}
          ${card('30-day laggards', '', p30.slice(-10).reverse().map((s, i) => row(s, s.perf30, Math.abs(s.perf30) / maxP * 100, '', i)).join(''))}
          ${card('biggest layers', 'market cap', cap.map((s, i) => row(s, 0, (s.mcap || 0) / maxC * 100, big(s.mcap), i)).join(''))}
          ${card('most traded', '24h volume', vol.map((s, i) => row(s, 0, (s.vol24 || 0) / maxV * 100, big(s.vol24), i)).join(''))}
          ${card('busiest lanes', 'layers with the most coins', L.length ? L.map((x, i) => row(x.s, 0, x.n / maxN * 100, `${x.n} · ${big(x.mcap)}`, i)).join('') : '<div class="empty" style="padding:18px">No coins paired yet. The first launch opens the first lane.<br><a class="btn sm pri" style="margin-top:12px" href="#/launch">launch a coin</a></div>')}
          ${card('launches', `${day} in the last 24 hours`, `<div class="hist">${hours.map((h, i) => `<i style="height:${Math.max(1, h / maxH * 100).toFixed(1)}%" title="${h} launch${h === 1 ? '' : 'es'}, ${24 - i}h ago"></i>`).join('')}</div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10.5px" class="mu2"><span>24h ago</span><span>now</span></div>`)}
          ${card('the wall', 'what kind of privacy', `<div class="kv c3" style="border:0"><div><span class="lab">kind</span>${Object.entries(kinds).map(([k, n]) => `<p style="margin:6px 0 0"><b style="display:inline">${n}</b> ${esc(k)}</p>`).join('')}</div><div><span class="lab">holders paid in</span>${Object.entries(pays).map(([k, n]) => `<p style="margin:6px 0 0"><b style="display:inline">${n}</b> ${esc(k)}</p>`).join('')}</div><div><span class="lab">dark</span><p style="margin:6px 0 0"><b style="display:inline">${(B.waiting || []).length}</b> no live price</p></div></div>`, true)}
        </div>`; },
    init() { const cv = $('#pF'); if (!cv || !S.board) return; const L = S.board.stocks.filter(s => s.perf30 != null && s.ch24 != null), g = cv.getContext('2d'), D = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * D; cv.height = H * D; g.setTransform(D, 0, 0, D, 0, 0);
      const mx = Math.max(5, ...L.map(s => Math.abs(s.perf30))) * 1.1, my = Math.max(2, ...L.map(s => Math.abs(s.ch24))) * 1.15, X = v => W / 2 + v / mx * (W / 2 - 30), Y = v => H / 2 - v / my * (H / 2 - 22), pts = L.map(s => ({ s, x: X(s.perf30), y: Y(s.ch24) }));
      let t0 = performance.now(), hov = null; const draw = now => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); g.clearRect(0, 0, W, H); g.font = '500 10px JB, monospace';
        g.strokeStyle = '#1c1c1c'; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(W * i / 8 + .5, 0); g.lineTo(W * i / 8 + .5, H); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, H * i / 6 + .5); g.lineTo(W, H * i / 6 + .5); g.stroke(); }
        g.strokeStyle = '#3a3a3a'; g.beginPath(); g.moveTo(W / 2 + .5, 0); g.lineTo(W / 2 + .5, H); g.moveTo(0, H / 2 + .5); g.lineTo(W, H / 2 + .5); g.stroke();
        g.fillStyle = '#5a5a5a'; g.fillText('↑ up today', W / 2 + 8, 14); g.fillText('↓ down today', W / 2 + 8, H - 8); g.textAlign = 'right'; g.fillText('30 days →', W - 8, H / 2 - 8); g.textAlign = 'left'; g.fillText('← 30 days', 8, H / 2 - 8);
        for (const p of pts) { const x = W / 2 + (p.x - W / 2) * e, y = H / 2 + (p.y - H / 2) * e, on = hov === p, c = p.s.ch24 >= 0 ? '138,240,180' : '255,122,122'; g.fillStyle = `rgba(${c},${on ? 1 : .85})`; g.fillRect(x - (on ? 4 : 3), y - (on ? 4 : 3), on ? 8 : 6, on ? 8 : 6); g.fillStyle = on ? '#fff' : 'rgba(236,236,236,.7)'; g.fillText(p.s.sym, x + 7, y + 3); }
        if (k < 1) requestAnimationFrame(draw); }; requestAnimationFrame(draw);
      const tip = $('#pFt .tip'); cv.onpointermove = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 400; for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } } if (best !== hov) { hov = best; t0 = performance.now() - 900; requestAnimationFrame(draw); }
        if (hov) { tip.style.opacity = 1; tip.style.left = Math.min(W - 190, hov.x + 12) + 'px'; tip.style.top = Math.max(0, hov.y - 34) + 'px'; tip.innerHTML = `<b>${esc(hov.s.sym)}</b> ${esc(hov.s.name)} · 24h <span class="${cls(hov.s.ch24)}">${pct(hov.s.ch24, 1)}</span> · 30d <span class="${cls(hov.s.perf30)}">${pct(hov.s.perf30, 1)}</span>`; cv.style.cursor = 'pointer'; } else { tip.style.opacity = 0; cv.style.cursor = ''; } };
      cv.onpointerleave = () => { hov = null; tip.style.opacity = 0; requestAnimationFrame(draw); }; cv.onclick = () => { if (hov) Z.go('#/l/' + hov.s.sym); }; },
    refresh() { if (Z.view() === 'pulse' && !$('#view .pg')) Z.rerender(); } };

  // ================================================================ vault
  Z.views.vault = { nav: 'vault',
    render() { if (!WL.pk) return `<div class="vh"><h1><span data-scr>vault</span><small>your coins, what they paid you, and what you launched.</small></h1></div><div class="pn"><div class="empty" style="padding:80px 20px"><pre class="asc mu2" style="margin:0 auto 18px;font-size:12px;line-height:1.15">  ┌───────┐\n  │ ░░░░░ │\n  │ ░ Ø ░ │\n  │ ░░░░░ │\n  └───────┘</pre><b>locked</b>Log in to open your vault. z3r0 only sees your address.<br><button class="btn pri" style="margin-top:16px" id="meL" type="button">log in</button></div></div>`;
      const v = WL.view; if (!v) return `<div class="vh"><h1><span data-scr>vault</span></h1></div><div class="pn"><div class="empty">${FX.spin()} reading your wallet</div></div>`;
      const mine = v.tokens.filter(t => t.kind === 'z3r0'), lay = v.tokens.filter(t => t.kind === 'layer'), launched = (v.launched || []).map(m => Z.coin(m)).filter(Boolean);
      const row2 = (t, extra, href) => `<a class="mv" href="${href}">${logo(t.icon, t.symbol, 26)}<span style="min-width:0"><b>${esc(t.symbol)}</b><small>${esc(extra)}</small></span><span class="mu" style="text-align:right">${kf(t.amount)}</span><span class="r"><b>${usd(t.usd, 2)}</b></span></a>`;
      const parts = [['SOL', v.solUsd || 0, '#ececec'], ['z3r0 coins', mine.reduce((a, t) => a + (t.usd || 0), 0), '#8a8a8a'], ['privacy tokens', lay.reduce((a, t) => a + (t.usd || 0), 0), '#4a4a4a'], ['other', v.tokens.filter(t => t.kind === 'coin').reduce((a, t) => a + (t.usd || 0), 0), '#262626']], tot = parts.reduce((a, p) => a + p[1], 0) || 1;
      return `<div class="vh"><h1><span data-scr>vault</span><small>${short(WL.pk)} <button class="btn xs" id="meCp" type="button">copy</button> <button class="btn xs" id="meOut" type="button">log out</button></small></h1><div class="rt"><span class="big">${usd(v.totalUsd, 2)}</span></div></div>
        <div class="pn hero"><div><span class="lab">SOL</span><span class="big">${num(v.sol, 3)}</span><small>${usd(v.solUsd, 2)}</small></div><div><span class="lab">z3r0 coins</span><span class="big">${mine.length}</span></div><div><span class="lab">privacy tokens</span><span class="big">${lay.length}</span></div><div><span class="lab">coins launched</span><span class="big">${launched.length}</span></div></div>
        <div class="pn" style="margin-bottom:12px"><div class="ph"><b>where it sits</b></div><div class="pb"><div class="alloc">${parts.filter(p => p[1] > 0).map(p => `<i style="width:${(p[1] / tot * 100).toFixed(2)}%;background:${p[2]}" title="${p[0]}"></i>`).join('')}</div><div class="alloc-l">${parts.map(p => `<span><i style="background:${p[2]}"></i>${p[0]} <b>${usd(p[1], 2)}</b> <em>${(p[1] / tot * 100).toFixed(1)}%</em></span>`).join('')}</div></div></div>
        <div class="pg">${card('your z3r0 coins', mine.length, mine.length ? mine.map(t => row2(t, 'paired with ' + (t.stock || '?'), '#/c/' + t.mint)).join('') : '<div class="empty" style="padding:18px">None yet. Coins you hold from z3r0 show here.</div>')}
          ${card('privacy tokens', lay.length, lay.length ? lay.map(t => row2(t, t.name, '#/l/' + t.symbol)).join('') : '<div class="empty" style="padding:18px">None yet. Payouts in a layer’s own token land here.</div>')}
          ${card('coins you launched', launched.length, launched.length ? launched.map(c => `<a class="mv" href="#/c/${c.mint}">${logo(c.image, c.symbol, 26)}<span><b>$${esc(c.symbol)}</b><small>${esc(c.name)} ⇄ ${esc(c.stock)}</small></span><span class="ab">${FX.bar(c.curve || 0, 12)}</span><span class="r"><b>${big(c.mcap)}</b></span></a>`).join('') : '<div class="empty" style="padding:18px">You haven’t launched a coin yet.<br><a class="btn sm pri" style="margin-top:12px" href="#/launch">launch one</a></div>', true)}</div>`; },
    init() { const l = $('#meL'); if (l) l.onclick = Z.login; const o = $('#meOut'); if (o) o.onclick = Z.disconnect; const c = $('#meCp'); if (c) c.onclick = () => Z.copy(WL.pk, 'Address'); if (WL.pk && !WL.view) Z.refreshWallet(); } };
  document.addEventListener('z-wallet', () => { if (Z.view() === 'vault') Z.rerender(); });

  // ================================================================ docs: an ASCII story driven by scroll, then the fine print
  const ART = [
`   ┌──────────────┐          ┌──────────────┐
   │              │          │              │
   │    $COIN     │  ◄────►  │   ZEC · XMR  │
   │              │          │   RAIL · NYM │
   └──────────────┘          └──────────────┘
         your coin             one privacy layer
                  written on-chain at launch`,
`  $70K ┤                              ╭──●
       │                          ╭───╯
       │                     ╭────╯
       │               ╭─────╯
       │        ╭──────╯
  $10K ●────────╯
       └──────────────────────────────────
         opens                 graduates · 7x`,
`        a trade on the curve
               │
       ┌───────┴────────┐
       │                │
      99%              1%
       │                │
       ▼                ▼
   ┌───────┐      ┌────────────┐
   │ curve │      │ fee wallet │
   └───────┘      └────────────┘`,
`   ┌────────────┐         ┌─────────────────┐
   │ fee wallet │── SOL ─►│ the layer’s     │
   └────────────┘    │    │ token on Solana │
                     │    └─────────────────┘
                     │
                     └──── no token there? it stays SOL`,
`   ┌─────────┐
   │ payout  │──┬──►  holder   ████████████  41%
   └─────────┘  ├──►  holder   ███████       22%
                ├──►  holder   ███            9%
                └──►  …        pro rata, on-chain
                      pools and vaults left out`];
  const STEPS = [['Pick one privacy layer.', 'Zcash, Monero, Railgun, Nym, Aztec and every other layer with a live price. One per coin, written on-chain.'], ['Launch at about $10K.', 'Your coin opens between $8K and $11K on its own Raydium curve, and graduates to a pool at 7x.'], ['Every curve trade pays 1%.', 'While the coin trades on its curve, 1% of each trade goes to the z3r0 fee wallet. Nothing else is taken.'], ['The fee buys the layer.', 'The fee wallet swaps that SOL into the layer’s token where it trades on Solana. Where it doesn’t, it stays SOL.'], ['Holders get paid in it.', 'It is sent to the coin’s holders, pro rata, straight to their wallets. Every round is on-chain.']];
  Z.views.docs = { nav: 'docs',
    render() { const B = S.board, T = S.status, tab = (h, rows) => `<div class="dtab"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, sec = (t, h) => `<section><h3>${t}</h3>${h}</section>`;
      return `<div class="vh"><h1><span data-scr>docs</span><small>how z3r0 works, in five steps. then the fine print.</small></h1></div>
      <div class="dgrid"><div class="story" id="dSt"><div class="pn"><div class="ph"><b>how z3r0 works</b><i id="dN">01 / 05</i></div><div class="pb"><pre class="asc" id="dArt" style="font-size:12.5px;line-height:1.3;min-height:190px;color:#d8d8d8;overflow:auto"></pre></div></div><h2 id="dH"></h2><p id="dP"></p><div class="sdots" id="dD">${STEPS.map(() => '<i></i>').join('')}</div></div>
        <div class="doc">${STEPS.map(([h, p], i) => `<div class="stp" data-n="${i}"><div><span class="lab">step 0${i + 1}</span><b>${h}</b><p>${p}</p></div></div>`).join('')}
          ${sec('What z3r0 is', `<p>z3r0 is a launchpad for Raydium coins paired with privacy layers. Every coin gets <b>one privacy layer</b>, picked at launch from the wall: privacy chains like Zcash and Monero, protocols like Railgun, networks like Nym, and encrypted compute like Zama. The coin trades on Raydium like any other; the pairing decides what its holders are paid in.</p>`)}
          ${sec('The wall', `<p>The wall lists every privacy layer z3r0 tracks that has a live price, ranked by performance. Prices come from CoinGecko. Only layers on the wall can be picked.</p>${tab(['rule', 'value'], [['layers tracked', `${B ? B.size : '…'}`], ['ranking', B && B.basis === '24h' ? '24-hour performance, until 30-day changes are in' : 'performance over the last 30 days'], ['to qualify', 'a live price'], ['on the wall now', B ? B.stocks.length + ' layers' : '…'], ['trade on Solana', B ? B.stocks.filter(x => x.route).length + ' of them' : '…'], ['if a layer loses its price', 'coins already paired keep it; new coins can’t pick it until it’s back']])}`)}
          ${sec('A launch', `<p>A launch is one or two Solana transactions that your wallet signs. It creates the coin on Raydium LaunchLab and writes its privacy layer on-chain.</p>${tab(['setting', 'value'], [['supply', '1,000,000,000'], ['opens at', '$8K, $9K, $10K or $11K market cap'], ['graduates at', `${RUN()}x the open, into a Raydium pool`], ['sold on the curve', 'about 72.6% of the supply'], ['first buy', 'optional, up to 20 SOL, in the same transaction'], ['you pay', 'Solana fees, about 0.03 SOL of rent, and your first buy']])}<p>The open is set in SOL at the moment you launch, so its dollar value moves a little with SOL's price.</p>`)}
          ${sec('The pair', `<p>The layer is written in two places: a memo in the launch transaction (<code>z3r0:launch:&lt;coin&gt;:&lt;layer&gt;</code>) and the coin's metadata file, which is stored once and never overwritten. Nobody can change it afterwards, including z3r0.</p>`)}
          ${sec('Fees and payouts', `<p>Coins launched on the z3r0 launchpad pay a <b>1% fee on curve trades</b>. That fee is collected by the z3r0 fee wallet and paid to each coin's holders pro rata: in the layer's own token when that token trades on Solana, and in SOL when it doesn't.</p>${tab(['', ''], [['fee', '1% of each trade while the coin is on its curve'], ['paid to', 'the coin’s holders'], ['paid in', 'the layer’s token where it trades on Solana, otherwise SOL'], ['how', 'in rounds, run from the fee wallet; each round is on-chain with a memo'], ['who is left out', 'pools and vaults (they aren’t people)'], ['status', T && T.payoutsLive ? '<span class="up">live</span>' : 'not live yet: until the z3r0 launchpad exists, coins launch on Raydium’s own pad and no fee is taken for holders']])}<p>Rounds are run by a person from the operator console, not by a timer. Payout sizes depend on trading volume and can be zero.</p>`)}
          ${sec('Verify it yourself', `<p>Every launch and payout sends 0 SOL to the z3r0 tag address with a memo, so the whole history can be read from the chain:</p><p><code>${esc((T && T.tag) || '')}</code></p>${T && T.tag ? `<p><a class="btn sm" href="https://solscan.io/account/${T.tag}" target="_blank" rel="noopener">open the tag on solscan ↗</a></p>` : ''}`)}
          ${sec('What z3r0 is not', `<ul><li>z3r0 doesn't make your coin or your trades private. Your coin is a normal Solana token, and every trade is public. The pairing is the coin's identity and what its holders are paid in.</li><li>A memecoin can go to zero. A privacy layer doing well lately says nothing about what it does next.</li><li>z3r0 isn't affiliated with Raydium, Jupiter, CoinGecko or any privacy project on the wall. Nothing here is financial advice.</li></ul>`)}
          ${sec('Questions', [['Can I change my coin’s layer later?', 'No. It is written on-chain at launch.'], ['Why is a layer missing?', 'A layer needs a live price to be on the wall. Layers with no token, or no price right now, are listed as dark.'], ['Why are some payouts in SOL?', 'Most privacy tokens don’t trade on Solana. Where a layer’s token does, holders get that token. Where it doesn’t, they get SOL.'], ['Is the coin’s price tied to the layer?', 'No. The coin trades on its own curve against SOL.'], ['What happens at graduation?', 'The coin moves from its curve to a Raydium pool. Half of that liquidity is burned.'], ['Does z3r0 hold my coins?', 'No. You sign every transaction in your own wallet, and z3r0 never asks for a seed phrase.']].map(([q, a]) => `<details class="qa"><summary>${q}</summary><p>${a}</p></details>`).join(''))}
        </div></div>`; },
    init() { let cur = -1; const sc = innerWidth <= 900 ? window : $('#main'), show = n => { if (n === cur) return; cur = n; const art = $('#dArt'); if (!art) return; art.textContent = ART[n]; FX.scramble(art, 700); $('#dH').textContent = STEPS[n][0]; FX.scramble($('#dH'), 500); $('#dP').textContent = STEPS[n][1]; $('#dN').textContent = `0${n + 1} / 05`; $$('#dD i').forEach((d, i) => d.classList.toggle('on', i <= n)); Z.FX.snd.blip(500 + n * 80, .03, .08); };
      const onS = () => { if (!$('#dArt')) return; let n = 0; $$('.stp').forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .55) n = +s.dataset.n; }); show(n); }; show(0); (sc === window ? Z.winScroll(onS) : sc.onscroll = onS); } };

  // ================================================================ ops: the operator console
  const OP = { pad: null, coin: '', sol: '', amt: '' };
  Z.views.ops = { nav: 'ops',
    render() { const T = S.status, C = S.coins ? S.coins.coins : [], down = !T && S.statusErr, opts = C.map(c => `<option value="${c.mint}" ${OP.coin === c.mint ? 'selected' : ''}>$${esc(c.symbol)} · paired with ${esc(c.stock)}</option>`).join('') || '<option value="">no coins launched yet</option>';
      return `<div class="vh"><h1><span data-scr>ops</span><small>the operator console, for the fee wallet. every action is signed in that wallet.</small></h1></div>
        <div class="pg">${card(`the z3r0 launchpad <span class="pill ${T && T.payoutsLive ? 'ok' : 'wa'}" style="margin-left:8px">${T && T.payoutsLive ? 'live' : down ? 'offline' : T ? 'not created' : 'reading'}</span>`, '', `<p class="mu" style="margin:0 0 12px;font-size:12px">A LaunchLab launchpad with a 1% fee, half the graduation liquidity burned. The wallet that creates it collects the fee and runs payouts. One per wallet.</p><div id="opPad" class="mu" style="font-size:12px">${WL.pk ? FX.spin() + ' reading' : 'Log in with the fee wallet to manage it.'}</div><div class="stat" id="opS1"></div>`, true)}
          ${card('1 · buy a coin’s layer token', '', `<p class="mu" style="margin:0 0 12px;font-size:12px">Swap claimed SOL into the token of the layer a coin is paired with. It lands in this wallet, ready to pay out. Coins whose layer doesn't trade on Solana are paid in SOL, so skip this for them.</p><div class="opg"><select class="inp" id="opC1">${opts}</select><input class="inp" id="opSol" inputmode="decimal" placeholder="SOL" value="${esc(OP.sol)}"><button class="btn pri" id="opBuy" type="button">buy</button></div><div class="stat" id="opS2"></div>`)}
          ${card('2 · pay it to holders', '', `<p class="mu" style="margin:0 0 12px;font-size:12px">Send an amount of the layer's token (or SOL) to a coin's holders, pro rata. Pools and vaults are left out. Up to 42 wallets per batch; it keeps going until it's done.</p><div class="opg"><select class="inp" id="opC2">${opts}</select><input class="inp" id="opAmt" inputmode="decimal" placeholder="amount" value="${esc(OP.amt)}"><button class="btn pri" id="opPay" type="button">pay</button></div><div class="stat" id="opS3"></div>`)}</div>`; },
    async init() { const need = () => { if (!WL.pk) { Z.login(); return false; } return true; }, coinOf = id => Z.coin($(id).value);
      const padEl = $('#opPad'); if (WL.pk && padEl) { try { const p = await api('pad', '&admin=' + WL.pk); OP.pad = p; if (!$('#opPad')) return;
        padEl.innerHTML = p.exists ? `launchpad <b class="hi">${short(p.id)}</b> <button class="btn xs" id="opCp" type="button">copy</button> · fee ${p.feePct}% · unclaimed <b class="hi">${num(p.unclaimedSol, 4)} SOL</b> <button class="btn xs pri" id="opClaim" type="button">claim</button>${p.pinned === p.id ? '' : '<br><span class="wa">This launchpad isn’t the one pinned on the site yet. Send its address to be pinned so launches use it.</span>'}` : `this wallet has no launchpad yet. <button class="btn xs pri" id="opMake" type="button">create the z3r0 launchpad</button>`;
        const st = Z.stat('#opS1'), mk = $('#opMake'), cl = $('#opClaim'), cp = $('#opCp'); if (cp) cp.onclick = () => Z.copy(p.id, 'Launchpad address');
        if (mk) mk.onclick = async () => { try { st('building…'); const r = await post('buildPad', { wallet: WL.pk }); const s = await Z.signSend(r.txs, st); st(`created · ${esc(r.pad)} · ${Z.tsx(s[0])}`, 'ok'); } catch (e) { st(esc(e.message), 'err'); } };
        if (cl) cl.onclick = async () => { try { st('building…'); const r = await post('claim', { wallet: WL.pk }); const s = await Z.signSend(r.txs, st); st(`claimed · ${Z.tsx(s[0])}`, 'ok'); } catch (e) { st(esc(e.message), 'err'); } }; } catch (e) { padEl.textContent = e.message; } }
      $('#opBuy').onclick = async () => { if (!need()) return; const st = Z.stat('#opS2'), c = coinOf('#opC1'), sol = +$('#opSol').value; try { if (!c) throw new Error('pick a coin'); if (!(sol > 0)) throw new Error('type an amount of SOL'); const s = Z.stock(c.stock); if (!s) throw new Error(c.stock + ' is off the wall right now'); if (!s.route || !s.mint) throw new Error(s.name + ' has no token on Solana: pay this coin’s holders in SOL in step 2');
          st('quoting…'); const q = await (await fetch(`${Z.JUP}/swap/v1/quote?inputMint=${Z.SOL}&outputMint=${s.mint}&amount=${Math.floor(sol * 1e9)}&slippageBps=100`)).json(); if (!q.outAmount) throw new Error(q.error || 'no route');
          const j = await (await fetch(`${Z.JUP}/swap/v1/swap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: q, userPublicKey: WL.pk, dynamicComputeUnitLimit: true }) })).json(); if (!j.swapTransaction) throw new Error(j.error || 'Jupiter could not build this swap');
          const sig = await Z.signSendV(j.swapTransaction, st); st(`bought about ${kf(+q.outAmount / 10 ** (s.decimals || 8))} ${esc(s.tok)} · ${Z.tsx(sig)}`, 'ok'); } catch (e) { st(esc(e.message), 'err'); } };
      $('#opPay').onclick = async () => { if (!need()) return; const st = Z.stat('#opS3'), c = coinOf('#opC2'), amt = +$('#opAmt').value; try { if (!c) throw new Error('pick a coin'); if (!(amt > 0)) throw new Error('type an amount to pay'); const s = Z.stock(c.stock), inSol = !(s && s.mint), dec = inSol ? 9 : ((s && s.decimals) || 8); let off = 0, paid = 0;
          while (off != null) { st(`building batch from wallet ${off + 1}…`); const r = await post('buildPayout', { wallet: WL.pk, coin: c.mint, amountRaw: String(Math.floor(amt * 10 ** dec)), offset: off }); if (!r.txs.length) break; await Z.signSend(r.txs, st); paid += Math.min(42, r.paid - off); off = r.next; }
          st(`paid ${inSol ? 'SOL' : esc(s.tok)} to ${paid} wallets`, 'ok'); setTimeout(() => Z.reload(), 2500); } catch (e) { st(esc(e.message), 'err'); } }; } };

  Z.start();
})();
