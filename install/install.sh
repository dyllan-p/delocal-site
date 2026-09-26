#!/bin/sh
# Installer for delocal, served at https://delocal.sh/install.
#
# This is a placeholder. It will be replaced by install.sh from the releases
# of https://github.com/dyllan-p/delocal once there is a release.
#
# Everything runs inside main(), which is called on the last line, so a
# download cut off part way through runs nothing.

main() {
	set -eu
	echo "delocal is in development and has no releases yet. Nothing was installed."
	exit 0
}

main "$@"
