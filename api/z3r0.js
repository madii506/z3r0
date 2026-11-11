// z3r0 API: launch a coin on Raydium LaunchLab, paired with one privacy layer (Zcash, Monero, Railgun, Aztec, Nym and every other one z3r0 tracks).
// GET  a=status · a=board · a=coins · a=coin&mint= · a=wallet&addr= · a=pad&admin= · a=rounds · a=holders&mint= · a=candles&mint=
// POST a=img · a=buildLaunch · a=buildPad · a=claim · a=buildPayout · a=send      (every transaction is signed in the visitor's own wallet)
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction } = require('@solana/web3.js');
const SPL = require('@solana/spl-token');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');
const crypto = require('crypto');
const CFG = require('./z3r0-config.json');

// ---------------------------------------------------------------- plumbing
const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function rpcFetch(url, opts) { let last = null; for (let round = 0; round < 2; round++) { for (const u of RPCS) { try { const r = await fetch(u, { ...opts, signal: AbortSignal.timeout(12000) }); if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = r; continue; } return r; } catch (e) { last = e; } } await new Promise(r => setTimeout(r, 700)); } if (last instanceof Error) throw last; return last; }
const conn = new Connection(RPCS[0], { commitment: 'confirmed', fetch: rpcFetch, disableRetryOnRateLimit: true });

const SOL = 'So11111111111111111111111111111111111111112', WSOL = new PublicKey(SOL);
const PROGRAM = R.LAUNCHPAD_PROGRAM, RAYDIUM_PLATFORM = R.LAUNCHPAD_PLATFORM, CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
const TAG = new PublicKey(process.env.Z3R0_TAG || CFG.tag);               // every z3r0 launch and payout sends 0 SOL here with a memo, so the chain is the index
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PIN = { pad: process.env.Z3R0_PAD || CFG.pad || null };               // the z3r0 launchpad (a LaunchLab platform config). Until it exists, coins launch on Raydium's own platform
const SUPPLY = new BN('1000000000000000'), PPM = 1e6, RUN = +CFG.run || 7;
const JUP = 'https://lite-api.jup.ag', HISTORY_API = 'https://launch-history-v1.raydium.io', PFX = 'z3r0/';

const out = (res, code, b, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(b)); };
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'bad address'); } };
const link = (s, re, what, eg) => { s = clean(s, 200); if (!s) return ''; if (!/^https:\/\/\S+$/.test(s)) throw new Error(`the ${what} must be a https:// link`); if (re && !re.test(s)) throw new Error(`the ${what} must start with ${eg}`); return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJ(url, ms = 8000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(r.status + ' ' + url.split('/')[2]); return r.json(); }
const cache = new Map();
async function memo(key, ttl, fn) { const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v; if (c && c.p) return c.p; const p = fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; }, e => { if (c) cache.set(key, c); else cache.delete(key); throw e; }); cache.set(key, { ...(c || { t: 0 }), p }); return p; }
const memoIx = text => new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(text) });
const tagIx = from => SystemProgram.transfer({ fromPubkey: from, toPubkey: TAG, lamports: 0 });
const padIdOf = admin => R.getPdaPlatformId(PROGRAM, admin).publicKey, vaultOf = id => R.getPdaPlatformVault(PROGRAM, id, WSOL).publicKey;
const str = b => Buffer.from(b).toString('utf8').replace(/\0/g, '').trim(), pct = n => +(+n.toString() / PPM * 100).toFixed(4);

// write-once files (images, metadata, coin cards) and one small overwritten file (the performance sheet)
const blob = () => require('@vercel/blob');
const hasStore = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const blobBase = () => { const id = (process.env.BLOB_STORE_ID || '').replace(/^store_/, '') || String(process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3] || ''; return id ? `https://${id.toLowerCase()}.public.blob.vercel-storage.com/` : null; };
async function putFile(path, data, type, over) { if (!hasStore()) throw new Error('storage is not switched on yet');
  try { return (await blob().put(PFX + path, data, { access: 'public', addRandomSuffix: false, allowOverwrite: !!over, contentType: type, cacheControlMaxAge: over ? 60 : 31536000 })).url; }
  catch (e) { if (!over && /exist/i.test(e.message || '')) { const h = await blob().head(PFX + path).catch(() => null); if (h) return h.url; } throw e; } }
async function readFile(path, fresh) { const b = blobBase(); if (!b) return null; try { const r = await fetch(b + PFX + path + (fresh ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(6000) }); return r.ok ? await r.json() : null; } catch { return null; } }

// ---------------------------------------------------------------- prices
// every privacy layer z3r0 knows (config). A layer is on the board when it has a live price; its token can pay holders when it trades on Solana.
const LAYERS = CFG.layers.slice(); const BY_SYM = Object.fromEntries(LAYERS.map(s => [s.key, s])), BY_MINT = Object.fromEntries(LAYERS.filter(s => s.mint).map(s => [s.mint, s]));
const CG = 'https://api.coingecko.com/api/v3', cgHead = () => process.env.CG_KEY ? { 'x-cg-demo-api-key': process.env.CG_KEY } : {};
async function cgJ(path, ms = 9000) { const r = await fetch(CG + path, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json', ...cgHead() } }); if (!r.ok) throw new Error('prices ' + r.status); return r.json(); }
async function jupInfo(mints) { const o = {}, L = [...new Set(mints)].filter(Boolean);
  for (let i = 0; i < L.length; i += 90) { try { const j = await getJ(`${JUP}/tokens/v2/search?query=${L.slice(i, i + 90).join(',')}`);
    for (const t of j || []) { const s = t.stats24h || {}; o[t.id] = { symbol: t.symbol, name: t.name, icon: t.icon || null, decimals: t.decimals, usd: t.usdPrice ?? null, ch24: s.priceChange ?? null, mcap: t.mcap ?? t.fdv ?? null, liquidity: t.liquidity ?? null, holders: t.holderCount ?? null, vol24: (s.buyVolume || 0) + (s.sellVolume || 0), traders24: s.numTraders ?? null, curve: t.bondingCurve ?? null, created: t.createdAt || null, program: t.tokenProgram || null }; } } catch { } }
  return o; }
const solUsd = () => memo('sol', 30000, async () => ((await jupInfo([SOL]))[SOL] || {}).usd || null);

// ---------------------------------------------------------------- the board: every privacy layer with a live price, ranked by its last 30 days
// prices and 30-day moves come from CoinGecko in one call; daily closes are filled in a few layers per request and kept in a small file, so a cold start has them at once.
// the whole sheet is saved too, so a rate-limited price source never empties the board.
let PERF = null, perfSavedAt = 0, SHEET = null;
async function perfSheet() { if (!PERF) PERF = (await readFile('perf.json', true)) || {}; return PERF; }
async function refreshPerf(live) { const P = await perfSheet(), now = Date.now(), stale = live.filter(s => !P[s.sym] || now - P[s.sym].at > 8 * 3600e3).slice(0, 4); if (!stale.length) return;
  for (const s of stale) { try { const g = await cgJ(`/coins/${encodeURIComponent(s.cg)}/market_chart?vs_currency=usd&days=30&interval=daily`, 7000);
      const rows = (g.prices || []).filter(x => x[1] > 0); P[s.sym] = { at: now, days: Math.max(0, rows.length - 1), closes: rows.map(x => +(+x[1]).toPrecision(6)) }; } catch { break; } }   // rate limited: the rest wait for a later request
  if (hasStore() && now - perfSavedAt > 60000) { perfSavedAt = now; putFile('perf.json', JSON.stringify(P), 'application/json', true).catch(() => { }); } }
async function market() { return memo('mkt', 120000, async () => { const ids = LAYERS.filter(s => s.cg).map(s => s.cg);
  try { const L = await cgJ(`/coins/markets?vs_currency=usd&per_page=250&ids=${ids.join(',')}&price_change_percentage=24h,30d&sparkline=true`), by = Object.fromEntries((Array.isArray(L) ? L : []).map(c => [c.id, c]));
    const v = { at: Date.now(), by }; if (Object.keys(by).length) { SHEET = v; if (hasStore()) putFile('market.json', JSON.stringify(v), 'application/json', true).catch(() => { }); } return v; }
  catch (e) { if (!SHEET) SHEET = await readFile('market.json', true); if (SHEET) return { ...SHEET, stale: true }; throw e; } }); }
const thin = (a, n) => { a = (a || []).filter(x => x > 0); if (a.length <= n) return a.map(x => +(+x).toPrecision(6)); return Array.from({ length: n }, (_, i) => +(+a[Math.round(i / (n - 1) * (a.length - 1))]).toPrecision(6)); };
async function board() { return memo('board', 45000, async () => { const [M, J] = await Promise.all([market(), jupInfo([SOL, ...LAYERS.map(s => s.mint)])]);
  const all = LAYERS.map(s => { const c = (s.cg && M.by[s.cg]) || null, j = (s.mint && J[s.mint]) || {}, solLiq = s.mint ? (j.liquidity ?? null) : null;
    return { sym: s.key, name: s.name, tok: c ? String(c.symbol || '').toUpperCase() : s.key, kind: s.kind, how: s.how, cg: s.cg, icon: c ? c.image : null, mint: s.mint || null, route: !!(s.mint && solLiq >= (+CFG.minSolanaLiquidityUsd || 500)), decimals: j.decimals ?? null,
      usd: c ? c.current_price ?? null : null, ch24: c ? c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null : null, perf30: c ? c.price_change_percentage_30d_in_currency ?? null : null, mcap: c ? c.market_cap ?? null : null, vol24: c ? c.total_volume ?? null : null, mcRank: c ? c.market_cap_rank ?? null : null, liquidity: solLiq, holders: s.mint ? (j.holders ?? null) : null, spark: c && c.sparkline_in_7d ? thin(c.sparkline_in_7d.price || [], 42) : [] }; });
  const live = all.filter(s => s.usd); await refreshPerf(live).catch(() => { }); const P = await perfSheet();
  for (const s of live) { const p = P[s.sym]; s.closes = (p && p.closes) || []; s.days = p && p.days || null; }
  const basis = live.filter(s => s.perf30 != null).length >= Math.min(6, live.length) ? '30d' : '24h', score = s => basis === '30d' ? (s.perf30 ?? -1e9) : (s.ch24 ?? -1e9);
  const ranked = [...live].sort((a, b) => score(b) - score(a)).map((s, i) => ({ ...s, rank: i + 1 }));
  return { at: Date.now(), priced: M.at, stale: !!M.stale, basis, size: LAYERS.length, sol: (J[SOL] || {}).usd || null, stocks: ranked,
    waiting: all.filter(s => !s.usd).map(s => ({ sym: s.sym, name: s.name, icon: s.icon, why: s.cg ? 'no live price right now' : 'no token' })) }; }); }

// ---------------------------------------------------------------- the chain index: launches and payout rounds, read from the tag address
async function scan() { return memo('scan', 20000, async () => { const sigs = (await conn.getSignaturesForAddress(TAG, { limit: 300 })).filter(s => !s.err), launches = [], rounds = [];
  for (let i = 0; i < sigs.length; i += 25) { const txs = await conn.getParsedTransactions(sigs.slice(i, i + 25).map(s => s.signature), { maxSupportedTransactionVersion: 0 }).catch(() => []);
    txs.forEach((t, k) => { if (!t || !t.meta || t.meta.err) return; const by = t.transaction.message.accountKeys[0].pubkey.toBase58(), sig = sigs[i + k].signature, at = t.blockTime;
      for (const ix of t.transaction.message.instructions) { if (ix.program !== 'spl-memo' || typeof ix.parsed !== 'string') continue;
        let m = /^z3r0:launch:([1-9A-HJ-NP-Za-km-z]{32,44}):([A-Z0-9]{1,8})$/.exec(ix.parsed); if (m && BY_SYM[m[2]]) launches.push({ mint: m[1], stock: m[2], creator: by, sig, at });
        m = /^z3r0:payout:([1-9A-HJ-NP-Za-km-z]{32,44}):([1-9A-HJ-NP-Za-km-z]{32,44}|SOL):(\d{1,3}):(\d{1,24})$/.exec(ix.parsed); if (m) rounds.push({ coin: m[1], stockMint: m[2], wallets: +m[3], raw: m[4], by, sig, at }); } }); }
  const seen = new Set(); return { launches: launches.filter(l => !seen.has(l.mint) && seen.add(l.mint)), rounds }; }); }
// a coin counts when its launch memo is on-chain AND z3r0 built that launch for the same wallet (the card file is written once, at build time)
async function coins() { return memo('coins', 20000, async () => { const [S, B] = await Promise.all([scan(), board().catch(() => null)]); const cards = await Promise.all(S.launches.slice(0, 120).map(l => memo('card:' + l.mint, 3600e3, () => readFile('coin/' + l.mint + '.json'))));
  const ok = S.launches.slice(0, 120).map((l, i) => ({ l, c: cards[i] })).filter(x => x.c && x.c.creator === x.l.creator && x.c.stock === x.l.stock);
  const J = await jupInfo(ok.map(x => x.l.mint)), su = B && B.sol, stockBy = Object.fromEntries(((B && B.stocks) || []).map(s => [s.sym, s]));
  const paid = {}; for (const r of S.rounds) paid[r.coin] = (paid[r.coin] || 0) + 1;
  return { at: Date.now(), pad: PIN.pad, coins: ok.map(({ l, c }) => { const j = J[l.mint] || {}, st = stockBy[l.stock] || BY_SYM[l.stock] || {};
    return { mint: l.mint, pool: c.pool, name: j.name || c.name, symbol: j.symbol || c.symbol, image: c.image, desc: c.desc || '', links: c.links || {}, creator: l.creator, at: l.at, sig: l.sig, stock: l.stock, stockIcon: st.icon || null, stockRank: st.rank || null,
      openUsd: c.openUsd, gradUsd: c.gradUsd, raiseSol: c.raiseSol, usd: j.usd ?? null, mcap: j.mcap ?? null, ch24: j.ch24 ?? null, vol24: j.vol24 ?? null, holders: j.holders ?? null, liquidity: j.liquidity ?? null, curve: j.curve ?? (j.mcap && c.gradUsd ? Math.max(0, Math.min(100, (j.mcap - c.openUsd) / (c.gradUsd - c.openUsd) * 100)) : null), onPad: !!c.pad, rounds: paid[l.mint] || 0 }; }) }; }); }
async function candles(mint) { const c = (await coins()).coins.find(x => x.mint === mint); if (!c) throw new Error('not a z3r0 coin');
  return memo('k:' + mint, 30000, async () => { let rows = []; try { const j = await getJ(`${HISTORY_API}/kline?poolId=${c.pool}&interval=15m&limit=300`); rows = ((j && j.data && j.data.rows) || []).map(r => ({ t: r.t, o: +r.o, h: +r.h, l: +r.l, c: +r.c })).sort((a, b) => a.t - b.t); } catch { } return { mint, rows, unit: 'SOL per coin', interval: '15m' }; }); }
async function coin(mint) { const C = await coins(), c = C.coins.find(x => x.mint === mint); if (!c) throw new Error('not a z3r0 coin');
  const [B, S] = await Promise.all([board(), scan()]); const st = B.stocks.find(s => s.sym === c.stock) || null;
  return { coin: c, stock: st || { sym: c.stock, name: (BY_SYM[c.stock] || {}).name, how: (BY_SYM[c.stock] || {}).how, icon: c.stockIcon, off: true }, stockMint: (BY_SYM[c.stock] || {}).mint || null, rounds: S.rounds.filter(r => r.coin === mint).slice(0, 30), feePct: CFG.feePct, payoutsLive: !!PIN.pad && c.onPad, sol: B.sol }; }

// ---------------------------------------------------------------- wallets and holders
async function walletView(addr) { const w = pk(addr, 'bad wallet'); const [lam, a, b] = await Promise.all([conn.getBalance(w), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_PROGRAM_ID }), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_2022_PROGRAM_ID })]);
  const held = {}; for (const x of [...a.value, ...b.value]) { const i = x.account.data.parsed.info, ui = +i.tokenAmount.uiAmountString; if (ui > 0) held[i.mint] = (held[i.mint] || 0) + ui; }
  const mints = Object.keys(held).slice(0, 180), [J, C, su] = await Promise.all([jupInfo(mints), coins().catch(() => ({ coins: [] })), solUsd()]); const mine = Object.fromEntries(C.coins.map(c => [c.mint, c]));
  const tokens = mints.map(m => { const j = J[m] || {}, st = BY_MINT[m], c = mine[m]; return { mint: m, amount: held[m], symbol: st ? st.key : (j.symbol || m.slice(0, 4)), name: st ? st.name : (j.name || ''), icon: c ? c.image : j.icon || null, price: j.usd ?? null, usd: j.usd != null ? held[m] * j.usd : null, kind: st ? 'layer' : c ? 'z3r0' : 'coin', stock: c ? c.stock : null }; }).sort((x, y) => (y.usd || 0) - (x.usd || 0));
  return { wallet: w.toBase58(), sol: lam / 1e9, solUsd: su ? lam / 1e9 * su : null, totalUsd: (su ? lam / 1e9 * su : 0) + tokens.reduce((s, t) => s + (t.usd || 0), 0), tokens, launched: C.coins.filter(c => c.creator === w.toBase58()).map(c => c.mint) }; }
async function holdersOf(mintStr) { const mint = pk(mintStr, 'bad mint'), acc = await conn.getAccountInfo(mint); if (!acc) throw new Error('mint not found'); const prog = acc.owner; let rows = [], full = true;
  try { const r = await conn.getParsedProgramAccounts(prog, { filters: [...(prog.equals(SPL.TOKEN_PROGRAM_ID) ? [{ dataSize: 165 }] : []), { memcmp: { offset: 0, bytes: mint.toBase58() } }] }); rows = r.map(x => ({ owner: x.account.data.parsed.info.owner, raw: BigInt(x.account.data.parsed.info.tokenAmount.amount) })); }
  catch (e) { full = false; let top; try { top = await conn.getTokenLargestAccounts(mint); } catch { throw new Error('the public Solana RPC is rate-limiting holder lists right now. try again in a minute'); } const infos = await conn.getMultipleParsedAccounts(top.value.map(x => x.address)); rows = infos.value.map((x, i) => x ? { owner: x.data.parsed.info.owner, raw: BigInt(top.value[i].amount) } : null).filter(Boolean); }
  const by = {}; for (const r of rows) { if (r.raw <= 0n) continue; let on = false; try { on = PublicKey.isOnCurve(new PublicKey(r.owner).toBytes()); } catch { } if (!on) continue; by[r.owner] = (by[r.owner] || 0n) + r.raw; }   // off-curve owners are pools and vaults
  return { full, list: Object.entries(by).map(([owner, raw]) => ({ owner, raw })).sort((a, b) => (b.raw > a.raw ? 1 : -1)) }; }

// ---------------------------------------------------------------- LaunchLab: the curve, a launch, the launchpad, its fees
let chainCache = null;
async function chain() { if (chainCache && Date.now() - chainCache.t < 120000) return chainCache.v; const [ca, pa] = await conn.getMultipleAccountsInfo([CONFIG, RAYDIUM_PLATFORM]); if (!ca) throw new Error('could not read LaunchLab');
  const v = { cfg: R.LaunchpadConfig.decode(ca.data), ray: pa ? R.PlatformConfig.decode(pa.data) : null }; chainCache = { t: Date.now(), v }; return v; }
// LaunchLab's constant-product curve with the graduation price equal to the pool's opening price:
//   run = graduation / start,  sold share = sqrt(run) / (1 + sqrt(run)),  SOL raised = graduation x (1 - sold share)
function curveOf(startSol, run) { const q = Math.sqrt(run), sold = q / (1 + q), gradSol = startSol * run; return { run, sold, raise: gradSol * (1 - sold), startSol, gradSol }; }
async function sdk(owner) { const r = await R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' }); if (module.exports._t.onLoad) module.exports._t.onLoad(r); return r; }
const fits = t => { try { return t.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232; } catch { return false; } };
const txsOf = m => m.transactions ? m.transactions : [{ instructions: m.transaction && m.transaction.instructions && m.transaction.instructions.length ? m.transaction.instructions : m.builder.allInstructions }];
async function finish(txs, wallet, signers, extra, simulate) { const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const mk = ixs => { const t = new Transaction(); t.add(...ixs); t.feePayer = wallet; t.recentBlockhash = blockhash; const need = signers.filter(s => t.instructions.some(ix => ix.keys.some(k => k.isSigner && k.pubkey.equals(s.publicKey)))); if (need.length) t.partialSign(...need); return t; };
  let list = txs.map((tx, i) => mk(i === 0 && extra ? [...tx.instructions, ...extra] : tx.instructions)); if (extra && !fits(list[0])) { list = txs.map(tx => mk(tx.instructions)); list.push(mk(extra)); }
  let sim = null; if (simulate) { const r = await conn.simulateTransaction(list[0]); sim = { err: r.value.err, units: r.value.unitsConsumed, logs: (r.value.logs || []).slice(-12) }; }
  return { txs: list.map(t => Buffer.from(t.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64')), sim }; }

async function img(req) { const b = await body(req); const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || '')); if (!m) throw new Error('pick a png, jpg, webp or gif image');
  const buf = Buffer.from(m[3], 'base64'); if (buf.length > 1.5e6) throw new Error('that image is too big (1.5 MB max)'); if (buf.length < 100) throw new Error('that image is empty');
  return { url: await putFile(`img/${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24)}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`, buf, m[1]) }; }

async function buildLaunch(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first');
  const name = clean(b.name, 32), symbol = clean(b.symbol, 10).toUpperCase().replace(/[^A-Z0-9]/g, ''), desc = clean(b.desc, 400);
  if (name.length < 2) throw new Error('give the coin a name'); if (symbol.length < 2) throw new Error('give the coin a ticker (2 to 10 letters or numbers)');
  const image = link(b.image, null, 'image'); if (!image) throw new Error('add an image');
  const links = { website: link(b.website, null, 'website'), x: link(b.x, /^https:\/\/(x|twitter)\.com\//, 'X link', 'https://x.com/'), telegram: link(b.telegram, /^https:\/\/t\.me\//, 'Telegram link', 'https://t.me/') };
  // one privacy layer per coin, and only a layer that is on the board right now
  const B = await board(), stock = B.stocks.find(s => s.sym === String(b.stock || '').toUpperCase()); if (!stock) throw new Error('pick one privacy layer from the board');
  const openUsd = +b.openUsd || CFG.openDefault; if (!CFG.openUsd.includes(openUsd)) throw new Error('the open is $8K, $9K, $10K or $11K'); if (!(B.sol > 0)) throw new Error('could not read the SOL price. try again in a moment');
  const { cfg } = await chain(), c = curveOf(openUsd / B.sol, RUN), minRaise = +cfg.minFundRaisingB.toString() / 1e9, minSold = +cfg.minSellRateA.toString() / PPM, maxSold = 1 - +cfg.minMigrateRateA.toString() / PPM;
  if (c.raise < minRaise) throw new Error(`LaunchLab's minimum raise is ${minRaise} SOL; this curve raises ${c.raise.toFixed(1)}`); if (c.sold < minSold || c.sold > maxSold) throw new Error('that curve sells too little or too much of the supply');
  const sell = new BN(String(Math.floor(c.sold * 1e9) * 1e6)), raise = new BN(String(Math.round(c.raise * 1e9)));
  const buySol = Math.max(0, +b.buySol || 0); if (buySol > Math.min(CFG.maxFirstBuySol, c.raise / 2)) throw new Error(`the first buy can be up to ${Math.min(CFG.maxFirstBuySol, c.raise / 2).toFixed(1)} SOL`);
  const bal = await conn.getBalance(wallet).catch(() => null); if (bal != null && bal < (buySol + 0.03) * 1e9) throw new Error(`your wallet needs about ${(buySol + 0.03).toFixed(2)} SOL for this launch`);
  let padId = RAYDIUM_PLATFORM; if (PIN.pad) { padId = pk(PIN.pad, 'bad launchpad'); const pa = await conn.getAccountInfo(padId); if (!pa || !pa.owner.equals(PROGRAM)) throw new Error('the z3r0 launchpad could not be read'); }
  // the metadata every wallet and explorer reads: written once, with the privacy layer in it
  const meta = { name, symbol, description: (desc ? desc + ' ' : '') + `Paired with ${stock.name} (${stock.tok}) on z3r0.`, image, layer: stock.sym, ...(stock.mint && { layerMint: stock.mint }), ...(links.website && { website: links.website }), ...(links.x && { twitter: links.x }), ...(links.telegram && { telegram: links.telegram }), createdOn: 'z3r0' };
  const js = JSON.stringify(meta), uri = await putFile(`meta/${crypto.createHash('sha256').update(js).digest('hex').slice(0, 24)}.json`, js, 'application/json'); if (uri.length > 200) throw new Error('metadata link too long');
  const mint = Keypair.generate(), raydium = await sdk(wallet);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({ programId: PROGRAM, mintA: mint.publicKey, decimals: 6, name, symbol, uri, migrateType: 'cpmm', configId: CONFIG, configInfo: cfg, mintBDecimals: 9, platformId: padId,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0, supply: SUPPLY, totalSellA: sell, totalFundRaisingB: raise, totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    extraSigners: [mint], feePayer: wallet, computeBudgetConfig: { units: 600000, microLamports: 60000 } });
  const r = await finish(transactions, wallet, [mint], [memoIx(`z3r0:launch:${mint.publicKey.toBase58()}:${stock.sym}`), tagIx(wallet)], !!b.simulate);
  const pool = (extInfo && extInfo.address && extInfo.address.poolId && extInfo.address.poolId.toBase58()) || R.getPdaLaunchpadPoolId(PROGRAM, mint.publicKey, WSOL).publicKey.toBase58();
  const card = { mint: mint.publicKey.toBase58(), pool, name, symbol, image, desc, links, stock: stock.sym, creator: wallet.toBase58(), openUsd, gradUsd: openUsd * RUN, raiseSol: +c.raise.toFixed(3), sold: +c.sold.toFixed(4), pad: PIN.pad || null, built: Date.now() };
  if (!b.simulate) await putFile('coin/' + card.mint + '.json', JSON.stringify(card), 'application/json');
  return { mint: card.mint, pool, uri, stock: stock.sym, curve: { openUsd, gradUsd: openUsd * RUN, raiseSol: c.raise, sold: c.sold, startSol: c.startSol }, ...r }; }

function decodePad(id, data) { const p = R.PlatformConfig.decode(data); return { id: id.toBase58(), name: str(p.name), feePct: pct(p.feeRate), lp: { burn: pct(p.burnScale), platform: pct(p.platformScale) }, claimWallet: p.platformClaimFeeWallet.toBase58() }; }
async function pad(q) { const id = q.get('id') ? pk(q.get('id'), 'bad pad id') : padIdOf(pk(q.get('admin'), 'bad wallet')); const [acc, vault] = await conn.getMultipleAccountsInfo([id, vaultOf(id)]);
  if (!acc || !acc.owner.equals(PROGRAM)) return { exists: false, id: id.toBase58(), pinned: PIN.pad };
  return { exists: true, ...decodePad(id, acc.data), vault: vaultOf(id).toBase58(), unclaimedSol: vault && vault.data.length >= 72 ? Number(vault.data.readBigUInt64LE(64)) / 1e9 : 0, pinned: PIN.pad }; }
// the z3r0 launchpad: 1% of every curve trade goes to the wallet that created it, which buys each coin's privacy token for its holders (or pays SOL where the token has no Solana route); half the graduation liquidity is burned
async function buildPad(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet); if (await conn.getAccountInfo(id)) throw new Error(`this wallet already has a launchpad (${id.toBase58()}). one per wallet.`);
  const { ray } = await chain(); if (!ray) throw new Error('could not read Raydium’s platform settings'); const burn = Math.round(CFG.burnPct * 1e4), host = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'z3r0-alpha.vercel.app'), raydium = await sdk(wallet);
  const made = await raydium.launchpad.createPlatformConfig({ programId: PROGRAM, platformAdmin: wallet, platformClaimFeeWallet: wallet, platformLockNftWallet: wallet, platformVestingWallet: wallet, cpConfigId: ray.cpConfigId,
    migrateCpLockNftScale: { platformScale: new BN(PPM - burn), creatorScale: new BN(0), burnScale: new BN(burn) }, transferFeeExtensionAuth: wallet, creatorFeeRate: new BN(0), feeRate: new BN(Math.round(CFG.feePct * 1e4)),
    name: CFG.name, web: host, img: host + '/icon.png', txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return { pad: id.toBase58(), ...(await finish(txsOf(made), wallet, [], [memoIx('z3r0:pad'), tagIx(wallet)], !!b.simulate)) }; }
async function claim(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet); if (!(await conn.getAccountInfo(id))) throw new Error('this wallet has no launchpad');
  const raydium = await sdk(wallet), made = await raydium.launchpad.claimVaultPlatformFee({ programId: PROGRAM, platformId: id, mintB: WSOL, claimFeeWallet: wallet, txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return finish(txsOf(made), wallet, [], null, !!b.simulate); }
// a payout round: what the fee wallet bought goes to a coin's holders, pro rata, straight from that wallet.
// it is paid in the layer's own token when that token trades on Solana; otherwise in SOL
async function buildPayout(req) { const b = await body(req), w = pk(b.wallet, 'connect the payout wallet'), C = (await coins()).coins.find(c => c.mint === String(b.coin)); if (!C) throw new Error('pick a z3r0 coin');
  const L = BY_SYM[C.stock] || {}, coinPk = new PublicKey(C.mint), inSol = !L.mint, total = BigInt(b.amountRaw || '0'); if (total <= 0n) throw new Error('nothing to pay out'); const minRaw = BigInt(b.minRaw || '0'), from = Math.max(0, +b.offset || 0);
  let tok = null, prog = null, dec = 9; if (!inSol) { tok = new PublicKey(L.mint); const acc = await conn.getAccountInfo(tok); if (!acc) throw new Error('layer token not found on Solana'); prog = acc.owner; dec = (await SPL.getMint(conn, tok, 'confirmed', prog)).decimals; }
  const { full, list } = await holdersOf(C.mint), sum = list.reduce((a, x) => a + x.raw, 0n); if (!sum) throw new Error('this coin has no holders yet');
  const pays = list.map(x => ({ owner: x.owner, amt: total * x.raw / sum })).filter(x => x.amt > 0n && x.amt >= minRaw && x.owner !== w.toBase58()), slice = pays.slice(from, from + 42);
  const src = inSol ? null : SPL.getAssociatedTokenAddressSync(tok, w, false, prog), { blockhash } = await conn.getLatestBlockhash('confirmed'), txs = [];
  for (let i = 0; i < slice.length; i += 7) { const t = new Transaction(), part = slice.slice(i, i + 7); t.feePayer = w; t.recentBlockhash = blockhash;
    for (const p of part) { const o = new PublicKey(p.owner);
      if (inSol) t.add(SystemProgram.transfer({ fromPubkey: w, toPubkey: o, lamports: p.amt }));
      else { const ata = SPL.getAssociatedTokenAddressSync(tok, o, true, prog); t.add(SPL.createAssociatedTokenAccountIdempotentInstruction(w, ata, o, tok, prog), SPL.createTransferCheckedInstruction(src, tok, ata, w, p.amt, dec, [], prog)); } }
    t.add(memoIx(`z3r0:payout:${coinPk.toBase58()}:${inSol ? 'SOL' : tok.toBase58()}:${part.length}:${part.reduce((a, p) => a + p.amt, 0n)}`), tagIx(w)); txs.push(t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')); }
  cache.delete('scan'); return { txs, holders: list.length, paid: pays.length, next: from + slice.length < pays.length ? from + slice.length : null, fullHolderList: full, stock: C.stock, paidIn: inSol ? 'SOL' : L.key, decimals: dec }; }
async function sendTxs(req) { const b = await body(req); if (!Array.isArray(b.txs) || !b.txs.length || b.txs.length > 6) throw new Error('nothing to send'); const sigs = [];
  for (const t of b.txs) { const sig = await conn.sendRawTransaction(Buffer.from(t, 'base64'), { skipPreflight: false, maxRetries: 3 }); sigs.push(sig);
    for (let k = 0; k < 40; k++) { const s = (await conn.getSignatureStatuses([sig])).value[0]; if (s && s.err) throw new Error('transaction failed: ' + JSON.stringify(s.err)); if (s && /confirmed|finalized/.test(s.confirmationStatus || '')) break; await sleep(700); } }
  cache.delete('scan'); cache.delete('coins'); return { sigs }; }
async function status() { const [B, C, S] = await Promise.all([board().catch(() => null), coins().catch(() => null), scan().catch(() => null)]); let p = null; if (PIN.pad) p = await pad(new URLSearchParams({ id: PIN.pad })).catch(() => null);
  return { name: CFG.name, tag: TAG.toBase58(), pad: PIN.pad, padInfo: p, payoutsLive: !!(p && p.exists), feePct: CFG.feePct, open: CFG.openUsd, openDefault: CFG.openDefault, run: RUN, boardSize: CFG.layers.length, storage: hasStore(), sol: B && B.sol, stocks: B ? B.stocks.length : null, layers: CFG.layers.length, routes: B ? B.stocks.filter(x => x.route).length : null, basis: B && B.basis, coins: C ? C.coins.length : null, rounds: S ? S.rounds.length : null, maxFirstBuySol: CFG.maxFirstBuySol }; }

module.exports = async (req, res) => { const q = new URL(req.url, 'http://x').searchParams, a = q.get('a'); if (req.method === 'GET') res.setHeader('access-control-allow-origin', '*');
  try {
    if (a === 'status') return out(res, 200, await status(), 's-maxage=15, stale-while-revalidate=60');
    if (a === 'board') return out(res, 200, await board(), 's-maxage=30, stale-while-revalidate=120');
    if (a === 'coins') return out(res, 200, await coins(), 's-maxage=10, stale-while-revalidate=40');
    if (a === 'coin') return out(res, 200, await coin(String(q.get('mint'))), 's-maxage=10, stale-while-revalidate=40');
    if (a === 'candles') return out(res, 200, await candles(String(q.get('mint'))), 's-maxage=20, stale-while-revalidate=60');
    if (a === 'wallet') return out(res, 200, await walletView(q.get('addr')));
    if (a === 'holders') { const h = await holdersOf(q.get('mint')), sum = h.list.reduce((s, x) => s + x.raw, 0n); return out(res, 200, { full: h.full, count: h.list.length, top: h.list.slice(0, 20).map(x => ({ owner: x.owner, pct: sum ? Number(x.raw * 10000n / sum) / 100 : 0 })) }, 's-maxage=30'); }
    if (a === 'rounds') return out(res, 200, { rounds: (await scan()).rounds }, 's-maxage=20');
    if (a === 'pad') return out(res, 200, await pad(q), 's-maxage=10');
    if (req.method === 'POST' && a === 'img') return out(res, 200, await img(req));
    if (req.method === 'POST' && a === 'buildLaunch') return out(res, 200, await buildLaunch(req));
    if (req.method === 'POST' && a === 'buildPad') return out(res, 200, await buildPad(req));
    if (req.method === 'POST' && a === 'claim') return out(res, 200, await claim(req));
    if (req.method === 'POST' && a === 'buildPayout') return out(res, 200, await buildPayout(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await sendTxs(req));
    return out(res, 404, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: e.message || String(e) }); } };
module.exports._t = { board, coins, coin, scan, curveOf, buildLaunch, buildPad, claim, buildPayout, conn, cache, setChain: v => { chainCache = { t: Date.now() + 1e9, v }; }, setPerf: v => { PERF = v; } };
