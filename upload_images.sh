#!/bin/bash
# Uploads page scan images to GitHub Releases — one release per book (tag: images-<slug>).
# Auto-discovers analyzed books from dashboard/public/data/index.json.
# Incremental: skips images already present on the remote release.
# Safe to re-run after adding new books.
#
# Usage:   bash upload_images.sh
# Requires: gh CLI authenticated with `repo` scope.

set -u
REPO=sarmadchandio/book-analysis
INDEX=dashboard/public/data/index.json
BATCH_SIZE=25

command -v gh >/dev/null || { echo "gh CLI not found"; exit 1; }
command -v jq >/dev/null || command -v python >/dev/null || { echo "need jq or python"; exit 1; }

read_slugs() {
  if command -v jq >/dev/null; then
    jq -r '.books[].name' "$INDEX" | tr -d '\r'
  else
    python -c "import json,sys;sys.stdout.write('\n'.join(b['name'] for b in json.load(open(sys.argv[1]))['books']))" "$INDEX" | tr -d '\r'
  fi
}

grand_total=0
grand_skipped=0

for slug in $(read_slugs); do
  tag="images-${slug}"
  img_dir="books/${slug}/images"

  if [ ! -d "$img_dir" ]; then
    echo "SKIP no-dir slug=$slug"
    continue
  fi
  first_img=$(find "$img_dir" -maxdepth 1 -type f -print -quit 2>/dev/null)
  if [ -z "$first_img" ]; then
    echo "SKIP empty-dir slug=$slug"
    continue
  fi

  # Ensure release exists
  if ! gh release view "$tag" --repo "$REPO" >/dev/null 2>&1; then
    gh release create "$tag" --repo "$REPO" --title "Page scans: $slug" \
      --notes "Page scan images for book \`$slug\`." >/dev/null
    echo "CREATED release tag=$tag"
  fi

  # Fetch existing asset names into a lookup file
  existing=$(mktemp)
  gh release view "$tag" --repo "$REPO" --json assets --jq '.assets[].name' > "$existing" 2>/dev/null || true

  uploaded=0
  skipped=0
  args=()
  for img in "$img_dir"/*; do
    [ -f "$img" ] || continue
    base=$(basename "$img")
    if grep -Fxq "$base" "$existing"; then
      skipped=$((skipped+1))
      continue
    fi
    args+=("$img")
    if [ ${#args[@]} -ge $BATCH_SIZE ]; then
      if gh release upload "$tag" --repo "$REPO" "${args[@]}" >/dev/null 2>&1; then
        uploaded=$((uploaded+${#args[@]}))
        echo "UPLOADED slug=$slug batch=${#args[@]} total_uploaded=$uploaded"
      else
        echo "FAILED batch slug=$slug — retrying individually"
        for f in "${args[@]}"; do
          if gh release upload "$tag" --repo "$REPO" "$f" >/dev/null 2>&1; then
            uploaded=$((uploaded+1))
          else
            echo "  FAIL $f"
          fi
        done
      fi
      args=()
    fi
  done
  if [ ${#args[@]} -gt 0 ]; then
    if gh release upload "$tag" --repo "$REPO" "${args[@]}" >/dev/null 2>&1; then
      uploaded=$((uploaded+${#args[@]}))
    else
      for f in "${args[@]}"; do
        gh release upload "$tag" --repo "$REPO" "$f" >/dev/null 2>&1 && uploaded=$((uploaded+1)) || echo "  FAIL $f"
      done
    fi
  fi
  rm -f "$existing"
  echo "DONE_BOOK slug=$slug uploaded=$uploaded skipped=$skipped"
  grand_total=$((grand_total+uploaded))
  grand_skipped=$((grand_skipped+skipped))
done

echo "ALL_DONE uploaded=$grand_total skipped=$grand_skipped"
