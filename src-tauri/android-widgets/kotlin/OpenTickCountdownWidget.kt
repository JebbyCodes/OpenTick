package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone
import __PACKAGE__.R

/**
 * What you count down to. The app writes each countdown's moment (`at`, in milliseconds); the days and hours are worked out here, from the
 * clock, every time the widget is drawn, so they stay right between the app's own refreshes.
 */
class OpenTickCountdownWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_countdowns
    private val ROWS = 6

    /** Days between today and a "yyyy-mm-dd" date, both read on the calendar of [zone]. */
    private fun dayDiff(date: String, zone: TimeZone, now: Long): Int {
        val p = date.split("-")
        if (p.size != 3) return 0
        val a = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { clear(); set(p[0].toInt(), p[1].toInt() - 1, p[2].toInt()) }
        val t = Calendar.getInstance(zone).apply { timeInMillis = now }
        val b = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { clear(); set(t.get(Calendar.YEAR), t.get(Calendar.MONTH), t.get(Calendar.DAY_OF_MONTH)) }
        return Math.round((a.timeInMillis - b.timeInMillis) / 86400000.0).toInt()
    }

    /** The big number and its unit: "12" "days", "3" "hours", "40" "min". */
    private fun big(o: JSONObject, now: Long): Pair<String, String> {
        if (o.optBoolean("w", false)) {
            val zid = o.optString("z", "")
            val zone = if (zid.isNotEmpty()) TimeZone.getTimeZone(zid) else TimeZone.getDefault()
            val d = dayDiff(o.optString("d"), zone, now)
            return if (d <= 0) Pair("Today", "") else Pair(d.toString(), if (d == 1) "day" else "days")
        }
        val ms = o.optLong("at") - now
        if (ms <= 0) return Pair("Now", "")
        val min = ms / 60000
        return when {
            min >= 2 * 1440 -> Pair((min / 1440).toString(), "days")
            min >= 1440 -> Pair("1", "day " + (min % 1440 / 60) + "h")
            min >= 60 -> Pair((min / 60).toString(), if (min / 60 == 1L) "hour" else "hours")
            else -> Pair(maxOf(1, min).toString(), "min")
        }
    }

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = data?.optJSONArray("cd")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, "ot_cd", "Countdowns", if (total > 0) "$total" else "", "page", "countdowns", "page", "countdowns")
        val rowsFit = fit(manager, id, 54, 60, ROWS)
        emptyText(context, rv, th, "ot_cd", data, total == 0, "No countdowns yet")
        val now = System.currentTimeMillis()
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_cd_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val col = OtUi.hex(o.optString("c"), th.acc)
            OtUi.tint(rv, OtUi.rid(context, "ot_cd_b$n"), th.card)
            OtUi.tint(rv, OtUi.rid(context, "ot_cd_i$n"), OtUi.alpha(col, 60))
            val e = OtUi.rid(context, "ot_cd_e$n")
            val icon = o.optString("e", "")
            rv.setTextViewText(e, if (icon.isNotEmpty()) icon else "⏳")
            rv.setTextColor(e, col)
            val name = OtUi.rid(context, "ot_cd_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, th.text)
            val (num, unit) = big(o, now)
            val nv = OtUi.rid(context, "ot_cd_v$n")
            rv.setTextViewText(nv, num)
            rv.setTextColor(nv, col)
            val uv = OtUi.rid(context, "ot_cd_u$n")
            rv.setTextViewText(uv, unit)
            rv.setTextColor(uv, th.muted)
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "page", "countdowns", (o.optString("id").hashCode() * 31) xor id))
        }
        moreText(context, rv, th, "ot_cd", total - minOf(rowsFit, total), id, "page", "countdowns")
    }
}
