package com.alshalfa.tasks;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

/** Shows the floating task window on top of all apps. */
public class OverlayService extends Service {

    public static final String ACTION_SHOW = "com.alshalfa.tasks.SHOW";
    public static final String ACTION_STOP = "com.alshalfa.tasks.STOP";
    public static final String ACTION_MIN = "com.alshalfa.tasks.MIN";

    private static final String CHANNEL = "floating";
    private static final int NOTIF_ID = 7;

    // colours
    private static final int BG = 0xFF12161B, BAR = 0xFF1A2027, FAINT = 0xFF2A3038, FG = 0xFFE8EBEF,
            MUTED = 0xFF7C8590, ACCENT = 0xFF6CC4FF, DONE = 0xFF5FD39A;

    private WindowManager wm;
    private WindowManager.LayoutParams lp;
    private FrameLayout root;
    private LinearLayout card;
    private TextView bubble;
    private TextView count, leftText, keepBtn, maxBtn;
    private ProgressBar progress;
    private LinearLayout list;
    private EditText input;
    private final TextView[] chips = new TextView[3];

    private TaskStore store;
    private String mode = "normal";   // normal | min | max
    private String filter = "all";    // all | active | done
    private boolean keepOn = true;
    private boolean shown = false;

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        store = new TaskStore(this);
        mode = store.getString("mode", "normal");
        filter = store.getString("filter", "all");
        keepOn = store.getBool("keepOn", true);
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    /** Keeps the app running in the background so the window isn't closed. */
    private void goForeground() {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, buildNotification(),
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, buildNotification());
            }
        } catch (Exception ignored) {
            // Android may refuse this when restarting in the background; the window still shows.
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!shown) {
            buildWindow();
        }
        goForeground();
        if (ACTION_SHOW.equals(action) && "min".equals(mode)) {
            setMode("normal");
        } else if (ACTION_MIN.equals(action)) {
            setMode("min");
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (shown && root != null) {
            try {
                wm.removeView(root);
            } catch (Exception ignored) {
            }
        }
        shown = false;
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (shown) applyMode();
    }

    // ------------------------------------------------------------------ notification

    private Notification buildNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            // NotificationChannel is newer than the compile SDK, so it is created by reflection.
            try {
                Class<?> chCls = Class.forName("android.app.NotificationChannel");
                Object ch = chCls.getConstructor(String.class, CharSequence.class, int.class)
                        .newInstance(CHANNEL, "Floating tasks", 2 /* IMPORTANCE_LOW */);
                nm.getClass().getMethod("createNotificationChannel", chCls).invoke(nm, ch);
                b = Notification.Builder.class.getConstructor(Context.class, String.class)
                        .newInstance(this, CHANNEL);
            } catch (Exception e) {
                b = new Notification.Builder(this);
            }
        } else {
            b = new Notification.Builder(this);
        }
        int immutable = 0x04000000; // PendingIntent.FLAG_IMMUTABLE
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), immutable | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent show = PendingIntent.getService(this, 1,
                new Intent(this, OverlayService.class).setAction(ACTION_SHOW),
                immutable | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 2,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP),
                immutable | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(android.R.drawable.checkbox_on_background)
                .setContentTitle("Floating tasks are on")
                .setContentText("Tap Open window to show your checklist")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(0, "Open window", show)
                .addAction(0, "Stop", stop);
        return b.build();
    }

    // ------------------------------------------------------------------ window

    private void buildWindow() {
        int type = Build.VERSION.SDK_INT >= 26
                ? 2038 /* TYPE_APPLICATION_OVERLAY */
                : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        DisplayMetrics m = getResources().getDisplayMetrics();
        lp.x = store.getInt("x", (m.widthPixels - dp(310)) / 2);
        lp.y = store.getInt("y", m.heightPixels / 3);
        applyKeepOn();

        root = new FrameLayout(this);
        root.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_OUTSIDE) {
                    setKeyboard(false);
                }
                return false;
            }
        });

        card = buildCard();
        root.addView(card, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        bubble = new TextView(this);
        bubble.setTextColor(FG);
        bubble.setTextSize(15);
        bubble.setTypeface(Typeface.DEFAULT_BOLD);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(dp(16), dp(12), dp(16), dp(12));
        GradientDrawable bb = new GradientDrawable();
        bb.setColor(BAR);
        bb.setCornerRadius(dp(30));
        bb.setStroke(dp(2), DONE);
        bubble.setBackground(bb);
        bubble.setElevation(dp(8));
        attachDrag(bubble, true);
        root.addView(bubble, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        wm.addView(root, lp);
        shown = true;
        render();
        applyMode();
    }

    private LinearLayout buildCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable g = new GradientDrawable();
        g.setColor(BG);
        g.setCornerRadius(dp(16));
        g.setStroke(dp(1), FAINT);
        c.setBackground(g);
        c.setClipToOutline(true);
        c.setElevation(dp(10));

        // ---- title bar (drag handle) ----
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), dp(6), dp(4), dp(6));
        GradientDrawable barBg = new GradientDrawable();
        barBg.setColor(BAR);
        barBg.setCornerRadii(new float[]{dp(16), dp(16), dp(16), dp(16), 0, 0, 0, 0});
        bar.setBackground(barBg);

        TextView grip = text("⠿", 16, MUTED);
        grip.setPadding(0, 0, dp(8), 0);
        bar.addView(grip);

        TextView title = text("Tasks", 16, FG);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        count = text("0/0", 12, MUTED);
        count.setPadding(dp(8), dp(2), dp(8), dp(2));
        GradientDrawable cg = new GradientDrawable();
        cg.setColor(FAINT);
        cg.setCornerRadius(dp(10));
        count.setBackground(cg);
        bar.addView(count);

        keepBtn = barButton("☀");
        keepBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                keepOn = !keepOn;
                store.putBool("keepOn", keepOn);
                applyKeepOn();
                wm.updateViewLayout(root, lp);
                render();
            }
        });
        bar.addView(keepBtn);

        TextView minBtn = barButton("—");
        minBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                setMode("min");
            }
        });
        bar.addView(minBtn);

        maxBtn = barButton("□");
        maxBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                setMode("max".equals(mode) ? "normal" : "max");
            }
        });
        bar.addView(maxBtn);

        TextView closeBtn = barButton("✕");
        closeBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                stopSelf();
            }
        });
        bar.addView(closeBtn);

        attachDrag(bar, false);
        c.addView(bar);

        // ---- progress ----
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(false);
        progress.setProgressTintList(ColorStateList.valueOf(DONE));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(FAINT));
        c.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));

        // ---- body ----
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(12), dp(10), dp(12), dp(8));

        LinearLayout addRow = new LinearLayout(this);
        addRow.setOrientation(LinearLayout.HORIZONTAL);
        input = new EditText(this);
        input.setHint("Add a task…");
        input.setHintTextColor(MUTED);
        input.setTextColor(FG);
        input.setTextSize(15);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        GradientDrawable ig = new GradientDrawable();
        ig.setColor(Color.BLACK);
        ig.setCornerRadius(dp(10));
        ig.setStroke(dp(1), FAINT);
        input.setBackground(ig);
        input.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_UP) setKeyboard(true);
                return false;
            }
        });
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int actionId, KeyEvent ev) {
                addTask();
                return true;
            }
        });
        addRow.addView(input, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        TextView addBtn = text("Add", 15, 0xFF001A2B);
        addBtn.setTypeface(Typeface.DEFAULT_BOLD);
        addBtn.setGravity(Gravity.CENTER);
        addBtn.setPadding(dp(16), 0, dp(16), 0);
        GradientDrawable ag = new GradientDrawable();
        ag.setColor(ACCENT);
        ag.setCornerRadius(dp(10));
        addBtn.setBackground(ag);
        addBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                addTask();
            }
        });
        LinearLayout.LayoutParams abl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT);
        abl.leftMargin = dp(8);
        addRow.addView(addBtn, abl);
        body.addView(addRow);

        // filters
        LinearLayout filters = new LinearLayout(this);
        filters.setOrientation(LinearLayout.HORIZONTAL);
        filters.setPadding(0, dp(10), 0, dp(6));
        String[] labels = {"All", "To do", "Done"};
        final String[] keys = {"all", "active", "done"};
        for (int i = 0; i < 3; i++) {
            final String key = keys[i];
            TextView chip = text(labels[i], 13, MUTED);
            chip.setPadding(dp(12), dp(5), dp(12), dp(5));
            chip.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    filter = key;
                    store.putString("filter", filter);
                    render();
                }
            });
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cl.rightMargin = dp(6);
            chip.setTag(key);
            chips[i] = chip;
            filters.addView(chip, cl);
        }
        body.addView(filters);

        // list
        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(list);
        body.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        // footer
        LinearLayout foot = new LinearLayout(this);
        foot.setOrientation(LinearLayout.HORIZONTAL);
        foot.setGravity(Gravity.CENTER_VERTICAL);
        foot.setPadding(dp(4), dp(8), 0, 0);
        leftText = text("", 12, MUTED);
        foot.addView(leftText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView clear = text("Clear done", 12, MUTED);
        clear.setPadding(dp(8), dp(6), dp(8), dp(6));
        clear.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                store.clearDone();
                render();
            }
        });
        foot.addView(clear);
        body.addView(foot);

        c.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        return c;
    }

    private TextView text(String s, float size, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTextColor(color);
        return t;
    }

    private TextView barButton(String s) {
        TextView t = text(s, 17, MUTED);
        t.setGravity(Gravity.CENTER);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
        return t;
    }

    // ------------------------------------------------------------------ behaviour

    private void addTask() {
        String v = input.getText().toString().trim();
        if (v.length() > 0) {
            store.add(v);
            input.setText("");
            if ("done".equals(filter)) {
                filter = "all";
                store.putString("filter", filter);
            }
            render();
        }
    }

    private void setMode(String m) {
        mode = m;
        store.putString("mode", m);
        if (!"normal".equals(m) && !"max".equals(m)) setKeyboard(false);
        applyMode();
        render();
    }

    private void applyMode() {
        if (root == null) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        if ("min".equals(mode)) {
            card.setVisibility(View.GONE);
            bubble.setVisibility(View.VISIBLE);
            lp.width = WindowManager.LayoutParams.WRAP_CONTENT;
            lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
            lp.x = store.getInt("x", lp.x);
            lp.y = store.getInt("y", lp.y);
        } else if ("max".equals(mode)) {
            card.setVisibility(View.VISIBLE);
            bubble.setVisibility(View.GONE);
            lp.width = WindowManager.LayoutParams.MATCH_PARENT;
            lp.height = WindowManager.LayoutParams.MATCH_PARENT;
            lp.x = 0;
            lp.y = 0;
        } else {
            card.setVisibility(View.VISIBLE);
            bubble.setVisibility(View.GONE);
            lp.width = Math.min(dp(320), dm.widthPixels - dp(16));
            lp.height = Math.min(dp(460), (int) (dm.heightPixels * 0.65f));
            lp.x = store.getInt("x", lp.x);
            lp.y = store.getInt("y", lp.y);
        }
        clamp(lp.width > 0 ? lp.width : dp(110), lp.height > 0 ? lp.height : dp(50));
        wm.updateViewLayout(root, lp);
    }

    private void clamp(int w, int h) {
        if ("max".equals(mode)) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        lp.x = Math.max(0, Math.min(lp.x, dm.widthPixels - w));
        lp.y = Math.max(0, Math.min(lp.y, dm.heightPixels - h - dp(24)));
    }

    private void applyKeepOn() {
        if (keepOn) lp.flags |= WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        else lp.flags &= ~WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
    }

    /** The window only takes the keyboard while you type, so other apps keep working normally. */
    private void setKeyboard(boolean on) {
        if (lp == null || root == null) return;
        boolean focusable = (lp.flags & WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) == 0;
        if (on == focusable) return;
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (on) {
            lp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            wm.updateViewLayout(root, lp);
            input.requestFocus();
            imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
        } else {
            imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
            input.clearFocus();
            lp.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            wm.updateViewLayout(root, lp);
        }
    }

    private void attachDrag(final View handle, final boolean tapOpens) {
        handle.setOnTouchListener(new View.OnTouchListener() {
            int startX, startY;
            float downX, downY;
            boolean moved;

            public boolean onTouch(View v, MotionEvent e) {
                if ("max".equals(mode)) {
                    return false;
                }
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = lp.x;
                        startY = lp.y;
                        downX = e.getRawX();
                        downY = e.getRawY();
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) moved = true;
                        if (moved) {
                            lp.x = startX + (int) dx;
                            lp.y = startY + (int) dy;
                            clamp(root.getWidth(), root.getHeight());
                            wm.updateViewLayout(root, lp);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (moved) {
                            store.putInt("x", lp.x);
                            store.putInt("y", lp.y);
                        } else if (tapOpens && e.getActionMasked() == MotionEvent.ACTION_UP) {
                            setMode("normal");
                        }
                        return true;
                }
                return false;
            }
        });
    }

    // ------------------------------------------------------------------ drawing the list

    private void render() {
        if (root == null) return;
        int total = store.tasks.size(), done = store.doneCount();
        count.setText(done + "/" + total);
        leftText.setText((total - done) + " left");
        progress.setMax(Math.max(1, total));
        progress.setProgress(done);
        bubble.setText("✓ " + done + "/" + total);
        keepBtn.setTextColor(keepOn ? DONE : MUTED);
        maxBtn.setText("max".equals(mode) ? "❐" : "□");

        for (TextView chip : chips) {
            boolean sel = chip.getTag().equals(filter);
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(dp(20));
            if (sel) {
                g.setColor(FG);
                chip.setTextColor(Color.BLACK);
            } else {
                g.setColor(Color.TRANSPARENT);
                g.setStroke(dp(1), FAINT);
                chip.setTextColor(MUTED);
            }
            chip.setBackground(g);
        }

        list.removeAllViews();
        int shownCount = 0;
        boolean big = "max".equals(mode);
        for (final TaskStore.Task t : store.tasks) {
            if ("active".equals(filter) && t.done) continue;
            if ("done".equals(filter) && !t.done) continue;
            shownCount++;

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(4), 0, dp(4));

            final CheckBox cb = new CheckBox(this);
            cb.setChecked(t.done);
            cb.setButtonTintList(ColorStateList.valueOf(t.done ? DONE : MUTED));
            cb.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    t.done = cb.isChecked();
                    store.save();
                    render();
                }
            });
            row.addView(cb);

            TextView label = text(t.text, big ? 19 : 15, t.done ? MUTED : FG);
            label.setEllipsize(big ? null : TextUtils.TruncateAt.END);
            label.setMaxLines(big ? 4 : 2);
            if (t.done) label.setPaintFlags(label.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
            label.setPadding(dp(4), dp(6), dp(4), dp(6));
            label.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    t.done = !t.done;
                    store.save();
                    render();
                }
            });
            row.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            TextView del = text("✕", 15, MUTED);
            del.setGravity(Gravity.CENTER);
            del.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    store.remove(t);
                    render();
                }
            });
            row.addView(del, new LinearLayout.LayoutParams(dp(36), dp(36)));

            list.addView(row);
        }
        if (shownCount == 0) {
            TextView empty = text("No tasks here. Add one above.", 14, MUTED);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(0, dp(20), 0, dp(20));
            list.addView(empty, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
    }
}
