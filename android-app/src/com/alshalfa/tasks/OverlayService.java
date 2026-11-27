package com.alshalfa.tasks;

import android.animation.ValueAnimator;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
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
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.DateFormat;
import java.util.Date;
import java.util.List;

/** The floating task window shown on top of all apps. */
public class OverlayService extends Service implements Model.Listener {

    public static final String ACTION_SHOW = "com.alshalfa.tasks.SHOW";
    public static final String ACTION_HIDE = "com.alshalfa.tasks.HIDE";
    public static final String ACTION_STOP = "com.alshalfa.tasks.STOP";

    private static final int NOTIF_ID = 7;
    private static final long FOCUS_MS = 25 * 60 * 1000L, BREAK_MS = 5 * 60 * 1000L;

    private static OverlayService instance;

    public static boolean isWindowShown() {
        return instance != null && instance.attached;
    }

    /** Used by the Quick Settings tile. Returns false when the service isn't running. */
    public static boolean toggleFromTile() {
        if (instance == null) return false;
        if (instance.attached) instance.hideWindow();
        else instance.showWindow();
        return true;
    }

    private Model model;
    private SharedPreferences prefs;
    private WindowManager wm;
    private WindowManager.LayoutParams lp;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private LinearLayout card, list, lists, timerRow;
    private TextView bubble, title, clock, keepBtn, maxBtn, timerBtn, leftText, showDoneBtn, sortBtn;
    private TextView timerText, timerPlay;
    private ProgressBar progress;
    private EditText input;
    private boolean attached;

    private String mode;       // normal | min | max
    private long listFilter;   // 0 = all lists
    private boolean showDone, keepOn;
    private String sort;       // mine | priority | time

    // focus timer
    private boolean timerOpen, timerRunning, onBreak;
    private long timerEnd, timerLeft = FOCUS_MS;

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
        instance = this;
        model = Model.get(this);
        prefs = model.prefs;
        mode = prefs.getString("mode", "normal");
        listFilter = prefs.getLong("listFilter", 0);
        showDone = prefs.getBoolean("showDone", true);
        keepOn = prefs.getBoolean("keepOn", true);
        sort = prefs.getString("sort", "mine");
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        model.addListener(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            prefs.edit().putBoolean("wasRunning", false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (root == null) buildWindow();
        if (ACTION_HIDE.equals(action)) {
            hideWindow();
        } else {
            showWindow();
            if (ACTION_SHOW.equals(action) && "min".equals(mode)) setMode("normal");
        }
        prefs.edit().putBoolean("wasRunning", true).apply();
        goForeground();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        model.removeListener(this);
        handler.removeCallbacksAndMessages(null);
        if (attached) {
            try {
                wm.removeView(root);
            } catch (Exception ignored) {
            }
        }
        attached = false;
        instance = null;
        QuickTile.refresh(this);
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (root != null) applyMode();
    }

    @Override
    public void onModelChanged() {
        if (root == null) return;
        if (listFilter != 0 && model.findList(listFilter) == null) listFilter = 0;
        applySettings();
        render();
    }

    // ------------------------------------------------------------------ foreground notification

    private void goForeground() {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, buildNotification());
            }
        } catch (Exception ignored) {
            // Android may refuse this when restarting in the background; the window still shows.
        }
    }

    private Notification buildNotification() {
        int flags = Reminders.IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), flags);
        PendingIntent show = PendingIntent.getService(this, 1,
                new Intent(this, OverlayService.class).setAction(attached ? ACTION_HIDE : ACTION_SHOW), flags);
        PendingIntent stop = PendingIntent.getService(this, 2,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP), flags);
        int open2 = 0;
        for (Model.Task t : model.tasks) if (!t.done) open2++;
        return Reminders.builder(this, Reminders.CH_FLOAT)
                .setSmallIcon(R.drawable.ic_tile)
                .setContentTitle(attached ? "Floating tasks are showing" : "Floating tasks are hidden")
                .setContentText(open2 + (open2 == 1 ? " task" : " tasks") + " left")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(0, attached ? "Hide window" : "Show window", show)
                .addAction(0, "Stop", stop)
                .build();
    }

    private void updateNotification() {
        try {
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIF_ID, buildNotification());
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------------ window

    private void buildWindow() {
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        DisplayMetrics m = getResources().getDisplayMetrics();
        lp.x = prefs.getInt("x", (m.widthPixels - dp(320)) / 2);
        lp.y = prefs.getInt("y", m.heightPixels / 4);

        root = new FrameLayout(this);
        root.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_OUTSIDE) setKeyboard(false);
                return false;
            }
        });
        card = buildCard();
        root.addView(card, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        bubble = Ui.bold(this, "", 15, Ui.FG);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(dp(16), dp(12), dp(16), dp(12));
        bubble.setBackground(Ui.outline(this, Ui.BAR, Ui.DONE, 30));
        bubble.setElevation(dp(8));
        attachDrag(bubble, true);
        root.addView(bubble, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        applySettings();
        render();
        tickClock();
    }

    private void showWindow() {
        if (root == null || attached) return;
        wm.addView(root, lp);
        attached = true;
        applyMode();
        render();
        updateNotification();
        QuickTile.refresh(this);
    }

    private void hideWindow() {
        if (!attached) return;
        setKeyboard(false);
        try {
            wm.removeView(root);
        } catch (Exception ignored) {
        }
        attached = false;
        updateNotification();
        QuickTile.refresh(this);
    }

    private LinearLayout buildCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(Ui.outline(this, Ui.BG, Ui.FAINT, 16));
        c.setClipToOutline(true);
        c.setElevation(dp(10));

        // ---- title bar (drag handle) ----
        LinearLayout bar = Ui.row(this);
        bar.setPadding(dp(12), dp(4), dp(2), dp(4));
        bar.setBackgroundColor(Ui.BAR);
        bar.addView(Ui.text(this, "⠿", 15, Ui.MUTED), Ui.margins(Ui.wrap(), this, 0, 0, 6, 0));
        title = Ui.bold(this, "Tasks", 15, Ui.FG);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        bar.addView(title, Ui.weight());
        clock = Ui.text(this, "", 12, Ui.MUTED);
        bar.addView(clock, Ui.margins(Ui.wrap(), this, 4, 0, 2, 0));

        timerBtn = barButton("⏱");
        timerBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                timerOpen = !timerOpen;
                render();
            }
        });
        bar.addView(timerBtn);
        keepBtn = barButton("☀");
        keepBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                keepOn = !keepOn;
                prefs.edit().putBoolean("keepOn", keepOn).apply();
                applySettings();
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
                hideWindow();
            }
        });
        bar.addView(closeBtn);
        attachDrag(bar, false);
        c.addView(bar, Ui.fill());

        // ---- progress ----
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(ColorStateList.valueOf(Ui.DONE));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(Ui.FAINT));
        c.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));

        // ---- focus timer ----
        timerRow = Ui.row(this);
        timerRow.setPadding(dp(14), dp(8), dp(8), dp(8));
        timerRow.setBackgroundColor(0xFF0E1B24);
        timerText = Ui.bold(this, "", 20, Ui.ACCENT);
        timerText.setFontFeatureSettings("tnum");
        timerRow.addView(timerText, Ui.weight());
        timerPlay = smallButton("▶");
        timerPlay.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                toggleTimer();
            }
        });
        timerRow.addView(timerPlay);
        TextView reset = smallButton("⟲");
        reset.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                timerRunning = false;
                onBreak = false;
                timerLeft = FOCUS_MS;
                render();
            }
        });
        timerRow.addView(reset);
        c.addView(timerRow, Ui.fill());

        // ---- body ----
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(12), dp(10), dp(12), dp(6));

        // lists
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        lists = Ui.row(this);
        hs.addView(lists);
        body.addView(hs, Ui.margins(Ui.fill(), this, 0, 0, 0, 8));

        // add row
        LinearLayout addRow = Ui.row(this);
        input = new EditText(this);
        input.setHint("Add a task…");
        input.setHintTextColor(Ui.MUTED);
        input.setTextColor(Ui.FG);
        input.setTextSize(15);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setPadding(dp(12), dp(9), dp(12), dp(9));
        input.setBackground(Ui.outline(this, Ui.BLACK, Ui.FAINT, 10));
        input.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_UP) setKeyboard(true);
                return false;
            }
        });
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int id, KeyEvent ev) {
                addTask();
                return true;
            }
        });
        addRow.addView(input, Ui.weight());
        TextView mic = Ui.text(this, "🎤", 17, Ui.FG);
        mic.setGravity(Gravity.CENTER);
        mic.setBackground(Ui.round(this, Ui.FAINT, 10));
        mic.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                setKeyboard(false);
                Intent i = new Intent(OverlayService.this, VoiceActivity.class)
                        .putExtra("list", currentAddList()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            }
        });
        addRow.addView(mic, Ui.margins(new LinearLayout.LayoutParams(dp(40), dp(40)), this, 6, 0, 0, 0));
        TextView add = Ui.bold(this, "Add", 15, 0xFF001A2B);
        add.setGravity(Gravity.CENTER);
        add.setPadding(dp(14), 0, dp(14), 0);
        add.setBackground(Ui.round(this, Ui.ACCENT, 10));
        add.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                addTask();
            }
        });
        addRow.addView(add, Ui.margins(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(40)), this, 6, 0, 0, 0));
        body.addView(addRow, Ui.fill());

        // list
        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, dp(6), 0, 0);
        scroll.addView(list);
        body.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        // footer
        LinearLayout foot = Ui.row(this);
        foot.setPadding(dp(2), dp(4), 0, 0);
        leftText = Ui.text(this, "", 12, Ui.MUTED);
        foot.addView(leftText, Ui.weight());
        sortBtn = footButton("");
        sortBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                sort = "mine".equals(sort) ? "priority" : "priority".equals(sort) ? "time" : "mine";
                prefs.edit().putString("sort", sort).apply();
                render();
            }
        });
        foot.addView(sortBtn);
        showDoneBtn = footButton("");
        showDoneBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                showDone = !showDone;
                prefs.edit().putBoolean("showDone", showDone).apply();
                render();
            }
        });
        foot.addView(showDoneBtn);
        TextView clear = footButton("Clear done");
        clear.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                model.clearDone(listFilter);
                model.changed();
            }
        });
        foot.addView(clear);
        body.addView(foot, Ui.fill());

        c.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        return c;
    }

    private TextView barButton(String s) {
        TextView t = Ui.text(this, s, 16, Ui.MUTED);
        t.setGravity(Gravity.CENTER);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(34), dp(40)));
        return t;
    }

    private TextView smallButton(String s) {
        TextView t = Ui.text(this, s, 17, Ui.FG);
        t.setGravity(Gravity.CENTER);
        t.setBackground(Ui.round(this, Ui.FAINT, 8));
        t.setLayoutParams(Ui.margins(new LinearLayout.LayoutParams(dp(38), dp(34)), this, 6, 0, 0, 0));
        return t;
    }

    private TextView footButton(String s) {
        TextView t = Ui.text(this, s, 12, Ui.MUTED);
        t.setPadding(dp(8), dp(6), dp(6), dp(6));
        return t;
    }

    // ------------------------------------------------------------------ settings & modes

    private void applySettings() {
        if (lp == null) return;
        if (keepOn) lp.flags |= WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        else lp.flags &= ~WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        lp.alpha = Math.max(40, Math.min(100, prefs.getInt("opacity", 100))) / 100f;
        if (attached) applyMode();
    }

    private void setMode(String m) {
        mode = m;
        prefs.edit().putString("mode", m).apply();
        if ("min".equals(m)) setKeyboard(false);
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
            lp.x = prefs.getInt("bx", prefs.getInt("x", lp.x));
            lp.y = prefs.getInt("by", prefs.getInt("y", lp.y));
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
            lp.width = Math.min(dp(prefs.getInt("widthDp", 320)), dm.widthPixels - dp(12));
            lp.height = Math.min(dp(prefs.getInt("heightDp", 480)), (int) (dm.heightPixels * 0.75f));
            lp.x = prefs.getInt("x", lp.x);
            lp.y = prefs.getInt("y", lp.y);
        }
        clamp(lp.width > 0 ? lp.width : dp(110), lp.height > 0 ? lp.height : dp(50));
        if (attached) wm.updateViewLayout(root, lp);
    }

    private void clamp(int w, int h) {
        if ("max".equals(mode)) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        lp.x = Math.max(0, Math.min(lp.x, dm.widthPixels - w));
        lp.y = Math.max(0, Math.min(lp.y, dm.heightPixels - h - dp(24)));
    }

    /** The window only takes the keyboard while you type, so other apps keep working normally. */
    private void setKeyboard(boolean on) {
        if (lp == null || !attached) return;
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

    private void attachDrag(final View handle, final boolean isBubble) {
        handle.setOnTouchListener(new View.OnTouchListener() {
            int startX, startY;
            float downX, downY;
            boolean moved;

            public boolean onTouch(View v, MotionEvent e) {
                if ("max".equals(mode)) return false;
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
                            if (isBubble && prefs.getBoolean("snap", true)) snapToEdge();
                            else savePos(isBubble);
                        } else if (isBubble && e.getActionMasked() == MotionEvent.ACTION_UP) {
                            setMode("normal");
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private void savePos(boolean isBubble) {
        prefs.edit().putInt(isBubble ? "bx" : "x", lp.x).putInt(isBubble ? "by" : "y", lp.y).apply();
    }

    /** Slides the bubble to the nearest side of the screen. */
    private void snapToEdge() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int w = root.getWidth();
        final int target = lp.x + w / 2 < dm.widthPixels / 2 ? 0 : dm.widthPixels - w;
        ValueAnimator a = ValueAnimator.ofInt(lp.x, target);
        a.setDuration(180);
        a.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            public void onAnimationUpdate(ValueAnimator an) {
                if (!attached) return;
                lp.x = (Integer) an.getAnimatedValue();
                wm.updateViewLayout(root, lp);
            }
        });
        a.addListener(new android.animation.AnimatorListenerAdapter() {
            public void onAnimationEnd(android.animation.Animator an) {
                savePos(true);
            }
        });
        a.start();
    }

    // ------------------------------------------------------------------ clock & focus timer

    private void tickClock() {
        clock.setText(DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
        if (timerRunning) {
            timerLeft = Math.max(0, timerEnd - System.currentTimeMillis());
            if (timerLeft == 0) timerFinished();
            renderTimer();
        }
        handler.postDelayed(new Runnable() {
            public void run() {
                tickClock();
            }
        }, timerRunning ? 1000 : 15000);
    }

    private void toggleTimer() {
        if (timerRunning) {
            timerLeft = Math.max(0, timerEnd - System.currentTimeMillis());
            timerRunning = false;
        } else {
            timerEnd = System.currentTimeMillis() + timerLeft;
            timerRunning = true;
            handler.removeCallbacksAndMessages(null);
            tickClock();
        }
        render();
    }

    private void timerFinished() {
        timerRunning = false;
        String msg = onBreak ? "Break over. Ready for the next focus session?" : "Focus session done. Take a 5-minute break.";
        onBreak = !onBreak;
        timerLeft = onBreak ? BREAK_MS : FOCUS_MS;
        try {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(new long[]{0, 300, 150, 300}, -1));
            else v.vibrate(new long[]{0, 300, 150, 300}, -1);
        } catch (Exception ignored) {
        }
        try {
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(9,
                    Reminders.builder(this, Reminders.CH_FOCUS).setSmallIcon(R.drawable.ic_tile)
                            .setContentTitle("Focus timer").setContentText(msg).setAutoCancel(true).build());
        } catch (Exception ignored) {
        }
        if (onBreak) {
            timerEnd = System.currentTimeMillis() + timerLeft;
            timerRunning = true; // the break starts by itself
        }
        render();
    }

    private static String mmss(long ms) {
        long s = (ms + 999) / 1000;
        return String.format(java.util.Locale.US, "%02d:%02d", s / 60, s % 60);
    }

    private void renderTimer() {
        timerText.setText((onBreak ? "Break  " : "Focus  ") + mmss(timerLeft));
        timerText.setTextColor(onBreak ? Ui.DONE : Ui.ACCENT);
        timerPlay.setText(timerRunning ? "⏸" : "▶");
        if ("min".equals(mode)) bubble.setText(bubbleText());
    }

    // ------------------------------------------------------------------ tasks

    private long currentAddList() {
        return listFilter != 0 ? listFilter : model.defaultListId();
    }

    private void addTask() {
        String v = input.getText().toString().trim();
        if (v.length() == 0) return;
        model.add(v, currentAddList());
        input.setText("");
        model.changed();
    }

    private void openEditor(long taskId) {
        setKeyboard(false);
        Intent i = new Intent(this, TaskEditActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (taskId != 0) i.putExtra("id", taskId);
        else i.putExtra("list", currentAddList());
        startActivity(i);
    }

    private String bubbleText() {
        if (timerRunning || timerLeft != FOCUS_MS) return "⏱ " + mmss(timerLeft);
        int open = 0, late = 0;
        for (Model.Task t : model.tasks) {
            if (listFilter != 0 && t.listId != listFilter) continue;
            if (!t.done) open++;
            if (Model.overdue(t)) late++;
        }
        return (late > 0 ? "⚠ " : "✓ ") + open + " left";
    }

    private void render() {
        if (root == null) return;
        float scale = prefs.getInt("textPct", 100) / 100f;
        boolean big = "max".equals(mode);

        title.setText(listFilter == 0 ? "All tasks" : model.listName(listFilter));
        keepBtn.setTextColor(keepOn ? Ui.DONE : Ui.MUTED);
        timerBtn.setTextColor(timerOpen || timerRunning ? Ui.ACCENT : Ui.MUTED);
        maxBtn.setText(big ? "❐" : "□");
        timerRow.setVisibility(timerOpen ? View.VISIBLE : View.GONE);
        renderTimer();
        sortBtn.setText("mine".equals(sort) ? "↕ My order" : "priority".equals(sort) ? "↕ Priority" : "↕ Time");
        showDoneBtn.setText(showDone ? "Hide done" : "Show done");

        // list chips
        lists.removeAllViews();
        addListChip("All", 0);
        for (Model.TList l : model.lists) addListChip(l.name, l.id);
        TextView plus = Ui.chip(this, "+ List");
        plus.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                setKeyboard(false);
                startActivity(new Intent(OverlayService.this, MainActivity.class)
                        .putExtra("section", "lists").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        });
        lists.addView(plus, Ui.wrap());

        // counts
        int total = 0, done = 0;
        for (Model.Task t : model.tasks) {
            if (listFilter != 0 && t.listId != listFilter) continue;
            total++;
            if (t.done) done++;
        }
        progress.setMax(Math.max(1, total));
        progress.setProgress(done);
        leftText.setText((total - done) + " left · " + model.doneToday() + " done today");
        bubble.setText(bubbleText());

        // rows
        list.removeAllViews();
        final List<Model.Task> shown = model.visible(listFilter, showDone, sort);
        for (int i = 0; i < shown.size(); i++) list.addView(makeRow(shown, i, scale, big));
        if (shown.isEmpty()) {
            TextView empty = Ui.text(this, total > 0 ? "All done here ✓" : "No tasks yet. Type one above, or tap 🎤 to say it.", 14, Ui.MUTED);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(8), dp(24), dp(8), dp(24));
            list.addView(empty, Ui.fill());
        }
        updateNotification();
    }

    private void addListChip(String name, final long id) {
        TextView chip = Ui.chip(this, name);
        Ui.select(this, chip, listFilter == id, Ui.FG);
        chip.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                listFilter = id;
                prefs.edit().putLong("listFilter", id).apply();
                render();
            }
        });
        lists.addView(chip, Ui.margins(Ui.wrap(), this, 0, 0, 6, 0));
    }

    private View makeRow(final List<Model.Task> shown, final int index, float scale, boolean big) {
        final Model.Task t = shown.get(index);
        final LinearLayout row = Ui.row(this);
        row.setPadding(0, dp(3), 0, dp(3));

        // priority stripe
        View stripe = new View(this);
        stripe.setBackground(Ui.round(this, Model.PRIORITY_COLORS[t.priority], 2));
        row.addView(stripe, Ui.margins(new LinearLayout.LayoutParams(dp(4), dp(30)), this, 0, 0, 2, 0));

        // drag handle (only in "My order")
        if ("mine".equals(sort)) {
            TextView handle = Ui.text(this, "⋮⋮", 14, Ui.FAINT);
            handle.setGravity(Gravity.CENTER);
            handle.setTextColor(0xFF4A535E);
            row.addView(handle, new LinearLayout.LayoutParams(dp(20), dp(40)));
            handle.setOnTouchListener(new View.OnTouchListener() {
                float downY;
                int rowH;

                public boolean onTouch(View v, MotionEvent e) {
                    switch (e.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            downY = e.getRawY();
                            rowH = Math.max(1, row.getHeight());
                            row.getParent().requestDisallowInterceptTouchEvent(true);
                            row.setElevation(dp(6));
                            row.setBackground(Ui.round(OverlayService.this, Ui.BAR, 8));
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            row.setTranslationY(e.getRawY() - downY);
                            return true;
                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL:
                            int steps = Math.round((e.getRawY() - downY) / rowH);
                            int to = Math.max(0, Math.min(shown.size() - 1, index + steps));
                            row.setTranslationY(0);
                            row.setElevation(0);
                            if (to != index) {
                                model.move(shown, index, to);
                                model.changed();
                            } else {
                                render();
                            }
                            return true;
                    }
                    return false;
                }
            });
        }

        final CheckBox cb = new CheckBox(this);
        cb.setChecked(t.done);
        cb.setButtonTintList(ColorStateList.valueOf(t.done ? Ui.DONE : Ui.MUTED));
        cb.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                model.setDone(t, cb.isChecked());
                model.changed();
            }
        });
        row.addView(cb);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(2), dp(4), dp(4), dp(4));
        TextView label = Ui.text(this, t.text, (big ? 18 : 15) * scale, t.done ? Ui.MUTED : Ui.FG);
        label.setMaxLines(big ? 4 : 2);
        label.setEllipsize(TextUtils.TruncateAt.END);
        if (t.done) label.setPaintFlags(label.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
        col.addView(label);
        String meta = model.meta(this, t, listFilter == 0);
        if (meta.length() > 0) {
            TextView m = Ui.text(this, meta, (big ? 13 : 11.5f) * scale, Model.overdue(t) ? Ui.DANGER : Ui.MUTED);
            m.setSingleLine(!big);
            m.setEllipsize(TextUtils.TruncateAt.END);
            col.addView(m);
        }
        col.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                openEditor(t.id);
            }
        });
        row.addView(col, Ui.weight());

        TextView del = Ui.text(this, "✕", 14, Ui.MUTED);
        del.setGravity(Gravity.CENTER);
        del.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                model.delete(t);
                model.changed();
            }
        });
        row.addView(del, new LinearLayout.LayoutParams(dp(32), dp(36)));
        return row;
    }
}
