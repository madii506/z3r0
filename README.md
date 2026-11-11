# z3r0

The launchpad for coins paired with privacy layers. One coin, one layer: Zcash, Monero, Railgun, Nym and the rest, on Raydium LaunchLab.

- `index.html` + `assets/`: the intro and the terminal (wall, feed, pulse, launch, vault, docs, ops). No build step.
- `api/z3r0.js`: one serverless function. Prices from CoinGecko (optional `CG_KEY` env for a demo key), launches on Raydium LaunchLab, the chain index read from the tag address in `api/z3r0-config.json`.
- `api/z3r0-config.json`: every privacy layer z3r0 tracks. A layer pays holders in its own token only when `mint` is set to that token's Solana mint; otherwise in SOL.
- Storage: a Vercel Blob store (`BLOB_READ_WRITE_TOKEN`) for images, metadata, coin cards and the price sheets.

Every transaction is signed in the visitor's own wallet. z3r0 never holds keys or coins.
