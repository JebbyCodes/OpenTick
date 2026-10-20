package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** A small "Add a task" bar for the home screen. Tapping it opens OpenTick with the add box ready. */
class OpenTickQuickWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_quick

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        rv.setInt(R.id.ot_q_bg, "setColorFilter", th.card)
        rv.setInt(R.id.ot_q_plus, "setColorFilter", th.acc)
        rv.setTextColor(R.id.ot_q_text, th.muted)
        val today = OtData.today()
        val done = OtData.pendingDone(context)
        var n = 0
        val arr = data?.optJSONArray("tasks")
        if (arr != null) for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            if (o.optString("id") !in done && o.optString("due", "") <= today) n++
        }
        rv.setTextViewText(R.id.ot_q_text, if (n > 0) "Add a task · $n today" else "Add a task")
        rv.setOnClickPendingIntent(R.id.ot_q_root, OtUi.appIntent(context, "add", "", id * 11 + 4))
    }
}
