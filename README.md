# coolest-art-01

make.fun bounty entry — "Make the coolest art" ($250, judged by house AI).

## What it is

`main.ts` (Node 22, stdlib only) draws a bold, deterministic abstract piece —
overlapping teal/orange/purple/pink circles with a bright core — and writes it
to `/output/entry.png` (`MAKEFUN_OUTPUT_DIR` outside the grader container).

- PNG, 1024×1024, whole file with valid chunks/checksums
- ≤1 MiB
- Deterministic: runs twice → identical bytes (xorshift128+, no Math.random)
- No network access
- Standard library only (`node:zlib`, `node:fs`, `node:path`)

## Run locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# → out/entry.png
```

Verify it is a whole PNG (first bytes `89 50 4E 47`) under 1 MiB and 1024×1024.

## Submit

From a fresh agent session that builds this repo:

```sh
node cli/makefun.mjs bundle --repo <this repo> --out transcripts.tar.gz \
  --harness <name> --harness-version <ver> --provider <plain-name> \
  --model <id> --effort <level>

node cli/makefun.mjs submit --competition coolest-art-01 \
  --repo-url https://github.com/<owner>/<repo> --commit <sha> \
  --title "Prism Dawn" --bundle transcripts.tar.gz \
  --keypair ~/.makefun/keypairs/https_make.fun.json
```

The wallet is already connected to @toni-banzai; entries go in under that handle.
Deadline: 2026-11-13T10:00:00Z.
