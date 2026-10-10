#!/bin/sh
# Builds public/warmup/warmup.cpio.gz: busybox, init and profile from the shared
# guest/ folder, plus the two warm-ups (Orientation and Speed drills) and the
# again/runaway/pasteit speed-drill commands.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
base="$here/../guest"
out="$here/../public/warmup/warmup.cpio.gz"
r=$(mktemp -d)
mkdir -p "$r"/bin "$r"/sbin "$r"/etc "$r"/proc "$r"/sys "$r"/dev "$r"/tmp "$r"/home/player "$r"/root
chmod 755 "$r" "$r"/bin "$r"/sbin "$r"/etc "$r"/home "$r"/home/player "$r"/dev "$r"/proc "$r"/sys
chmod 1777 "$r"/tmp
cp "$base/busybox" "$r/bin/busybox"
for app in $("$base/busybox" --list); do
  case "$app" in busybox) ;; *) ln -sf busybox "$r/bin/$app" ;; esac
done
install -m 755 "$base/init" "$r/init"
install -m 755 "$here/build-missions" "$r/sbin/build-missions"
for f in submit hint mission; do install -m 755 "$here/$f" "$r/bin/$f"; done
mkdir -p "$r/usr/share/quest" && install -m 644 "$here"/readme/*.txt "$r/usr/share/quest/"
printf 'root:x:0:0:root:/root:/bin/sh\nplayer:x:1000:1000:player:/home/player:/bin/sh\n' > "$r/etc/passwd"
printf 'root:x:0:\nplayer:x:1000:\n' > "$r/etc/group"
cp "$base/profile" "$r/etc/profile"
install -m 644 "$here/banner" "$r/etc/banner"
cp "$base/profile" "$r/home/player/.profile"
chmod 700 "$r/root"
(cd "$r" && find . | cpio -o -H newc --owner root:root 2>/dev/null | gzip -9) > "$out"
rm -rf "$r"
ls -la "$out"
