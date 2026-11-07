package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** The "Today" widget: today's and overdue tasks, drawn like the app's task rows (priority ring, list dot and name, due time). Tick one to complete it. */
class OpenTickTasksWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_tasks
    private val H = Hd(R.id.ot_ts_bg, R.id.ot_ts_title, R.id.ot_ts_sub, R.id.ot_ts_add, R.id.ot_ts_plus, R.id.ot_ts_empty, R.id.ot_ts_list, R.id.ot_ts_more)
    private val ROWS = 10

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val rowsFit = fit(manager, id, 45, 60, ROWS)
        val today = OtData.today()
        val done = OtData.pendingDone(context)
        val tasks = ArrayList<JSONObject>()
        val arr = items(data, "tasks")
        if (arr != null) for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            if (o.optString("id") in done) continue
            if (o.optString("due", "") > today) continue
            tasks.add(o)
        }
        head(context, id, rv, th, H, "Today", if (tasks.isEmpty()) "" else "${tasks.size} to do", "add", "", "nav", "today")
        emptyText(rv, th, H, data, tasks.isEmpty(), "Nothing due today")
        clearRows(rv, H)
        val shown = minOf(rowsFit, tasks.size)
        for (n in 0 until shown) addRow(rv, H, taskRow(context, id, th, tasks[n], today))
        moreText(context, rv, th, H, tasks.size - shown, id, "nav", "today")
    }

    private fun taskRow(context: Context, id: Int, th: OtTheme, t: JSONObject, today: String): RemoteViews {
        val row = newRow(context, R.layout.ot_widget_row_task)
        val tid = t.optString("id")
        val overdue = t.optString("due", today) < today
        OtUi.tint(row, R.id.ot_rt_bg, th.card)
        row.setTextViewText(R.id.ot_rt_title, t.optString("t"))
        row.setTextColor(R.id.ot_rt_title, th.text)
        val time = t.optString("time", "")
        row.setTextViewText(R.id.ot_rt_when, if (overdue) "Overdue" else time)
        row.setTextColor(R.id.ot_rt_when, if (overdue) th.red else th.acc)
        OtUi.show(row, R.id.ot_rt_when, overdue || time.isNotEmpty())
        val ln = t.optString("ln", "")
        OtUi.tint(row, R.id.ot_rt_dot, OtUi.hex(t.optString("c", ""), th.muted))
        OtUi.show(row, R.id.ot_rt_dot, ln.isNotEmpty())
        row.setTextViewText(R.id.ot_rt_list, ln)
        row.setTextColor(R.id.ot_rt_list, th.muted)
        OtUi.show(row, R.id.ot_rt_list, ln.isNotEmpty())
        val ring = when (t.optInt("p", 0)) { 3 -> th.red; 2 -> th.acc; 1 -> OtUi.hex("#4772fa", th.muted); else -> th.muted }
        OtUi.tint(row, R.id.ot_rt_check, ring)
        row.setOnClickPendingIntent(R.id.ot_rt_check, OtUi.actIntent(context, OpenTickTasksWidget::class.java, "done", tid, (tid.hashCode() * 31) xor id))
        row.setOnClickPendingIntent(R.id.ot_rt_root, OtUi.appIntent(context, "open", tid, (tid.hashCode() * 17) xor id))
        return row
    }
}
