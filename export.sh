#!/bin/bash
PREFIX="$(dirname "$0")"
if [ -z "$PREFIX" ]; then
	PREFIX="$(dirname "$(which "$0")")"
fi
cd "$PREFIX"
PREFIX="$PWD"

echo working in "$PREFIX"

if ! svn export . "$PREFIX.export"; then
	echo failed to export
	exit 1
fi

rm -vf "$PREFIX.export/"bookmark-manager1.png

cd "$PREFIX.export"
zip -r "$PREFIX.zip" *
