package com.ezstorage.fuel;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Shares the driver's location while they are clocked in. Runs as a foreground service with a notification that
 * can't be hidden, so the driver always knows. Started by the app at clock in, stopped at clock out (and after
 * 16 hours at most, in case nobody clocks out).
 */
public class TrackService extends Service implements LocationListener {
    static final String PREFS = "track", CHANNEL = "duty";
    static final long MAX_MS = 16L * 3600 * 1000;
    private static final int NOTE_ID = 7;

    private HandlerThread thread;
    private Handler worker;
    private LocationManager lm;
    private TrackSender sender;
    private final List<TrackSender.Point> pending = new ArrayList<>();
    private Location lastSent, best;
    private long lastSentAt, intervalMs = 120000, startedAt;
    private volatile boolean sending;

    /** Starts (or updates) tracking. Returns "ok", or why it couldn't start. */
    static String start(Context c, String apiKey, String projectId, String uid, String name, String refreshToken, int intervalSec) {
        if (Build.VERSION.SDK_INT >= 23 && c.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && c.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return "no-permission";
        }
        SharedPreferences p = c.getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean same = uid.equals(p.getString("uid", "")) && p.getLong("since", 0) > System.currentTimeMillis() - MAX_MS;
        p.edit().putString("apiKey", apiKey).putString("projectId", projectId).putString("uid", uid).putString("name", name)
                .putString("refresh", refreshToken).putInt("interval", Math.max(60, intervalSec))
                .putLong("since", same ? p.getLong("since", System.currentTimeMillis()) : System.currentTimeMillis()).apply();
        Intent i = new Intent(c, TrackService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
            return "ok";
        } catch (Exception e) {
            return "error: " + e.getMessage();
        }
    }

    static void stop(Context c) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        c.stopService(new Intent(c, TrackService.class));
    }

    static boolean running(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, MODE_PRIVATE);
        return p.contains("uid") && p.getLong("since", 0) > System.currentTimeMillis() - MAX_MS;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            goForeground();
        } catch (Throwable e) {
            // Android refused (e.g. restarted in the background without location access): the app restarts it when opened
            stopSelf();
            return START_NOT_STICKY;
        }
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.contains("uid") || p.getLong("since", 0) < System.currentTimeMillis() - MAX_MS) {
            stop(this);
            return START_NOT_STICKY;
        }
        startedAt = p.getLong("since", System.currentTimeMillis());
        intervalMs = p.getInt("interval", 120) * 1000L;
        sender = new TrackSender(p.getString("apiKey", ""), p.getString("projectId", ""), p.getString("uid", ""),
                p.getString("name", ""), p.getString("refresh", ""));
        if (thread == null) {
            thread = new HandlerThread("track");
            thread.start();
            worker = new Handler(thread.getLooper());
        }
        listen();
        return START_STICKY;
    }

    private void goForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "On duty location", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while " + getString(R.string.app_name) + " shares your location during work hours");
            nm.createNotificationChannel(ch);
            b = new Notification.Builder(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
        }
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        b.setContentTitle("On duty: sharing your location")
                .setContentText(getString(R.string.app_name) + " shares your location with the office until you clock out.")
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentIntent(pi)
                .setOngoing(true);
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(NOTE_ID, n);
    }

    @SuppressWarnings("MissingPermission")
    private void listen() {
        if (lm == null) lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        lm.removeUpdates(this);
        long every = Math.max(30000, intervalMs / 2);
        boolean any = false;
        for (String prov : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (lm.getAllProviders().contains(prov)) {
                    lm.requestLocationUpdates(prov, every, 0f, this, Looper.getMainLooper());
                    any = true;
                }
            } catch (SecurityException e) {
                stop(this);
                return;
            } catch (Exception ignored) {
                // provider not available on this phone
            }
        }
        if (!any) stop(this);
    }

    @Override
    public void onLocationChanged(Location l) {
        long now = System.currentTimeMillis();
        if (now - startedAt > MAX_MS) {
            stop(this);
            return;
        }
        // keep the more accurate of recent fixes (GPS vs network)
        if (best == null || l.getTime() - best.getTime() > 60000 || l.getAccuracy() <= best.getAccuracy()) best = l;
        if (now - lastSentAt < intervalMs) return;
        boolean moved = lastSent == null || best.distanceTo(lastSent) >= 30;
        if (!moved && now - lastSentAt < 10 * 60000) return; // standing still: an update every 10 minutes is enough
        final Location fix = best;
        lastSent = fix;
        lastSentAt = now;
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
        synchronized (pending) {
            pending.add(new TrackSender.Point(now, round(fix.getLatitude()), round(fix.getLongitude()), Math.round(fix.getAccuracy()), date));
            while (pending.size() > 300) pending.remove(0); // no signal for a long time: keep the latest
        }
        flush();
    }

    private static double round(double v) {
        return Math.round(v * 1e6) / 1e6;
    }

    private void flush() {
        if (sending || worker == null) return;
        sending = true;
        worker.post(new Runnable() {
            public void run() {
                List<TrackSender.Point> batch;
                synchronized (pending) {
                    batch = new ArrayList<>(pending);
                }
                try {
                    sender.send(batch);
                    synchronized (pending) {
                        pending.removeAll(batch);
                    }
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("refresh", sender.refreshToken()).apply();
                } catch (TrackSender.Stop e) {
                    stop(TrackService.this);
                } catch (Exception e) {
                    // no signal: try again with the next location
                }
                sending = false;
            }
        });
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    @Override
    public void onProviderEnabled(String provider) {
    }

    @Override
    public void onProviderDisabled(String provider) {
    }

    @Override
    public void onDestroy() {
        if (lm != null) lm.removeUpdates(this);
        if (thread != null) thread.quitSafely();
        thread = null;
        super.onDestroy();
    }
}
