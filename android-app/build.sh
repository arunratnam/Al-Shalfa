#!/bin/bash
# Builds AlwaysOnTasks.apk without Gradle.
# Needs (Ubuntu): apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
KS=${KEYSTORE:-release.keystore}
rm -rf build && mkdir -p build/gen build/classes

aapt package -f -M AndroidManifest.xml -S res -I "$SDK" -J build/gen -F build/app.unsigned.apk
javac -nowarn -source 8 -target 8 -bootclasspath "$SDK" -d build/classes \
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
