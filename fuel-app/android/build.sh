#!/bin/bash
# Builds EZFuel.apk: the web app in ../web packed into a small Android WebView app.
# Needs (Ubuntu): apt-get install aapt apksigner zipalign dalvik-exchange
#   ANDROID_ALL = org.robolectric:android-all:15-robolectric-12650502 jar (Android 15 classes, from Maven Central)
#   KEYSTORE    = signing key (created on first build if missing; keep it to publish updates)
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_ALL=${ANDROID_ALL:?set ANDROID_ALL to the android-all jar}
KS=${KEYSTORE:-release.keystore}
rm -rf build && mkdir -p build/gen build/classes build/assets

[ -f framework/res/values/public.xml ] || python3 framework/gen.py "$ANDROID_ALL"
cp -r ../web build/assets/web
aapt package -f -x -M framework/AndroidManifest.xml -S framework/res -F build/framework.apk
aapt package -f -M AndroidManifest.xml -S res -A build/assets -I build/framework.apk -J build/gen -F build/app.unsigned.apk
javac -nowarn --release 8 -classpath "$ANDROID_ALL" -d build/classes \
  $(find build/gen src -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
dalvik-exchange --dex --output=build/classes.dex build/classes
(cd build && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f 4 build/app.unsigned.apk build/app.aligned.apk

if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias app -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass ezfuel -keypass ezfuel -dname "CN=EZ Fuel" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:ezfuel --ks-key-alias app --out EZFuel.apk build/app.aligned.apk
apksigner verify EZFuel.apk && echo "Built EZFuel.apk"
