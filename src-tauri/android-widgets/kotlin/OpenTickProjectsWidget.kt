package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Each project with a progress bar and what is open and overdue. */
class OpenTickProjectsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_projects
    private val H = Hd(R.id.ot_pr_bg, R.id.ot_pr_title, R.id.ot_pr_sub, R.id.ot_pr_add, R.id.ot_pr_plus, R.id.ot_pr_empty, R.id.ot_pr_list, R.id.ot_pr_more)
    private val ROWS = 5

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = items(data, "projects")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, H, "Projects", if (total > 0) "$total" else "", "add", "", "page", "home")
        val rowsFit = fit(manager, id, 65, 60, ROWS)
        emptyText(rv, th, H, data, total == 0, "No projects yet")
        clearRows(rv, H)
        val shown = minOf(rowsFit, total)
        for (n in 0 until shown) {
            val o = arr?.optJSONObject(n) ?: continue
            val pid = o.optString("id")
            val col = OtUi.hex(o.optString("c"), th.acc)
            val pct = o.optInt("pct", 0)
            val row = newRow(context, R.layout.ot_widget_row_project)
            OtUi.tint(row, R.id.ot_rp_bg, th.card)
            row.setTextViewText(R.id.ot_rp_name, o.optString("n"))
            row.setTextColor(R.id.ot_rp_name, th.text)
            row.setTextViewText(R.id.ot_rp_pct, "$pct%")
            row.setTextColor(R.id.ot_rp_pct, col)
            row.setImageViewBitmap(R.id.ot_rp_bar, OtUi.bar(480, 18, pct / 100f, col, th.line))
            val late = o.optInt("l", 0)
            row.setTextViewText(R.id.ot_rp_meta, "${o.optInt("o", 0)} open" + (if (late > 0) " · $late overdue" else ""))
            row.setTextColor(R.id.ot_rp_meta, if (late > 0) th.red else th.muted)
            row.setOnClickPendingIntent(R.id.ot_rp_root, OtUi.appIntent(context, "nav", "project:$pid", (pid.hashCode() * 13) xor id))
            addRow(rv, H, row)
        }
        moreText(context, rv, th, H, total - shown, id, "page", "home")
    }
}
