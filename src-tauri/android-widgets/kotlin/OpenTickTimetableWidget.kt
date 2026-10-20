package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import __PACKAGE__.R

/** Today's timetable: your school lessons when the school timetable is on, otherwise the day's slots and timed tasks. The lesson on now is highlighted. */
class OpenTickTimetableWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_timetable
    private val ROWS = 8

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val tt = data?.optJSONObject("tt")
        val arr = tt?.optJSONArray("items")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, "ot_tt", if (tt?.optString("kind") == "school") "School" else "Timetable", tt?.optString("sub", "") ?: "", "page", "timetable", "page", "timetable")
        val rowsFit = fit(manager, id, 47, 60, ROWS)
        emptyText(context, rv, th, "ot_tt", data, total == 0, if (tt?.optString("kind") == "school") "No lessons today" else "Nothing scheduled today")
        val nowCal = Calendar.getInstance()
        val nowMin = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE)
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_tt_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val a = OtUi.minutes(o.optString("a"))
            val b = OtUi.minutes(o.optString("b"))
            val live = nowMin in a until b
            val past = b <= nowMin
            OtUi.tint(rv, OtUi.rid(context, "ot_tt_b$n"), if (live) th.line else th.card)
            val t = OtUi.rid(context, "ot_tt_t$n")
            rv.setTextViewText(t, o.optString("a"))
            rv.setTextColor(t, if (live) th.acc else th.muted)
            OtUi.tint(rv, OtUi.rid(context, "ot_tt_k$n"), OtUi.hex(o.optString("c"), th.acc))
            val name = OtUi.rid(context, "ot_tt_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, if (past) th.muted else th.text)
            val s = OtUi.rid(context, "ot_tt_s$n")
            val sub = o.optString("s", "")
            rv.setTextViewText(s, if (sub.isNotEmpty()) sub else o.optString("a") + " – " + o.optString("b"))
            rv.setTextColor(s, th.muted)
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "page", "timetable", (n + 1) * 97 + id))
        }
        moreText(context, rv, th, "ot_tt", total - minOf(rowsFit, total), id, "page", "timetable")
    }
}
