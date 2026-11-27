package com.alshalfa.tasks;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

/** Handles reminder alarms, Done / Snooze buttons, daily summaries and phone restarts. */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        Model m = Model.get(c);
        long id = intent.getLongExtra("id", 0);

        if (Reminders.ACTION_REMIND.equals(a)) {
            Model.Task t = m.find(id);
            if (t != null && !t.done) Reminders.notifyTask(c, t);

        } else if (Reminders.ACTION_DONE.equals(a)) {
            Model.Task t = m.find(id);
            Reminders.cancelNotification(c, id);
            if (t != null) {
                m.setDone(t, true);
                m.changed();
            }

        } else if (Reminders.ACTION_SNOOZE.equals(a)) {
            Reminders.cancelNotification(c, id);
            Reminders.scheduleAt(c, Reminders.taskAlarm(c, id, android.app.PendingIntent.FLAG_UPDATE_CURRENT),
                    System.currentTimeMillis() + 10 * 60 * 1000L);

        } else if (Reminders.ACTION_SUMMARY.equals(a)) {
            Reminders.notifySummary(c, intent.getStringExtra("kind"));
            Reminders.scheduleSummaries(c);

        } else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)
                || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            Reminders.reschedule(c);
            boolean restart = Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a);
            if (restart && m.prefs.getBoolean("autoStart", true) && Settings.canDrawOverlays(c)
                    && m.prefs.getBoolean("wasRunning", false)) {
                Intent s = new Intent(c, OverlayService.class).setAction(OverlayService.ACTION_SHOW);
                try {
                    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
                    else c.startService(s);
                } catch (Exception ignored) {
                }
            }
        }
    }
}
