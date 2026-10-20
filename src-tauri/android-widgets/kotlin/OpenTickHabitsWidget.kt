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

/** Today's habits with their streaks. Tap the circle to check one in; the app applies it the next time it opens. */
class OpenTickHabitsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_habits
    private val ROWS = 7

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = data?.optJSONArray("hb")
        val total = arr?.length() ?: 0
        val flipped = OtData.pending(context, "habit")
        var done = 0
        for (i in 0 until total) { val o = arr?.optJSONObject(i) ?: continue; if (o.optBoolean("d", false) != (o.optString("id") in flipped)) done++ }
        head(context, id, rv, th, "ot_hb", "Habit", if (total > 0) "$done/$total today" else "", "page", "habits", "page", "habits")
        val rowsFit = fit(manager, id, 49, 60, ROWS)
        emptyText(context, rv, th, "ot_hb", data, total == 0, "No habits yet")
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_hb_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val hid = o.optString("id")
            val col = OtUi.hex(o.optString("c"), th.acc)
            val on = o.optBoolean("d", false) != (hid in flipped)
            OtUi.tint(rv, OtUi.rid(context, "ot_hb_b$n"), th.card)
            OtUi.tint(rv, OtUi.rid(context, "ot_hb_i$n"), OtUi.alpha(col, 60))
            val e = OtUi.rid(context, "ot_hb_e$n")
            val icon = o.optString("e", "")
            rv.setTextViewText(e, if (icon.isNotEmpty()) icon else o.optString("n").take(1).uppercase())
            rv.setTextColor(e, col)
            val name = OtUi.rid(context, "ot_hb_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, th.text)
            val s = OtUi.rid(context, "ot_hb_s$n")
            val streak = o.optInt("s", 0)
            rv.setTextViewText(s, if (streak > 0) "🔥 $streak ${o.optString("u", "day")} streak" else "No streak yet")
            rv.setTextColor(s, th.muted)
            val c = OtUi.rid(context, "ot_hb_c$n")
            rv.setImageViewResource(c, if (on) R.drawable.ot_widget_check_on else R.drawable.ot_widget_check_off)
            OtUi.tint(rv, c, if (on) col else th.muted)
            rv.setOnClickPendingIntent(c, OtUi.actIntent(context, OpenTickHabitsWidget::class.java, "habit", hid, (hid.hashCode() * 29) xor id))
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "page", "habits", (hid.hashCode() * 23) xor id))
        }
        moreText(context, rv, th, "ot_hb", total - minOf(rowsFit, total), id, "page", "habits")
    }
}
