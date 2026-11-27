package com.alshalfa.tasks;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import java.util.HashSet;
import java.util.Set;

/** Task reminders, the daily summary, and notification channels. */
public class Reminders {

    public static final String CH_FLOAT = "floating";
    public static final String CH_REMIND = "reminders";
    public static final String CH_SUMMARY = "summary";
    public static final String CH_FOCUS = "focus";

    public static final String ACTION_REMIND = "com.alshalfa.tasks.REMIND";
    public static final String ACTION_DONE = "com.alshalfa.tasks.DONE";
    public static final String ACTION_SNOOZE = "com.alshalfa.tasks.SNOOZE";
    public static final String ACTION_SUMMARY = "com.alshalfa.tasks.SUMMARY";

    static final int IMMUTABLE = 0x04000000; // PendingIntent.FLAG_IMMUTABLE

    public static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CH_FLOAT, "Floating window", NotificationManager.IMPORTANCE_LOW));
        NotificationChannel r = new NotificationChannel(CH_REMIND, "Task reminders", NotificationManager.IMPORTANCE_HIGH);
        r.enableVibration(true);
        nm.createNotificationChannel(r);
        nm.createNotificationChannel(new NotificationChannel(CH_SUMMARY, "Daily summary", NotificationManager.IMPORTANCE_DEFAULT));
        NotificationChannel f = new NotificationChannel(CH_FOCUS, "Focus timer", NotificationManager.IMPORTANCE_HIGH);
        f.enableVibration(true);
        nm.createNotificationChannel(f);
    }

    @SuppressWarnings("deprecation")
    public static Notification.Builder builder(Context c, String channel) {
        ensureChannels(c);
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, channel) : new Notification.Builder(c);
    }

    static PendingIntent taskAlarm(Context c, long id, int flags) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION_REMIND)
                .setData(Uri.parse("task://" + id)).putExtra("id", id);
        return PendingIntent.getBroadcast(c, 0, i, IMMUTABLE | flags);
    }

    public static void scheduleAt(Context c, PendingIntent pi, long when) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        }
    }

    /** Sets an alarm for every open task with a future due time; removes alarms of deleted or finished tasks. */
    public static void reschedule(Context c) {
        Model m = Model.get(c);
        SharedPreferences p = m.prefs;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Set<String> before = new HashSet<String>(p.getStringSet("alarmIds", new HashSet<String>()));
        Set<String> now = new HashSet<String>();
        long t = System.currentTimeMillis();
        for (Model.Task task : m.tasks) {
            if (!task.done && task.due > t) {
                scheduleAt(c, taskAlarm(c, task.id, PendingIntent.FLAG_UPDATE_CURRENT), task.due);
                now.add(String.valueOf(task.id));
            } else if (!task.done && task.due > 0) {
                now.add(String.valueOf(task.id)); // past due: keep any snooze alarm
            }
        }
        for (String id : before) {
            if (!now.contains(id)) {
                PendingIntent pi = taskAlarm(c, Long.parseLong(id), PendingIntent.FLAG_NO_CREATE);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
                cancelNotification(c, Long.parseLong(id));
            }
        }
        p.edit().putStringSet("alarmIds", now).apply();
        scheduleSummaries(c);
    }

    // ------------------------------------------------------------------ task notifications

    static int notifId(long taskId) {
        return (int) (taskId ^ (taskId >>> 32)) & 0x7fffffff;
    }

    public static void cancelNotification(Context c, long taskId) {
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(notifId(taskId));
    }

    public static void notifyTask(Context c, Model.Task t) {
        PendingIntent open = PendingIntent.getActivity(c, notifId(t.id),
                new Intent(c, TaskEditActivity.class).putExtra("id", t.id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent done = PendingIntent.getBroadcast(c, 0,
                new Intent(c, ReminderReceiver.class).setAction(ACTION_DONE).setData(Uri.parse("task://" + t.id)).putExtra("id", t.id),
                IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent snooze = PendingIntent.getBroadcast(c, 0,
                new Intent(c, ReminderReceiver.class).setAction(ACTION_SNOOZE).setData(Uri.parse("task://" + t.id)).putExtra("id", t.id),
                IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String body = Model.dueLabel(c, t.due);
        if (t.notes != null && t.notes.trim().length() > 0) body += " · " + t.notes.trim();
        Notification n = builder(c, CH_REMIND)
                .setSmallIcon(R.drawable.ic_tile)
                .setContentTitle(t.text)
                .setContentText(body)
                .setContentIntent(open)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
                .addAction(0, "Done", done)
                .addAction(0, "Snooze 10 min", snooze)
                .build();
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(notifId(t.id), n);
        } catch (SecurityException ignored) {
        }
    }

    // ------------------------------------------------------------------ daily summary

    static PendingIntent summaryAlarm(Context c, String kind, int flags) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION_SUMMARY)
                .setData(Uri.parse("summary://" + kind)).putExtra("kind", kind);
        return PendingIntent.getBroadcast(c, 0, i, IMMUTABLE | flags);
    }

    static long nextAt(int minutesOfDay) {
        long t = Model.todayAt(minutesOfDay / 60, minutesOfDay % 60);
        if (t <= System.currentTimeMillis()) t += 86400000L;
        return t;
    }

    public static void scheduleSummaries(Context c) {
        SharedPreferences p = Model.get(c).prefs;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        boolean on = p.getBoolean("summaryOn", true);
        String[] kinds = {"morning", "evening"};
        int[] defaults = {8 * 60, 21 * 60};
        for (int i = 0; i < 2; i++) {
            PendingIntent pi = summaryAlarm(c, kinds[i], PendingIntent.FLAG_UPDATE_CURRENT);
            if (on) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextAt(p.getInt(kinds[i] + "Min", defaults[i])), pi);
            } else {
                am.cancel(pi);
            }
        }
    }

    public static void notifySummary(Context c, String kind) {
        Model m = Model.get(c);
        String title, text;
        if ("morning".equals(kind)) {
            int open = m.openToday(), late = m.overdueCount();
            title = open == 0 ? "Nothing planned for today" : "You have " + open + (open == 1 ? " task" : " tasks") + " today";
            text = late > 0 ? late + " overdue. Tap to open your list." : "Tap to open your list.";
        } else {
            int done = m.doneToday(), left = m.openToday();
            title = "You finished " + done + " of " + (done + left) + " today";
            text = left == 0 ? "Everything is done. Well done!" : left + " still open. Tap to plan tomorrow.";
        }
        PendingIntent open = PendingIntent.getActivity(c, 3,
                new Intent(c, MainActivity.class).putExtra("show", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = builder(c, CH_SUMMARY)
                .setSmallIcon(R.drawable.ic_tile)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify("morning".equals(kind) ? 11 : 12, n);
        } catch (SecurityException ignored) {
        }
    }
}
