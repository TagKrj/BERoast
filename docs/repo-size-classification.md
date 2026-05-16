# Repository Size Classification

The repository size check must be deterministic. Do not use AI to decide the `sizeLabel`, because repeated checks can produce different labels for the same repository.

## Labels

The API keeps the existing labels:

- `small`: low review effort.
- `medium`: moderate review effort.
- `large`: high review effort, requires the user's personal OpenAI API key.

## Counted Metrics

Use these metrics from the GitHub tree:

- `fileCount`: all files in the repo tree.
- `totalBytes`: total bytes of all files.
- `reviewableFileCount`: files that are useful for source review.
- `reviewableBytes`: bytes of reviewable files.
- `assetBytes`: image, font, binary, archive, minified, lockfile, media, and 3D asset bytes.
- `treeTruncated`: GitHub returned a truncated tree.

Reviewable files include common source/config/text extensions such as `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.go`, `.html`, `.css`, `.scss`, `.json`, `.yml`, `.sql`, and `.md`.

Non-reviewable files include common generated/binary/heavy asset patterns such as lockfiles, minified files, source maps, images, videos, archives, fonts, and 3D models.

## Thresholds

### Small

Classify as `small` when all are true:

- `reviewableFileCount <= 50`
- `reviewableBytes <= 500,000`
- `fileCount <= 250`
- `treeTruncated === false`

### Medium

Classify as `medium` when the repo exceeds `small`, but all are still true:

- `reviewableFileCount <= 250`
- `reviewableBytes <= 2,500,000`
- `fileCount <= 1,500`
- `totalBytes <= 75,000,000`
- `treeTruncated === false`

### Large

Classify as `large` when any are true:

- `reviewableFileCount > 250`
- `reviewableBytes > 2,500,000`
- `fileCount > 1,500`
- `totalBytes > 75,000,000`
- `treeTruncated === true`

## Why This Fixes Inconsistent Results

Previously, Gemini classified repository size. That made the label unstable because AI can interpret asset-heavy repositories differently each time.

Now the label is rule-based. For the same repository commit, the same metrics always produce the same result.

