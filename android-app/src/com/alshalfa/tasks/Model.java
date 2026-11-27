package com.alshalfa.tasks;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/** All tasks, lists and settings. One shared copy per app process. */
public class Model {

    public static class Sub {
        public String text;
        public boolean done;
    }

    public static class Task {
        public long id;
        public long listId;
        public String text = "";
        public boolean done;
        public int priority;          // 0 none, 1 low, 2 medium, 3 high
        public long due;              // 0 = no due time
        public String repeat = "none"; // none | daily | weekdays | weekly | monthly
        public String notes = "";
        public List<Sub> subs = new ArrayList<Sub>();
        public long doneAt;

        public int subsDone() {
            int n = 0;
            for (Sub s : subs) if (s.done) n++;
            return n;
        }
    }

    public static class TList {
        public long id;
        public String name;
    }

    public interface Listener {
        void onModelChanged();
    }

    public static final String[] REPEATS = {"none", "daily", "weekdays", "weekly", "monthly"};
    public static final String[] REPEAT_LABELS = {"Doesn't repeat", "Every day", "Weekdays (Mon–Fri)", "Every week", "Every month"};
    public static final String[] PRIORITY_LABELS = {"None", "Low", "Medium", "High"};
    public static final int[] PRIORITY_COLORS = {0x00000000, 0xFF6CC4FF, 0xFFFFC46B, 0xFFFF7A7A};

    private static Model instance;

    public static synchronized Model get(Context c) {
        if (instance == null) instance = new Model(c.getApplicationContext());
        return instance;
    }

    private final Context ctx;
    private final SharedPreferences data;
    public final SharedPreferences prefs;
    public final List<TList> lists = new ArrayList<TList>();
    public final List<Task> tasks = new ArrayList<Task>();
    private JSONObject log = new JSONObject();
    private final List<Listener> listeners = new ArrayList<Listener>();
    private final Handler main = new Handler(Looper.getMainLooper());

    private Model(Context c) {
        ctx = c;
        data = c.getSharedPreferences("data2", Context.MODE_PRIVATE);
        prefs = c.getSharedPreferences("tasks", Context.MODE_PRIVATE);
        load();
    }

    // ------------------------------------------------------------------ load / save

    private void load() {
        String raw = data.getString("json", null);
        if (raw != null) {
            try {
                JSONObject root = new JSONObject(raw);
                JSONArray ls = root.getJSONArray("lists");
                for (int i = 0; i < ls.length(); i++) {
                    JSONObject o = ls.getJSONObject(i);
                    TList l = new TList();
                    l.id = o.getLong("id");
                    l.name = o.getString("name");
                    lists.add(l);
                }
                JSONArray ts = root.getJSONArray("tasks");
                for (int i = 0; i < ts.length(); i++) tasks.add(readTask(ts.getJSONObject(i)));
                log = root.optJSONObject("log");
                if (log == null) log = new JSONObject();
            } catch (Exception ignored) {
            }
        }
        if (lists.isEmpty()) {
            TList l = new TList();
            l.id = 1;
            l.name = "My tasks";
            lists.add(l);
            if (raw == null) migrateOld(l.id);
        }
    }

    /** Brings over tasks saved by version 1.0. */
    private void migrateOld(long listId) {
        String old = prefs.getString("list", null);
        if (old == null) {
            addSample(listId, "Example: Morning walk", true, 0);
            addSample(listId, "Example: Reply to emails", false, 3);
            addSample(listId, "Example: Buy groceries", false, 2);
            return;
        }
        try {
            JSONArray arr = new JSONArray(old);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                Task t = new Task();
                t.id = o.getLong("id");
                t.listId = listId;
                t.text = o.getString("text");
                t.done = o.getBoolean("done");
                tasks.add(t);
            }
        } catch (Exception ignored) {
        }
        save();
    }

    private void addSample(long listId, String text, boolean done, int prio) {
        Task t = new Task();
        t.id = newId();
        t.listId = listId;
        t.text = text;
        t.done = done;
        t.priority = prio;
        tasks.add(t);
    }

    private static Task readTask(JSONObject o) throws Exception {
        Task t = new Task();
        t.id = o.getLong("id");
        t.listId = o.optLong("list", 1);
        t.text = o.optString("text", "");
        t.done = o.optBoolean("done");
        t.priority = o.optInt("prio");
        t.due = o.optLong("due");
        t.repeat = o.optString("repeat", "none");
        t.notes = o.optString("notes", "");
        t.doneAt = o.optLong("doneAt");
        JSONArray subs = o.optJSONArray("subs");
        if (subs != null) {
            for (int i = 0; i < subs.length(); i++) {
                JSONObject so = subs.getJSONObject(i);
                Sub s = new Sub();
                s.text = so.optString("t");
                s.done = so.optBoolean("d");
                t.subs.add(s);
            }
        }
        return t;
    }

    public synchronized void save() {
        try {
            JSONObject root = new JSONObject();
            JSONArray ls = new JSONArray();
            for (TList l : lists) {
                JSONObject o = new JSONObject();
                o.put("id", l.id);
                o.put("name", l.name);
                ls.put(o);
            }
            JSONArray ts = new JSONArray();
            for (Task t : tasks) {
                JSONObject o = new JSONObject();
                o.put("id", t.id);
                o.put("list", t.listId);
                o.put("text", t.text);
                o.put("done", t.done);
                o.put("prio", t.priority);
                o.put("due", t.due);
                o.put("repeat", t.repeat);
                o.put("notes", t.notes);
                o.put("doneAt", t.doneAt);
                JSONArray subs = new JSONArray();
                for (Sub s : t.subs) {
                    JSONObject so = new JSONObject();
                    so.put("t", s.text);
                    so.put("d", s.done);
                    subs.put(so);
                }
                o.put("subs", subs);
                ts.put(o);
            }
            root.put("lists", ls);
            root.put("tasks", ts);
            root.put("log", log);
            data.edit().putString("json", root.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Call after any change: saves, refreshes the window and widget, and updates reminders. */
    public void changed() {
        save();
        main.post(new Runnable() {
            public void run() {
                for (Listener l : new ArrayList<Listener>(listeners)) l.onModelChanged();
            }
        });
        try {
            AppWidgetManager awm = AppWidgetManager.getInstance(ctx);
            int[] ids = awm.getAppWidgetIds(new ComponentName(ctx, TasksWidget.class));
            if (ids.length > 0) TasksWidget.update(ctx, awm, ids);
        } catch (Exception ignored) {
        }
        Reminders.reschedule(ctx);
    }

    public void addListener(Listener l) {
        if (!listeners.contains(l)) listeners.add(l);
    }

    public void removeListener(Listener l) {
        listeners.remove(l);
    }

    // ------------------------------------------------------------------ tasks

    public static long newId() {
        return System.currentTimeMillis() * 10 + (long) (Math.random() * 10);
    }

    public Task find(long id) {
        for (Task t : tasks) if (t.id == id) return t;
        return null;
    }

    public TList findList(long id) {
        for (TList l : lists) if (l.id == id) return l;
        return null;
    }

    public String listName(long id) {
        TList l = findList(id);
        return l == null ? "" : l.name;
    }

    public long defaultListId() {
        return lists.get(0).id;
    }

    public Task add(String text, long listId) {
        Task t = new Task();
        t.id = newId();
        t.text = text;
        t.listId = findList(listId) != null ? listId : defaultListId();
        tasks.add(t);
        return t;
    }

    public void delete(Task t) {
        tasks.remove(t);
    }

    /** Ticks a task. A repeating task moves to its next date instead of staying done. */
    public void setDone(Task t, boolean done) {
        if (done && !"none".equals(t.repeat)) {
            long base = t.due > 0 ? t.due : todayAt(9, 0);
            long next = nextDue(base, t.repeat);
            while (next <= System.currentTimeMillis()) next = nextDue(next, t.repeat);
            t.due = next;
            t.done = false;
            for (Sub s : t.subs) s.done = false;
            logDone();
            return;
        }
        if (done && !t.done) logDone();
        t.done = done;
        t.doneAt = done ? System.currentTimeMillis() : 0;
    }

    public void clearDone(long listFilter) {
        Iterator<Task> it = tasks.iterator();
        while (it.hasNext()) {
            Task t = it.next();
            if (t.done && (listFilter == 0 || t.listId == listFilter)) it.remove();
        }
    }

    public static long nextDue(long base, String repeat) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(base);
        if ("daily".equals(repeat)) {
            c.add(Calendar.DAY_OF_MONTH, 1);
        } else if ("weekdays".equals(repeat)) {
            do {
                c.add(Calendar.DAY_OF_MONTH, 1);
            } while (c.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || c.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY);
        } else if ("weekly".equals(repeat)) {
            c.add(Calendar.DAY_OF_MONTH, 7);
        } else if ("monthly".equals(repeat)) {
            c.add(Calendar.MONTH, 1);
        } else {
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return c.getTimeInMillis();
    }

    public static long todayAt(int h, int m) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, h);
        c.set(Calendar.MINUTE, m);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    public static long endOfToday() {
        return todayAt(23, 59) + 60000;
    }

    public static boolean overdue(Task t) {
        return !t.done && t.due > 0 && t.due < System.currentTimeMillis();
    }

    /** Tasks to show, in display order. listFilter 0 = all lists. sort: mine | priority | time */
    public List<Task> visible(long listFilter, boolean showDone, String sort) {
        List<Task> out = new ArrayList<Task>();
        for (Task t : tasks) {
            if (listFilter != 0 && t.listId != listFilter) continue;
            if (!showDone && t.done) continue;
            out.add(t);
        }
        final List<Task> order = tasks;
        if ("priority".equals(sort)) {
            Collections.sort(out, new Comparator<Task>() {
                public int compare(Task a, Task b) {
                    if (a.done != b.done) return a.done ? 1 : -1;
                    if (a.priority != b.priority) return b.priority - a.priority;
                    return order.indexOf(a) - order.indexOf(b);
                }
            });
        } else if ("time".equals(sort)) {
            Collections.sort(out, new Comparator<Task>() {
                public int compare(Task a, Task b) {
                    if (a.done != b.done) return a.done ? 1 : -1;
                    long da = a.due == 0 ? Long.MAX_VALUE : a.due, db = b.due == 0 ? Long.MAX_VALUE : b.due;
                    if (da != db) return da < db ? -1 : 1;
                    return b.priority - a.priority;
                }
            });
        }
        return out;
    }

    /** Moves a task within the shown list (drag to reorder), keeping other tasks in place. */
    public void move(List<Task> shown, int from, int to) {
        if (from == to || from < 0 || to < 0 || from >= shown.size() || to >= shown.size()) return;
        List<Integer> slots = new ArrayList<Integer>();
        for (Task t : shown) slots.add(tasks.indexOf(t));
        Collections.sort(slots);
        List<Task> reordered = new ArrayList<Task>(shown);
        Task moving = reordered.remove(from);
        reordered.add(to, moving);
        for (int i = 0; i < slots.size(); i++) tasks.set(slots.get(i), reordered.get(i));
    }

    // ------------------------------------------------------------------ daily log

    private static String dayKey(long time) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(time));
    }

    private void logDone() {
        String k = dayKey(System.currentTimeMillis());
        try {
            log.put(k, log.optInt(k) + 1);
        } catch (Exception ignored) {
        }
    }

    public int doneToday() {
        return log.optInt(dayKey(System.currentTimeMillis()));
    }

    /** Open tasks due today, overdue, or without a date. */
    public int openToday() {
        long end = endOfToday();
        int n = 0;
        for (Task t : tasks) if (!t.done && (t.due == 0 || t.due < end)) n++;
        return n;
    }

    public int overdueCount() {
        int n = 0;
        for (Task t : tasks) if (overdue(t)) n++;
        return n;
    }

    // ------------------------------------------------------------------ labels

    public static String dueLabel(Context c, long due) {
        if (due == 0) return "";
        Calendar now = Calendar.getInstance();
        Calendar d = Calendar.getInstance();
        d.setTimeInMillis(due);
        String time = android.text.format.DateFormat.getTimeFormat(c).format(new Date(due));
        int days = (int) ((startOfDay(due) - startOfDay(now.getTimeInMillis())) / 86400000L);
        if (days == 0) return "Today " + time;
        if (days == 1) return "Tomorrow " + time;
        if (days == -1) return "Yesterday " + time;
        if (days > 1 && days < 7) return new SimpleDateFormat("EEE", Locale.getDefault()).format(new Date(due)) + " " + time;
        return new SimpleDateFormat("d MMM", Locale.getDefault()).format(new Date(due)) + " " + time;
    }

    private static long startOfDay(long t) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(t);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    public static String repeatShort(String r) {
        if ("daily".equals(r)) return "Daily";
        if ("weekdays".equals(r)) return "Weekdays";
        if ("weekly".equals(r)) return "Weekly";
        if ("monthly".equals(r)) return "Monthly";
        return "";
    }

    /** One-line summary under a task: due time, repeat, subtasks, notes. */
    public String meta(Context c, Task t, boolean withList) {
        StringBuilder sb = new StringBuilder();
        if (t.due > 0) sb.append("⏰ ").append(dueLabel(c, t.due));
        String r = repeatShort(t.repeat);
        if (r.length() > 0) sb.append(sb.length() > 0 ? "  · " : "").append("↻ ").append(r);
        if (!t.subs.isEmpty()) sb.append(sb.length() > 0 ? "  · " : "").append("☑ ").append(t.subsDone()).append("/").append(t.subs.size());
        if (t.notes != null && t.notes.trim().length() > 0) sb.append(sb.length() > 0 ? "  · " : "").append("✎ Note");
        if (withList && lists.size() > 1) sb.append(sb.length() > 0 ? "  · " : "").append(listName(t.listId));
        return sb.toString();
    }
}
