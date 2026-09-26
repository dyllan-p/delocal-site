#!/bin/sh
# Checks that <base-url>/install serves the installer as a plain-text shell
# script that is safe to pipe into sh.
#
# Usage: sh scripts/check-install.sh <base-url> [--local] [--run]
#
#   --local  Allow a final URL that is not https://, for wrangler dev.
#   --run    If every check passes, pipe the script into sh and print its output.
#
# Exits non-zero if any check fails, including when curl cannot connect.
set -eu

usage() {
	echo "usage: sh scripts/check-install.sh <base-url> [--local] [--run]" >&2
	exit 2
}

base=
local_mode=0
run_mode=0
for arg in "$@"; do
	case $arg in
	--local) local_mode=1 ;;
	--run) run_mode=1 ;;
	-*) usage ;;
	*)
		[ -z "$base" ] || usage
		base=$arg
		;;
	esac
done
[ -n "$base" ] || usage
url="${base%/}/install"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' HUP INT TERM

failures=0
pass() { printf 'ok    %s\n' "$*"; }
fail() {
	printf 'FAIL  %s\n' "$*"
	failures=$((failures + 1))
}

echo "Checking $url"

rc=0
info=$(curl -fsSL --max-time 30 -D "$tmp/headers" -o "$tmp/body" \
	-w '%{http_code} %{num_redirects} %{url_effective}' "$url") || rc=$?
if [ "$rc" -ne 0 ]; then
	fail "curl exited $rc (HTTP status ${info%% *})"
	exit 1
fi
status=${info%% *}
rest=${info#* }
redirects=${rest%% *}
final_url=${rest#* }

# curl -D writes one header block per hop. Keep only the last one.
tr -d '\r' <"$tmp/headers" |
	awk '/^HTTP\// { block = "" } { block = block $0 "\n" } END { printf "%s", block }' >"$tmp/final"

count_header() { grep -ci "^$1:" "$tmp/final" || true; }
header() { grep -i "^$1:" "$tmp/final" | head -n 1 | sed 's/^[^:]*:[[:space:]]*//'; }

echo "Final response headers:"
sed '/^$/d; s/^/      /' "$tmp/final"

# Status
if [ "$status" = 200 ]; then
	pass "status 200"
else
	fail "status $status, expected 200"
fi

# Redirects
if [ "$redirects" -le 1 ]; then
	pass "$redirects redirect(s)"
else
	fail "$redirects redirects, expected at most 1"
fi
if [ "$local_mode" = 1 ]; then
	case $final_url in
	*/install) pass "ended on $final_url (https not required with --local)" ;;
	*) fail "ended on $final_url, expected .../install" ;;
	esac
else
	case $final_url in
	https://*/install) pass "ended on $final_url" ;;
	*) fail "ended on $final_url, expected https://.../install" ;;
	esac
fi

# Content-Type
n=$(count_header content-type)
value=$(header content-type | tr '[:upper:]' '[:lower:]')
if [ "$n" != 1 ]; then
	fail "$n Content-Type headers, expected exactly 1"
else
	case $value in
	text/plain*) pass "Content-Type: $value" ;;
	*) fail "Content-Type: $value, expected text/plain" ;;
	esac
fi

# Cache-Control: exactly one header, with exactly one max-age of at most 600.
n=$(count_header cache-control)
value=$(header cache-control | tr '[:upper:]' '[:lower:]')
max_age=$(printf '%s\n' "$value" | awk '{
	n = 0; s = $0
	while (match(s, /max-age=[0-9]+/)) { n++; v = substr(s, RSTART + 8, RLENGTH - 8); s = substr(s, RSTART + RLENGTH) }
	if (n == 1) print v
}')
if [ "$n" != 1 ]; then
	fail "$n Cache-Control headers, expected exactly 1"
elif [ -z "$max_age" ]; then
	fail "Cache-Control: $value, expected exactly one max-age"
elif [ "$max_age" -le 600 ]; then
	pass "Cache-Control: $value"
else
	fail "Cache-Control: $value, expected max-age <= 600"
fi

# Body
first_line=
IFS= read -r first_line <"$tmp/body" || true
case $first_line in
'#!/bin/sh'*) pass "body starts with #!/bin/sh" ;;
*) fail "body starts with '$(printf '%.40s' "$first_line")', expected #!/bin/sh" ;;
esac
if grep -qi -e '<html' -e '<!doctype' "$tmp/body"; then
	fail "body contains <html or <!doctype"
else
	pass "body has no <html or <!doctype"
fi
if err=$(sh -n "$tmp/body" 2>&1); then
	pass "sh -n passes"
else
	fail "sh -n: $err"
fi

if [ "$failures" -ne 0 ]; then
	echo "$failures check(s) failed for $url"
	[ "$run_mode" = 0 ] || echo "Not running the script, because a check failed."
	exit 1
fi
echo "All checks passed for $url"

if [ "$run_mode" = 1 ]; then
	echo "Running the script with sh, as curl -fsSL $url | sh would:"
	rc=0
	output=$(sh <"$tmp/body" 2>&1) || rc=$?
	printf '%s\n' "$output" | sed 's/^/      /'
	if [ "$rc" -ne 0 ]; then
		echo "FAIL  the script exited $rc"
		exit 1
	fi
	echo "ok    the script exited 0"
fi
