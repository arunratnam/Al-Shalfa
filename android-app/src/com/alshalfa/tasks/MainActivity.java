package com.alshalfa.tasks;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.TimePickerDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.TimePicker;

import java.util.Calendar;

/** Home screen: setup, lists, window settings, reminders and daily summary. */
public class MainActivity extends Activity implements Model.Listener {

    private Model model;
    private SharedPreferences prefs;
    private ScrollView scroll;
    private LinearLayout col, setup, listsBox;
    private TextView listsHeader;

    private int dp(float v) {
        return Ui.dp(this, v);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        model = Model.get(this);
        prefs = model.prefs;
        Reminders.ensureChannels(this);

        if (getIntent().getBooleanExtra("show", false) && Settings.canDrawOverlays(this)) {
            startOverlay();
            finish();
            return;
        }

        scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.BLACK);
        scroll.setFitsSystemWindows(true);
        col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), dp(24), dp(20), dp(48));
        scroll.addView(col);

        col.addView(Ui.bold(this, "Always On Tasks", 28, Ui.FG));
        TextView sub = Ui.text(this, "A floating checklist on top of every app, with reminders, lists and a focus timer.", 15, Ui.MUTED);
        sub.setLineSpacing(0, 1.2f);
        sub.setPadding(0, dp(6), 0, dp(4));
        col.addView(sub);

        setup = new LinearLayout(this);
        setup.setOrientation(LinearLayout.VERTICAL);
        col.addView(setup, Ui.fill());

        // ---- lists ----
        listsHeader = section("Lists");
        listsBox = new LinearLayout(this);
        listsBox.setOrientation(LinearLayout.VERTICAL);
        col.addView(listsBox, Ui.fill());
        TextView addList = Ui.button(this, "+ New list", Ui.BAR, Ui.FG);
        addList.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                askName("New list", "", new NameCallback() {
                    public void done(String name) {
                        Model.TList l = new Model.TList();
                        l.id = Model.newId();
                        l.name = name;
                        model.lists.add(l);
                        model.changed();
                    }
                });
            }
        });
        col.addView(addList, Ui.margins(Ui.fill(), this, 0, 8, 0, 0));

        // ---- floating window ----
        section("Floating window");
        slider("See-through", "opacity", 40, 100, 100, "%");
        slider("Width", "widthDp", 240, 420, 320, " dp");
        slider("Height", "heightDp", 300, 700, 480, " dp");
        slider("Text size", "textPct", 80, 150, 100, "%");
        toggle("Snap the bubble to the screen edge", "snap", true, null);
        toggle("Keep the screen on while it shows", "keepOn", true, null);
        toggle("Show again after the phone restarts", "autoStart", true, null);

        // ---- daily summary ----
        section("Daily summary");
        toggle("Morning and evening summary", "summaryOn", true, new Runnable() {
            public void run() {
                Reminders.scheduleSummaries(MainActivity.this);
            }
        });
        timeRow("Morning summary", "morningMin", 8 * 60);
        timeRow("Evening summary", "eveningMin", 21 * 60);

        // ---- help ----
        section("How to use");
        TextView tips = Ui.text(this,
                "• Drag the top bar to move the window. — makes it a bubble, □ makes it full screen, ✕ hides it.\n"
                        + "• Tap a task to edit it: reminder time, repeat, priority, steps and notes.\n"
                        + "• Hold ⋮⋮ and drag to change the order (when sorted by \"My order\").\n"
                        + "• ⏱ opens a 25-minute focus timer with a 5-minute break.\n"
                        + "• 🎤 adds a task by voice. ☀ keeps the screen on.\n"
                        + "• Home Screen widget: long-press your Home Screen → Widgets → Always On Tasks.\n"
                        + "• Quick Settings tile: pull down twice → ✎ (edit) → drag \"Floating tasks\" in.",
                14, Ui.MUTED);
        tips.setLineSpacing(0, 1.35f);
        col.addView(tips);

        setContentView(scroll);

        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        model.addListener(this);
        Reminders.reschedule(this);
        if ("lists".equals(getIntent().getStringExtra("section"))) {
            scroll.post(new Runnable() {
                public void run() {
                    scroll.smoothScrollTo(0, listsHeader.getTop());
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (model != null) model.removeListener(this);
        super.onDestroy();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (setup != null) {
            refreshSetup();
            refreshLists();
        }
    }

    @Override
    public void onModelChanged() {
        refreshLists();
    }

    private void startOverlay() {
        startService(new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_SHOW));
    }

    // ------------------------------------------------------------------ setup

    private void refreshSetup() {
        setup.removeAllViews();
        boolean overlay = Settings.canDrawOverlays(this);
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31) exact = ((AlarmManager) getSystemService(ALARM_SERVICE)).canScheduleExactAlarms();

        if (!overlay) {
            setup.addView(status("Step 1: allow \"Display over other apps\" so the window can float.", false), Ui.margins(Ui.fill(), this, 0, 16, 0, 0));
            TextView perm = Ui.button(this, "Allow display over other apps", Ui.ACCENT, 0xFF001A2B);
            perm.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                }
            });
            setup.addView(perm, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
        } else {
            setup.addView(status(OverlayService.isWindowShown() ? "✓ The floating window is on." : "✓ Ready. Tap Show to open the floating window.", true),
                    Ui.margins(Ui.fill(), this, 0, 16, 0, 0));
        }
        if (!exact) {
            TextView ex = Ui.button(this, "Allow exact reminder times", Ui.BAR, Ui.WARN);
            ex.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    try {
                        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                    } catch (Exception ignored) {
                    }
                }
            });
            setup.addView(ex, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
        }

        LinearLayout row = Ui.row(this);
        TextView show = Ui.button(this, "Show floating tasks", overlay ? Ui.DONE : Ui.FAINT, overlay ? 0xFF062014 : Ui.MUTED);
        show.setEnabled(overlay);
        show.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startOverlay();
                moveTaskToBack(true);
            }
        });
        row.addView(show, Ui.weight());
        TextView stop = Ui.button(this, "Stop", Ui.BAR, Ui.FG);
        stop.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startService(new Intent(MainActivity.this, OverlayService.class).setAction(OverlayService.ACTION_STOP));
                scroll.postDelayed(new Runnable() {
                    public void run() {
                        refreshSetup();
                    }
                }, 300);
            }
        });
        row.addView(stop, Ui.margins(Ui.wrap(), this, 8, 0, 0, 0));
        setup.addView(row, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));

        TextView newTask = Ui.button(this, "+ Add a task", Ui.BAR, Ui.ACCENT);
        newTask.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startActivity(new Intent(MainActivity.this, TaskEditActivity.class));
            }
        });
        setup.addView(newTask, Ui.margins(Ui.fill(), this, 0, 8, 0, 0));

        TextView battery = Ui.text(this, "Samsung tip: Settings → Apps → Always On Tasks → Battery → Unrestricted, so the phone doesn't close the window.", 13, Ui.MUTED);
        battery.setPadding(0, dp(10), 0, 0);
        battery.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
            }
        });
        setup.addView(battery);
    }

    private TextView status(String s, boolean ok) {
        TextView t = Ui.text(this, s, 14, ok ? Ui.DONE : Ui.WARN);
        t.setPadding(dp(14), dp(12), dp(14), dp(12));
        t.setBackground(Ui.round(this, ok ? 0xFF0E2219 : 0xFF2A2112, 12));
        return t;
    }

    // ------------------------------------------------------------------ lists

    interface NameCallback {
        void done(String name);
    }

    private void askName(String title, String value, final NameCallback cb) {
        final EditText e = new EditText(this);
        e.setText(value);
        e.setSelection(value.length());
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        LinearLayout wrap = new LinearLayout(this);
        wrap.setPadding(dp(20), dp(8), dp(20), 0);
        wrap.addView(e, Ui.fill());
        new AlertDialog.Builder(this).setTitle(title).setView(wrap)
                .setPositiveButton("Save", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface d, int w) {
                        String n = e.getText().toString().trim();
                        if (n.length() > 0) cb.done(n);
                    }
                })
                .setNegativeButton("Cancel", null).show();
    }

    private void refreshLists() {
        if (listsBox == null) return;
        listsBox.removeAllViews();
        for (final Model.TList l : model.lists) {
            int open = 0;
            for (Model.Task t : model.tasks) if (t.listId == l.id && !t.done) open++;
            LinearLayout r = Ui.row(this);
            r.setPadding(dp(14), dp(6), dp(4), dp(6));
            r.setBackground(Ui.round(this, Ui.BG, 12));
            LinearLayout texts = new LinearLayout(this);
            texts.setOrientation(LinearLayout.VERTICAL);
            texts.addView(Ui.text(this, l.name, 16, Ui.FG));
            texts.addView(Ui.text(this, open + " open", 12, Ui.MUTED));
            r.addView(texts, Ui.weight());
            TextView rename = Ui.text(this, "Rename", 13, Ui.ACCENT);
            rename.setPadding(dp(10), dp(10), dp(10), dp(10));
            rename.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    askName("Rename list", l.name, new NameCallback() {
                        public void done(String name) {
                            l.name = name;
                            model.changed();
                        }
                    });
                }
            });
            r.addView(rename);
            if (model.lists.size() > 1) {
                TextView del = Ui.text(this, "Delete", 13, Ui.DANGER);
                del.setPadding(dp(10), dp(10), dp(10), dp(10));
                del.setOnClickListener(new View.OnClickListener() {
                    public void onClick(View v) {
                        new AlertDialog.Builder(MainActivity.this)
                                .setMessage("Delete the list \"" + l.name + "\" and all its tasks?")
                                .setPositiveButton("Delete", new DialogInterface.OnClickListener() {
                                    public void onClick(DialogInterface d, int w) {
                                        java.util.Iterator<Model.Task> it = model.tasks.iterator();
                                        while (it.hasNext()) if (it.next().listId == l.id) it.remove();
                                        model.lists.remove(l);
                                        model.changed();
                                    }
                                })
                                .setNegativeButton("Cancel", null).show();
                    }
                });
                r.addView(del);
            }
            listsBox.addView(r, Ui.margins(Ui.fill(), this, 0, 0, 0, 8));
        }
    }

    // ------------------------------------------------------------------ settings rows

    private TextView section(String s) {
        TextView t = Ui.bold(this, s.toUpperCase(), 12, Ui.MUTED);
        t.setLetterSpacing(0.08f);
        t.setPadding(0, dp(30), 0, dp(10));
        col.addView(t);
        return t;
    }

    private void slider(String label, final String key, final int min, int max, int def, final String unit) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        LinearLayout top = Ui.row(this);
        top.addView(Ui.text(this, label, 15, Ui.FG), Ui.weight());
        final TextView val = Ui.text(this, "", 14, Ui.MUTED);
        top.addView(val);
        box.addView(top, Ui.fill());
        SeekBar sb = new SeekBar(this);
        sb.setMax(max - min);
        int cur = prefs.getInt(key, def);
        sb.setProgress(cur - min);
        val.setText(cur + unit);
        sb.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar s, int p, boolean user) {
                val.setText((p + min) + unit);
                if (user) {
                    prefs.edit().putInt(key, p + min).apply();
                    model.changed();
                }
            }

            public void onStartTrackingTouch(SeekBar s) {
            }

            public void onStopTrackingTouch(SeekBar s) {
            }
        });
        box.addView(sb, Ui.margins(Ui.fill(), this, 0, 4, 0, 10));
        col.addView(box, Ui.fill());
    }

    private void toggle(String label, final String key, boolean def, final Runnable after) {
        final Switch sw = new Switch(this);
        sw.setText(label);
        sw.setTextColor(Ui.FG);
        sw.setTextSize(15);
        sw.setChecked(prefs.getBoolean(key, def));
        sw.setPadding(0, dp(8), 0, dp(8));
        sw.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
            public void onCheckedChanged(android.widget.CompoundButton b, boolean on) {
                prefs.edit().putBoolean(key, on).apply();
                model.changed();
                if (after != null) after.run();
            }
        });
        col.addView(sw, Ui.fill());
    }

    private void timeRow(String label, final String key, final int def) {
        LinearLayout r = Ui.row(this);
        r.setPadding(0, dp(10), 0, dp(10));
        r.addView(Ui.text(this, label, 15, Ui.FG), Ui.weight());
        final TextView val = Ui.text(this, "", 15, Ui.ACCENT);
        r.addView(val);
        final Runnable show = new Runnable() {
            public void run() {
                int m = prefs.getInt(key, def);
                Calendar c = Calendar.getInstance();
                c.set(Calendar.HOUR_OF_DAY, m / 60);
                c.set(Calendar.MINUTE, m % 60);
                val.setText(android.text.format.DateFormat.getTimeFormat(MainActivity.this).format(c.getTime()));
            }
        };
        show.run();
        r.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                int m = prefs.getInt(key, def);
                new TimePickerDialog(MainActivity.this, new TimePickerDialog.OnTimeSetListener() {
                    public void onTimeSet(TimePicker tp, int h, int min) {
                        prefs.edit().putInt(key, h * 60 + min).apply();
                        show.run();
                        Reminders.scheduleSummaries(MainActivity.this);
                    }
                }, m / 60, m % 60, android.text.format.DateFormat.is24HourFormat(MainActivity.this)).show();
            }
        });
        col.addView(r, Ui.fill());
    }
}
