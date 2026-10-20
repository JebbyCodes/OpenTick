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

/** A month: today is ringed in the accent colour and days that have tasks carry a dot. The arrows move between months. */
class OpenTickCalendarWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_calendar
    private val NAMES = arrayOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")

    private fun offset(context: Context, id: Int): Int = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE).getInt("cal_$id", 0)

    override fun onAction(context: Context, intent: Intent) {
        if (intent.getStringExtra("op") != "month") return
        val id = intent.getIntExtra("wid", 0)
        val step = intent.getStringExtra("id")?.toIntOrNull() ?: 0
        val prefs = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE)
        val cur = if (step == 0) 0 else prefs.getInt("cal_$id", 0) + step
        prefs.edit().putInt("cal_$id", cur).apply()
    }

    private fun monthIntent(context: Context, id: Int, step: Int, code: Int): android.app.PendingIntent {
        val i = Intent(context, OpenTickCalendarWidget::class.java).setAction(OtUi.ACTION_ACT).putExtra("op", "month").putExtra("id", step.toString()).putExtra("wid", id)
        val f = if (Build.VERSION.SDK_INT >= 23) android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE else android.app.PendingIntent.FLAG_UPDATE_CURRENT
        return android.app.PendingIntent.getBroadcast(context, code, i, f)
    }

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val off = offset(context, id)
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.add(Calendar.MONTH, off)
        val title = SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(cal.time)
        head(context, id, rv, th, "ot_cal", title, "", "add", "", "page", "calendar")
        OtUi.tint(rv, R.id.ot_cal_prev, th.muted)
        OtUi.tint(rv, R.id.ot_cal_next, th.muted)
        rv.setOnClickPendingIntent(R.id.ot_cal_prev, monthIntent(context, id, -1, id * 11 + 5))
        rv.setOnClickPendingIntent(R.id.ot_cal_next, monthIntent(context, id, 1, id * 11 + 6))
        rv.setOnClickPendingIntent(R.id.ot_cal_title, monthIntent(context, id, 0, id * 11 + 7))
        val cdata = data?.optJSONObject("cal")
        val ws = cdata?.optInt("ws", 0) ?: 0
        val days = cdata?.optJSONObject("days")
        for (i in 0 until 7) {
            val t = OtUi.rid(context, "ot_cal_w$i")
            rv.setTextViewText(t, NAMES[(ws + i) % 7])
            rv.setTextColor(t, th.muted)
        }
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH)
        val dim = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val lead = (cal.get(Calendar.DAY_OF_WEEK) - 1 - ws + 7) % 7
        val prev = Calendar.getInstance()
        prev.set(Calendar.DAY_OF_MONTH, 1)
        prev.add(Calendar.MONTH, off - 1)
        val prevDim = prev.getActualMaximum(Calendar.DAY_OF_MONTH)
        val now = Calendar.getInstance()
        val todayKey = OtData.today()
        var todayCount = 0
        for (i in 0 until 42) {
            val day = i - lead + 1
            val inMonth = day in 1..dim
            val shown = if (day < 1) prevDim + day else if (day > dim) day - dim else day
            val key = if (inMonth) String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day) else ""
            val n = if (inMonth) (days?.optInt(key, 0) ?: 0) else 0
            val isToday = key == todayKey
            val circle = OtUi.rid(context, "ot_cal_c$i")
            val label = OtUi.rid(context, "ot_cal_d$i")
            val dot = OtUi.rid(context, "ot_cal_k$i")
            rv.setTextViewText(label, "$shown")
            rv.setTextColor(label, if (isToday) th.onAcc else if (inMonth) th.text else OtUi.alpha(th.muted, 110))
            OtUi.tint(rv, circle, th.acc)
            OtUi.show(rv, circle, isToday)
            OtUi.tint(rv, dot, if (isToday) th.onAcc else th.acc)
            OtUi.show(rv, dot, n > 0)
            if (isToday) todayCount = n
        }
        val info = if (off == 0) (if (todayCount > 0) "$todayCount task${if (todayCount == 1) "" else "s"} today" else "Nothing due today") else "Tap the month name to come back to today"
        rv.setTextViewText(R.id.ot_cal_info, if (data == null) "Open OpenTick once to fill this widget" else info)
        rv.setTextColor(R.id.ot_cal_info, th.muted)
        rv.setOnClickPendingIntent(R.id.ot_cal_info, OtUi.appIntent(context, "page", "calendar", id * 11 + 8))
        rv.setOnClickPendingIntent(R.id.ot_cal_root, OtUi.appIntent(context, "page", "calendar", id * 11 + 9))
    }
}
