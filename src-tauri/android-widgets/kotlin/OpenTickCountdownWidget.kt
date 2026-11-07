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
    private val H = Hd(R.id.ot_cd_bg, R.id.ot_cd_title, R.id.ot_cd_sub, 0, 0, R.id.ot_cd_empty, R.id.ot_cd_list, R.id.ot_cd_more)
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
        val arr = items(data, "cd")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, H, "Countdowns", if (total > 0) "$total" else "", "page", "countdowns", "page", "countdowns")
        val rowsFit = fit(manager, id, 53, 60, ROWS)
        emptyText(rv, th, H, data, total == 0, "No countdowns yet")
        clearRows(rv, H)
        val now = System.currentTimeMillis()
        val shown = minOf(rowsFit, total)
        for (n in 0 until shown) {
            val o = arr?.optJSONObject(n) ?: continue
            val col = OtUi.hex(o.optString("c"), th.acc)
            val row = newRow(context, R.layout.ot_widget_row_cd)
            OtUi.tint(row, R.id.ot_rc_bg, th.card)
            OtUi.tint(row, R.id.ot_rc_icon, OtUi.alpha(col, 60))
            val icon = o.optString("e", "")
            row.setTextViewText(R.id.ot_rc_emoji, if (icon.isNotEmpty()) icon else "⏳")
            row.setTextColor(R.id.ot_rc_emoji, col)
            row.setTextViewText(R.id.ot_rc_name, o.optString("n"))
            row.setTextColor(R.id.ot_rc_name, th.text)
            val (num, unit) = big(o, now)
            row.setTextViewText(R.id.ot_rc_value, num)
            row.setTextColor(R.id.ot_rc_value, col)
            row.setTextViewText(R.id.ot_rc_unit, unit)
            row.setTextColor(R.id.ot_rc_unit, th.muted)
            OtUi.show(row, R.id.ot_rc_unit, unit.isNotEmpty())
            row.setOnClickPendingIntent(R.id.ot_rc_root, OtUi.appIntent(context, "page", "countdowns", (o.optString("id").hashCode() * 31) xor id))
            addRow(rv, H, row)
        }
        moreText(context, rv, th, H, total - shown, id, "page", "countdowns")
    }
}
