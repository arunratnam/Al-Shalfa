package com.alshalfa.tasks;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Shared colours and small view helpers. */
public final class Ui {
    public static final int BG = 0xFF12161B, BAR = 0xFF1A2027, FAINT = 0xFF2A3038, FG = 0xFFE8EBEF,
            MUTED = 0xFF8A939E, ACCENT = 0xFF6CC4FF, DONE = 0xFF5FD39A, DANGER = 0xFFFF7A7A,
            WARN = 0xFFFFC46B, BLACK = 0xFF000000;

    private Ui() {
    }

    public static int dp(Context c, float v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }

    public static GradientDrawable round(Context c, int color, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(c, radiusDp));
        return g;
    }

    public static GradientDrawable outline(Context c, int fill, int stroke, float radiusDp) {
        GradientDrawable g = round(c, fill, radiusDp);
        g.setStroke(dp(c, 1), stroke);
        return g;
    }

    public static TextView text(Context c, String s, float sp, int color) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    public static TextView bold(Context c, String s, float sp, int color) {
        TextView t = text(c, s, sp, color);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    /** A filled rounded button. */
    public static TextView button(Context c, String s, int bg, int fg) {
        TextView t = bold(c, s, 15, fg);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(c, 14), dp(c, 12), dp(c, 14), dp(c, 12));
        t.setBackground(round(c, bg, 12));
        return t;
    }

    /** A small pill used for choices; call select() to show it as chosen. */
    public static TextView chip(Context c, String s) {
        TextView t = text(c, s, 13, MUTED);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(c, 12), dp(c, 6), dp(c, 12), dp(c, 6));
        select(c, t, false, FG);
        return t;
    }

    public static void select(Context c, TextView chip, boolean on, int color) {
        if (on) {
            chip.setBackground(round(c, color, 20));
            chip.setTextColor(BLACK);
        } else {
            chip.setBackground(outline(c, 0x00000000, FAINT, 20));
            chip.setTextColor(MUTED);
        }
    }

    public static LinearLayout row(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    public static LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    public static LinearLayout.LayoutParams fill() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    public static LinearLayout.LayoutParams weight() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
    }

    public static LinearLayout.LayoutParams margins(LinearLayout.LayoutParams lp, Context c, int l, int t, int r, int b) {
        lp.setMargins(dp(c, l), dp(c, t), dp(c, r), dp(c, b));
        return lp;
    }
}
