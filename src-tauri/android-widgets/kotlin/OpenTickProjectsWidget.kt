package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Each project with a progress bar and what is open and overdue. */
class OpenTickProjectsWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_projects
    private val ROWS = 5

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = data?.optJSONArray("projects")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, "ot_pr", "Projects", if (total > 0) "$total" else "", "add", "", "page", "home")
        val rowsFit = fit(manager, id, 65, 60, ROWS)
        emptyText(context, rv, th, "ot_pr", data, total == 0, "No projects yet")
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_pr_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val pid = o.optString("id")
            val col = OtUi.hex(o.optString("c"), th.acc)
            val pct = o.optInt("pct", 0)
            OtUi.tint(rv, OtUi.rid(context, "ot_pr_b$n"), th.card)
            val name = OtUi.rid(context, "ot_pr_n$n")
            rv.setTextViewText(name, o.optString("n"))
            rv.setTextColor(name, th.text)
            val p = OtUi.rid(context, "ot_pr_p$n")
            rv.setTextViewText(p, "$pct%")
            rv.setTextColor(p, col)
            rv.setImageViewBitmap(OtUi.rid(context, "ot_pr_g$n"), OtUi.bar(480, 18, pct / 100f, col, th.line))
            val late = o.optInt("l", 0)
            val m = OtUi.rid(context, "ot_pr_m$n")
            rv.setTextViewText(m, "${o.optInt("o", 0)} open" + (if (late > 0) " · $late overdue" else ""))
            rv.setTextColor(m, if (late > 0) th.red else th.muted)
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "nav", "project:$pid", (pid.hashCode() * 13) xor id))
        }
        moreText(context, rv, th, "ot_pr", total - minOf(rowsFit, total), id, "page", "home")
    }
}
