package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Today's habits with their streaks. Tap the circle to check one in; the app applies it the next time it opens. */
class OpenTickHabitsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_habits
    private val H = Hd(R.id.ot_hb_bg, R.id.ot_hb_title, R.id.ot_hb_sub, 0, 0, R.id.ot_hb_empty, R.id.ot_hb_list, R.id.ot_hb_more)
    private val ROWS = 7

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = items(data, "hb")
        val total = arr?.length() ?: 0
        val flipped = OtData.pending(context, "habit")
        var done = 0
        for (i in 0 until total) { val o = arr?.optJSONObject(i) ?: continue; if (o.optBoolean("d", false) != (o.optString("id") in flipped)) done++ }
        head(context, id, rv, th, H, "Habits", if (total > 0) "$done/$total today" else "", "page", "habits", "page", "habits")
        val rowsFit = fit(manager, id, 49, 60, ROWS)
        emptyText(rv, th, H, data, total == 0, "No habits yet")
        clearRows(rv, H)
        val shown = minOf(rowsFit, total)
        for (n in 0 until shown) {
            val o = arr?.optJSONObject(n) ?: continue
            val hid = o.optString("id")
            val col = OtUi.hex(o.optString("c"), th.acc)
            val on = o.optBoolean("d", false) != (hid in flipped)
            val row = newRow(context, R.layout.ot_widget_row_habit)
            OtUi.tint(row, R.id.ot_rh_bg, th.card)
            OtUi.tint(row, R.id.ot_rh_icon, OtUi.alpha(col, 60))
            val icon = o.optString("e", "")
            row.setTextViewText(R.id.ot_rh_emoji, if (icon.isNotEmpty()) icon else o.optString("n").take(1).uppercase())
            row.setTextColor(R.id.ot_rh_emoji, col)
            row.setTextViewText(R.id.ot_rh_name, o.optString("n"))
            row.setTextColor(R.id.ot_rh_name, th.text)
            val streak = o.optInt("s", 0)
            row.setTextViewText(R.id.ot_rh_streak, if (streak > 0) "🔥 $streak ${o.optString("u", "day")} streak" else "No streak yet")
            row.setTextColor(R.id.ot_rh_streak, th.muted)
            row.setImageViewResource(R.id.ot_rh_check, if (on) R.drawable.ot_widget_check_on else R.drawable.ot_widget_check_off)
            OtUi.tint(row, R.id.ot_rh_check, if (on) col else th.muted)
            row.setOnClickPendingIntent(R.id.ot_rh_check, OtUi.actIntent(context, OpenTickHabitsWidget::class.java, "habit", hid, (hid.hashCode() * 29) xor id))
            row.setOnClickPendingIntent(R.id.ot_rh_root, OtUi.appIntent(context, "page", "habits", (hid.hashCode() * 23) xor id))
            addRow(rv, H, row)
        }
        moreText(context, rv, th, H, total - shown, id, "page", "habits")
    }
}
