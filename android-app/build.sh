#!/bin/bash
# Builds AlwaysOnTasks.apk without Gradle.
# Needs (Ubuntu): apt-get install aapt apksigner zipalign dalvik-exchange
# plus an Android 15 framework: org.robolectric:android-all:15-robolectric-12650502 from Maven Central.
#   ANDROID_ALL = that jar (classes, for javac)
#   ANDROID_RES = a zip holding only its resources.arsc (for aapt)
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_ALL=${ANDROID_ALL:?set ANDROID_ALL}
ANDROID_RES=${ANDROID_RES:?set ANDROID_RES}
KS=${KEYSTORE:-release.keystore}
rm -rf build && mkdir -p build/gen build/classes

aapt package -f -M AndroidManifest.xml -S res -I "$ANDROID_RES" -J build/gen -F build/app.unsigned.apk
javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_ALL" -d build/classes \
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
