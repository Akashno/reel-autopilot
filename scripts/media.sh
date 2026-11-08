#!/usr/bin/env bash
# Adds a day's video to the `media` branch, which GitHub Pages serves at
#   https://<owner>.github.io/<repo>/<date>.mp4
# The branch is one commit holding the last KEEP_DAYS days, force-pushed each time, so the
# repository doesn't grow by a video a day. Usage: scripts/media.sh <date> <mp4> <reel.json>
set -euo pipefail
date="$1"; mp4="$2"; reel="$3"
keep="${KEEP_DAYS:-14}"
dir="$(mktemp -d)"

if git ls-remote --exit-code --heads origin media >/dev/null 2>&1; then
  git fetch --depth 1 origin media
  git worktree add "$dir" FETCH_HEAD --detach
else
  git worktree add --detach "$dir"
  (cd "$dir" && git rm -rq --ignore-unmatch . && git clean -fdxq)
fi

cp "$mp4" "$dir/$date.mp4"
cp "$reel" "$dir/$date.json"
touch "$dir/.nojekyll"
cutoff="$(date -u -d "$date -$keep days" +%F 2>/dev/null || date -u -j -v-"$keep"d -f %F "$date" +%F)"
for f in "$dir"/????-??-??.*; do
  d="$(basename "$f" | cut -c1-10)"
  [[ "$d" < "$cutoff" ]] && rm -f "$f"
done
# A plain index so the Pages root isn't a 404.
{
  echo '<!doctype html><meta charset="utf-8"><title>Reels</title><ul>'
  for f in $(ls "$dir" | grep -E '^[0-9-]{10}\.mp4$' | sort -r); do echo "<li><a href=\"$f\">$f</a></li>"; done
  echo '</ul>'
} > "$dir/index.html"

cd "$dir"
git checkout -q --orphan media-new
git add -A
git -c user.name="reel-bot" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -qm "media: $date"
git push -q -f origin HEAD:media
cd - >/dev/null
git worktree remove --force "$dir"
echo "media branch updated with $date.mp4"
