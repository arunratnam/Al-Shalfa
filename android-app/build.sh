#!/bin/bash
# Builds AlwaysOnTasks.apk without Gradle, using Ubuntu packages only:
#   apt-get install aapt apksigner zipalign dalvik-exchange
# Plus the Android 15 framework classes for javac:
#   ANDROID_ALL = org.robolectric:android-all:15-robolectric-12650502 jar (Maven Central)
# The manifest is compiled against framework/, a small table of the real Android
# attribute IDs, so the old aapt can target current Android versions.
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_ALL=${ANDROID_ALL:?set ANDROID_ALL to the android-all jar}
KS=${KEYSTORE:-release.keystore}
rm -rf build && mkdir -p build/gen build/classes

aapt package -f -x -M framework/AndroidManifest.xml -S framework/res -F build/framework.apk
aapt package -f -M AndroidManifest.xml -S res -I build/framework.apk -J build/gen -F build/app.unsigned.apk
javac -nowarn --release 8 -classpath "$ANDROID_ALL" -d build/classes \
  $(find build/gen src -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
dalvik-exchange --dex --output=build/classes.dex build/classes
(cd build && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f 4 build/app.unsigned.apk build/app.aligned.apk

if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias app -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass alshalfa -keypass alshalfa -dname "CN=Always On Tasks" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:alshalfa --ks-key-alias app --out AlwaysOnTasks.apk build/app.aligned.apk
apksigner verify AlwaysOnTasks.apk && echo "Built AlwaysOnTasks.apk"
