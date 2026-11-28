/*
 * Arabic for EZ Staff. The screens are written in English; when Arabic is chosen, this file translates the text on
 * screen as it is drawn (right-to-left layout). Data people type (names, notes) and the PDF forms stay as they are.
 * To add a translation, add "English text": "Arabic text" to AR below.
 */
(function () {
  "use strict";

  var AR = {
    // ---- navigation and common ----
    "EZ Staff": "EZ Staff", "Home": "الرئيسية", "My time": "وقتي", "Profile": "الملف الشخصي", "Dashboard": "لوحة التحكم",
    "Time": "الوقت", "Fuel": "الوقود", "Payroll": "الرواتب", "Me": "أنا", "People": "الموظفون", "Add bill": "إضافة فاتورة",
    "Bills": "الفواتير", "Claims": "المطالبات", "Monthly": "شهري", "Back": "رجوع", "Cancel": "إلغاء", "Save": "حفظ",
    "Close": "إغلاق", "Delete": "حذف", "Edit": "تعديل", "Change": "تغيير", "Remove": "إزالة", "Yes": "نعم", "No": "لا",
    "Search": "بحث", "Details": "التفاصيل", "See all": "عرض الكل", "All": "الكل", "Clear": "مسح", "Start": "ابدأ",
    "Status": "الحالة", "Date": "التاريخ", "Note": "ملاحظة", "Note (optional)": "ملاحظة (اختياري)", "Total": "المجموع",
    "Today": "اليوم", "This month": "هذا الشهر", "This year": "هذه السنة", "Month": "الشهر", "Day": "اليوم", "Days": "الأيام",
    "Hours": "الساعات", "Minutes": "الدقائق", "Saved": "تم الحفظ", "Saving…": "جارٍ الحفظ…", "Choose": "اختر", "Choose…": "اختر…",
    "Nothing here": "لا يوجد شيء هنا", "None yet": "لا يوجد بعد", "No data yet": "لا توجد بيانات بعد", "(optional)": "(اختياري)",
    "(you)": "(أنت)", "Office": "المكتب", "Staff": "الموظفون", "Everyone": "الجميع", "Settings saved": "تم حفظ الإعدادات",
    "Go home": "الرئيسية", "Open dashboard": "فتح لوحة التحكم", "Reports": "التقارير", "History": "السجل", "Form": "النموذج",
    "Appearance": "المظهر", "Light": "فاتح", "Dark": "داكن", "Auto": "تلقائي", "Language": "اللغة", "Sign out": "تسجيل الخروج",
    "Upload now": "رفع الآن", "Uploaded": "تم الرفع", "Uploading": "جارٍ الرفع", "Version": "الإصدار", "Trend": "الاتجاه",
    "Average": "المتوسط", "Rate": "المعدل", "Source": "المصدر", "Server": "الخادم", "Check": "تحقق", "Add": "إضافة",

    // ---- sign in / account ----
    "Sign in": "تسجيل الدخول", "Create account": "إنشاء حساب", "Full name": "الاسم الكامل", "Employee ID": "الرقم الوظيفي",
    "Department": "القسم", "Vehicle number": "رقم المركبة", "Vehicle number (optional)": "رقم المركبة (اختياري)",
    "Work email": "البريد الإلكتروني للعمل", "Password": "كلمة المرور", "Forgot password?": "نسيت كلمة المرور؟",
    "New accounts start as Driver. An administrator can give office roles.": "الحسابات الجديدة تبدأ كسائق/موظف. يمكن للمسؤول منح صلاحيات المكتب.",
    "Please enter your full name and employee ID.": "يرجى إدخال الاسم الكامل والرقم الوظيفي.",
    "Type your email first, then tap Forgot password.": "اكتب بريدك الإلكتروني أولاً، ثم اضغط نسيت كلمة المرور.",
    "Password reset email sent to": "تم إرسال رسالة إعادة تعيين كلمة المرور إلى",
    "Waiting for approval": "بانتظار الموافقة", "Waiting to be allowed": "بانتظار السماح", "waiting to be allowed": "بانتظار السماح",
    "Your account (": "حسابك (", "Your account is turned off": "حسابك موقوف", "Ask the admin to turn it back on.": "اطلب من المسؤول إعادة تشغيله.",
    ") was created. The admin needs to allow it before you can add fuel bills. This page opens by itself once you are allowed.":
      ") تم إنشاؤه. يجب أن يسمح به المسؤول قبل أن تتمكن من استخدام التطبيق. ستفتح هذه الصفحة تلقائياً عند السماح.",
    "Profile saved": "تم حفظ الملف الشخصي", "Save profile": "حفظ الملف الشخصي", "Save changes": "حفظ التغييرات",
    "These details go on every claim form.": "هذه البيانات تظهر في كل نموذج مطالبة.", "Your signature": "توقيعك",
    "Driver": "سائق", "Driver / Staff": "سائق / موظف", "Supervisor": "مشرف", "Manager": "مدير", "Admin": "مسؤول",
    "Driver / Staff:": "سائق / موظف:", "Supervisor:": "مشرف:", "Manager:": "مدير:", "Admin:": "مسؤول:", "Roles": "الأدوار",
    "Operations": "العمليات", "Logistics": "اللوجستيات", "Warehouse": "المستودع", "Delivery": "التوصيل", "Sales": "المبيعات",
    "Administration": "الإدارة", "No employee ID": "بدون رقم وظيفي", "no ID": "بدون رقم", "No vehicle": "بدون مركبة", "no vehicle": "بدون مركبة",
    "Hello,": "مرحباً،", "Install on your phone": "التثبيت على هاتفك", "Add to Home Screen": "إضافة إلى الشاشة الرئيسية",
    "Add to Home screen": "إضافة إلى الشاشة الرئيسية",

    // ---- warehouses ----
    "Ardiya": "العارضية", "Shuaiba": "الشعيبة", "Mina Abdulla": "ميناء عبدالله", "Open Yard": "الساحة المفتوحة",
    "Warehouses": "المستودعات", "Warehouse (in)": "المستودع (دخول)", "Warehouse (out)": "المستودع (خروج)",

    // ---- attendance ----
    "Attendance": "الحضور", "Attendance ·": "الحضور ·", "Clock in": "تسجيل الحضور", "Clock out": "تسجيل الانصراف",
    "Clocked in": "حاضر", "Clocked out": "تم الانصراف", "Clocked in at": "تم تسجيل الحضور في", "Clocked out · worked": "تم الانصراف · عملت",
    "Not clocked in": "لم يتم تسجيل الحضور", "Not clocked in today": "لم يسجل الحضور اليوم", "Off": "خارج الدوام",
    "Tap where you are working to clock in:": "اضغط على مكان عملك لتسجيل الحضور:", "Switch warehouse": "تغيير المستودع",
    "My time and overtime →": "وقتي والعمل الإضافي ←", "Today": "اليوم", "Normal day": "اليوم العادي", "Overtime": "العمل الإضافي",
    "At": "في", "since": "منذ", "Getting your location…": "جارٍ تحديد موقعك…", "Getting location…": "جارٍ تحديد الموقع…",
    "Checking your location…": "جارٍ التحقق من موقعك…", "Where are you now?": "أين أنت الآن؟", "Choose where you are now.": "اختر مكانك الآن.",
    "No location: choose where you are now.": "لا يوجد موقع: اختر مكانك الآن.", "Same place": "نفس المكان", "Finishing here": "أنهي العمل هنا",
    "Same warehouse": "نفس المستودع", "Move here": "انتقل إلى هنا", "Now at": "الآن في", "Leaving": "مغادرة",
    "Your location shows you at": "موقعك يظهر أنك في", ". Where are you now?": ". أين أنت الآن؟",
    "All your hours count for overtime, wherever you finish.": "كل ساعاتك تُحتسب للعمل الإضافي، أينما أنهيت عملك.",
    "Clock in on the Home screen when you start work.": "سجّل حضورك من الشاشة الرئيسية عند بدء العمل.",
    "Location is blocked for EZ Staff: allow it in the phone's Settings → Apps → EZ Staff → Permissions → Location":
      "الموقع محظور لتطبيق EZ Staff: اسمح به من إعدادات الهاتف ← التطبيقات ← EZ Staff ← الأذونات ← الموقع",
    "Location is off: turn on Location in the phone's quick settings": "الموقع مغلق: شغّل الموقع من الإعدادات السريعة للهاتف",
    "Location wasn't found in time: turn on Location (and Wi-Fi) and try outside or near a door":
      "لم يتم العثور على الموقع في الوقت المحدد: شغّل الموقع (والواي فاي) وحاول في الخارج أو قرب الباب",
    "Couldn't get the location. Allow location for this app and try again.": "تعذر الحصول على الموقع. اسمح بالموقع لهذا التطبيق وحاول مرة أخرى.",
    "Your location is shared with the office until you clock out.": "موقعك يُشارك مع المكتب حتى تسجل الانصراف.",
    "Live location works in the EZ Staff Android app. On this phone only your clock in and out places are saved.":
      "الموقع المباشر يعمل في تطبيق EZ Staff للأندرويد. على هذا الهاتف يتم حفظ أماكن الحضور والانصراف فقط.",
    "Location is blocked, so the office can't see where you are. Allow it in Settings → Apps → EZ Staff → Permissions → Location.":
      "الموقع محظور، لذلك لا يستطيع المكتب رؤية مكانك. اسمح به من الإعدادات ← التطبيقات ← EZ Staff ← الأذونات ← الموقع.",
    "Live location couldn't start (": "تعذر بدء الموقع المباشر (",
    "Days worked": "أيام العمل", "Hours worked": "ساعات العمل", "Overtime approved": "العمل الإضافي المعتمد",
    "Overtime waiting": "العمل الإضافي بانتظار الموافقة", "Overtime approved:": "العمل الإضافي المعتمد:", "Overtime rejected": "تم رفض العمل الإضافي",
    "Worked": "عمل", "worked this month": "ساعات العمل هذا الشهر", "In": "دخول", "Out": "خروج", "In location": "موقع الدخول",
    "Out location": "موقع الخروج", "No location": "لا يوجد موقع", "no location": "لا يوجد موقع", "Location saved": "تم حفظ الموقع",
    "At site (": "في الموقع (", "Sent late (no signal?)": "أُرسل متأخراً (لا توجد شبكة؟)", "Time saved": "تم حفظ الوقت",
    "No time recorded this month": "لا يوجد وقت مسجل هذا الشهر", "No overtime this month": "لا يوجد عمل إضافي هذا الشهر",
    "Shift": "الوردية", "Shifts": "الورديات", "Morning": "صباحي", "Morning shift": "الوردية الصباحية", "Day shift": "الوردية النهارية",
    "Shift changed": "تم تغيير الوردية", "New shift": "وردية جديدة", "+ Add shift": "+ إضافة وردية",
    "Started at": "بدأ في", "Finished at": "انتهى في", "Leave empty if still working.": "اتركه فارغاً إذا كان لا يزال يعمل.",
    "· normal day": "· اليوم العادي", "· overtime after": "· عمل إضافي بعد", "At work now": "في العمل الآن",
    "Time tracking needs the online app": "تتبع الوقت يحتاج إلى التطبيق المتصل",
    ": all hours today count as overtime.": ": كل ساعات اليوم تُحتسب عملاً إضافياً.",
    "Friday": "الجمعة", "Saturday": "السبت", "Sunday": "الأحد", "Monday": "الاثنين", "Tuesday": "الثلاثاء",
    "Wednesday": "الأربعاء", "Thursday": "الخميس", "Public holiday": "عطلة رسمية", "Friday / rest day": "الجمعة / يوم الراحة",

    // ---- overtime (office) ----
    "Who's in": "من في العمل", "Live map": "الخريطة المباشرة", "Overtime to approve": "عمل إضافي للموافقة", "Time entries": "سجلات الوقت",
    "+ Add entry": "+ إضافة سجل", "Live attendance from all warehouses ·": "الحضور المباشر من جميع المستودعات ·",
    "Nobody clocked in": "لا أحد سجل الحضور", "Everyone has clocked in today": "الجميع سجلوا الحضور اليوم", "people": "أشخاص",
    "Approve": "موافقة", "Reject": "رفض", "Approve overtime": "الموافقة على العمل الإضافي", "Reject overtime": "رفض العمل الإضافي",
    "Change overtime": "تعديل العمل الإضافي", "OT approved": "تمت الموافقة على العمل الإضافي", "OT rejected": "تم رفض العمل الإضافي",
    "OT waiting": "عمل إضافي بانتظار الموافقة", "OT asked": "العمل الإضافي المطلوب", "No overtime waiting": "لا يوجد عمل إضافي بانتظار الموافقة",
    "Overtime appears here when staff clock out after their shift.": "يظهر العمل الإضافي هنا عندما ينصرف الموظفون بعد ورديتهم.",
    "Recently decided": "قرارات حديثة", "Reason": "السبب", "Please write the reason.": "يرجى كتابة السبب.",
    "Please write a short reason.": "يرجى كتابة سبب مختصر.", "Hours changed after the decision; please check again.": "تغيرت الساعات بعد القرار؛ يرجى التحقق مجدداً.",
    "Add time": "إضافة وقت", "Add time entry": "إضافة سجل وقت", "Edit time entry": "تعديل سجل الوقت", "Entry deleted": "تم حذف السجل",
    "Enter the date and the clock-in time.": "أدخل التاريخ ووقت الحضور.", "That is more than 20 hours. Check the times.": "هذا أكثر من 20 ساعة. تحقق من الأوقات.",
    "There is nobody else to add time for yet.": "لا يوجد أحد آخر لإضافة وقت له بعد.", "No time entries": "لا توجد سجلات وقت",
    "Added by": "أضافه", "Edited by": "عدّله", "Hours per person and warehouse": "الساعات لكل شخص ومستودع",
    "Off duty": "خارج الدوام", "On duty ·": "في الدوام ·", "On duty · no location yet": "في الدوام · لا يوجد موقع بعد", "No signal · last": "لا توجد شبكة · آخر",
    "People on the map": "الأشخاص على الخريطة", "Route": "المسار", "Showing route": "عرض المسار", "No route for this day": "لا يوجد مسار لهذا اليوم",
    "just now": "الآن", "min ago": "دقيقة مضت", "ago": "مضت", "Start": "البداية", "Last": "آخر",
    "The map couldn't load. Check the connection.": "تعذر تحميل الخريطة. تحقق من الاتصال.",
    "Nobody has live location yet. Tick": "لا أحد لديه موقع مباشر بعد. فعّل", "for drivers on the People page.": "للسائقين في صفحة الموظفين.",
    "Live location is shared from the EZ Staff Android app while people are clocked in, if you ticked":
      "يُشارك الموقع المباشر من تطبيق EZ Staff للأندرويد أثناء تسجيل حضور الموظفين، إذا فعّلت",
    "for them on the People page. Tap a person to see their route for the day.": "لهم في صفحة الموظفين. اضغط على شخص لعرض مساره لليوم.",

    // ---- people / settings ----
    "Allow": "سماح", "Allowed": "مسموح", "Turn off": "إيقاف", "Turn on": "تشغيل", "Turned off": "موقوف", "· turned off": "· موقوف",
    "Account allowed": "تم السماح بالحساب", "Account turned off": "تم إيقاف الحساب", "Account re-activated": "تمت إعادة تفعيل الحساب",
    "Fuel allowance": "بدل الوقود", "Live location on duty": "الموقع المباشر أثناء الدوام", "Fuel allowance on": "تم تفعيل بدل الوقود",
    "Fuel allowance off: attendance only": "تم إيقاف بدل الوقود: الحضور فقط", "Live location off": "تم إيقاف الموقع المباشر",
    "Live location on: shared while on duty (Android app)": "تم تفعيل الموقع المباشر: يُشارك أثناء الدوام (تطبيق الأندرويد)",
    "Role changed to": "تم تغيير الدور إلى", "Company settings": "إعدادات الشركة",
    "Everyone who has created an account. New accounts can't use the app until you allow them. Choose each person's role and shift here. Tick Fuel allowance only for people who claim fuel; everyone else uses attendance only.":
      "كل من أنشأ حساباً. لا يمكن للحسابات الجديدة استخدام التطبيق حتى تسمح بها. اختر دور ووردية كل شخص هنا. فعّل بدل الوقود فقط لمن يطالب بالوقود؛ والباقون يستخدمون الحضور فقط.",
    "adds their own fuel bills and claims.": "يضيف فواتير الوقود والمطالبات الخاصة به.",
    "also sees everyone's bills and claims, and verifies claims.": "يرى أيضاً فواتير ومطالبات الجميع، ويتحقق من المطالبات.",
    "also approves claims and marks them paid.": "يوافق أيضاً على المطالبات ويحددها كمدفوعة.",
    "everything, plus allowing people and choosing roles.": "كل شيء، بالإضافة إلى السماح بالأشخاص واختيار الأدوار.",
    "Nobody can verify or approve their own claim.": "لا يمكن لأحد التحقق من مطالبته أو الموافقة عليها بنفسه.",
    "Warehouses, shifts, overtime rules and public holidays.": "المستودعات والورديات وقواعد العمل الإضافي والعطل الرسمية.",
    "Use my location here": "استخدم موقعي هنا", "allowed distance": "المسافة المسموحة", "Save settings": "حفظ الإعدادات",
    "Public holidays": "العطل الرسمية", "Overtime rules (Kuwait Labour Law)": "قواعد العمل الإضافي (قانون العمل الكويتي)",
    "Weekly rest day": "يوم الراحة الأسبوعي", "Normal hours per day (OT after)": "ساعات العمل العادية يومياً (إضافي بعدها)",
    "Count OT in blocks of (min)": "احتساب الإضافي بوحدات (دقيقة)", "Days per month (wage)": "أيام الشهر (للأجر)",
    "Hours per day (wage)": "ساعات اليوم (للأجر)", "Normal day ×": "اليوم العادي ×", "Rest day ×": "يوم الراحة ×", "Public holiday ×": "العطلة الرسمية ×",
    "Enter the holiday date and name.": "أدخل تاريخ العطلة واسمها.",
    "The shift shows when each person is expected to start. Choose it on the People page.": "الوردية تبين متى يُتوقع أن يبدأ كل شخص. اخترها في صفحة الموظفين.",

    // ---- payroll ----
    "Salaries": "الرواتب", "Basic salary": "الراتب الأساسي", "Salary (KD)": "الراتب (د.ك)", "Monthly salary (KD)": "الراتب الشهري (د.ك)",
    "Set salary": "تحديد الراتب", "Salary saved": "تم حفظ الراتب", "Set the salary first": "حدد الراتب أولاً", "Payslip": "قسيمة الراتب",
    "Payslip PDF": "قسيمة الراتب PDF", "Payroll PDF": "كشف الرواتب PDF", "Share payslip": "مشاركة القسيمة",
    "Share payslip on WhatsApp": "مشاركة القسيمة على واتساب", "Total to pay": "الإجمالي المستحق", "Only the admin can see salaries.": "المسؤول فقط يرى الرواتب.",
    "Salaries and payroll are handled by the admin.": "الرواتب يديرها المسؤول.", "Enter the salary in KD.": "أدخل الراتب بالدينار الكويتي.",
    "Tap a name to see that person's month and payslip.": "اضغط على اسم لعرض شهره وقسيمة راتبه.", "← All staff": "→ كل الموظفين",
    "Hourly (KD)": "أجر الساعة (د.ك)", "OT amount (KD)": "مبلغ الإضافي (د.ك)", "Overtime days": "أيام العمل الإضافي",
    "Admin only": "للمسؤول فقط", "Office only": "للمكتب فقط",

    // ---- fuel bills ----
    "Fuel bill": "فاتورة وقود", "Fuel bills": "فواتير الوقود", "Add fuel bill": "إضافة فاتورة وقود", "Edit fuel bill": "تعديل فاتورة الوقود",
    "Save bill": "حفظ الفاتورة", "Bill saved": "تم حفظ الفاتورة", "Bill deleted": "تم حذف الفاتورة", "Bill photo": "صورة الفاتورة",
    "Take photo": "التقاط صورة", "Fuel station": "محطة الوقود", "Fuel Station": "محطة الوقود", "Fuel date": "تاريخ التعبئة",
    "Odometer": "عداد المسافة", "Odometer (km)": "عداد المسافة (كم)", "Litres": "اللترات", "Amount": "المبلغ", "Amount (KD)": "المبلغ (د.ك)",
    "Distance": "المسافة", "Distance driven": "المسافة المقطوعة", "Mileage": "استهلاك الوقود", "Average mileage": "متوسط الاستهلاك",
    "Fuel this month": "الوقود هذا الشهر", "Km this month": "الكيلومترات هذا الشهر", "Last odometer": "آخر قراءة للعداد",
    "Latest bills": "أحدث الفواتير", "No bills yet": "لا توجد فواتير بعد", "No fuel bills yet": "لا توجد فواتير وقود بعد",
    "No bills this month": "لا توجد فواتير هذا الشهر", "No bills": "لا توجد فواتير", "No new bills": "لا توجد فواتير جديدة",
    "New bills (not claimed yet)": "فواتير جديدة (لم يُطالب بها بعد)", "Not claimed yet": "لم يُطالب بها بعد", "not claimed yet": "لم يُطالب بها بعد",
    "Lay the bill flat in good light.": "ضع الفاتورة بشكل مستوٍ في إضاءة جيدة.", "This is your first bill.": "هذه فاتورتك الأولى.",
    "Odometer is not higher than the previous fill-up.": "قراءة العداد ليست أعلى من التعبئة السابقة.",
    "The date can't be in the future.": "لا يمكن أن يكون التاريخ في المستقبل.",
    "Tap \"Add bill\" after you fill up, and take a photo of the bill.": "اضغط \"إضافة فاتورة\" بعد التعبئة، والتقط صورة للفاتورة.",
    "Add each fuel bill when you fill up.": "أضف كل فاتورة وقود عند التعبئة.", "No photo": "لا توجد صورة",
    "km since the previous bill": "كم منذ الفاتورة السابقة", "since the last bill": "منذ الفاتورة الأخيرة", "Last bill:": "آخر فاتورة:",
    "Fuel allowance is not enabled for your account": "بدل الوقود غير مفعّل لحسابك",

    // ---- claims ----
    "Claim": "المطالبة", "New claim": "مطالبة جديدة", "Create claim": "إنشاء مطالبة", "Create claim & PDF": "إنشاء مطالبة و PDF",
    "My claims": "مطالباتي", "Next claim": "المطالبة التالية", "Next claim · new bills": "المطالبة التالية · فواتير جديدة",
    "Ready to claim": "جاهز للمطالبة", "ready to claim": "جاهز للمطالبة", "Claim created": "تم إنشاء المطالبة", "Claim created ✓": "تم إنشاء المطالبة ✓",
    "Claim deleted": "تم حذف المطالبة", "Claim approved": "تمت الموافقة على المطالبة", "Claim rejected": "تم رفض المطالبة",
    "Claim verified": "تم التحقق من المطالبة", "Claim updated": "تم تحديث المطالبة", "Claim not found": "المطالبة غير موجودة",
    "Submitted": "مُقدّمة", "Verified": "تم التحقق", "Approved": "تمت الموافقة", "Paid": "مدفوعة", "Returned": "مُعادة", "Rejected": "مرفوضة",
    "Waiting": "بالانتظار", "Waiting for payment": "بانتظار الدفع", "Returned to driver": "أُعيدت للسائق", "Return to driver": "إعادة للسائق",
    "Verify": "تحقق", "Verify claim": "التحقق من المطالبة", "Approve claim": "الموافقة على المطالبة", "Reject claim": "رفض المطالبة",
    "Mark as paid": "تحديد كمدفوعة", "Marked as paid": "تم التحديد كمدفوعة", "Download PDF": "تنزيل PDF", "Share PDF": "مشاركة PDF",
    "Share on WhatsApp": "مشاركة على واتساب", "Preparing PDF…": "جارٍ تجهيز PDF…", "Monthly report": "التقرير الشهري",
    "Monthly reports": "التقارير الشهرية", "Fuel claims": "مطالبات الوقود", "Signature": "التوقيع", "Sign here": "وقّع هنا",
    "Sign here with your finger": "وقّع هنا بإصبعك", "Sign again": "التوقيع مجدداً", "Clear signature": "مسح التوقيع", "Save signature": "حفظ التوقيع",
    "Signature saved": "تم حفظ التوقيع", "Please sign first.": "يرجى التوقيع أولاً.", "Remarks": "ملاحظات", "Remarks (optional)": "ملاحظات (اختياري)",
    "Period": "الفترة", "Period from": "من", "Period to": "إلى", "Submission date": "تاريخ التقديم", "Receipts": "الإيصالات",
    "Total litres": "مجموع اللترات", "Total amount": "المبلغ الإجمالي", "KD claimed": "المبلغ المطالب (د.ك)", "KD paid": "المدفوع (د.ك)",
    "Review & sign": "المراجعة والتوقيع", "Submit claim": "تقديم المطالبة", "Submitting…": "جارٍ التقديم…", "Creating…": "جارٍ الإنشاء…",
    "Tick the declaration to confirm.": "ضع علامة على الإقرار للتأكيد.", "Driver declaration": "إقرار السائق",
    "I confirm that all fuel receipts listed above relate to the company vehicle and that the information provided is correct. All original receipts are attached.":
      "أقر بأن جميع إيصالات الوقود المذكورة أعلاه تخص مركبة الشركة وأن المعلومات المقدمة صحيحة. جميع الإيصالات الأصلية مرفقة.",
    "Now send the PDF to the office on WhatsApp.": "الآن أرسل ملف PDF إلى المكتب على واتساب.",
    "Your last claim is done. Start adding bills for the next one.": "تمت مطالبتك الأخيرة. ابدأ بإضافة فواتير للمطالبة التالية.",
    "Delete this claim?": "حذف هذه المطالبة؟", "Keep it": "إبقاؤها", "Its bills go back to the bills list.": "تعود فواتيرها إلى قائمة الفواتير.",
    "Waiting for the admin to check and approve it.": "بانتظار أن يراجعها المسؤول ويوافق عليها.", "Returned for correction.": "أُعيدت للتصحيح.",
    "Office note:": "ملاحظة المكتب:", "Fix and resubmit": "تصحيح وإعادة تقديم", "Claims to verify and approve": "مطالبات للتحقق والموافقة",
    "No claims yet": "لا توجد مطالبات بعد", "No claims": "لا توجد مطالبات", "Recent claims": "المطالبات الأخيرة",
    "Your saved signature is added to the claim.": "يُضاف توقيعك المحفوظ إلى المطالبة.",
    "Vehicle": "المركبة", "Driver name": "اسم السائق", "Mark as not paid": "إلغاء الدفع", "Not paid yet": "لم تُدفع بعد",
    "bills ready. You can create a claim now.": "فواتير جاهزة. يمكنك إنشاء مطالبة الآن.", "more needed": "مطلوبة أكثر",

    // ---- misc messages ----
    "Please fill in the highlighted fields.": "يرجى تعبئة الحقول المحددة.", "Please fill in all four details.": "يرجى تعبئة البيانات الأربعة.",
    "Couldn't save the file.": "تعذر حفظ الملف.", "Download cancelled": "تم إلغاء التنزيل", "Saved to Downloads:": "تم الحفظ في التنزيلات:",
    "Couldn't make the PDF:": "تعذر إنشاء PDF:", "You don't have permission to do that.": "ليست لديك صلاحية للقيام بذلك.",
    "No internet connection. Try again when you're online.": "لا يوجد اتصال بالإنترنت. حاول مجدداً عند الاتصال.",
    "Wrong email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "An account with this email already exists. Sign in instead.": "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول بدلاً من ذلك.",
    "Use a password with at least 6 characters.": "استخدم كلمة مرور من 6 أحرف على الأقل.",
    "That email address doesn't look right.": "عنوان البريد الإلكتروني غير صحيح.", "Something went wrong.": "حدث خطأ ما.",
    "Couldn't save the time. Check that your phone's date and time are set to automatic, then try again.":
      "تعذر حفظ الوقت. تأكد أن تاريخ ووقت الهاتف مضبوطان تلقائياً، ثم حاول مجدداً.",
    "Too many tries. Wait a minute and try again.": "محاولات كثيرة. انتظر دقيقة وحاول مجدداً.",
    "No account with that email. Create one first.": "لا يوجد حساب بهذا البريد. أنشئ حساباً أولاً.",

    // ---- more screens ----
    "Fuel Expense Claims": "مطالبات مصاريف الوقود", "Submit fuel receipts, track approval and get reimbursed.": "قدّم إيصالات الوقود وتابع الموافقة واسترد المبلغ.",
    "Staff app": "تطبيق الموظفين", "Attendance, overtime and fuel claims for EZ Storage staff.": "الحضور والعمل الإضافي ومطالبات الوقود لموظفي EZ Storage.",
    ") was created. The admin needs to allow it before you can use the app. This page opens by itself once you are allowed.":
      ") تم إنشاؤه. يجب أن يسمح به المسؤول قبل أن تتمكن من استخدام التطبيق. ستفتح هذه الصفحة تلقائياً عند السماح.",
    "Admin dashboard": "لوحة تحكم المسؤول", "Supervisor dashboard": "لوحة تحكم المشرف", "Manager dashboard": "لوحة تحكم المدير",
    "Live from everyone using the app": "مباشر من جميع مستخدمي التطبيق", "Drivers": "السائقون", "To verify": "للتحقق",
    "Verified, to approve": "تم التحقق، بانتظار الموافقة", "Approved, to pay": "تمت الموافقة، بانتظار الدفع", "To approve": "للموافقة", "To pay": "للدفع",
    "Bills (Excel)": "الفواتير (Excel)", "Claims (Excel)": "المطالبات (Excel)", "Excel (CSV)": "Excel (CSV)", "Export Excel (CSV)": "تصدير Excel (CSV)",
    "No drivers yet": "لا يوجد سائقون بعد", "Drivers appear here once they create their account in the app.": "يظهر السائقون هنا بعد إنشاء حساباتهم في التطبيق.",
    "All claims": "كل المطالبات", "Nothing waiting for you": "لا يوجد شيء بانتظارك", "New claims from drivers appear here straight away.": "تظهر المطالبات الجديدة من السائقين هنا فوراً.",
    "Live attendance from all warehouses": "الحضور المباشر من جميع المستودعات",
    "Live location is shared from the EZ Staff Android app while people are clocked in, if you ticked": "يُشارك الموقع المباشر من تطبيق EZ Staff للأندرويد أثناء تسجيل حضور الموظفين، إذا فعّلت",
    "claims": "مطالبات", "claim": "مطالبة", "approved only": "المعتمد فقط", "not included yet": "غير مشمول بعد",
    "Salary + approved overtime": "الراتب + العمل الإضافي المعتمد", "in the table.": "في الجدول.", "Salary KD": "الراتب د.ك", "Hourly KD": "أجر الساعة د.ك",
    "OT h": "إضافي س", "Friday h": "الجمعة س", "Holiday h": "العطلة س", "OT KD": "الإضافي د.ك", "Total KD": "المجموع د.ك",
    "Stand at the warehouse and tap": "قف في المستودع واضغط",
    ". If someone clocks in or out further away than the": ". إذا سجّل أحد الحضور أو الانصراف أبعد من",
    ", the supervisor sees a warning (it doesn't block them). Use a bigger distance for large sites.": "، يرى المشرف تحذيراً (لا يمنعه). استخدم مسافة أكبر للمواقع الكبيرة.",
    "Allowed distance (metres)": "المسافة المسموحة (متر)", "Name": "الاسم", "Location": "الموقع", "Not set": "غير محدد",
    "Not set yet. You sign once, on your first claim.": "غير محدد بعد. توقّع مرة واحدة في أول مطالبة.", "Add signature": "إضافة توقيع",
    "iPhone:": "آيفون:", "Android:": "أندرويد:", "open this page in Safari → tap Share →": "افتح هذه الصفحة في Safari ← اضغط مشاركة ←",
    "install the EZ Fuel app, or in Chrome tap ⋮ →": "ثبّت تطبيق EZ Staff، أو في Chrome اضغط ⋮ ←", "System": "تلقائي",
    "now": "الآن", "a day": "يومياً", "overtime after": "عمل إضافي بعد", "Ref.": "مرجع", "Example data": "بيانات تجريبية",
    "Salary": "الراتب", "Hourly": "أجر الساعة", "OT": "إضافي", "Holiday": "عطلة", "Rest day": "يوم الراحة",
    "Person": "الشخص", "Staff member": "الموظف", "All staff": "كل الموظفين", "hours": "ساعات", "days": "أيام",
    "Overtime = hours worked in a day beyond the normal hours, wherever the person worked. On the rest day and public holidays every hour worked is overtime. Hourly wage = salary ÷ days per month ÷ hours per day.":
      "العمل الإضافي = ساعات العمل في اليوم بعد الساعات العادية، أينما عمل الشخص. في يوم الراحة والعطل الرسمية كل ساعة عمل تعتبر إضافية. أجر الساعة = الراتب ÷ أيام الشهر ÷ ساعات اليوم.",
    "without a salary. Tap": "بدون راتب. اضغط", "Open in Google Maps": "فتح في خرائط Google", "Google Maps": "خرائط Google",
    "Google Maps key": "مفتاح خرائط Google", "Want Google Maps? Add your Google Maps key in": "تريد خرائط Google؟ أضف مفتاح خرائط Google في",
    "Google refused the Maps key. Check it in Company settings. Showing the free map.": "رفضت Google مفتاح الخرائط. تحقق منه في إعدادات الشركة. يتم عرض الخريطة المجانية.",
    "Paste the key from Google Cloud (Keys & Credentials). With a key, the Live map uses Google Maps and shows place names. Without one, it uses the free map.":
      "الصق المفتاح من Google Cloud (المفاتيح وبيانات الاعتماد). مع المفتاح تستخدم الخريطة المباشرة خرائط Google وتعرض أسماء الأماكن. بدونه تُستخدم الخريطة المجانية.", "person": "شخص", "people without a salary. Tap": "أشخاص بدون راتب. اضغط"
  };

  // words replaced inside otherwise-translated text (dates, units)
  var WORDS = {
    January: "يناير", February: "فبراير", March: "مارس", April: "أبريل", May: "مايو", June: "يونيو", July: "يوليو",
    August: "أغسطس", September: "سبتمبر", October: "أكتوبر", November: "نوفمبر", December: "ديسمبر",
    Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", Jun: "يونيو", Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر",
    Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
    Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء", Thursday: "الخميس", Friday: "الجمعة", Saturday: "السبت", Sunday: "الأحد",
    Mon: "الاثنين", Tue: "الثلاثاء", Wed: "الأربعاء", Thu: "الخميس", Fri: "الجمعة", Sat: "السبت", Sun: "الأحد",
    km: "كم", KD: "د.ك", now: "الآن", ago: "مضت", min: "د", bills: "فواتير", bill: "فاتورة", points: "نقاط", point: "نقطة",
    about: "حوالي", people: "أشخاص", person: "شخص", claims: "مطالبات", claim: "مطالبة", hours: "ساعات", days: "أيام", day: "يوم"
  };

  var PATTERNS = [
    [/^hourly wage = salary ÷ (\d+) ÷ (\d+)$/, "أجر الساعة = الراتب ÷ $1 ÷ $2"],
    [/^OT ×([\d.]+), Friday ×([\d.]+), holiday ×([\d.]+)$/, "الإضافي ×$1، الجمعة ×$2، العطلة ×$3"],
    [/^(\d+) min ago$/, "قبل $1 دقيقة"],
    [/^(\d+(?:\.\d+)?) km from (.+)$/, "$1 كم من $2"],
    [/^(\d+) m from (.+)$/, "$1 م من $2"],
    [/^At (.+)$/, "في $1"]
  ];
  var KEYS = Object.keys(AR).sort(function (a, b) { return b.length - a.length; });
  var WORD_RE = new RegExp("\\b(" + Object.keys(WORDS).join("|") + ")\\b", "g");
  var lang = "en";
  try { lang = localStorage.getItem("ezstaff-lang") || "en"; } catch (e) {}

  function units(s) {
    return s.replace(/\b(\d+)h (\d+)m\b/g, "$1س $2د").replace(/\b(\d+)h\b/g, "$1س").replace(/\b(\d+)m\b/g, "$1د")
      .replace(WORD_RE, function (w) { return WORDS[w]; });
  }
  /** Text that is data (names, numbers, emails, codes), not an English sentence: kept as it is. */
  function isData(t) {
    return !t.split(/\s+/).some(function (w) { return /^[a-z]{3,}[.,:;!?]*$/.test(w) && w.indexOf("@") < 0; });
  }

  /** Arabic for the text, or null when it can't be fully translated (then the English stays, never half and half). */
  function full(t) {
    t = t.trim();
    if (!t) return t;
    if (AR[t] !== undefined) return AR[t];
    if (!/[A-Za-z]/.test(t)) return t;
    if (t.indexOf(" · ") > 0) {
      var parts = t.split(" · ").map(function (p) { var f = full(p); return f === null ? (isData(p) ? p : null) : f; });
      return parts.indexOf(null) >= 0 ? null : parts.join(" · ");
    }
    for (var j = 0; j < PATTERNS.length; j++) {
      var mm = t.match(PATTERNS[j][0]);
      if (mm) return PATTERNS[j][1].replace(/\$(\d)/g, function (_, n) { var g = mm[n] || "", f = full(g); return f === null ? g : f; });
    }
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (k.length < 2 || t.length <= k.length) continue;
      var rest;
      if (t.indexOf(k) === 0 && /[\s(:,.]/.test(t.charAt(k.length) + k.charAt(k.length - 1))) {
        rest = t.slice(k.length);
        var fr = full(rest);
        if (fr === null && isData(rest)) fr = units(rest.trim());
        if (fr !== null) return AR[k] + (/^[,.:)]/.test(rest) ? "" : " ") + fr;
      }
      if (t.slice(-k.length) === k && /[\s()]/.test(t.charAt(t.length - k.length - 1) + k.charAt(0))) {
        rest = t.slice(0, t.length - k.length);
        var fl = full(rest);
        if (fl === null && isData(rest)) fl = units(rest.trim());
        if (fl !== null) return fl + " " + AR[k];
      }
    }
    var u = units(t);
    return isData(u) ? u : null;
  }

  function tr(text) {
    if (!/[A-Za-z]/.test(text)) return text;
    var out = full(text);
    if (out === null) return text;
    return text.match(/^\s*/)[0] + out + text.match(/\s*$/)[0];
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CANVAS: 1, svg: 1, SVG: 1 };
  function walk(node) {
    if (lang !== "ar" || !node) return;
    if (node.nodeType === 3) {
      if (node.__ar === node.nodeValue) return;
      var v = tr(node.nodeValue);
      if (v !== node.nodeValue) node.nodeValue = v;
      node.__ar = node.nodeValue;
      return;
    }
    if (node.nodeType !== 1 || SKIP[node.nodeName] || node.hasAttribute("data-notr") || (node.classList && node.classList.contains("leaflet-pane"))) return;
    ["placeholder", "aria-label", "title"].forEach(function (a) {
      var v = node.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) node.setAttribute(a, tr(v));
    });
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function apply() {
    var root = document.documentElement;
    root.lang = lang === "ar" ? "ar" : "en";
    root.dir = lang === "ar" ? "rtl" : "ltr";
    if (document.body) walk(document.body);
  }

  var obs = new MutationObserver(function (list) {
    if (lang !== "ar") return;
    list.forEach(function (m) {
      if (m.type === "childList") for (var i = 0; i < m.addedNodes.length; i++) walk(m.addedNodes[i]);
      else if (m.type === "characterData") walk(m.target);
    });
  });
  function startObs() { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); apply(); }
  if (document.body) startObs(); else document.addEventListener("DOMContentLoaded", startObs);

  window.EZ_I18N = {
    get lang() { return lang; },
    /** "en" or "ar"; English needs a redraw (the app re-renders the screen afterwards). */
    set: function (l) {
      l = l === "ar" ? "ar" : "en";
      try { localStorage.setItem("ezstaff-lang", l); } catch (e) {}
      if (l === lang) return false;
      lang = l;
      apply();
      return true;
    },
    tr: function (s) { return lang === "ar" ? tr(s) : s; }
  };
})();
