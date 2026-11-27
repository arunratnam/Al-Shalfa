package com.alshalfa.tasks;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Start screen: asks for the "display over other apps" permission and starts the floating window. */
public class MainActivity extends Activity {

    private TextView status;
    private TextView permBtn;
    private TextView startBtn;
    private TextView stopBtn;

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.BLACK);
        scroll.setFitsSystemWindows(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(24), dp(48), dp(24), dp(32));
        scroll.addView(col);

        TextView title = new TextView(this);
        title.setText("Always On Tasks");
        title.setTextColor(0xFFE8EBEF);
        title.setTextSize(28);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        col.addView(title);

        TextView sub = new TextView(this);
        sub.setText("A floating checklist that stays on top of every app. "
                + "Drag it anywhere, minimise it to a small bubble, or maximise it to full screen. "
                + "The ☀ button keeps your screen on while it is showing.");
        sub.setTextColor(0xFF9AA3AD);
        sub.setTextSize(15);
        sub.setLineSpacing(0, 1.25f);
        sub.setPadding(0, dp(10), 0, dp(24));
        col.addView(sub);

        status = new TextView(this);
        status.setTextSize(14);
        status.setPadding(dp(14), dp(12), dp(14), dp(12));
        col.addView(status);

        permBtn = button("1. Allow \"Display over other apps\"", 0xFF6CC4FF, 0xFF001A2B);
        permBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivity(i);
            }
        });
        col.addView(permBtn);

        startBtn = button("Show floating tasks", 0xFF5FD39A, 0xFF062014);
        startBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startOverlay();
                moveTaskToBack(true);
            }
        });
        col.addView(startBtn);

        stopBtn = button("Stop floating tasks", 0xFF1A2027, 0xFFE8EBEF);
        stopBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Intent i = new Intent(MainActivity.this, OverlayService.class);
                i.setAction(OverlayService.ACTION_STOP);
                startService(i);
                refresh();
            }
        });
        col.addView(stopBtn);

        TextView tips = new TextView(this);
        tips.setText("How to use\n\n"
                + "• Drag the top bar to move the window.\n"
                + "• —  minimises to a small bubble. Tap the bubble to open it again. Drag the bubble to move it.\n"
                + "• □  maximises to full screen. Tap again to go back.\n"
                + "• ☀  keeps the screen on (green = on).\n"
                + "• ✕  hides the window. Open this app again to bring it back.\n\n"
                + "If the window disappears after a while, open Settings → Apps → Always On Tasks → Battery "
                + "and choose \"Unrestricted\" so your phone doesn't close it.");
        tips.setTextColor(0xFF9AA3AD);
        tips.setTextSize(14);
        tips.setLineSpacing(0, 1.3f);
        tips.setPadding(0, dp(28), 0, 0);
        col.addView(tips);

        setContentView(scroll);

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        }
    }

    private TextView button(String text, int bg, int fg) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(fg);
        t.setTextSize(16);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(16), dp(16), dp(16), dp(16));
        GradientDrawable g = new GradientDrawable();
        g.setColor(bg);
        g.setCornerRadius(dp(14));
        t.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(12);
        t.setLayoutParams(lp);
        return t;
    }

    private void startOverlay() {
        Intent i = new Intent(this, OverlayService.class);
        i.setAction(OverlayService.ACTION_SHOW);
        startService(i);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void refresh() {
        boolean allowed = Settings.canDrawOverlays(this);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(12));
        if (allowed) {
            status.setText("✓ Permission granted. Tap \"Show floating tasks\".");
            status.setTextColor(0xFF5FD39A);
            g.setColor(0xFF0E2219);
        } else {
            status.setText("Step 1: allow this app to display over other apps.");
            status.setTextColor(0xFFFFC46B);
            g.setColor(0xFF2A2112);
        }
        status.setBackground(g);
        permBtn.setVisibility(allowed ? View.GONE : View.VISIBLE);
        startBtn.setEnabled(allowed);
        startBtn.setAlpha(allowed ? 1f : 0.35f);
    }
}
