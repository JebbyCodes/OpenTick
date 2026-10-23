package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** The "Today" widget: today's and overdue tasks, drawn like the app's task rows (priority ring, list dot and name, due time). Tick one to complete it. */
class OpenTickTasksWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_tasks
    private val ROW = intArrayOf(R.id.ot_r0, R.id.ot_r1, R.id.ot_r2, R.id.ot_r3, R.id.ot_r4, R.id.ot_r5, R.id.ot_r6, R.id.ot_r7, R.id.ot_r8, R.id.ot_r9)
    private val BG = intArrayOf(R.id.ot_rb0, R.id.ot_rb1, R.id.ot_rb2, R.id.ot_rb3, R.id.ot_rb4, R.id.ot_rb5, R.id.ot_rb6, R.id.ot_rb7, R.id.ot_rb8, R.id.ot_rb9)
    private val CHECK = intArrayOf(R.id.ot_c0, R.id.ot_c1, R.id.ot_c2, R.id.ot_c3, R.id.ot_c4, R.id.ot_c5, R.id.ot_c6, R.id.ot_c7, R.id.ot_c8, R.id.ot_c9)
    private val TITLE = intArrayOf(R.id.ot_t0, R.id.ot_t1, R.id.ot_t2, R.id.ot_t3, R.id.ot_t4, R.id.ot_t5, R.id.ot_t6, R.id.ot_t7, R.id.ot_t8, R.id.ot_t9)
    private val DOT = intArrayOf(R.id.ot_k0, R.id.ot_k1, R.id.ot_k2, R.id.ot_k3, R.id.ot_k4, R.id.ot_k5, R.id.ot_k6, R.id.ot_k7, R.id.ot_k8, R.id.ot_k9)
    private val LIST = intArrayOf(R.id.ot_l0, R.id.ot_l1, R.id.ot_l2, R.id.ot_l3, R.id.ot_l4, R.id.ot_l5, R.id.ot_l6, R.id.ot_l7, R.id.ot_l8, R.id.ot_l9)
    private val WHEN = intArrayOf(R.id.ot_d0, R.id.ot_d1, R.id.ot_d2, R.id.ot_d3, R.id.ot_d4, R.id.ot_d5, R.id.ot_d6, R.id.ot_d7, R.id.ot_d8, R.id.ot_d9)

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        rv.setInt(R.id.ot_bg, "setColorFilter", th.bg)
        rv.setTextColor(R.id.ot_title, th.text)
        rv.setTextColor(R.id.ot_count, th.muted)
        OtUi.tint(rv, R.id.ot_add, th.acc)
        OtUi.tint(rv, R.id.ot_addp, th.onAcc)
        val rowsFit = fit(manager, id, 45, 60, ROW.size)
        val today = OtData.today()
        val done = OtData.pendingDone(context)
        val tasks = ArrayList<JSONObject>()
        val arr = data?.optJSONArray("tasks")
        if (arr != null) for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            if (o.optString("id") in done) continue
            if (o.optString("due", "") > today) continue
            tasks.add(o)
        }
        rv.setTextViewText(R.id.ot_title, "Today")
        rv.setTextViewText(R.id.ot_count, if (tasks.isEmpty()) "" else "${tasks.size} to do")
        rv.setTextColor(R.id.ot_empty, th.muted)
        val locked = data?.optBoolean("locked", false) == true
        rv.setTextViewText(R.id.ot_empty, if (data == null) "Open OpenTick once to fill this widget" else if (locked) OtUi.LOCKED else "Nothing due today")
        OtUi.show(rv, R.id.ot_empty, tasks.isEmpty() || locked)
        for (n in ROW.indices) {
            if (n < rowsFit && n < tasks.size) {
                val t = tasks[n]
                val tid = t.optString("id")
                val overdue = t.optString("due", today) < today
                OtUi.show(rv, ROW[n], true)
                OtUi.tint(rv, BG[n], th.card)
                rv.setTextViewText(TITLE[n], t.optString("t"))
                rv.setTextColor(TITLE[n], th.text)
                val time = t.optString("time", "")
                rv.setTextViewText(WHEN[n], if (overdue) "Overdue" else time)
                rv.setTextColor(WHEN[n], if (overdue) th.red else th.acc)
                OtUi.show(rv, WHEN[n], overdue || time.isNotEmpty())
                val ln = t.optString("ln", "")
                val lc = OtUi.hex(t.optString("c", ""), th.muted)
                OtUi.tint(rv, DOT[n], lc)
                OtUi.show(rv, DOT[n], ln.isNotEmpty())
                rv.setTextViewText(LIST[n], ln)
                rv.setTextColor(LIST[n], th.muted)
                OtUi.show(rv, LIST[n], ln.isNotEmpty())
                val ring = when (t.optInt("p", 0)) { 3 -> th.red; 2 -> th.acc; 1 -> OtUi.hex("#4772fa", th.muted); else -> th.muted }
                OtUi.tint(rv, CHECK[n], ring)
                rv.setOnClickPendingIntent(CHECK[n], OtUi.actIntent(context, OpenTickTasksWidget::class.java, "done", tid, (tid.hashCode() * 31) xor id))
                rv.setOnClickPendingIntent(TITLE[n], OtUi.appIntent(context, "open", tid, (tid.hashCode() * 17) xor id))
            } else {
                OtUi.show(rv, ROW[n], false)
            }
        }
        val hidden = tasks.size - minOf(rowsFit, tasks.size)
        rv.setTextColor(R.id.ot_more, th.muted)
        OtUi.show(rv, R.id.ot_more, hidden > 0)
        if (hidden > 0) rv.setTextViewText(R.id.ot_more, "+$hidden more")
        rv.setOnClickPendingIntent(R.id.ot_add, OtUi.appIntent(context, "add", "", id * 11 + 1))
        rv.setOnClickPendingIntent(R.id.ot_addp, OtUi.appIntent(context, "add", "", id * 11 + 1))
        rv.setOnClickPendingIntent(R.id.ot_title, OtUi.appIntent(context, "nav", "today", id * 11 + 2))
        rv.setOnClickPendingIntent(R.id.ot_more, OtUi.appIntent(context, "nav", "today", id * 11 + 3))
    }
}
