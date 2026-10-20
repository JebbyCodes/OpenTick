package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Every list with what is open in it (and what is overdue), in the colours of the lists. */
class OpenTickListsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_lists
    private val ROWS = 9

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = data?.optJSONArray("lists")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, "ot_ls", "Lists", if (total > 0) "$total" else "", "add", "", "page", "tasks")
        val rowsFit = fit(manager, id, 41, 60, ROWS)
        emptyText(context, rv, th, "ot_ls", data, total == 0, "No lists yet")
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_ls_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val lid = o.optString("id")
            OtUi.tint(rv, OtUi.rid(context, "ot_ls_b$n"), th.card)
            OtUi.tint(rv, OtUi.rid(context, "ot_ls_k$n"), OtUi.hex(o.optString("c"), th.acc))
            val name = OtUi.rid(context, "ot_ls_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, th.text)
            val late = o.optInt("l", 0)
            val l = OtUi.rid(context, "ot_ls_l$n")
            rv.setTextViewText(l, if (late > 0) "$late late" else "")
            rv.setTextColor(l, th.red)
            val c = OtUi.rid(context, "ot_ls_c$n")
            rv.setTextViewText(c, "${o.optInt("o", 0)}")
            rv.setTextColor(c, th.muted)
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "nav", "list:$lid", (lid.hashCode() * 13) xor id))
        }
        moreText(context, rv, th, "ot_ls", total - minOf(rowsFit, total), id, "page", "tasks")
    }
}
