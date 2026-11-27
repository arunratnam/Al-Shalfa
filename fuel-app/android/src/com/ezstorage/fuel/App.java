package com.ezstorage.fuel;

import android.app.Application;
import android.os.Build;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;

/** Saves the details of a crash so the app can offer to send them on the next start. */
public class App extends Application {

    static File crashFile(android.content.Context c) {
        return new File(c.getFilesDir(), "last-crash.txt");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            public void uncaughtException(Thread t, Throwable e) {
                try {
                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    String version = "";
                    try {
                        version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                    } catch (Exception ignored) {
                    }
                    FileWriter w = new FileWriter(crashFile(App.this));
                    w.write("EZ Fuel " + version + " crash report\n"
                            + "Phone: " + Build.MANUFACTURER + " " + Build.MODEL + ", Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n"
                            + "Time: " + new java.util.Date() + "\nThread: " + t.getName() + "\n\n" + sw);
                    w.close();
                } catch (Throwable ignored) {
                }
                if (previous != null) previous.uncaughtException(t, e);
            }
        });
    }
}
