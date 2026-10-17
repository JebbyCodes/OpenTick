package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import __PACKAGE__.R

/** A small "Add a task" bar for the home screen. Tapping it opens OpenTick with the add box ready. */
class OpenTickQuickWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) update(context, manager, id)
    }

    companion object {
        fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val rv = RemoteViews(context.packageName, R.layout.ot_widget_quick)
            val data = OtData.readData(context)
            val theme = data?.optJSONObject("theme")
            rv.setInt(R.id.ot_q_bg, "setColorFilter", OtData.color(theme, "card", "#32302f"))
            rv.setInt(R.id.ot_q_plus, "setColorFilter", OtData.color(theme, "acc", "#fabd2f"))
            rv.setTextColor(R.id.ot_q_text, OtData.color(theme, "muted", "#a89984"))
            val today = OtData.today()
            val done = OtData.pendingDone(context)
            var n = 0
            val arr = data?.optJSONArray("tasks")
            if (arr != null) for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (o.optString("id") !in done && o.optString("due", "") <= today) n++
            }
            rv.setTextViewText(R.id.ot_q_text, if (n > 0) "Add a task · $n today" else "Add a task")
            rv.setOnClickPendingIntent(R.id.ot_q_root, OpenTickTasksWidget.appIntent(context, "add", "", widgetId * 7 + 4))
            manager.updateAppWidget(widgetId, rv)
        }
    }
}
