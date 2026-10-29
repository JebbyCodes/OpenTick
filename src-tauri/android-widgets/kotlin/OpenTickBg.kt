package __PACKAGE__

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * OpenTick's background service on Android.
 *
 * The web app writes opentick-bg.json (the next 14 days of reminders and the next 3 days of lessons). This file turns it into:
 *   1. reminders, set with AlarmManager (one alarm: the soonest; each time it fires the next one is set). They come back after a reboot,
 *      an app update and a clock or time-zone change.
 *   2. an optional persistent notification (a foreground service) for the timetable: the lesson you are in, or the next one, with the
 *      whole day when it is expanded, and the room as the small icon.
 * Reminders the page shows itself (while the app is on screen) are skipped here, and the ones shown here are listed in
 * opentick-bg-fired.json so the page does not show them a second time. Nothing leaves the device.
 */
object OtBg {
    const val PLAN = "opentick-bg.json"
    const val FIRED = "opentick-bg-fired.json"
    const val CH_REM = "opentick_reminders"
    const val CH_TT = "opentick_timetable"
    const val ACTION_ALARM = "__PACKAGE__.BG_ALARM"
    const val ACTION_TT = "__PACKAGE__.BG_TIMETABLE"
    private const val PREFS = "opentick_bg"

    /** Set by OpenTickWidgetBoot: true while one of the app's screens is showing (the page then shows its own reminders). */
    @Volatile var foreground = false
    private val skipped = HashSet<String>()

    fun plan(ctx: Context): JSONObject? = try {
        val f = OtData.find(ctx, PLAN)
        if (f == null) null else JSONObject(f.readText())
    } catch (e: Exception) { null }

    private fun cfg(p: JSONObject?): JSONObject = p?.optJSONObject("cfg") ?: JSONObject()
    private fun enabled(p: JSONObject?) = p != null && cfg(p).optBoolean("on", true)

    private fun firedSet(ctx: Context): MutableSet<String> =
        HashSet(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet("fired", emptySet()) ?: emptySet())

    private fun markFired(ctx: Context, keys: List<String>) {
        if (keys.isEmpty()) return
        val s = firedSet(ctx); s.addAll(keys)
        // keep the list from growing for ever
        val trimmed = if (s.size > 600) s.toList().takeLast(400).toMutableSet() else s
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet("fired", trimmed).apply()
        try {
            val dir = OtData.find(ctx, PLAN)?.parentFile ?: return
            val f = File(dir, FIRED)
            val arr = try { JSONArray(if (f.exists()) f.readText().ifBlank { "[]" } else "[]") } catch (e: Exception) { JSONArray() }
            for (k in keys) arr.put(k)
            f.writeText(arr.toString())
        } catch (e: Exception) { /* the page will just show it again; harmless */ }
    }

    private fun canExact(ctx: Context, am: AlarmManager) = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()

    private fun setAlarm(ctx: Context, at: Long, pi: PendingIntent) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            if (canExact(ctx, am)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    private fun alarmPi(ctx: Context): PendingIntent {
        val i = Intent(ctx, OpenTickBgReceiver::class.java).setAction(ACTION_ALARM)
        return PendingIntent.getBroadcast(ctx, 41, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    /** Sets the one alarm for the soonest reminder that has not been shown. */
    fun scheduleNext(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = alarmPi(ctx)
        am.cancel(pi)
        val p = plan(ctx)
        if (!enabled(p)) return
        val rem = p!!.optJSONArray("rem") ?: return
        val now = System.currentTimeMillis(); val done = firedSet(ctx); var next = Long.MAX_VALUE
        for (i in 0 until rem.length()) {
            val r = rem.optJSONObject(i) ?: continue
            val k = r.optString("k"); if (k in done || k in skipped) continue
            if (r.optLong("exp") < now) continue
            val at = maxOf(r.optLong("at"), now + 1500)
            if (at < next) next = at
        }
        if (next != Long.MAX_VALUE) setAlarm(ctx, next, pi)
    }

    /** The alarm went off: show everything that is due and not shown yet, then set the next alarm. */
    fun onAlarm(ctx: Context) {
        val p = plan(ctx)
        if (enabled(p)) {
            val rem = p!!.optJSONArray("rem") ?: JSONArray()
            val now = System.currentTimeMillis(); val done = firedSet(ctx); val shown = ArrayList<String>()
            for (i in 0 until rem.length()) {
                val r = rem.optJSONObject(i) ?: continue
                val k = r.optString("k")
                if (k in done || k in skipped || r.optLong("at") > now || r.optLong("exp") < now) continue
                if (foreground) { skipped.add(k); continue } // the page is showing its own
                if (post(ctx, k, r.optString("t"), r.optString("b"))) shown.add(k)
            }
            markFired(ctx, shown)
        }
        scheduleNext(ctx)
    }

    private fun ensureChannels(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CH_REM, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply { description = "Task, lesson and timetable reminders" })
        nm.createNotificationChannel(NotificationChannel(CH_TT, "Timetable", NotificationManager.IMPORTANCE_LOW).apply { description = "Your current and next lesson"; setShowBadge(false) })
    }

    private fun smallIconRes(ctx: Context): Int {
        val id = ctx.resources.getIdentifier("ic_stat_opentick", "drawable", ctx.packageName)
        return if (id != 0) id else ctx.applicationInfo.icon
    }

    private fun launchPi(ctx: Context): PendingIntent? {
        val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
        return PendingIntent.getActivity(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun builder(ctx: Context, channel: String): Notification.Builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, channel) else @Suppress("DEPRECATION") Notification.Builder(ctx)

    private fun canNotify(ctx: Context) =
        Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED

    private fun post(ctx: Context, key: String, title: String, body: String): Boolean {
        if (!canNotify(ctx)) return false
        return try {
            ensureChannels(ctx)
            val b = builder(ctx, CH_REM).setSmallIcon(smallIconRes(ctx)).setContentTitle(title).setContentText(body)
                .setStyle(Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER)
            if (Build.VERSION.SDK_INT < 26) @Suppress("DEPRECATION") b.setPriority(Notification.PRIORITY_HIGH)
            launchPi(ctx)?.let { b.setContentIntent(it) }
            (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(key.hashCode(), b.build())
            true
        } catch (e: Exception) { false }
    }

    /* ---------------- the persistent timetable notification ---------------- */

    private class Lsn(val a: Long, val b: Long, val tm: String, val n: String, val r: String, val te: String, val day: String)

    private fun lessons(p: JSONObject): List<Lsn> {
        val out = ArrayList<Lsn>(); val tl = p.optJSONArray("tl") ?: return out
        for (d in 0 until tl.length()) {
            val day = tl.optJSONObject(d) ?: continue; val items = day.optJSONArray("items") ?: continue
            for (i in 0 until items.length()) {
                val it = items.optJSONObject(i) ?: continue
                out.add(Lsn(it.optLong("as"), it.optLong("bs"), it.optString("tm"), it.optString("n"), it.optString("r"), it.optString("te"), day.optString("k")))
            }
        }
        return out.sortedBy { it.a }
    }

    /** The service should run when the person wants it and there is a timetable in the plan. */
    fun wantsTimetable(ctx: Context): Boolean {
        val p = plan(ctx) ?: return false
        return enabled(p) && cfg(p).optBoolean("persist", true) && lessons(p).any { it.b > System.currentTimeMillis() }
    }

    /** Draws the room (up to four characters) as a white-on-transparent icon, which is what Android wants for the status bar. */
    private fun roomIcon(ctx: Context, room: String): Icon? {
        val t = room.trim().take(4).ifBlank { return null }
        val s = 96; val bmp = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888); val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
        var size = 76f; p.textSize = size
        while (p.measureText(t) > s - 6 && size > 20f) { size -= 4f; p.textSize = size }
        c.drawText(t, s / 2f, s / 2f - (p.descent() + p.ascent()) / 2f, p)
        return Icon.createWithBitmap(bmp)
    }

    fun timetableNotification(ctx: Context, now: Long = System.currentTimeMillis()): Notification {
        ensureChannels(ctx)
        val p = plan(ctx) ?: JSONObject(); val all = lessons(p)
        val cur = all.firstOrNull { it.a <= now && now < it.b }
        val nxt = all.firstOrNull { it.a > now }
        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US); val today = dayFmt.format(Date(now))
        val todays = all.filter { it.day == today }
        val b = builder(ctx, CH_TT).setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false).setCategory(Notification.CATEGORY_STATUS)
        val focus = cur ?: nxt
        val icon = if (focus != null) roomIcon(ctx, focus.r) else null
        if (icon != null && Build.VERSION.SDK_INT >= 23) b.setSmallIcon(icon) else b.setSmallIcon(smallIconRes(ctx))
        fun line(l: Lsn) = l.tm + "  " + l.n + (if (l.r.isNotEmpty()) " · " + l.r else "") + (if (l.te.isNotEmpty()) " · " + l.te else "")
        if (cur != null) {
            b.setContentTitle(cur.n + (if (cur.r.isNotEmpty()) " · " + cur.r else "")).setContentText("Now · " + cur.tm + (if (cur.te.isNotEmpty()) " · " + cur.te else ""))
            if (Build.VERSION.SDK_INT >= 24) b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(cur.b).setShowWhen(true)
        } else if (nxt != null) {
            val tomorrow = nxt.day != today
            b.setContentTitle("Next: " + nxt.n + (if (nxt.r.isNotEmpty()) " · " + nxt.r else ""))
                .setContentText((if (tomorrow) "Tomorrow · " else "") + nxt.tm + (if (nxt.te.isNotEmpty()) " · " + nxt.te else ""))
            if (!tomorrow && Build.VERSION.SDK_INT >= 24) b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(nxt.a).setShowWhen(true)
        } else b.setContentTitle("No more lessons").setContentText("Nothing else on your timetable")
        val txt = StringBuilder()
        if (todays.isEmpty()) txt.append("No lessons today") else for (l in todays) txt.append(if (l === cur) "▶ " else if (l === nxt && cur == null) "› " else "   ").append(line(l)).append('\n')
        b.setStyle(Notification.BigTextStyle().bigText(txt.toString().trimEnd()).setSummaryText("Today"))
        launchPi(ctx)?.let { b.setContentIntent(it) }
        return b.build()
    }

    /** The next moment the notification should change: a lesson starting or ending. */
    fun nextBoundary(ctx: Context, now: Long = System.currentTimeMillis()): Long? {
        val p = plan(ctx) ?: return null
        return lessons(p).flatMap { listOf(it.a, it.b) }.filter { it > now }.minOrNull()
    }

    fun scheduleTimetable(ctx: Context) {
        val i = Intent(ctx, OpenTickTimetableService::class.java).setAction(ACTION_TT)
        val pi = if (Build.VERSION.SDK_INT >= 26) PendingIntent.getForegroundService(ctx, 42, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        else PendingIntent.getService(ctx, 42, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi)
        val at = nextBoundary(ctx) ?: return
        setAlarm(ctx, at + 1000, pi)
    }

    /** Called when the app opens or closes, after a reboot or update, and when the clock changes. Everything is best effort. */
    fun apply(ctx: Context) {
        try { scheduleNext(ctx) } catch (e: Exception) { /* keep going */ }
        try {
            if (wantsTimetable(ctx)) {
                val i = Intent(ctx, OpenTickTimetableService::class.java).setAction(ACTION_TT)
                if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
            } else ctx.stopService(Intent(ctx, OpenTickTimetableService::class.java))
        } catch (e: Exception) { /* Android may refuse to start it from the background; the next time the app opens it will start */ }
    }
}

class OpenTickBgReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val pending = goAsync()
        Thread {
            try {
                if (intent?.action == OtBg.ACTION_ALARM) OtBg.onAlarm(context) else OtBg.apply(context)
            } catch (e: Exception) { /* ignore */ } finally { pending.finish() }
        }.start()
    }
}

class OpenTickTimetableService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val n = OtBg.timetableNotification(this)
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(7, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            else startForeground(7, n)
        } catch (e: Exception) { stopSelf(); return START_NOT_STICKY }
        if (!OtBg.wantsTimetable(this)) { stopForeground(true); stopSelf(); return START_NOT_STICKY }
        OtBg.scheduleTimetable(this)
        return START_STICKY
    }
}
