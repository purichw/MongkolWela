# Recovery Checkpoints

## National Registry Cleanup, 2026-10-16

- Approved: remove the 3,389 candidate rows from `public/assets/data/temples-thailand.json`, retaining 41,316 rows and every retained metadata column. Do not change Popular, Sacred or Mu source data.
- Scope: this working tree and its release. No purge of Git history, old deployments, other checkouts or backups.
- Before mutation, the original registry and exact proposal were copied and byte-verified in `artifacts/directory-places/pre-prune-20261016/`. Tracked diff and status are also saved there. This local checkpoint is not a deployed asset.
- Original registry SHA-256: `df1585a52438ca7616250a4572fe9cf06f97c707851fa169aba1ba30d712a35a`.
- Original committed version: `e4ee69bd4d65ae5ec5743f14ad3d080a0612a0d0:public/assets/data/temples-thailand.json`.
- Restore only after a new user request: verify the checkpoint hash, restore this one registry file, then rebuild its index and rerun registry/CMS tests. Do not reset the branch or overwrite unrelated work.
- Preserve province/district/subdistrict choices as an area-only snapshot before pruning. The approved cleanup has no deferred product removal.
