package com.alshalfa.tasks;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.CheckBox;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/** Add or edit one task: text, list, priority, due time, repeat, notes and subtasks. */
public class TaskEditActivity extends Activity {

    private Model model;
    private Model.Task task;      // null while adding a new task
    private EditText text, notes, subInput;
    private long listId;
    private int priority;
    private long due;
    private String repeat = "none";
    private final List<Model.Sub> subs = new ArrayList<Model.Sub>();

    private LinearLayout listRow, prioRow, repeatRow, subList;
    private TextView dueText, clearDue;

    private int dp(float v) {
        return Ui.dp(this, v);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        model = Model.get(this);
        long id = getIntent().getLongExtra("id", 0);
        task = id != 0 ? model.find(id) : null;
        if (id != 0 && task == null) {
            Toast.makeText(this, "That task was deleted.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        if (task != null) {
            listId = task.listId;
            priority = task.priority;
            due = task.due;
            repeat = task.repeat;
            for (Model.Sub s : task.subs) {
                Model.Sub c = new Model.Sub();
                c.text = s.text;
                c.done = s.done;
                subs.add(c);
            }
        } else {
            listId = getIntent().getLongExtra("list", model.defaultListId());
        }
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        buildUi();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.BLACK);
        scroll.setFitsSystemWindows(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), dp(20), dp(20), dp(40));
        scroll.addView(col);

        // header
        LinearLayout head = Ui.row(this);
        head.addView(Ui.bold(this, task == null ? "New task" : "Edit task", 22, Ui.FG), Ui.weight());
        TextView close = Ui.text(this, "✕", 20, Ui.MUTED);
        close.setPadding(dp(12), dp(4), dp(4), dp(4));
        close.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                finish();
            }
        });
        head.addView(close);
        col.addView(head, Ui.fill());

        text = field(task != null ? task.text : "", "What do you need to do?", false);
        if (task == null) text.requestFocus();
        col.addView(text, Ui.margins(Ui.fill(), this, 0, 16, 0, 0));

        // list
        col.addView(label("List"));
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        listRow = Ui.row(this);
        hs.addView(listRow);
        col.addView(hs, Ui.fill());

        // priority
        col.addView(label("Priority"));
        prioRow = Ui.row(this);
        col.addView(prioRow, Ui.fill());

        // due
        col.addView(label("Reminder"));
        LinearLayout dueRow = Ui.row(this);
        dueText = Ui.text(this, "", 16, Ui.FG);
        dueText.setPadding(dp(14), dp(12), dp(14), dp(12));
        dueText.setBackground(Ui.outline(this, Ui.BG, Ui.FAINT, 12));
        dueText.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                pickDate();
            }
        });
        dueRow.addView(dueText, Ui.weight());
        clearDue = Ui.text(this, "Clear", 14, Ui.MUTED);
        clearDue.setPadding(dp(14), dp(12), dp(4), dp(12));
        clearDue.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                due = 0;
                refresh();
            }
        });
        dueRow.addView(clearDue);
        col.addView(dueRow, Ui.fill());
        LinearLayout quick = Ui.row(this);
        quick.addView(quickDue("In 1 hour", 1), Ui.margins(Ui.wrap(), this, 0, 8, 6, 0));
        quick.addView(quickDue("Tonight 8 PM", 2), Ui.margins(Ui.wrap(), this, 0, 8, 6, 0));
        quick.addView(quickDue("Tomorrow 9 AM", 3), Ui.margins(Ui.wrap(), this, 0, 8, 0, 0));
        HorizontalScrollView qs = new HorizontalScrollView(this);
        qs.setHorizontalScrollBarEnabled(false);
        qs.addView(quick);
        col.addView(qs, Ui.fill());

        // repeat
        col.addView(label("Repeat"));
        HorizontalScrollView rs = new HorizontalScrollView(this);
        rs.setHorizontalScrollBarEnabled(false);
        repeatRow = Ui.row(this);
        rs.addView(repeatRow);
        col.addView(rs, Ui.fill());

        // subtasks
        col.addView(label("Steps"));
        subList = new LinearLayout(this);
        subList.setOrientation(LinearLayout.VERTICAL);
        col.addView(subList, Ui.fill());
        LinearLayout subAdd = Ui.row(this);
        subInput = field("", "Add a step", false);
        subAdd.addView(subInput, Ui.weight());
        TextView addSub = Ui.button(this, "Add", Ui.FAINT, Ui.FG);
        addSub.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                String s = subInput.getText().toString().trim();
                if (s.length() == 0) return;
                Model.Sub sub = new Model.Sub();
                sub.text = s;
                subs.add(sub);
                subInput.setText("");
                refresh();
            }
        });
        subAdd.addView(addSub, Ui.margins(Ui.wrap(), this, 8, 0, 0, 0));
        col.addView(subAdd, Ui.margins(Ui.fill(), this, 0, 6, 0, 0));

        // notes
        col.addView(label("Notes"));
        notes = field(task != null ? task.notes : "", "Details, phone number, address…", true);
        col.addView(notes, Ui.fill());

        // actions
        TextView save = Ui.button(this, task == null ? "Add task" : "Save", Ui.ACCENT, 0xFF001A2B);
        save.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                save();
            }
        });
        col.addView(save, Ui.margins(Ui.fill(), this, 0, 28, 0, 0));
        if (task != null) {
            TextView del = Ui.button(this, "Delete task", Ui.BG, Ui.DANGER);
            del.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    new AlertDialog.Builder(TaskEditActivity.this)
                            .setMessage("Delete \"" + task.text + "\"?")
                            .setPositiveButton("Delete", new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface d, int w) {
                                    model.delete(task);
                                    model.changed();
                                    finish();
                                }
                            })
                            .setNegativeButton("Cancel", null)
                            .show();
                }
            });
            col.addView(del, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
        }

        setContentView(scroll);
        refresh();
    }

    private EditText field(String value, String hint, boolean multi) {
        EditText e = new EditText(this);
        e.setText(value);
        e.setHint(hint);
        e.setHintTextColor(Ui.MUTED);
        e.setTextColor(Ui.FG);
        e.setTextSize(16);
        e.setPadding(dp(14), dp(12), dp(14), dp(12));
        e.setBackground(Ui.outline(this, Ui.BG, Ui.FAINT, 12));
        if (multi) {
            e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            e.setMinLines(3);
            e.setGravity(Gravity.TOP);
        } else {
            e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            e.setSingleLine(true);
        }
        return e;
    }

    private TextView label(String s) {
        TextView t = Ui.bold(this, s.toUpperCase(), 12, Ui.MUTED);
        t.setLetterSpacing(0.08f);
        t.setPadding(0, dp(22), 0, dp(8));
        return t;
    }

    private TextView quickDue(String s, final int kind) {
        TextView c = Ui.chip(this, s);
        c.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Calendar cal = Calendar.getInstance();
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                if (kind == 1) {
                    cal.add(Calendar.HOUR_OF_DAY, 1);
                } else if (kind == 2) {
                    cal.set(Calendar.HOUR_OF_DAY, 20);
                    cal.set(Calendar.MINUTE, 0);
                    if (cal.getTimeInMillis() < System.currentTimeMillis()) cal.add(Calendar.DAY_OF_MONTH, 1);
                } else {
                    cal.add(Calendar.DAY_OF_MONTH, 1);
                    cal.set(Calendar.HOUR_OF_DAY, 9);
                    cal.set(Calendar.MINUTE, 0);
                }
                due = cal.getTimeInMillis();
                refresh();
            }
        });
        return c;
    }

    private void pickDate() {
        final Calendar cal = Calendar.getInstance();
        if (due > 0) cal.setTimeInMillis(due);
        else {
            cal.add(Calendar.HOUR_OF_DAY, 1);
            cal.set(Calendar.MINUTE, 0);
        }
        new DatePickerDialog(this, new DatePickerDialog.OnDateSetListener() {
            public void onDateSet(DatePicker v, int y, int m, int d) {
                cal.set(y, m, d);
                new TimePickerDialog(TaskEditActivity.this, new TimePickerDialog.OnTimeSetListener() {
                    public void onTimeSet(TimePicker tp, int h, int min) {
                        cal.set(Calendar.HOUR_OF_DAY, h);
                        cal.set(Calendar.MINUTE, min);
                        cal.set(Calendar.SECOND, 0);
                        cal.set(Calendar.MILLISECOND, 0);
                        due = cal.getTimeInMillis();
                        refresh();
                    }
                }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE),
                        android.text.format.DateFormat.is24HourFormat(TaskEditActivity.this)).show();
            }
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void refresh() {
        listRow.removeAllViews();
        for (final Model.TList l : model.lists) {
            TextView c = Ui.chip(this, l.name);
            Ui.select(this, c, l.id == listId, Ui.FG);
            c.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    listId = l.id;
                    refresh();
                }
            });
            listRow.addView(c, Ui.margins(Ui.wrap(), this, 0, 0, 6, 0));
        }

        prioRow.removeAllViews();
        for (int i = 0; i < 4; i++) {
            final int p = i;
            TextView c = Ui.chip(this, Model.PRIORITY_LABELS[i]);
            Ui.select(this, c, priority == i, i == 0 ? Ui.FG : Model.PRIORITY_COLORS[i]);
            c.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    priority = p;
                    refresh();
                }
            });
            prioRow.addView(c, Ui.margins(Ui.wrap(), this, 0, 0, 6, 0));
        }

        dueText.setText(due > 0 ? "⏰  " + Model.dueLabel(this, due) : "No reminder. Tap to pick a date and time.");
        dueText.setTextColor(due > 0 ? Ui.FG : Ui.MUTED);
        clearDue.setVisibility(due > 0 ? View.VISIBLE : View.GONE);

        repeatRow.removeAllViews();
        for (int i = 0; i < Model.REPEATS.length; i++) {
            final String r = Model.REPEATS[i];
            TextView c = Ui.chip(this, i == 0 ? "Never" : Model.repeatShort(r));
            Ui.select(this, c, r.equals(repeat), Ui.FG);
            c.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    repeat = r;
                    if (!"none".equals(r) && due == 0) {
                        Calendar cal = Calendar.getInstance();
                        cal.add(Calendar.DAY_OF_MONTH, 1);
                        cal.set(Calendar.HOUR_OF_DAY, 9);
                        cal.set(Calendar.MINUTE, 0);
                        cal.set(Calendar.SECOND, 0);
                        cal.set(Calendar.MILLISECOND, 0);
                        due = cal.getTimeInMillis();
                    }
                    refresh();
                }
            });
            repeatRow.addView(c, Ui.margins(Ui.wrap(), this, 0, 0, 6, 0));
        }

        subList.removeAllViews();
        for (final Model.Sub s : subs) {
            LinearLayout r = Ui.row(this);
            final CheckBox cb = new CheckBox(this);
            cb.setChecked(s.done);
            cb.setButtonTintList(android.content.res.ColorStateList.valueOf(s.done ? Ui.DONE : Ui.MUTED));
            cb.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    s.done = cb.isChecked();
                    refresh();
                }
            });
            r.addView(cb);
            TextView t = Ui.text(this, s.text, 15, s.done ? Ui.MUTED : Ui.FG);
            if (s.done) t.setPaintFlags(t.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
            r.addView(t, Ui.weight());
            TextView x = Ui.text(this, "✕", 14, Ui.MUTED);
            x.setPadding(dp(12), dp(8), dp(4), dp(8));
            x.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    subs.remove(s);
                    refresh();
                }
            });
            r.addView(x);
            subList.addView(r, Ui.fill());
        }
    }

    private void save() {
        String v = text.getText().toString().trim();
        if (v.length() == 0) {
            text.setError("Type the task first");
            return;
        }
        Model.Task t = task != null ? task : model.add(v, listId);
        t.text = v;
        t.listId = listId;
        t.priority = priority;
        t.due = due;
        t.repeat = repeat;
        t.notes = notes.getText().toString().trim();
        t.subs.clear();
        t.subs.addAll(subs);
        model.changed();
        Toast.makeText(this, task == null ? "Task added" : "Saved", Toast.LENGTH_SHORT).show();
        finish();
    }
}
