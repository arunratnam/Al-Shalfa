package com.alshalfa.tasks;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** Saves the task list and window settings on the phone. */
public class TaskStore {

    public static class Task {
        public long id;
        public String text;
        public boolean done;

        Task(long id, String text, boolean done) {
            this.id = id;
            this.text = text;
            this.done = done;
        }
    }

    private final SharedPreferences prefs;
    public final List<Task> tasks = new ArrayList<Task>();

    public TaskStore(Context ctx) {
        prefs = ctx.getSharedPreferences("tasks", Context.MODE_PRIVATE);
        load();
    }

    private void load() {
        tasks.clear();
        String raw = prefs.getString("list", null);
        if (raw == null) {
            tasks.add(new Task(1, "Example: Morning walk", true));
            tasks.add(new Task(2, "Example: Reply to emails", false));
            tasks.add(new Task(3, "Example: Buy groceries", false));
            return;
        }
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                tasks.add(new Task(o.getLong("id"), o.getString("text"), o.getBoolean("done")));
            }
        } catch (Exception ignored) {
        }
    }

    public void save() {
        JSONArray arr = new JSONArray();
        try {
            for (Task t : tasks) {
                JSONObject o = new JSONObject();
                o.put("id", t.id);
                o.put("text", t.text);
                o.put("done", t.done);
                arr.put(o);
            }
        } catch (Exception ignored) {
        }
        prefs.edit().putString("list", arr.toString()).apply();
    }

    public void add(String text) {
        tasks.add(new Task(System.currentTimeMillis(), text, false));
        save();
    }

    public void remove(Task t) {
        tasks.remove(t);
        save();
    }

    public void clearDone() {
        Iterator<Task> it = tasks.iterator();
        while (it.hasNext()) {
            if (it.next().done) it.remove();
        }
        save();
    }

    public int doneCount() {
        int n = 0;
        for (Task t : tasks) if (t.done) n++;
        return n;
    }

    // ---- window settings ----
    public String getString(String k, String def) { return prefs.getString(k, def); }
    public void putString(String k, String v) { prefs.edit().putString(k, v).apply(); }
    public int getInt(String k, int def) { return prefs.getInt(k, def); }
    public void putInt(String k, int v) { prefs.edit().putInt(k, v).apply(); }
    public boolean getBool(String k, boolean def) { return prefs.getBoolean(k, def); }
    public void putBool(String k, boolean v) { prefs.edit().putBoolean(k, v).apply(); }
}
