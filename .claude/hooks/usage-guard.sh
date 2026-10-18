#!/usr/bin/env bash
# PreToolUse: during a task-runner onward run (.claude/run.lock exists), stop
# Claude once 5-hour session usage reaches the run's threshold (default 95).
dir=${CLAUDE_PROJECT_DIR:-$PWD}/.claude
lock=$dir/run.lock
usage=$dir/usage.json
[ -f "$lock" ] && [ -f "$usage" ] || exit 0
updated=$(jq -r '.updated_at // 0' "$usage")
[ $(( $(date +%s) - updated )) -le 600 ] || exit 0
pct=$(jq -r '.five_hour // 0' "$usage")
limit=$(tr -dc '0-9' < "$lock")
limit=${limit:-95}
if awk -v p="$pct" -v l="$limit" 'BEGIN { exit !(p >= l) }'; then
  rm -f "$lock"
  jq -n --arg r "Session usage ${pct%.*}% reached ${limit}%: task-runner stopped. Say \"next task\" after the limit resets." \
    '{continue: false, stopReason: $r}'
fi
exit 0
