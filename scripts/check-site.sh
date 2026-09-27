#!/bin/sh
# Checks a served build of the site: the home page, the security headers,
# robots rules for the environment, the share image and the 404 page.
# check-install.sh covers /install.
#
# Usage: sh scripts/check-site.sh <base-url> [--preview] [--workers-dev <url>]
#
#   --preview            Expect a preview build (SITE_ENV=preview): noindex,
#                        and robots.txt disallowing everything. Without it,
#                        expect a production build, which must be indexable.
#   --workers-dev <url>  Also check that <url>, the workers.dev copy of
#                        production, is noindex.
#
# Strict-Transport-Security is only checked on https:// URLs, because
# browsers ignore it over http.
#
# The noindex checks test the outcome, not the header count or value:
# Cloudflare sets its own X-Robots-Tag on version and preview URLs, in place of
# ours.
#
# The share image: every build points og:image at https://delocal.sh/og.png
# (SITE_URL in site.config.mjs). The image itself is fetched from <base-url>,
# which is that URL when checking production. Elsewhere, such as wrangler dev
# in CI, delocal.sh may not have this build's og.png yet.
#
# Exits non-zero if any check fails, including when curl cannot connect.
set -eu

share_image=https://delocal.sh/og.png

usage() {
	echo "usage: sh scripts/check-site.sh <base-url> [--preview] [--workers-dev <url>]" >&2
	exit 2
}

base=
preview=0
workers_dev=
while [ $# -gt 0 ]; do
	case $1 in
	--preview) preview=1 ;;
	--workers-dev)
		[ -n "${2:-}" ] || usage
		workers_dev=${2%/}
		shift
		;;
	-*) usage ;;
	*)
		[ -z "$base" ] || usage
		base=$1
		;;
	esac
	shift
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

# fetch <url>: GET without following redirects. Sets $status and leaves the
# headers (CR stripped) in $tmp/headers and the body in $tmp/body.
fetch() {
	rc=0
	status=$(curl -sS --max-time 30 -D "$tmp/raw" -o "$tmp/body" -w '%{http_code}' "$1") || rc=$?
	if [ "$rc" -ne 0 ]; then
		fail "curl exited $rc fetching $1"
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

# The values of every X-Robots-Tag header, joined by " | ".
robots_tags() {
	grep -i '^x-robots-tag:' "$tmp/headers" | sed 's/^[^:]*:[[:space:]]*//' |
		awk 'NR > 1 { printf " | " } { printf "%s", $0 }'
}
# Whether any X-Robots-Tag header says noindex. "none" means noindex, nofollow.
header_noindex() { grep -i '^x-robots-tag:' "$tmp/headers" | grep -Eiq '[^a-z](noindex|none)([^a-z]|$)'; }
# Whether the body has a robots meta tag that says noindex.
meta_noindex() {
	grep -Eio "<meta[^>]*name=[\"']?robots[^>]*>" "$tmp/body" | grep -Eiq '[^a-z](noindex|none)([^a-z]|$)'
}

if [ "$preview" = 1 ]; then
	echo "Checking $base (preview build)"
else
	echo "Checking $base (production build)"
fi

# Home page
fetch "$base/"
if [ "$status" = 200 ]; then pass "/ is 200"; else fail "/ is $status, expected 200"; fi
case $(header content-type) in
text/html*) pass "/ is text/html" ;;
*) fail "/ is $(header content-type), expected text/html" ;;
esac
expect_header X-Content-Type-Options "nosniff"
expect_header Referrer-Policy "strict-origin-when-cross-origin"
expect_header X-Frame-Options "DENY"
expect_header Permissions-Policy "camera=(), microphone=(), geolocation=()"
case $base in
https://*) expect_header Strict-Transport-Security "max-age=31536000" ;;
*) echo "skip  Strict-Transport-Security, which browsers ignore over http" ;;
esac

# The share image, named on /.
og_tags=$(grep -Eo "<meta[^>]*property=[\"']?og:image[\"'][^>]*>" "$tmp/body" || true)
og_count=$(printf '%s' "$og_tags" | grep -c . || true)
og_value=$(printf '%s\n' "$og_tags" | sed -n "s/.*content=[\"']\([^\"']*\)[\"'].*/\1/p" | head -n 1)
if [ "$og_count" = 1 ] && [ "$og_value" = "$share_image" ]; then
	pass "og:image is $share_image"
elif [ "$og_count" = 1 ]; then
	fail "og:image is $og_value, expected $share_image"
else
	fail "$og_count og:image tags on /, expected exactly 1 ($share_image)"
fi

# Indexing, judged on / (the 404 page is always noindex).
if [ "$preview" = 1 ]; then
	if header_noindex; then
		pass "/ is noindex (X-Robots-Tag: $(robots_tags))"
	else
		fail "/ has no X-Robots-Tag with noindex, but a preview must not be indexed"
	fi
else
	if header_noindex; then
		fail "X-Robots-Tag: $(robots_tags), but a production build must be indexable"
	else
		pass "/ has no X-Robots-Tag with noindex"
	fi
	if meta_noindex; then
		fail "/ has a robots noindex meta tag, but a production build must be indexable"
	else
		pass "/ has no robots noindex meta tag"
	fi
fi

fetch "$base/og.png"
if [ "$status" = 200 ]; then pass "/og.png is 200"; else fail "/og.png is $status, expected 200"; fi
case $(header content-type) in
image/png*) pass "/og.png is image/png" ;;
*) fail "/og.png is $(header content-type), expected image/png" ;;
esac

# robots.txt
fetch "$base/robots.txt"
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
fetch "$base/this-page-does-not-exist"
if [ "$status" = 404 ]; then pass "unknown path is 404"; else fail "unknown path is $status, expected 404"; fi
if grep -q '<title>Not found' "$tmp/body"; then
	pass "unknown path serves 404.html"
else
	fail "unknown path does not serve 404.html"
fi
if meta_noindex; then
	pass "404.html has a robots noindex meta tag"
else
	fail "404.html has no robots noindex meta tag"
fi

# _headers configures Workers and must not be served itself.
fetch "$base/_headers"
if [ "$status" = 404 ]; then pass "/_headers is not served"; else fail "/_headers is $status, expected 404"; fi

# The workers.dev copy of production must never be indexed.
if [ -n "$workers_dev" ]; then
	echo "Checking $workers_dev (workers.dev copy)"
	fetch "$workers_dev/"
	if [ "$status" = 200 ]; then pass "$workers_dev/ is 200"; else fail "$workers_dev/ is $status, expected 200"; fi
	if header_noindex; then
		pass "$workers_dev/ is noindex (X-Robots-Tag: $(robots_tags))"
	else
		fail "$workers_dev/ has no X-Robots-Tag with noindex, but it must not be indexed"
	fi
fi

if [ "$failures" -ne 0 ]; then
	echo "$failures check(s) failed for $base"
	exit 1
fi
echo "All checks passed for $base"
