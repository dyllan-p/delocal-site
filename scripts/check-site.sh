#!/bin/sh
# Checks a served build of the site: the home page, the security headers,
# robots rules for the environment, the share image, the 404 page, and what
# the pages load. check-install.sh covers /install.
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
# What the pages load: Cloudflare zone features (Web Analytics, Rocket Loader,
# email obfuscation, Zaraz) can change pages at the edge, after the build has
# checked them. So on /, the 404 page, /docs/ when / links to it (a full
# build), and the workers.dev copy, this fails on:
#   - a script, stylesheet, font, image or iframe from another host, or from
#     /cdn-cgi/ on the page's own host, which only Cloudflare serves. These
#     are the tags and attributes the build checks, with each URL resolved
#     against the page's;
#   - /cdn-cgi/ anywhere else in the page. Zaraz and Bot Fight Mode load
#     their scripts from inline ones, and email obfuscation rewrites mailto:
#     links to /cdn-cgi/l/email-protection.
# Every request sends a browser's Accept header, because Web Analytics only
# added its script for requests that accept HTML. Only delocal.sh passes
# through the zone. On previews, workers.dev and wrangler dev, this checks
# our own output only.
#
# Exits non-zero if any check fails, including when curl cannot connect.
set -eu

share_image=https://delocal.sh/og.png
accept='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

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

# fetch <url>: GET without following redirects, with a browser's Accept
# header. Sets $status and leaves the headers (CR stripped) in $tmp/headers
# and the body in $tmp/body.
fetch() {
	rc=0
	status=$(curl -sS --max-time 30 -H "Accept: $accept" -D "$tmp/raw" -o "$tmp/body" -w '%{http_code}' "$1") || rc=$?
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

# Lists what a page loads from another host or from /cdn-cgi/, one problem per
# line (see the top of this file). Run as awk -v page=<the page's URL>. POSIX
# awk only: CI's is mawk, and macOS has BSD awk.
cat >"$tmp/edge.awk" <<'AWK'
BEGIN {
	i = index(page, "://")
	page_scheme = tolower(substr(page, 1, i - 1))
	rest = substr(page, i + 3)
	if (match(rest, /[\/?#]/)) {
		page_authority = substr(rest, 1, RSTART - 1)
		page_path = substr(rest, RSTART)
	} else {
		page_authority = rest
		page_path = "/"
	}
	page_host = host_of(page_authority, page_scheme)
	sub(/[?#].*$/, "", page_path)
	if (page_path == "") page_path = "/"
	page_dir = page_path
	sub(/[^\/]*$/, "", page_dir)
}

{
	gsub(/\r/, " ")
	text = text $0 " "
}

END {
	n = split(text, parts, "<")
	for (i = 2; i <= n; i++) tag(parts[i])
	styles(text)
	mentions(text)
}

# The host of a URL's authority, without user info or a default port.
function host_of(authority, scheme,    i) {
	authority = tolower(authority)
	while ((i = index(authority, "@")) > 0) authority = substr(authority, i + 1)
	if (scheme == "http" && authority ~ /:80$/) authority = substr(authority, 1, length(authority) - 3)
	if (scheme == "https" && authority ~ /:443$/) authority = substr(authority, 1, length(authority) - 4)
	return authority
}

# An absolute path without its . and .. segments.
function normalize(path,    n, seg, out, i, k, res) {
	n = split(path, seg, "/")
	k = 0
	for (i = 2; i <= n; i++) {
		if (seg[i] == "..") {
			if (k > 0) k--
			if (i == n) out[++k] = ""
		} else if (seg[i] == ".") {
			if (i == n) out[++k] = ""
		} else {
			out[++k] = seg[i]
		}
	}
	res = ""
	for (i = 1; i <= k; i++) res = res "/" out[i]
	return res == "" ? "/" : res
}

function report(url, why) {
	if (url in reported) return
	reported[url] = 1
	print "loads " url why
}

# Resolves one URL against the page's, and reports it if it is on another
# host or under /cdn-cgi/.
function check(raw,    u, scheme, rest, host, path, suffix, url, lower) {
	u = raw
	sub(/^[ \t]+/, "", u)
	sub(/[ \t]+$/, "", u)
	if (u == "" || substr(u, 1, 1) == "#") return
	checked[u] = 1
	scheme = page_scheme
	if (match(u, /^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
		scheme = tolower(substr(u, 1, RLENGTH - 1))
		# data:, blob:, mailto: and the like name no host.
		if (substr(u, RLENGTH + 1, 2) != "//") return
		url = u
		rest = substr(u, RLENGTH + 3)
	} else if (substr(u, 1, 2) == "//") {
		url = scheme ":" u
		rest = substr(u, 3)
	}
	if (url != "") {
		if (match(rest, /[\/?#]/)) {
			host = substr(rest, 1, RSTART - 1)
			path = substr(rest, RSTART)
		} else {
			host = rest
			path = "/"
		}
		if (host_of(host, scheme) != page_host) {
			report(url, " from another host")
			return
		}
	} else if (substr(u, 1, 1) == "/") {
		path = u
	} else if (substr(u, 1, 1) == "?") {
		path = page_path u
	} else {
		path = page_dir u
	}
	suffix = ""
	if (match(path, /[?#]/)) {
		suffix = substr(path, RSTART)
		path = substr(path, 1, RSTART - 1)
	}
	path = normalize(path)
	if (url == "") url = page_scheme "://" page_authority path suffix
	lower = tolower(path)
	if (lower == "/cdn-cgi" || index(lower, "/cdn-cgi/") == 1) report(url, ", a Cloudflare /cdn-cgi/ path")
}

# A tag's attributes, into A. Names are lowercased, and the first of a name
# wins, as in HTML.
function attributes(s,    name, q, e, v) {
	split("", A)
	while (match(s, /[^ \t\/]/)) {
		s = substr(s, RSTART)
		if (!match(s, /^[^ \t\/=>"']+/)) {
			s = substr(s, 2)
			continue
		}
		name = tolower(substr(s, 1, RLENGTH))
		s = substr(s, RLENGTH + 1)
		v = ""
		if (match(s, /^[ \t]*=[ \t]*/)) {
			s = substr(s, RLENGTH + 1)
			q = substr(s, 1, 1)
			if (q == "\"" || q == "'") {
				e = index(substr(s, 2), q)
				if (e) {
					v = substr(s, 2, e - 1)
					s = substr(s, e + 2)
				} else {
					v = substr(s, 2)
					s = ""
				}
			} else if (match(s, /^[^ \t]+/)) {
				v = substr(s, 1, RLENGTH)
				s = substr(s, RLENGTH + 1)
			}
		}
		if (!(name in A)) A[name] = v
	}
}

# p is the text after a "<". The same tags and attributes as
# externalResources in src/lib/build-hooks.mjs.
function tag(p,    name, s, e, k, words, j, fetches) {
	if (!match(tolower(p), /^(script|img|source|video|audio|iframe|embed|link|image|use)[ \t\/>]/)) return
	name = tolower(substr(p, 1, RLENGTH - 1))
	s = substr(p, RLENGTH)
	e = index(s, ">")
	if (e) s = substr(s, 1, e - 1)
	attributes(s)
	if (name == "link") {
		fetches = 0
		k = split(tolower(A["rel"]), words, " ")
		for (j = 1; j <= k; j++)
			if (index(" stylesheet preload modulepreload prefetch preconnect dns-prefetch icon apple-touch-icon manifest ", " " words[j] " ")) fetches = 1
		if (!fetches) return
	}
	if ("src" in A) check(A["src"])
	if ("href" in A) check(A["href"])
	if ("xlink:href" in A) check(A["xlink:href"])
	if ("srcset" in A) {
		k = split(A["srcset"], words, ",")
		for (j = 1; j <= k; j++) {
			sub(/^[ \t]+/, "", words[j])
			sub(/[ \t].*$/, "", words[j])
			check(words[j])
		}
	}
}

# url() and @import, in style attributes and style elements.
function styles(t,    n, parts, i, p, q, e) {
	n = split(t, parts, "[uU][rR][lL][(]")
	for (i = 2; i <= n; i++) {
		p = parts[i]
		sub(/^[ \t]+/, "", p)
		q = substr(p, 1, 1)
		if (q == "\"" || q == "'") {
			e = index(substr(p, 2), q)
			if (e) check(substr(p, 2, e - 1))
		} else if ((e = index(p, ")")) > 0) {
			check(substr(p, 1, e - 1))
		}
	}
	n = split(t, parts, "@[iI][mM][pP][oO][rR][tT]")
	for (i = 2; i <= n; i++) {
		p = parts[i]
		sub(/^[ \t]+/, "", p)
		q = substr(p, 1, 1)
		if (q == "\"" || q == "'") {
			e = index(substr(p, 2), q)
			if (e) check(substr(p, 2, e - 1))
		}
	}
}

# cdn-cgi anywhere else, such as in an inline script that loads from it.
# Prints the whole token around it, unless it is a URL check has judged. =, ,
# and ; end a token only on the left, because URLs have them in queries.
function mentions(t,    lower, ends, starts, off, pos, s, e, token) {
	lower = tolower(t)
	ends = " \t\"'`<>()"
	starts = ends "=,;"
	off = 0
	while ((pos = index(substr(lower, off + 1), "cdn-cgi")) > 0) {
		pos += off
		for (s = pos; s > 1 && !index(starts, substr(t, s - 1, 1)); s--) ;
		for (e = pos + 7; e <= length(t) && !index(ends, substr(t, e, 1)); e++) ;
		token = substr(t, s, e - s)
		if (!(token in checked) && !(token in mentioned)) {
			mentioned[token] = 1
			print "contains " token ", a Cloudflare /cdn-cgi/ path"
		}
		off = e - 1
	}
}
AWK

# check_edge <label> <page-url>: checks $tmp/body, fetched from <page-url>,
# for what it loads.
check_edge() {
	LC_ALL=C awk -v page="$2" -f "$tmp/edge.awk" "$tmp/body" >"$tmp/edge"
	if [ -s "$tmp/edge" ]; then
		while IFS= read -r line; do fail "$1 $line"; done <"$tmp/edge"
	else
		pass "$1 loads nothing from another host or /cdn-cgi/"
	fi
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

check_edge / "$base/"
# A full build's landing page links to the docs. The holding page doesn't.
docs=0
if grep -Eq "href=[\"']?/docs/" "$tmp/body"; then docs=1; fi

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
check_edge "the 404 page" "$base/this-page-does-not-exist"

# One docs page, in a full build. They all share Starlight's layout.
if [ "$docs" = 1 ]; then
	fetch "$base/docs/"
	if [ "$status" = 200 ]; then pass "/docs/ is 200"; else fail "/docs/ is $status, expected 200"; fi
	check_edge /docs/ "$base/docs/"
else
	echo "skip  /docs/, which / doesn't link to (a holding build)"
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
	check_edge "$workers_dev/" "$workers_dev/"
fi

if [ "$failures" -ne 0 ]; then
	echo "$failures check(s) failed for $base"
	exit 1
fi
echo "All checks passed for $base"
