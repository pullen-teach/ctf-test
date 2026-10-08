#!/bin/sh
# Builds public/images/quest.cpio.gz from busybox + the files in this folder.
# Needs: a 32-bit static busybox at ./busybox (Ubuntu package busybox-static, i386).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../public/images/quest.cpio.gz"
r=$(mktemp -d)
mkdir -p "$r"/bin "$r"/sbin "$r"/etc "$r"/proc "$r"/sys "$r"/dev "$r"/tmp "$r"/home/player "$r"/root
chmod 755 "$r" "$r"/bin "$r"/sbin "$r"/etc "$r"/home "$r"/home/player "$r"/dev "$r"/proc "$r"/sys
chmod 1777 "$r"/tmp
cp "$here/busybox" "$r/bin/busybox"
for app in $("$here/busybox" --list); do
  case "$app" in busybox) ;; *) ln -sf busybox "$r/bin/$app" ;; esac
done
install -m 755 "$here/init" "$r/init"
install -m 755 "$here/build-missions" "$r/sbin/build-missions"
install -m 755 "$here/submit" "$r/bin/submit"
install -m 755 "$here/hint" "$r/bin/hint"
install -m 644 "$here/vault" "$r/etc/vault.tmpl"
printf 'root:x:0:0:root:/root:/bin/sh\nplayer:x:1000:1000:player:/home/player:/bin/sh\n' > "$r/etc/passwd"
printf 'root:x:0:\nplayer:x:1000:\n' > "$r/etc/group"
cp "$here/profile" "$r/etc/profile"
cp "$here/profile" "$r/home/player/.profile"
chmod 700 "$r/root"
(cd "$r" && find . | cpio -o -H newc --owner root:root 2>/dev/null | gzip -9) > "$out"
rm -rf "$r"
ls -la "$out"
