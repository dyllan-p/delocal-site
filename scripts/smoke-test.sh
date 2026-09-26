#!/bin/sh
# Runs check-site.sh and check-install.sh against a deployed site, retrying
# until both pass or the time runs out. A first deploy has to provision the
# custom domain and its certificate, which can take a few minutes.
#
# Usage: sh scripts/smoke-test.sh <base-url> [--preview]
#
#   --preview   Passed to check-site.sh: expect a preview build.
#
# SMOKE_TIMEOUT sets how long to keep trying, in seconds (default 600).
# Exits non-zero, with the last attempt's output, if the checks never pass.
set -eu

[ $# -ge 1 ] || {
	echo "usage: sh scripts/smoke-test.sh <base-url> [--preview]" >&2
	exit 2
}
base=$1
shift

dir=$(dirname "$0")
log=$(mktemp)
trap 'rm -f "$log"' EXIT
trap 'exit 1' HUP INT TERM

timeout=${SMOKE_TIMEOUT:-600}
start=$(date +%s)
attempt=1
while :; do
	if sh "$dir/check-site.sh" "$base" "$@" >"$log" 2>&1 &&
		sh "$dir/check-install.sh" "$base" --run >>"$log" 2>&1; then
		cat "$log"
		echo "Smoke test passed on attempt $attempt."
		exit 0
	fi
	elapsed=$(($(date +%s) - start))
	if [ "$elapsed" -ge "$timeout" ]; then
		cat "$log"
		echo "Smoke test still failing after ${elapsed}s ($attempt attempts)."
		exit 1
	fi
	echo "Attempt $attempt failed after ${elapsed}s; retrying in 15s."
	grep '^FAIL' "$log" | sed 's/^/      /' || true
	attempt=$((attempt + 1))
	sleep 15
done
