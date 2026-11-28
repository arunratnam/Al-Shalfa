#!/bin/bash
# Builds the Android app: the web app packed into a small Android WebView app.
# Needs (Ubuntu): apt-get install aapt apksigner zipalign dalvik-exchange
#   ANDROID_ALL = org.robolectric:android-all:15-robolectric-12650502 jar (Android 15 classes, from Maven Central)
#   KEYSTORE    = signing key (created on first build if missing; keep it to publish updates)
#   KS_PASS     = keystore password (default: ezfuel)
# White-label builds (see ../whitelabel/make.py) also set:
#   WEB_DIR     = web app folder to pack (default ../web)
#   APP_ID      = Android application id, e.g. com.acme.staff (default com.ezstorage.fuel)
#   RES_DIR     = extra resources (app name, icons) laid over res/
#   OUT         = output file (default EZFuel.apk)
#   VERSION_CODE, VERSION_NAME = this company's own version (default: the ones in AndroidManifest.xml)
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_ALL=${ANDROID_ALL:?set ANDROID_ALL to the android-all jar}
KS=${KEYSTORE:-release.keystore}
KS_PASS=${KS_PASS:-ezfuel}
WEB_DIR=${WEB_DIR:-../web}
APP_ID=${APP_ID:-com.ezstorage.fuel}
OUT=${OUT:-EZFuel.apk}
rm -rf build && mkdir -p build/gen build/classes build/assets build/res

[ -f framework/res/values/public.xml ] || python3 framework/gen.py "$ANDROID_ALL"
cp -r "$WEB_DIR" build/assets/web
cp -r res/. build/res/
if [ -n "${RES_DIR:-}" ]; then cp -r "$RES_DIR"/. build/res/; fi
# the file provider authority follows the application id, so two companies' apps can sit on one phone
sed "s/com\.ezstorage\.fuel\.files/$APP_ID.files/" AndroidManifest.xml > build/AndroidManifest.xml
RENAME=()
if [ "$APP_ID" != "com.ezstorage.fuel" ]; then RENAME=(--rename-manifest-package "$APP_ID"); fi
if [ -n "${VERSION_CODE:-}" ]; then sed -i "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$VERSION_CODE\"/" build/AndroidManifest.xml; fi
if [ -n "${VERSION_NAME:-}" ]; then sed -i "s/android:versionName=\"[^\"]*\"/android:versionName=\"$VERSION_NAME\"/" build/AndroidManifest.xml; fi

aapt package -f -x -M framework/AndroidManifest.xml -S framework/res -F build/framework.apk
aapt package -f -M build/AndroidManifest.xml -S build/res -A build/assets -I build/framework.apk -J build/gen \
  --custom-package com.ezstorage.fuel "${RENAME[@]}" -F build/app.unsigned.apk
javac -nowarn --release 8 -classpath "$ANDROID_ALL" -d build/classes \
  $(find build/gen src -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
dalvik-exchange --dex --output=build/classes.dex build/classes
(cd build && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f 4 build/app.unsigned.apk build/app.aligned.apk

if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias app -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Staff App" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:"$KS_PASS" --ks-key-alias app --out "$OUT" build/app.aligned.apk
apksigner verify "$OUT" && echo "Built $OUT"
