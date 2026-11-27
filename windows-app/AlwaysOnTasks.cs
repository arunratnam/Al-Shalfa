// Always On Tasks for Windows: a floating checklist that stays on top of every window.
// Build (Linux, Mono):  ./build.sh      Build (Windows):  csc /target:winexe /win32icon:app.ico AlwaysOnTasks.cs
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Always On Tasks")]
[assembly: System.Reflection.AssemblyProduct("Always On Tasks")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace AlwaysOnTasks
{
    static class Theme
    {
        public static readonly Color Bg = Color.FromArgb(18, 22, 27);
        public static readonly Color Bar = Color.FromArgb(26, 32, 39);
        public static readonly Color Faint = Color.FromArgb(42, 48, 56);
        public static readonly Color Fg = Color.FromArgb(232, 235, 239);
        public static readonly Color Muted = Color.FromArgb(124, 133, 144);
        public static readonly Color Accent = Color.FromArgb(108, 196, 255);
        public static readonly Color Done = Color.FromArgb(95, 211, 154);
        public static readonly Color Danger = Color.FromArgb(255, 122, 122);
    }

    class TaskItem
    {
        public string Text;
        public bool Done;
    }

    /// <summary>Saves tasks and window settings in %APPDATA%\AlwaysOnTasks.</summary>
    static class Store
    {
        static readonly string Dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AlwaysOnTasks");
        static readonly string TasksFile = Path.Combine(Dir, "tasks.txt");
        static readonly string SettingsFile = Path.Combine(Dir, "settings.txt");
        public static List<TaskItem> Tasks = new List<TaskItem>();
        static Dictionary<string, string> settings = new Dictionary<string, string>();

        public static void Load()
        {
            try
            {
                if (File.Exists(TasksFile))
                {
                    foreach (string line in File.ReadAllLines(TasksFile, Encoding.UTF8))
                    {
                        if (line.Length < 2) continue;
                        Tasks.Add(new TaskItem { Done = line[0] == '1', Text = line.Substring(2) });
                    }
                }
                else
                {
                    Tasks.Add(new TaskItem { Text = "Example: Morning walk", Done = true });
                    Tasks.Add(new TaskItem { Text = "Example: Reply to emails" });
                    Tasks.Add(new TaskItem { Text = "Example: Buy groceries" });
                }
                if (File.Exists(SettingsFile))
                {
                    foreach (string line in File.ReadAllLines(SettingsFile, Encoding.UTF8))
                    {
                        int i = line.IndexOf('=');
                        if (i > 0) settings[line.Substring(0, i)] = line.Substring(i + 1);
                    }
                }
            }
            catch { }
        }

        public static void SaveTasks()
        {
            try
            {
                Directory.CreateDirectory(Dir);
                var lines = new List<string>();
                foreach (var t in Tasks)
                    lines.Add((t.Done ? "1" : "0") + "\t" + t.Text.Replace("\r", " ").Replace("\n", " "));
                File.WriteAllLines(TasksFile, lines.ToArray(), Encoding.UTF8);
            }
            catch { }
        }

        public static string Get(string k, string def)
        {
            string v;
            return settings.TryGetValue(k, out v) ? v : def;
        }

        public static int GetInt(string k, int def)
        {
            int v;
            return int.TryParse(Get(k, ""), out v) ? v : def;
        }

        public static void Set(string k, object v)
        {
            settings[k] = Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture);
            try
            {
                Directory.CreateDirectory(Dir);
                var lines = new List<string>();
                foreach (var kv in settings) lines.Add(kv.Key + "=" + kv.Value);
                File.WriteAllLines(SettingsFile, lines.ToArray(), Encoding.UTF8);
            }
            catch { }
        }
    }

    static class Native
    {
        [DllImport("kernel32.dll")]
        public static extern uint SetThreadExecutionState(uint flags);
        public const uint ES_CONTINUOUS = 0x80000000, ES_SYSTEM_REQUIRED = 0x1, ES_DISPLAY_REQUIRED = 0x2;

        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        public static void KeepAwake(bool on)
        {
            try
            {
                SetThreadExecutionState(on
                    ? ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
                    : ES_CONTINUOUS);
            }
            catch { }
        }
    }

    /// <summary>Flat clickable label used for the small buttons.</summary>
    class FlatButton : Label
    {
        public Color HoverBack = Theme.Faint;
        Color normalBack;

        public FlatButton(string text, float size)
        {
            Text = text;
            TextAlign = ContentAlignment.MiddleCenter;
            ForeColor = Theme.Muted;
            Font = new Font("Segoe UI Symbol", size);
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            normalBack = BackColor;
            BackColor = HoverBack;
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            BackColor = normalBack;
            base.OnMouseLeave(e);
        }
    }

    /// <summary>The small round bubble shown when the window is minimised.</summary>
    class Bubble : Form
    {
        readonly MainForm owner;
        Point downAt, startLoc;
        bool dragging, moved;
        public string Caption = "✓ 0/0";

        public Bubble(MainForm owner)
        {
            this.owner = owner;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Theme.Bar;
            Size = new Size(owner.S(104), owner.S(44));
            DoubleBuffered = true;
            Cursor = Cursors.Hand;
            Region = Rounded(ClientRectangle, Height / 2);
        }

        static Region Rounded(Rectangle r, int radius)
        {
            var p = new GraphicsPath();
            int d = radius * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return new Region(p);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using (var pen = new Pen(Theme.Done, owner.S(2)))
                e.Graphics.DrawArc(pen, owner.S(1), owner.S(1), Height - owner.S(3), Height - owner.S(3), 90, 180);
            using (var pen = new Pen(Theme.Done, owner.S(2)))
            {
                int h = Height - owner.S(3);
                e.Graphics.DrawArc(pen, Width - h - owner.S(2), owner.S(1), h, h, 270, 180);
                e.Graphics.DrawLine(pen, Height / 2, owner.S(1), Width - Height / 2, owner.S(1));
                e.Graphics.DrawLine(pen, Height / 2, Height - owner.S(2), Width - Height / 2, Height - owner.S(2));
            }
            TextRenderer.DrawText(e.Graphics, Caption, new Font("Segoe UI Symbol", 11f, FontStyle.Bold),
                ClientRectangle, Theme.Fg, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            dragging = true;
            moved = false;
            downAt = Cursor.Position;
            startLoc = Location;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (!dragging) return;
            Point p = Cursor.Position;
            int dx = p.X - downAt.X, dy = p.Y - downAt.Y;
            if (Math.Abs(dx) > 4 || Math.Abs(dy) > 4) moved = true;
            if (moved) Location = new Point(startLoc.X + dx, startLoc.Y + dy);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            if (!dragging) return;
            dragging = false;
            if (moved)
            {
                Store.Set("bubbleX", Left);
                Store.Set("bubbleY", Top);
            }
            else owner.Restore();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= 0x80; // WS_EX_TOOLWINDOW: keep it out of Alt+Tab
                return cp;
            }
        }
    }

    class MainForm : Form
    {
        readonly float scale;
        Panel bar, body, list, progressFill, progressTrack;
        Label countLbl, leftLbl;
        FlatButton keepBtn, maxBtn;
        TextBox input;
        readonly FlatButton[] chips = new FlatButton[3];
        readonly string[] chipKeys = { "all", "active", "done" };
        NotifyIcon tray;
        Bubble bubble;
        string filter;
        bool keepOn, maximised;
        Rectangle normalBounds;
        Point dragStart, formStart;
        bool dragging;

        public int S(float v) { return (int)Math.Round(v * scale); }

        public MainForm()
        {
            using (var g = CreateGraphics()) scale = g.DpiX / 96f;
            Text = "Always On Tasks";
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = true;
            BackColor = Theme.Faint; // shows as a 1px border around the body
            Padding = new Padding(1);
            MinimumSize = new Size(S(260), S(260));
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            KeyPreview = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            filter = Store.Get("filter", "all");
            keepOn = Store.Get("keepOn", "1") == "1";
            int opacity = Store.GetInt("opacity", 100);
            Opacity = Math.Max(40, Math.Min(100, opacity)) / 100.0;

            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int w = Store.GetInt("w", S(340)), h = Store.GetInt("h", S(480));
            int x = Store.GetInt("x", wa.Right - w - S(24)), y = Store.GetInt("y", wa.Top + S(80));
            Bounds = FitOnScreen(new Rectangle(x, y, w, h));

            BuildUi();
            BuildTray();
            bubble = new Bubble(this);

            Native.KeepAwake(keepOn);
            Render();
        }

        static Rectangle FitOnScreen(Rectangle r)
        {
            Rectangle wa = Screen.FromRectangle(r).WorkingArea;
            int w = Math.Min(r.Width, wa.Width), h = Math.Min(r.Height, wa.Height);
            int x = Math.Max(wa.Left, Math.Min(r.X, wa.Right - w));
            int y = Math.Max(wa.Top, Math.Min(r.Y, wa.Bottom - h));
            return new Rectangle(x, y, w, h);
        }

        // ------------------------------------------------------------ layout

        void BuildUi()
        {
            var root = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Bg };
            Controls.Add(root);

            // title bar
            bar = new Panel { Dock = DockStyle.Top, Height = S(44), BackColor = Theme.Bar, Cursor = Cursors.SizeAll };
            var title = new Label
            {
                Text = "⠿  Tasks", ForeColor = Theme.Fg, AutoSize = false, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI Semibold", 11f),
                Padding = new Padding(S(10), 0, 0, 0), Cursor = Cursors.SizeAll
            };
            countLbl = new Label
            {
                ForeColor = Theme.Muted, AutoSize = false, Width = S(52), Dock = DockStyle.Right,
                TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 9f)
            };
            keepBtn = BarButton("☀", "Keep the screen on");
            keepBtn.Click += delegate { ToggleKeepOn(); };
            var minBtn = BarButton("—", "Minimise to a bubble");
            minBtn.Click += delegate { ShowBubble(); };
            maxBtn = BarButton("□", "Maximise");
            maxBtn.Click += delegate { ToggleMax(); };
            var closeBtn = BarButton("✕", "Hide to the system tray");
            closeBtn.HoverBack = Color.FromArgb(120, 40, 40);
            closeBtn.Click += delegate { HideToTray(); };

            // Dock order: last added docks first, so add right-side buttons in reverse.
            bar.Controls.Add(title);
            bar.Controls.Add(countLbl);
            bar.Controls.Add(keepBtn);
            bar.Controls.Add(minBtn);
            bar.Controls.Add(maxBtn);
            bar.Controls.Add(closeBtn);
            countLbl.SendToBack(); keepBtn.SendToBack(); minBtn.SendToBack(); maxBtn.SendToBack(); closeBtn.SendToBack();
            title.BringToFront();

            foreach (Control c in new Control[] { bar, title })
            {
                c.MouseDown += BarMouseDown;
                c.MouseMove += BarMouseMove;
                c.MouseUp += BarMouseUp;
                c.DoubleClick += delegate { ToggleMax(); };
                c.MouseClick += BarRightClick;
            }

            // progress
            progressTrack = new Panel { Dock = DockStyle.Top, Height = S(3), BackColor = Theme.Faint };
            progressFill = new Panel { Dock = DockStyle.Left, Width = 0, BackColor = Theme.Done };
            progressTrack.Controls.Add(progressFill);

            // body
            body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(S(12), S(10), S(12), S(6)) };

            var addRow = new Panel { Dock = DockStyle.Top, Height = S(36) };
            input = new TextBox
            {
                BorderStyle = BorderStyle.FixedSingle, BackColor = Color.Black, ForeColor = Theme.Fg,
                Font = new Font("Segoe UI", 11f), Dock = DockStyle.Fill
            };
            SetCue(input, "Add a task…");
            input.KeyDown += delegate (object s, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; AddTask(); }
            };
            var addBtn = new FlatButton("Add", 10f)
            {
                Dock = DockStyle.Right, Width = S(64), BackColor = Theme.Accent,
                ForeColor = Color.FromArgb(0, 26, 43), Font = new Font("Segoe UI Semibold", 10f)
            };
            addBtn.HoverBack = Color.FromArgb(140, 210, 255);
            addBtn.Click += delegate { AddTask(); };
            var gap = new Panel { Dock = DockStyle.Right, Width = S(8) };
            addRow.Controls.Add(input);
            addRow.Controls.Add(gap);
            addRow.Controls.Add(addBtn);

            var chipRow = new FlowLayoutPanel
            {
                Dock = DockStyle.Top, Height = S(40), Padding = new Padding(0, S(8), 0, 0), WrapContents = false
            };
            string[] names = { "All", "To do", "Done" };
            for (int i = 0; i < 3; i++)
            {
                string key = chipKeys[i];
                var chip = new FlatButton(names[i], 9f)
                {
                    Font = new Font("Segoe UI", 9f), Size = new Size(S(64), S(26)), Margin = new Padding(0, 0, S(6), 0)
                };
                chip.Click += delegate { filter = key; Store.Set("filter", filter); Render(); };
                chips[i] = chip;
                chipRow.Controls.Add(chip);
            }

            list = new Panel { Dock = DockStyle.Fill, AutoScroll = true };

            var foot = new Panel { Dock = DockStyle.Bottom, Height = S(30) };
            leftLbl = new Label
            {
                Dock = DockStyle.Fill, ForeColor = Theme.Muted, TextAlign = ContentAlignment.MiddleLeft,
                Font = new Font("Segoe UI", 9f)
            };
            var clear = new FlatButton("Clear done", 9f)
            {
                Dock = DockStyle.Right, Width = S(84), Font = new Font("Segoe UI", 9f)
            };
            clear.Click += delegate
            {
                Store.Tasks.RemoveAll(t => t.Done);
                Store.SaveTasks();
                Render();
            };
            foot.Controls.Add(leftLbl);
            foot.Controls.Add(clear);

            body.Controls.Add(list);
            body.Controls.Add(foot);
            body.Controls.Add(chipRow);
            body.Controls.Add(addRow);

            root.Controls.Add(body);
            root.Controls.Add(progressTrack);
            root.Controls.Add(bar);
        }

        FlatButton BarButton(string glyph, string tip)
        {
            var b = new FlatButton(glyph, 11f) { Dock = DockStyle.Right, Width = S(38) };
            new ToolTip().SetToolTip(b, tip);
            return b;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, string l);

        static void SetCue(TextBox box, string text)
        {
            box.HandleCreated += delegate
            {
                try { SendMessage(box.Handle, 0x1501 /* EM_SETCUEBANNER */, (IntPtr)1, text); } catch { }
            };
        }

        void BuildTray()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("Show tasks", null, delegate { Restore(); });
            var top = new ToolStripMenuItem("Always on top") { Checked = true, CheckOnClick = true };
            top.CheckedChanged += delegate { TopMost = top.Checked; bubble.TopMost = top.Checked; };
            menu.Items.Add(top);
            var see = new ToolStripMenuItem("See-through");
            foreach (int pct in new[] { 100, 90, 80, 70, 60 })
            {
                int p = pct;
                see.DropDownItems.Add(p + "%", null, delegate { Opacity = p / 100.0; Store.Set("opacity", p); });
            }
            menu.Items.Add(see);
            var startup = new ToolStripMenuItem("Start with Windows") { CheckOnClick = true, Checked = IsStartup() };
            startup.CheckedChanged += delegate { SetStartup(startup.Checked); };
            menu.Items.Add(startup);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, delegate { ExitApp(); });

            tray = new NotifyIcon
            {
                Text = "Always On Tasks", Icon = Icon ?? SystemIcons.Application, Visible = true, ContextMenuStrip = menu
            };
            tray.MouseClick += delegate (object s, MouseEventArgs e)
            {
                if (e.Button == MouseButtons.Left) Restore();
            };
            barMenu = menu;
        }

        ContextMenuStrip barMenu;

        void BarRightClick(object s, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Right) barMenu.Show(Cursor.Position);
        }

        // ------------------------------------------------------------ start with Windows

        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

        static bool IsStartup()
        {
            try
            {
                using (var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RunKey))
                    return k != null && k.GetValue("AlwaysOnTasks") != null;
            }
            catch { return false; }
        }

        static void SetStartup(bool on)
        {
            try
            {
                using (var k = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(RunKey))
                {
                    if (on) k.SetValue("AlwaysOnTasks", "\"" + Application.ExecutablePath + "\"");
                    else k.DeleteValue("AlwaysOnTasks", false);
                }
            }
            catch { }
        }

        // ------------------------------------------------------------ window behaviour

        void BarMouseDown(object s, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left || maximised) return;
            dragging = true;
            dragStart = Cursor.Position;
            formStart = Location;
        }

        void BarMouseMove(object s, MouseEventArgs e)
        {
            if (!dragging) return;
            Point p = Cursor.Position;
            Location = new Point(formStart.X + p.X - dragStart.X, formStart.Y + p.Y - dragStart.Y);
        }

        void BarMouseUp(object s, MouseEventArgs e)
        {
            if (!dragging) return;
            dragging = false;
            Bounds = FitOnScreen(Bounds);
            SaveBounds();
        }

        void SaveBounds()
        {
            if (maximised) return;
            Store.Set("x", Left);
            Store.Set("y", Top);
            Store.Set("w", Width);
            Store.Set("h", Height);
        }

        protected override void OnResizeEnd(EventArgs e)
        {
            base.OnResizeEnd(e);
            SaveBounds();
        }

        void ToggleMax()
        {
            if (maximised)
            {
                maximised = false;
                Bounds = normalBounds;
            }
            else
            {
                normalBounds = Bounds;
                maximised = true;
                Bounds = Screen.FromControl(this).WorkingArea;
            }
            maxBtn.Text = maximised ? "❐" : "□";
            Render();
        }

        void ShowBubble()
        {
            Rectangle wa = Screen.FromControl(this).WorkingArea;
            int bx = Store.GetInt("bubbleX", Right - bubble.Width);
            int by = Store.GetInt("bubbleY", Top);
            Rectangle r = FitOnScreen(new Rectangle(bx, by, bubble.Width, bubble.Height));
            bubble.Location = r.Location;
            bubble.Caption = BubbleText();
            bubble.Show();
            bubble.Invalidate();
            Hide();
        }

        public void Restore()
        {
            bubble.Hide();
            Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
        }

        void HideToTray()
        {
            Hide();
            bubble.Hide();
            tray.ShowBalloonTip(2000, "Always On Tasks", "Still running here. Click the icon to show your tasks.", ToolTipIcon.None);
        }

        void ToggleKeepOn()
        {
            keepOn = !keepOn;
            Store.Set("keepOn", keepOn ? "1" : "0");
            Native.KeepAwake(keepOn);
            Render();
        }

        void ExitApp()
        {
            Native.KeepAwake(false);
            tray.Visible = false;
            Application.Exit();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                HideToTray();
                return;
            }
            tray.Visible = false;
            base.OnFormClosing(e);
        }

        // Resize from any edge of the borderless window.
        protected override void WndProc(ref Message m)
        {
            const int WM_NCHITTEST = 0x84;
            base.WndProc(ref m);
            if (m.Msg == WM_NCHITTEST && !maximised && (int)m.Result == 1)
            {
                Point p = PointToClient(new Point((int)m.LParam & 0xFFFF, ((int)m.LParam >> 16) & 0xFFFF));
                int g = S(6);
                bool l = p.X < g, r = p.X >= Width - g, t = p.Y < g, b = p.Y >= Height - g;
                if (t && l) m.Result = (IntPtr)13;
                else if (t && r) m.Result = (IntPtr)14;
                else if (b && l) m.Result = (IntPtr)16;
                else if (b && r) m.Result = (IntPtr)17;
                else if (l) m.Result = (IntPtr)10;
                else if (r) m.Result = (IntPtr)11;
                else if (t) m.Result = (IntPtr)12;
                else if (b) m.Result = (IntPtr)15;
            }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.Style |= 0x00020000; // WS_MINIMIZEBOX so the taskbar button can minimise it
                return cp;
            }
        }

        // ------------------------------------------------------------ tasks

        void AddTask()
        {
            string v = input.Text.Trim();
            if (v.Length == 0) return;
            Store.Tasks.Add(new TaskItem { Text = v });
            Store.SaveTasks();
            input.Text = "";
            if (filter == "done") { filter = "all"; Store.Set("filter", filter); }
            Render();
        }

        string BubbleText()
        {
            int done = Store.Tasks.FindAll(t => t.Done).Count;
            return "✓ " + done + "/" + Store.Tasks.Count;
        }

        void Render()
        {
            int total = Store.Tasks.Count, done = Store.Tasks.FindAll(t => t.Done).Count;
            countLbl.Text = done + "/" + total;
            leftLbl.Text = (total - done) + " left";
            progressFill.Width = total == 0 ? 0 : (int)(progressTrack.Width * (done / (double)total));
            keepBtn.ForeColor = keepOn ? Theme.Done : Theme.Muted;
            tray.Text = "Always On Tasks – " + (total - done) + " left";
            bubble.Caption = BubbleText();
            bubble.Invalidate();

            for (int i = 0; i < 3; i++)
            {
                bool sel = chipKeys[i] == filter;
                chips[i].BackColor = sel ? Theme.Fg : Theme.Faint;
                chips[i].ForeColor = sel ? Color.Black : Theme.Muted;
            }

            float textSize = maximised ? 13f : 10.5f;
            list.SuspendLayout();
            list.Controls.Clear();
            var rows = new List<Control>();
            foreach (var task in Store.Tasks)
            {
                if (filter == "active" && task.Done) continue;
                if (filter == "done" && !task.Done) continue;
                rows.Add(MakeRow(task, textSize));
            }
            if (rows.Count == 0)
            {
                rows.Add(new Label
                {
                    Text = "No tasks here. Add one above.", ForeColor = Theme.Muted, Dock = DockStyle.Top,
                    Height = S(60), TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 10f)
                });
            }
            // Docked Top: add in reverse so the first task ends up at the top.
            for (int i = rows.Count - 1; i >= 0; i--) list.Controls.Add(rows[i]);
            list.ResumeLayout();
        }

        Control MakeRow(TaskItem task, float textSize)
        {
            var row = new Panel { Dock = DockStyle.Top, Height = S(maximised ? 42 : 34) };
            var cb = new CheckBox
            {
                Checked = task.Done, Dock = DockStyle.Left, Width = S(26), Cursor = Cursors.Hand,
                FlatStyle = FlatStyle.Flat
            };
            cb.FlatAppearance.BorderColor = task.Done ? Theme.Done : Theme.Muted;
            cb.FlatAppearance.CheckedBackColor = Theme.Done;
            cb.CheckedChanged += delegate { task.Done = cb.Checked; Store.SaveTasks(); BeginInvoke((Action)Render); };

            var text = new Label
            {
                Text = task.Text, Dock = DockStyle.Fill, AutoEllipsis = true, TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = task.Done ? Theme.Muted : Theme.Fg, Cursor = Cursors.Hand,
                Font = new Font("Segoe UI", textSize, task.Done ? FontStyle.Strikeout : FontStyle.Regular)
            };
            new ToolTip().SetToolTip(text, task.Text);
            text.Click += delegate { task.Done = !task.Done; Store.SaveTasks(); Render(); };

            var del = new FlatButton("✕", 9f) { Dock = DockStyle.Right, Width = S(30) };
            del.MouseEnter += delegate { del.ForeColor = Theme.Danger; };
            del.MouseLeave += delegate { del.ForeColor = Theme.Muted; };
            del.Click += delegate { Store.Tasks.Remove(task); Store.SaveTasks(); BeginInvoke((Action)Render); };

            row.Controls.Add(text);
            row.Controls.Add(del);
            row.Controls.Add(cb);
            return row;
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            if (progressTrack != null)
            {
                int total = Store.Tasks.Count, done = Store.Tasks.FindAll(t => t.Done).Count;
                progressFill.Width = total == 0 ? 0 : (int)(progressTrack.Width * (done / (double)total));
            }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            bool created;
            using (var mutex = new System.Threading.Mutex(true, "AlwaysOnTasks.SingleInstance", out created))
            {
                if (!created) return; // already running
                try { Native.SetProcessDPIAware(); } catch { }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Store.Load();
                Application.Run(new MainForm());
            }
        }
    }
}
