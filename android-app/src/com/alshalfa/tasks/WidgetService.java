package com.alshalfa.tasks;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.ArrayList;
import java.util.List;

/** Supplies the rows of the Home Screen widget. */
public class WidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Row {
        long id;
        String text, meta;
        int prioColor;
        boolean late;
    }

    static class Factory implements RemoteViewsFactory {
        private final Context c;
        private final List<Row> rows = new ArrayList<Row>();

        Factory(Context c) {
            this.c = c;
        }

        public void onCreate() {
        }

        public void onDataSetChanged() {
            Model m = Model.get(c);
            List<Row> fresh = new ArrayList<Row>();
            try {
                for (Model.Task t : m.visible(0, false, "time")) {
                    Row r = new Row();
                    r.id = t.id;
                    r.text = t.text;
                    r.meta = m.meta(c, t, true);
                    r.prioColor = Model.PRIORITY_COLORS[t.priority];
                    r.late = Model.overdue(t);
                    fresh.add(r);
                }
            } catch (Exception ignored) {
                // the list changed while reading; the next refresh catches up
            }
            rows.clear();
            rows.addAll(fresh);
        }

        public void onDestroy() {
            rows.clear();
        }

        public int getCount() {
            return rows.size();
        }

        public RemoteViews getViewAt(int pos) {
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_item);
            if (pos >= rows.size()) return rv;
            Row r = rows.get(pos);
            rv.setTextViewText(R.id.w_text, r.text);
            rv.setTextViewText(R.id.w_meta, r.meta);
            rv.setViewVisibility(R.id.w_meta, r.meta.length() > 0 ? View.VISIBLE : View.GONE);
            rv.setTextColor(R.id.w_meta, r.late ? Ui.DANGER : Ui.MUTED);
            rv.setInt(R.id.w_prio, "setBackgroundColor", r.prioColor);
            rv.setOnClickFillInIntent(R.id.w_row, new Intent().putExtra("id", r.id));
            return rv;
        }

        public RemoteViews getLoadingView() {
            return null;
        }

        public int getViewTypeCount() {
            return 1;
        }

        public long getItemId(int pos) {
            return pos < rows.size() ? rows.get(pos).id : pos;
        }

        public boolean hasStableIds() {
            return true;
        }
    }
}
