#!/usr/bin/env python3
"""Builds a staff app for one customer company (white label).

    python3 whitelabel/make.py whitelabel/customers/<id>            # website files + Firebase files
    python3 whitelabel/make.py whitelabel/customers/<id> --apk      # ...and the Android app

A customer folder holds:
    customer.json   name, colour, Firebase settings, warehouses ... (copy customers/_template/customer.json)
    logo.png        company logo, wide (about 300 x 130 px or larger)
    icon.png        optional square app icon (512 x 512); made from the logo when missing

Output goes to whitelabel/dist/<id>/:
    web/            the website: upload to Firebase Hosting (firebase deploy) or any web host
    firebase.json, .firebaserc, firestore.rules   for "firebase deploy" into the customer's own project
    <App name>.apk  the Android app (with --apk; needs ANDROID_ALL and KEYSTORE, like android/build.sh)
    SETUP.txt       what is left to do for this customer
"""
import base64
import colorsys
import io
import json
import os
import re
import shutil
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)  # fuel-app/

DEFAULTS = {
    "appName": "Staff App", "shortName": "Staff", "companyName": "Company", "appId": "",
    "brandColor": "#c8102e", "firebase": None, "mapsKey": "",
    "formTitle": "Fuel Expense Submission Form", "docNo": "OPS-FUEL-001", "docVersion": "01", "currency": "KD",
    "departments": ["Operations", "Logistics", "Warehouse", "Delivery", "Sales", "Administration"],
    "maxReceipts": 30,
}
# colours in app.css / app.js that are the EZ Storage red, and what each one is
EZ_COLOURS = {"#c8102e": "brand", "#a50d26": "brand2", "#fdecef": "soft", "#e5344f": "brandDark", "#2a1519": "softDark"}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_hex(c):
    return "#" + "".join("%02x" % max(0, min(255, round(v * 255))) for v in c)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def shades(brand):
    c = hex_rgb(brand)
    h, l, s = colorsys.rgb_to_hls(*c)
    return {
        "brand": brand.lower(),
        "brand2": rgb_hex(colorsys.hls_to_rgb(h, max(0, l * 0.82), s)),
        "soft": rgb_hex(mix(c, (1, 1, 1), 0.9)),
        "brandDark": rgb_hex(colorsys.hls_to_rgb(h, min(0.72, l + 0.12), s)),
        "softDark": rgb_hex(mix(c, (0.07, 0.07, 0.08), 0.84)),
    }


def recolour(text, sh):
    return re.sub("|".join(re.escape(k) for k in EZ_COLOURS), lambda m: sh[EZ_COLOURS[m.group(0).lower()]], text, flags=re.I)


def square_icon(src_logo, icon_path, size):
    if icon_path and os.path.exists(icon_path):
        im = Image.open(icon_path).convert("RGBA")
        im = im.resize((size, size), Image.LANCZOS)
    else:
        logo = Image.open(src_logo).convert("RGBA")
        im = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        w = int(size * 0.86)
        h = int(logo.height * w / logo.width)
        if h > size * 0.86:
            h = int(size * 0.86)
            w = int(logo.width * h / logo.height)
        im.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return im


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cdir = os.path.abspath(sys.argv[1])
    want_apk = "--apk" in sys.argv
    cid = os.path.basename(cdir.rstrip("/"))
    cust = dict(DEFAULTS)
    cust.update(json.load(open(os.path.join(cdir, "customer.json"))))
    for k in ("appName", "companyName", "appId", "firebase"):
        if not cust.get(k):
            sys.exit("customer.json: please fill in " + k)
    if not re.match(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$", cust["appId"]):
        sys.exit("customer.json: appId must look like com.companyname.staff (small letters, dots)")
    logo_path = os.path.join(cdir, "logo.png")
    if not os.path.exists(logo_path):
        sys.exit("Put the company logo in " + logo_path)

    out = os.path.join(HERE, "dist", cid)
    web = os.path.join(out, "web")
    if os.path.exists(out):
        shutil.rmtree(out)
    shutil.copytree(os.path.join(APP, "web"), web)
    sh = shades(cust["brandColor"])

    # settings file
    conf = {k: cust[k] for k in ("firebase", "mapsKey", "appName", "companyName", "formTitle", "docNo", "docVersion",
                                  "currency", "departments", "maxReceipts")}
    for k in ("warehouses", "shifts", "ot", "useEmulators"):
        if cust.get(k):
            conf[k] = cust[k]
    with open(os.path.join(web, "config.js"), "w") as f:
        f.write("/* %s settings (made by whitelabel/make.py from customers/%s/customer.json). */\nwindow.EZ_CONFIG = %s;\n"
                % (cust["companyName"], cid, json.dumps(conf, indent=2, ensure_ascii=False)))

    # logo, PDF logo and icons
    logo = Image.open(logo_path).convert("RGBA")
    if logo.width > 616:
        logo = logo.resize((616, int(logo.height * 616 / logo.width)), Image.LANCZOS)
    flat = Image.new("RGB", logo.size, (255, 255, 255))
    flat.paste(logo, mask=logo.split()[3])
    flat.save(os.path.join(web, "img", "logo.png"))
    buf = io.BytesIO()
    flat.save(buf, "PNG")
    with open(os.path.join(web, "img", "logo.js"), "w") as f:
        f.write('window.EZ_LOGO="data:image/png;base64,%s";window.EZ_LOGO_RATIO=%.5f;\n'
                % (base64.b64encode(buf.getvalue()).decode(), flat.height / flat.width))
    icon_src = os.path.join(cdir, "icon.png")
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        square_icon(logo_path, icon_src, size).convert("RGB").save(os.path.join(web, "img", name))

    # names and colours
    def edit(path, fn):
        with open(path) as f:
            t = f.read()
        with open(path, "w") as f:
            f.write(fn(t))
    desc = "Attendance, overtime and fuel claims for %s staff." % cust["companyName"]
    edit(os.path.join(web, "index.html"), lambda t: t.replace("<title>EZ Staff</title>", "<title>%s</title>" % cust["appName"])
         .replace('content="EZ Staff"', 'content="%s"' % cust["appName"])
         .replace("EZ Storage staff app: attendance, overtime, fuel bills and claims.", desc))
    man = json.load(open(os.path.join(web, "manifest.webmanifest")))
    man.update({"name": cust["appName"], "short_name": cust.get("shortName") or cust["appName"], "description": desc,
                "theme_color": sh["brand"]})
    json.dump(man, open(os.path.join(web, "manifest.webmanifest"), "w"), indent=2, ensure_ascii=False)
    edit(os.path.join(web, "app.css"), lambda t: recolour(t, sh))
    edit(os.path.join(web, "app.js"), lambda t: recolour(t, sh))
    edit(os.path.join(web, "sw.js"), lambda t: re.sub(r'var CACHE = "[^"]+";', 'var CACHE = "staff-%s-1";' % cid, t))

    # Firebase deploy files (rules are the same for every company)
    shutil.copy(os.path.join(APP, "firebase", "firestore.rules"), os.path.join(out, "firestore.rules"))
    json.dump({"hosting": {"public": "web", "ignore": ["**/.*"]}, "firestore": {"rules": "firestore.rules"}},
              open(os.path.join(out, "firebase.json"), "w"), indent=2)
    json.dump({"projects": {"default": cust["firebase"]["projectId"]}}, open(os.path.join(out, ".firebaserc"), "w"), indent=2)

    # Android
    res = os.path.join(out, "android-res")
    os.makedirs(os.path.join(res, "values"))
    with open(os.path.join(res, "values", "strings.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">%s</string>\n</resources>\n'
                % cust["appName"].replace("&", "&amp;").replace("<", "&lt;").replace("'", "\\'"))
    for d, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        os.makedirs(os.path.join(res, "drawable-" + d))
        square_icon(logo_path, icon_src, size).save(os.path.join(res, "drawable-" + d, "ic_launcher.png"))
    apk = os.path.join(out, re.sub(r"[^A-Za-z0-9 _-]", "", cust["appName"]) + ".apk")
    if want_apk:
        env = dict(os.environ, WEB_DIR=web, APP_ID=cust["appId"], RES_DIR=res, OUT=apk)
        if cust.get("versionCode"):
            env.update(VERSION_CODE=str(cust["versionCode"]), VERSION_NAME=str(cust.get("versionName") or cust["versionCode"]))
        if not env.get("ANDROID_ALL") or not env.get("KEYSTORE"):
            sys.exit("For --apk set ANDROID_ALL and KEYSTORE (this customer's own signing key; it is made if missing)")
        subprocess.run([os.path.join(APP, "android", "build.sh")], env=env, check=True)

    with open(os.path.join(out, "SETUP.txt"), "w") as f:
        f.write("""%(app)s for %(co)s
==========================
1. Firebase project %(pid)s: Authentication -> Email/Password on; Firestore created (production mode).
2. Rules: firestore.rules -> Firebase console -> Firestore -> Rules -> Publish (or: firebase deploy --only firestore:rules).
3. Website: firebase deploy --only hosting   (from this folder; site: https://%(pid)s.web.app)
   In Google Cloud add that address to the Maps key's websites if Google Maps is used.
4. The customer's admin creates an account on the website, then in Firestore -> users -> their document set
   role = admin, active = true, pending = false.
5. Android app: %(apk)s (application id %(appid)s). Keep this customer's signing key: updates need the same key.
6. Admin: Company settings -> warehouses (stand at each one: Use my location here), shifts, overtime rules, holidays.
""" % {"app": cust["appName"], "co": cust["companyName"], "pid": cust["firebase"]["projectId"], "apk": os.path.basename(apk),
                "appid": cust["appId"]})
    print("Built %s for %s in %s" % (cust["appName"], cust["companyName"], out))


if __name__ == "__main__":
    main()
