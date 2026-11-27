#!/bin/bash
# Builds AlwaysOnTasks.exe (runs on Windows 10/11, uses the built-in .NET Framework 4.8).
# Needs Mono on Linux: apt-get install mono-devel
set -euo pipefail
cd "$(dirname "$0")"
mcs -sdk:4.5 -target:winexe -optimize+ -win32icon:app.ico \
  -r:System.Windows.Forms.dll -r:System.Drawing.dll \
  -out:AlwaysOnTasks.exe AlwaysOnTasks.cs
echo "Built AlwaysOnTasks.exe"
