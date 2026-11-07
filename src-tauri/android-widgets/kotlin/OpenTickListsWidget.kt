package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Every list with what is open in it (and what is overdue), in the colours of the lists. */
class OpenTickListsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_lists
    private val H = Hd(R.id.ot_ls_bg, R.id.ot_ls_title, R.id.ot_ls_sub, R.id.ot_ls_add, R.id.ot_ls_plus, R.id.ot_ls_empty, R.id.ot_ls_list, R.id.ot_ls_more)
    private val ROWS = 9

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = items(data, "lists")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, H, "Lists", if (total > 0) "$total" else "", "add", "", "page", "tasks")
        val rowsFit = fit(manager, id, 41, 60, ROWS)
        emptyText(rv, th, H, data, total == 0, "No lists yet")
        clearRows(rv, H)
        val shown = minOf(rowsFit, total)
        for (n in 0 until shown) {
            val o = arr?.optJSONObject(n) ?: continue
            val lid = o.optString("id")
            val row = newRow(context, R.layout.ot_widget_row_list)
            OtUi.tint(row, R.id.ot_rl_bg, th.card)
            OtUi.tint(row, R.id.ot_rl_dot, OtUi.hex(o.optString("c"), th.acc))
            row.setTextViewText(R.id.ot_rl_name, o.optString("n"))
            row.setTextColor(R.id.ot_rl_name, th.text)
            val late = o.optInt("l", 0)
            row.setTextViewText(R.id.ot_rl_late, if (late > 0) "$late late" else "")
            row.setTextColor(R.id.ot_rl_late, th.red)
            OtUi.show(row, R.id.ot_rl_late, late > 0)
            row.setTextViewText(R.id.ot_rl_count, "${o.optInt("o", 0)}")
            row.setTextColor(R.id.ot_rl_count, th.muted)
            row.setOnClickPendingIntent(R.id.ot_rl_root, OtUi.appIntent(context, "nav", "list:$lid", (lid.hashCode() * 13) xor id))
            addRow(rv, H, row)
        }
        moreText(context, rv, th, H, total - shown, id, "page", "tasks")
    }
}
