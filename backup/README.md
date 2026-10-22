# Project backups

[Lingfern](https://lingfern.com)

This is the local project recovery procedure. Run `npm run backup` before changes and delivery. Keep a verified full baseline; later snapshots contain only changed/new files and deletion records. If the protected files have not changed, the command returns the existing recovery point without creating another directory. Snapshots are immutable and written manifest-last. A directory without a manifest is incomplete.

Exclude secrets, `private/`, Git history, dependencies, Python `__pycache__/`, generated `dist/`, `output/` screenshots, browser-tool caches and nested backups. Keep original public assets and resource ZIPs: these are required for restoration. Browser IndexedDB, production services and off-site disaster recovery are outside this scope.

Restore into a directory that does not yet exist:

```sh
node scripts/backup.mjs --restore <UTC-snapshot-name> /tmp/lingfern-restored
```

Restoration verifies SHA-256, replays deletions and never overwrites the working project. Reinstall dependencies and run the build/tests there; configure credentials separately.

## Retention limit

Keep at most **30 complete recovery points**, counting the full baseline and incremental snapshots together. Unchanged backup calls do not consume a recovery point. Before a changed backup would create point31, run the verified consolidation command below, then create the new incremental snapshot. This resets the retained history to one full baseline plus the subsequent changes; it does not retain the latest30 historical versions. Thirty points cover roughly15 before/after edit cycles without allowing unlimited accumulation.

The maintainer authorizes this threshold-based maintenance as a standing rule. Never delete individual incremental links to meet the count. If consolidation fails or free space is insufficient, preserve the old chain and report the failed cleanup; safety takes precedence over the limit. Incomplete directories are not recovery points and may be removed only after a verified replacement exists and no backup is running.

## Verified consolidation

At the retention threshold, or at another explicit maintainer request, run:

```sh
node scripts/backup.mjs --compact
```

This resolves the latest complete snapshot, copies its required files into a new full baseline and verifies every source/copy hash and the standalone manifest before deleting captured older timestamp directories. It removes old recovery points; it does not remove current project files. Validation/copy failure preserves the old chain. Allow free space for one extra full baseline during consolidation. The ordinary backup script does not enforce retention automatically; the agent must check this rule before creating a new recovery point.

Backup and consolidation share an exclusive `backup/.lock`, preventing a new incremental snapshot from referring to a chain being removed. After an interrupted process, verify that no backup/consolidation is running before manually removing a stale lock. Never remove a live lock or a chain link referenced by a retained snapshot.
