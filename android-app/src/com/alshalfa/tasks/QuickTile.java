package com.alshalfa.tasks;

import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Quick Settings tile: shows or hides the floating window from the pull-down panel. */
public class QuickTile extends TileService {

    public static void refresh(Context c) {
        try {
            TileService.requestListeningState(c, new ComponentName(c, QuickTile.class));
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onStartListening() {
        Tile t = getQsTile();
        if (t == null) return;
        boolean on = OverlayService.isWindowShown();
        t.setState(on ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        t.setLabel("Floating tasks");
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle(on ? "Showing" : "Hidden");
        t.updateTile();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onClick() {
        if (OverlayService.toggleFromTile()) {
            onStartListening();
            return;
        }
        // Not running yet: open the app, which starts the window and closes itself.
        Intent i = new Intent(this, MainActivity.class).putExtra("show", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 30, i,
                    Reminders.IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        } else {
            startActivityAndCollapse(i);
        }
    }
}
