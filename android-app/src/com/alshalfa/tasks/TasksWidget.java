package com.alshalfa.tasks;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Home Screen widget: open tasks, tap one to tick it off, + to add. */
public class TasksWidget extends AppWidgetProvider {

    public static final String ACTION_TOGGLE = "com.alshalfa.tasks.WIDGET_TOGGLE";
    private static final int MUTABLE = 0x02000000; // PendingIntent.FLAG_MUTABLE

    @Override
    public void onUpdate(Context c, AppWidgetManager awm, int[] ids) {
        update(c, awm, ids);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (ACTION_TOGGLE.equals(intent.getAction())) {
            Model m = Model.get(c);
            Model.Task t = m.find(intent.getLongExtra("id", 0));
            if (t != null) {
                m.setDone(t, !t.done);
                m.changed();
            }
            return;
        }
        super.onReceive(c, intent);
    }

    @SuppressWarnings("deprecation")
    public static void update(Context c, AppWidgetManager awm, int[] ids) {
        Model m = Model.get(c);
        int open = 0, late = 0;
        for (Model.Task t : m.tasks) {
            if (!t.done) open++;
            if (Model.overdue(t)) late++;
        }
        for (int id : ids) {
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget);
            rv.setTextViewText(R.id.w_count, late > 0 ? open + " left · " + late + " late" : open + " left");

            Intent svc = new Intent(c, WidgetService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
            rv.setRemoteAdapter(R.id.w_list, svc);
            rv.setEmptyView(R.id.w_list, R.id.w_empty);

            PendingIntent toggle = PendingIntent.getBroadcast(c, 0,
                    new Intent(c, TasksWidget.class).setAction(ACTION_TOGGLE),
                    MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            rv.setPendingIntentTemplate(R.id.w_list, toggle);

            PendingIntent add = PendingIntent.getActivity(c, 20,
                    new Intent(c, TaskEditActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK),
                    Reminders.IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            rv.setOnClickPendingIntent(R.id.w_add, add);

            PendingIntent show = PendingIntent.getActivity(c, 21,
                    new Intent(c, MainActivity.class).putExtra("show", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    Reminders.IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            rv.setOnClickPendingIntent(R.id.w_title, show);

            awm.updateAppWidget(id, rv);
        }
        awm.notifyAppWidgetViewDataChanged(ids, R.id.w_list);
    }
}
