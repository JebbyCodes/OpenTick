package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import __PACKAGE__.R

/**
 * The timetable: classes, weekly slots and timed tasks in one list. Every row always shows its start and end time, the room and the teacher
 * (a line that is too long slides sideways like a marquee).
 *
 * The app hands the widget a fixed run of days (today and the next 27: four weeks). The single arrows move one day, the double arrows one week,
 * and tapping "Timetable" comes back to today. The steps are always kept inside what the data holds, and when the data file is older than today
 * the days are shifted to match, so stepping can never ask for a day that is not there. A day beyond the data says so instead of failing.
 */
class OpenTickTimetableWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_timetable
    private val ROWS = 8
    private val MAX_OFF = 27 // the app writes 28 days; fill() also limits this to what the file really holds

    private fun prefs(context: Context) = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE)
    private fun offset(context: Context, id: Int): Int = prefs(context).getInt("tt_$id", 0).coerceIn(0, MAX_OFF)

    override fun onAction(context: Context, intent: Intent) {
        if (intent.getStringExtra("op") != "day") return
        val id = intent.getIntExtra("wid", 0)
        val step = intent.getStringExtra("id")?.toIntOrNull() ?: 0
        val cur = if (step == 0) 0 else (offset(context, id) + step).coerceIn(0, MAX_OFF)
        prefs(context).edit().putInt("tt_$id", cur).apply()
    }

    private fun dayIntent(context: Context, id: Int, step: Int, code: Int): PendingIntent {
        val i = Intent(context, OpenTickTimetableWidget::class.java).setAction(OtUi.ACTION_ACT).putExtra("op", "day").putExtra("id", step.toString()).putExtra("wid", id)
        val f = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getBroadcast(context, code, i, f)
    }

    /** How many days the data file is behind today (0 when it was written today). The days in the file start at the date it was written. */
    private fun staleDays(data: JSONObject?): Int {
        val written = data?.optString("today", "") ?: ""
        if (written.isEmpty()) return 0
        return try {
            val f = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val a = f.parse(written) ?: return 0
            val b = f.parse(OtData.today()) ?: return 0
            Math.round((b.time - a.time) / 86400000.0).toInt().coerceIn(0, 400)
        } catch (e: Exception) { 0 }
    }

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val tt = data?.optJSONObject("tt")
        val days = tt?.optJSONArray("days")
        val have = days?.length() ?: 0
        val stale = staleDays(data)
        // the last step that still has a day behind it once the age of the file is counted
        val last = if (have > 0) maxOf(0, have - 1 - stale) else 0
        val off = offset(context, id).coerceAtMost(last)
        val idx = off + stale
        val day = if (idx in 0 until have) days?.optJSONObject(idx) else null
        val beyond = have > 0 && day == null // the file is too old to hold this day: say so, never draw a wrong one
        // older data files carry only today
        val arr = if (day != null) day.optJSONArray("items") else if (off == 0 && have == 0) tt?.optJSONArray("items") else null
        val total = arr?.length() ?: 0
        val label = if (day != null) (if (off == 0) day.optString("sub", "") else day.optString("d", "") + " · " + day.optString("sub", "")) else if (have == 0) (tt?.optString("sub", "") ?: "") else ""
        head(context, id, rv, th, "ot_tt", tt?.optString("title", "Timetable")?.ifEmpty { "Timetable" } ?: "Timetable", label, "page", "timetable", "page", "timetable")
        val canBack = if (off > 0) th.muted else OtUi.alpha(th.muted, 90)
        val canFwd = if (off < last) th.muted else OtUi.alpha(th.muted, 90)
        OtUi.tint(rv, R.id.ot_tt_prev, canBack)
        OtUi.tint(rv, R.id.ot_tt_pw, canBack)
        OtUi.tint(rv, R.id.ot_tt_next, canFwd)
        OtUi.tint(rv, R.id.ot_tt_nw, canFwd)
        rv.setOnClickPendingIntent(R.id.ot_tt_prev, dayIntent(context, id, -1, id * 13 + 5))
        rv.setOnClickPendingIntent(R.id.ot_tt_next, dayIntent(context, id, 1, id * 13 + 6))
        rv.setOnClickPendingIntent(R.id.ot_tt_title, dayIntent(context, id, 0, id * 13 + 7))
        rv.setOnClickPendingIntent(R.id.ot_tt_pw, dayIntent(context, id, -7, id * 13 + 8))
        rv.setOnClickPendingIntent(R.id.ot_tt_nw, dayIntent(context, id, 7, id * 13 + 9))
        val rowsFit = fit(manager, id, 57, 60, ROWS)
        val offText = if (day != null) day.optString("off", "") else if (have == 0) (tt?.optString("off", "") ?: "") else ""
        val msg = if (beyond) "That day is not in the widget yet.\nOpen OpenTick to refresh it." else if (offText.isNotEmpty()) offText else if (off == 0) "Nothing scheduled today" else "Nothing scheduled"
        emptyText(context, rv, th, "ot_tt", data, total == 0, msg)
        val nowCal = Calendar.getInstance()
        val nowMin = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE)
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_tt_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val a = OtUi.minutes(o.optString("a"))
            val b = OtUi.minutes(o.optString("b"))
            val live = off == 0 && nowMin in a until b
            val past = off == 0 && b <= nowMin
            OtUi.tint(rv, OtUi.rid(context, "ot_tt_b$n"), if (live) th.line else th.card)
            val t = OtUi.rid(context, "ot_tt_t$n")
            rv.setTextViewText(t, o.optString("a") + "\n" + o.optString("b"))
            rv.setTextColor(t, if (live) th.acc else th.muted)
            OtUi.tint(rv, OtUi.rid(context, "ot_tt_k$n"), OtUi.hex(o.optString("c"), th.acc))
            val name = OtUi.rid(context, "ot_tt_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, if (past) th.muted else th.text)
            val s = OtUi.rid(context, "ot_tt_s$n")
            val room = o.optString("r", o.optString("s", ""))
            val teacher = o.optString("te", "")
            val where = listOf(room, teacher).filter { it.isNotEmpty() }.joinToString(" · ")
            rv.setTextViewText(s, if (where.isNotEmpty()) where else "No room")
            rv.setTextColor(s, th.muted)
            // a room / teacher line that is too long slides (marquee needs the view selected)
            try { rv.setBoolean(s, "setSelected", true) } catch (e: Exception) { /* stays truncated */ }
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "page", "timetable", (n + 1) * 97 + id))
        }
        moreText(context, rv, th, "ot_tt", total - minOf(rowsFit, total), id, "page", "timetable")
    }
}
