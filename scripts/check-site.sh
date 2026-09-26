#!/bin/sh
# Checks a served build of the site: the home page, the security headers,
# robots rules for the environment and the 404 page. check-install.sh covers
# /install.
#
# Usage: sh scripts/check-site.sh <base-url> [--preview]
#
#   --preview  Expect a preview build (SITE_ENV=preview): noindex everywhere
#              and robots.txt disallowing everything. Without it, expect a
#              production build, which must be indexable.
#
# Exits non-zero if any check fails, including when curl cannot connect.
set -eu

usage() {
	echo "usage: sh scripts/check-site.sh <base-url> [--preview]" >&2
	exit 2
}

base=
preview=0
for arg in "$@"; do
	case $arg in
	--preview) preview=1 ;;
	-*) usage ;;
	*)
		[ -z "$base" ] || usage
		base=$arg
		;;
	esac
done
[ -n "$base" ] || usage
base=${base%/}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' HUP INT TERM

failures=0
pass() { printf 'ok    %s\n' "$*"; }
fail() {
	printf 'FAIL  %s\n' "$*"
	failures=$((failures + 1))
}

# fetch <path>: GET without following redirects. Sets $status and leaves the
# headers (CR stripped) in $tmp/headers and the body in $tmp/body.
fetch() {
	rc=0
	status=$(curl -sS --max-time 30 -D "$tmp/raw" -o "$tmp/body" -w '%{http_code}' "$base$1") || rc=$?
	if [ "$rc" -ne 0 ]; then
		fail "curl exited $rc fetching $base$1"
		exit 1
	fi
	tr -d '\r' <"$tmp/raw" >"$tmp/headers"
}
count_header() { grep -ci "^$1:" "$tmp/headers" || true; }
header() { grep -i "^$1:" "$tmp/headers" | head -n 1 | sed 's/^[^:]*:[[:space:]]*//'; }

# expect_header <name> <value>: exactly one such header, with exactly that value.
expect_header() {
	n=$(count_header "$1")
	value=$(header "$1")
	if [ "$n" = 1 ] && [ "$value" = "$2" ]; then
		pass "$1: $value"
	elif [ "$n" = 1 ]; then
		fail "$1: $value, expected $2"
	else
		fail "$n $1 headers, expected exactly 1 ($2)"
	fi
}

if [ "$preview" = 1 ]; then
	echo "Checking $base (preview build)"
else
	echo "Checking $base (production build)"
fi

# Home page
fetch /
if [ "$status" = 200 ]; then pass "/ is 200"; else fail "/ is $status, expected 200"; fi
case $(header content-type) in
text/html*) pass "/ is text/html" ;;
*) fail "/ is $(header content-type), expected text/html" ;;
esac
expect_header X-Content-Type-Options "nosniff"
expect_header Referrer-Policy "strict-origin-when-cross-origin"
expect_header X-Frame-Options "DENY"
expect_header Permissions-Policy "camera=(), microphone=(), geolocation=()"
if [ "$preview" = 1 ]; then
	expect_header X-Robots-Tag "noindex, nofollow"
elif [ "$(count_header X-Robots-Tag)" = 0 ]; then
	pass "no X-Robots-Tag"
else
	fail "X-Robots-Tag: $(header X-Robots-Tag), but a production build must be indexable"
fi

# robots.txt
fetch /robots.txt
if [ "$status" = 200 ]; then pass "/robots.txt is 200"; else fail "/robots.txt is $status, expected 200"; fi
if [ "$preview" = 1 ]; then
	if grep -qx 'Disallow: /' "$tmp/body"; then
		pass "robots.txt has Disallow: /"
	else
		fail "robots.txt has no Disallow: /, but a preview must not be crawled"
	fi
elif grep -qx 'Allow: /' "$tmp/body" && ! grep -qx 'Disallow: /' "$tmp/body"; then
	pass "robots.txt has Allow: /"
else
	fail "robots.txt does not allow crawling, but a production build must"
fi

# 404 page
fetch /this-page-does-not-exist
if [ "$status" = 404 ]; then pass "unknown path is 404"; else fail "unknown path is $status, expected 404"; fi
if grep -q '<title>Not found' "$tmp/body"; then
	pass "unknown path serves 404.html"
else
	fail "unknown path does not serve 404.html"
fi

# _headers configures Workers and must not be served itself.
fetch /_headers
if [ "$status" = 404 ]; then pass "/_headers is not served"; else fail "/_headers is $status, expected 404"; fi

if [ "$failures" -ne 0 ]; then
	echo "$failures check(s) failed for $base"
	exit 1
fi
echo "All checks passed for $base"
