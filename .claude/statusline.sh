#!/usr/bin/env bash
# Status line: shows 5-hour session and context usage, and saves the session %
# to .claude/usage.json for the task-runner usage guard.
input=$(cat)
dir=$(jq -r '.workspace.project_dir // .cwd // empty' <<<"$input")
dir=${dir:-$PWD}
five=$(jq -r '.rate_limits.five_hour.used_percentage // empty' <<<"$input")
reset=$(jq -r '.rate_limits.five_hour.resets_at // empty' <<<"$input")
ctx=$(jq -r '.context_window.used_percentage // empty' <<<"$input")
if [ -n "$five" ]; then
  jq -n --argjson p "$five" --arg r "$reset" --argjson t "$(date +%s)" \
    '{five_hour: $p, resets_at: ($r | tonumber? // null), updated_at: $t}' > "$dir/.claude/usage.json"
fi
five=${five%.*}
ctx=${ctx%.*}
printf 'session %s%% · ctx %s%%' "${five:-?}" "${ctx:-?}"
