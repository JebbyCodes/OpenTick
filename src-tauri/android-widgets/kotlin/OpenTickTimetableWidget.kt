package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Calendar
import __PACKAGE__.R

/**
 * The timetable: classes, weekly slots and timed tasks in one list. Every row always shows its start and end time, the room and the teacher
 * (a line that is too long slides sideways like a marquee). The arrows move to the previous / next day; tapping "Timetable" comes back to today.
 */
class OpenTickTimetableWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_timetable
    private val ROWS = 8

    private fun offset(context: Context, id: Int): Int = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE).getInt("tt_$id", 0)

    override fun onAction(context: Context, intent: Intent) {
        if (intent.getStringExtra("op") != "day") return
        val id = intent.getIntExtra("wid", 0)
        val step = intent.getStringExtra("id")?.toIntOrNull() ?: 0
        val prefs = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE)
        val cur = if (step == 0) 0 else (prefs.getInt("tt_$id", 0) + step).coerceIn(0, 4) // the data holds today and the next four days
        prefs.edit().putInt("tt_$id", cur).apply()
    }

    private fun dayIntent(context: Context, id: Int, step: Int, code: Int): PendingIntent {
        val i = Intent(context, OpenTickTimetableWidget::class.java).setAction(OtUi.ACTION_ACT).putExtra("op", "day").putExtra("id", step.toString()).putExtra("wid", id)
        val f = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getBroadcast(context, code, i, f)
    }

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val tt = data?.optJSONObject("tt")
        val off = offset(context, id)
        val days = tt?.optJSONArray("days")
        val day = days?.optJSONObject(off)
        // older data files only carry today
        val arr = if (day != null) day.optJSONArray("items") else if (off == 0) tt?.optJSONArray("items") else null
        val total = arr?.length() ?: 0
        val label = if (off == 0) (day?.optString("sub", "") ?: tt?.optString("sub", "") ?: "") else (day?.optString("d", "") + " · " + (day?.optString("sub", "") ?: ""))
        head(context, id, rv, th, "ot_tt", tt?.optString("title", "Timetable")?.ifEmpty { "Timetable" } ?: "Timetable", label, "page", "timetable", "page", "timetable")
        OtUi.tint(rv, R.id.ot_tt_prev, if (off > 0) th.muted else OtUi.alpha(th.muted, 90))
        OtUi.tint(rv, R.id.ot_tt_next, if (off < 4) th.muted else OtUi.alpha(th.muted, 90))
        rv.setOnClickPendingIntent(R.id.ot_tt_prev, dayIntent(context, id, -1, id * 13 + 5))
        rv.setOnClickPendingIntent(R.id.ot_tt_next, dayIntent(context, id, 1, id * 13 + 6))
        rv.setOnClickPendingIntent(R.id.ot_tt_title, dayIntent(context, id, 0, id * 13 + 7))
        val rowsFit = fit(manager, id, 57, 60, ROWS)
        val offText = (day?.optString("off", "") ?: tt?.optString("off", "") ?: "")
        emptyText(context, rv, th, "ot_tt", data, total == 0, if (offText.isNotEmpty()) offText else if (off == 0) "Nothing scheduled today" else "Nothing scheduled")
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
