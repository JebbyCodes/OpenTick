package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import __PACKAGE__.R

/** The focus timer: a ring, the time left (it counts down on its own while a session runs), and today's minutes. */
class OpenTickFocusWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_focus

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val fc = data?.optJSONObject("fc")
        val min = fc?.optInt("min", 0) ?: 0
        head(context, id, rv, th, "ot_fc", "Focus", "$min min today", "focus", "", "page", "focus")
        val run = fc?.optBoolean("run", false) ?: false
        val tot = maxOf(1, fc?.optInt("tot", 1500) ?: 1500)
        var left = fc?.optInt("left", tot) ?: tot
        if (run) {
            val at = fc?.optLong("at", 0L) ?: 0L
            if (at > 0L) left = maxOf(0, left - ((System.currentTimeMillis() - at) / 1000L).toInt())
        }
        rv.setImageViewBitmap(R.id.ot_fc_ring, OtUi.ring(320, left.toFloat() / tot, th.acc, th.line))
        val timeText = String.format(Locale.US, "%02d:%02d", left / 60, left % 60)
        rv.setTextViewText(R.id.ot_fc_text, if (data == null) "25:00" else timeText)
        rv.setTextColor(R.id.ot_fc_text, th.text)
        OtUi.show(rv, R.id.ot_fc_text, !(run && left > 0))
        if (run && left > 0) {
            rv.setTextColor(R.id.ot_fc_time, th.text)
            rv.setChronometer(R.id.ot_fc_time, SystemClock.elapsedRealtime() + left * 1000L, null, true)
            if (Build.VERSION.SDK_INT >= 24) rv.setChronometerCountDown(R.id.ot_fc_time, true)
            OtUi.show(rv, R.id.ot_fc_time, true)
        } else {
            OtUi.show(rv, R.id.ot_fc_time, false)
        }
        OtUi.tint(rv, R.id.ot_fc_btnbg, th.acc)
        rv.setTextViewText(R.id.ot_fc_btn, if (run) "Open timer" else "Start focus")
        rv.setTextColor(R.id.ot_fc_btn, th.onAcc)
        rv.setOnClickPendingIntent(R.id.ot_fc_btnf, OtUi.appIntent(context, "focus", if (run) "open" else "start", id * 11 + 5))
        rv.setOnClickPendingIntent(R.id.ot_fc_btn, OtUi.appIntent(context, "focus", if (run) "open" else "start", id * 11 + 5))
        rv.setOnClickPendingIntent(R.id.ot_fc_ring, OtUi.appIntent(context, "page", "focus", id * 11 + 6))
    }
}
