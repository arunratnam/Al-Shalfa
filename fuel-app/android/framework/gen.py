#!/usr/bin/env python3
"""Writes framework/res/values/{attrs,public,styles}.xml: a small stand-in for Android's own
resource table holding only what this app's XML uses, with the real Android IDs.

The IDs are read from the Android 15 framework classes (android.R$attr / android.R$style):
    python3 framework/gen.py /path/to/android-all.jar
"""
import os
import re
import subprocess
import sys

GRAVITY = {"top": 0x30, "bottom": 0x50, "left": 0x03, "right": 0x05, "center_vertical": 0x10,
           "center_horizontal": 0x01, "center": 0x11, "start": 0x00800003, "end": 0x00800005}
SIZE = {"fill_parent": -1, "match_parent": -1, "wrap_content": -2}

# name: (format, enum values, flag values)
ATTRS = {
    # manifest
    "theme": ("reference", None, None),
    "label": ("reference|string", None, None),
    "icon": ("reference", None, None),
    "name": ("string", None, None),
    "exported": ("boolean", None, None),
    "launchMode": (None, {"standard": 0, "singleTop": 1, "singleTask": 2, "singleInstance": 3}, None),
    "value": ("string|integer|boolean|color|float|dimension|reference", None, None),
    "minSdkVersion": ("integer|string", None, None),
    "versionCode": ("integer", None, None),
    "versionName": ("string", None, None),
    "targetSdkVersion": ("integer|string", None, None),
    "maxSdkVersion": ("integer", None, None),
    "allowBackup": ("boolean", None, None),
    "foregroundServiceType": (None, None, {"location": 0x08, "specialUse": 0x40000000}),
    "permission": ("string", None, None),
    "resource": ("reference", None, None),
    "excludeFromRecents": ("boolean", None, None),
    "taskAffinity": ("string", None, None),
    "description": ("reference|string", None, None),
    "windowSoftInputMode": (None, None, {"stateUnspecified": 0, "stateUnchanged": 1, "stateHidden": 2,
                                         "stateAlwaysHidden": 3, "stateVisible": 4, "stateAlwaysVisible": 5,
                                         "adjustUnspecified": 0, "adjustResize": 0x10, "adjustPan": 0x20,
                                         "adjustNothing": 0x30}),
    "authorities": ("string", None, None),
    "grantUriPermissions": ("boolean", None, None),
    "hardwareAccelerated": ("boolean", None, None),
    "screenOrientation": (None, {"unspecified": -1, "portrait": 1, "fullUser": 13}, None),
    "configChanges": (None, None, {"keyboard": 0x10, "keyboardHidden": 0x20, "orientation": 0x80, "screenLayout": 0x100,
                                   "uiMode": 0x200, "screenSize": 0x400, "smallestScreenSize": 0x800, "density": 0x1000}),
    # layouts (home screen widget)
    "id": ("reference", None, None),
    "layout_width": ("dimension", SIZE, None),
    "layout_height": ("dimension", SIZE, None),
    "layout_weight": ("float", None, None),
    "orientation": (None, {"horizontal": 0, "vertical": 1}, None),
    "gravity": (None, None, GRAVITY),
    "background": ("reference|color", None, None),
    "text": ("string", None, None),
    "textColor": ("reference|color", None, None),
    "textSize": ("dimension", None, None),
    "textStyle": (None, None, {"normal": 0, "bold": 1, "italic": 2}),
    "padding": ("dimension", None, None),
    "paddingLeft": ("dimension", None, None),
    "paddingTop": ("dimension", None, None),
    "paddingRight": ("dimension", None, None),
    "paddingBottom": ("dimension", None, None),
    "maxLines": ("integer", None, None),
    "ellipsize": (None, {"none": 0, "start": 1, "middle": 2, "end": 3, "marquee": 4}, None),
    "divider": ("reference|color", None, None),
    "dividerHeight": ("dimension", None, None),
    # appwidget-provider
    "minWidth": ("dimension", None, None),
    "minHeight": ("dimension", None, None),
    "minResizeWidth": ("dimension", None, None),
    "minResizeHeight": ("dimension", None, None),
    "targetCellWidth": ("integer", None, None),
    "targetCellHeight": ("integer", None, None),
    "updatePeriodMillis": ("integer", None, None),
    "initialLayout": ("reference", None, None),
    "resizeMode": (None, None, {"none": 0, "horizontal": 1, "vertical": 2}),
    "widgetCategory": (None, None, {"home_screen": 1, "keyguard": 2, "searchbox": 4}),
}
STYLES = ["Theme.Material.NoActionBar", "Theme.Material.Light.NoActionBar", "Theme.Translucent.NoTitleBar"]


def constants(jar, cls):
    out = subprocess.run(["javap", "-constants", "-cp", jar, cls], capture_output=True, text=True).stdout
    return {m.group(1): int(m.group(2)) for m in re.finditer(r"int (\w+) = (-?\d+);", out)}


def main():
    jar = sys.argv[1]
    attr_ids = constants(jar, "android.R$attr")
    style_ids = constants(jar, "android.R$style")
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "res", "values")
    os.makedirs(here, exist_ok=True)

    attrs, public = [], []
    for name, (fmt, enums, flags) in ATTRS.items():
        head = '    <attr name="%s"%s' % (name, ' format="%s"' % fmt if fmt else "")
        if enums or flags:
            attrs.append(head + ">")
            for k, v in (enums or {}).items():
                attrs.append('        <enum name="%s" value="%d" />' % (k, v))
            for k, v in (flags or {}).items():
                attrs.append('        <flag name="%s" value="0x%08x" />' % (k, v))
            attrs.append("    </attr>")
        else:
            attrs.append(head + " />")
        public.append('    <public type="attr" name="%s" id="0x%08x" />' % (name, attr_ids[name]))
    for s in STYLES:
        public.append('    <public type="style" name="%s" id="0x%08x" />' % (s, style_ids[s.replace(".", "_")]))

    def write(fname, lines):
        with open(os.path.join(here, fname), "w") as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by framework/gen.py -->\n'
                    "<resources>\n" + "\n".join(lines) + "\n</resources>\n")

    write("attrs.xml", attrs)
    write("public.xml", public)
    write("styles.xml", ['    <style name="%s" parent="" />' % s for s in STYLES])
    print("wrote %d attrs, %d styles" % (len(ATTRS), len(STYLES)))


if __name__ == "__main__":
    main()
