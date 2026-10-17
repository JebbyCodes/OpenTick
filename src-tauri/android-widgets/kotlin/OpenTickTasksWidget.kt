package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import __PACKAGE__.R

/** The "Today" widget: today's and overdue tasks. Tick one to complete it; tap "+" to add one; tap a title to open the app. */
class OpenTickTasksWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) update(context, manager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: Bundle) {
        update(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_DONE -> {
                OtData.queueAction(context, "done", intent.getStringExtra("id"))
                refreshAll(context)
            }
            ACTION_REFRESH -> refreshAll(context)
        }
    }

    companion object {
        const val ACTION_DONE = "__PACKAGE__.WIDGET_DONE"
        const val ACTION_REFRESH = "__PACKAGE__.WIDGET_REFRESH"
        private val ROW = intArrayOf(R.id.ot_r0, R.id.ot_r1, R.id.ot_r2, R.id.ot_r3, R.id.ot_r4, R.id.ot_r5, R.id.ot_r6, R.id.ot_r7)
        private val CHECK = intArrayOf(R.id.ot_c0, R.id.ot_c1, R.id.ot_c2, R.id.ot_c3, R.id.ot_c4, R.id.ot_c5, R.id.ot_c6, R.id.ot_c7)
        private val TITLE = intArrayOf(R.id.ot_t0, R.id.ot_t1, R.id.ot_t2, R.id.ot_t3, R.id.ot_t4, R.id.ot_t5, R.id.ot_t6, R.id.ot_t7)
        private val WHEN = intArrayOf(R.id.ot_d0, R.id.ot_d1, R.id.ot_d2, R.id.ot_d3, R.id.ot_d4, R.id.ot_d5, R.id.ot_d6, R.id.ot_d7)

        private fun flags(): Int =
            if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            for (cls in arrayOf(OpenTickTasksWidget::class.java, OpenTickQuickWidget::class.java)) {
                val ids = manager.getAppWidgetIds(ComponentName(context, cls))
                for (id in ids) {
                    if (cls == OpenTickTasksWidget::class.java) update(context, manager, id) else OpenTickQuickWidget.update(context, manager, id)
                }
            }
        }

        // a trampoline activity records what was tapped, then opens the app (a widget may not start the app from a broadcast)
        fun appIntent(context: Context, op: String, id: String, code: Int): PendingIntent {
            val i = Intent(context, OpenTickWidgetActivity::class.java)
                .putExtra("op", op).putExtra("id", id)
                .setAction("$op:$id")
            return PendingIntent.getActivity(context, code, i, flags())
        }

        fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val rv = RemoteViews(context.packageName, R.layout.ot_widget_tasks)
            val data = OtData.readData(context)
            val theme = data?.optJSONObject("theme")
            val bg = OtData.color(theme, "bg", "#282828")
            val text = OtData.color(theme, "text", "#ebdbb2")
            val muted = OtData.color(theme, "muted", "#a89984")
            val acc = OtData.color(theme, "acc", "#fabd2f")
            val red = OtData.color(theme, "red", "#fb4934")

            rv.setInt(R.id.ot_bg, "setColorFilter", bg)
            rv.setTextColor(R.id.ot_title, text)
            rv.setTextColor(R.id.ot_count, muted)
            rv.setInt(R.id.ot_add, "setColorFilter", acc)
            rv.setTextColor(R.id.ot_empty, muted)
            rv.setTextColor(R.id.ot_more, muted)

            // rows that fit: about 40dp each below a 56dp header
            val opts = manager.getAppWidgetOptions(widgetId)
            val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
            val fit = ((minH - 64) / 40).coerceIn(1, ROW.size)

            val today = OtData.today()
            val done = OtData.pendingDone(context)
            val tasks = ArrayList<org.json.JSONObject>()
            val arr = data?.optJSONArray("tasks")
            if (arr != null) for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (o.optString("id") in done) continue
                if (o.optString("due", "") > today) continue
                tasks.add(o)
            }

            rv.setTextViewText(R.id.ot_title, "Today")
            rv.setTextViewText(R.id.ot_count, if (tasks.isEmpty()) "" else "${tasks.size} to do")
            rv.setViewVisibility(R.id.ot_empty, if (tasks.isEmpty()) View.VISIBLE else View.GONE)
            rv.setTextViewText(R.id.ot_empty, if (data == null) "Open OpenTick once to fill this widget" else "Nothing due today")

            for (n in ROW.indices) {
                if (n < fit && n < tasks.size) {
                    val t = tasks[n]
                    val id = t.optString("id")
                    val overdue = t.optString("due", today) < today
                    rv.setViewVisibility(ROW[n], View.VISIBLE)
                    rv.setTextViewText(TITLE[n], t.optString("t"))
                    rv.setTextColor(TITLE[n], text)
                    val due = t.optString("time", "")
                    rv.setTextViewText(WHEN[n], if (overdue) "Overdue" else due)
                    rv.setTextColor(WHEN[n], if (overdue) red else muted)
                    rv.setViewVisibility(WHEN[n], if (overdue || due.isNotEmpty()) View.VISIBLE else View.GONE)
                    val ring = when (t.optInt("p", 0)) { 3 -> red; 2 -> acc; else -> muted }
                    rv.setInt(CHECK[n], "setColorFilter", ring)
                    val doneIntent = Intent(context, OpenTickTasksWidget::class.java).setAction(ACTION_DONE).putExtra("id", id)
                    rv.setOnClickPendingIntent(CHECK[n], PendingIntent.getBroadcast(context, (id.hashCode() * 31) xor widgetId, doneIntent, flags()))
                    rv.setOnClickPendingIntent(TITLE[n], appIntent(context, "open", id, (id.hashCode() * 17) xor widgetId))
                } else {
                    rv.setViewVisibility(ROW[n], View.GONE)
                }
            }
            val hidden = tasks.size - minOf(fit, tasks.size)
            rv.setViewVisibility(R.id.ot_more, if (hidden > 0) View.VISIBLE else View.GONE)
            if (hidden > 0) rv.setTextViewText(R.id.ot_more, "+$hidden more")

            rv.setOnClickPendingIntent(R.id.ot_add, appIntent(context, "add", "", widgetId * 7 + 1))
            rv.setOnClickPendingIntent(R.id.ot_title, appIntent(context, "open", "", widgetId * 7 + 2))
            rv.setOnClickPendingIntent(R.id.ot_more, appIntent(context, "open", "", widgetId * 7 + 3))
            manager.updateAppWidget(widgetId, rv)
        }
    }
}
