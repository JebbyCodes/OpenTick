package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import __PACKAGE__.R

/**
 * A month: today is ringed in the accent colour and days that have tasks carry a dot. The arrows move between months, tapping the month name
 * comes back to this month. The weeks are built as rows (one small layout each) and added under the weekday names.
 */
class OpenTickCalendarWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_calendar
    private val H = Hd(R.id.ot_cal_bg, R.id.ot_cal_title, R.id.ot_cal_sub, R.id.ot_cal_add, R.id.ot_cal_plus, R.id.ot_cal_empty, R.id.ot_cal_list, R.id.ot_cal_more)
    private val NAMES = arrayOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
    private val WD = intArrayOf(R.id.ot_cal_w0, R.id.ot_cal_w1, R.id.ot_cal_w2, R.id.ot_cal_w3, R.id.ot_cal_w4, R.id.ot_cal_w5, R.id.ot_cal_w6)
    private val CIRCLE = intArrayOf(R.id.ot_cw_c0, R.id.ot_cw_c1, R.id.ot_cw_c2, R.id.ot_cw_c3, R.id.ot_cw_c4, R.id.ot_cw_c5, R.id.ot_cw_c6)
    private val DAY = intArrayOf(R.id.ot_cw_d0, R.id.ot_cw_d1, R.id.ot_cw_d2, R.id.ot_cw_d3, R.id.ot_cw_d4, R.id.ot_cw_d5, R.id.ot_cw_d6)
    private val DOT = intArrayOf(R.id.ot_cw_k0, R.id.ot_cw_k1, R.id.ot_cw_k2, R.id.ot_cw_k3, R.id.ot_cw_k4, R.id.ot_cw_k5, R.id.ot_cw_k6)

    private fun prefs(context: Context) = context.getSharedPreferences("opentick_widgets", Context.MODE_PRIVATE)
    private fun offset(context: Context, id: Int): Int = prefs(context).getInt("cal_$id", 0)

    override fun onAction(context: Context, intent: Intent) {
        if (intent.getStringExtra("op") != "month") return
        val id = intent.getIntExtra("wid", 0)
        val step = intent.getStringExtra("id")?.toIntOrNull() ?: 0
        val cur = if (step == 0) 0 else offset(context, id) + step
        prefs(context).edit().putInt("cal_$id", cur).apply()
    }

    private fun monthIntent(context: Context, id: Int, step: Int, code: Int): PendingIntent {
        val i = Intent(context, OpenTickCalendarWidget::class.java).setAction(OtUi.ACTION_ACT).putExtra("op", "month").putExtra("id", step.toString()).putExtra("wid", id)
        val f = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getBroadcast(context, code, i, f)
    }

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val off = offset(context, id)
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.add(Calendar.MONTH, off)
        val title = SimpleDateFormat(if (widthDp(manager, id) >= 250) "MMMM yyyy" else "MMM yyyy", Locale.getDefault()).format(cal.time)
        head(context, id, rv, th, H, title, "", "add", "", "page", "calendar")
        OtUi.tint(rv, R.id.ot_cal_prev, th.muted)
        OtUi.tint(rv, R.id.ot_cal_next, th.muted)
        rv.setOnClickPendingIntent(R.id.ot_cal_prev, monthIntent(context, id, -1, id * 11 + 5))
        rv.setOnClickPendingIntent(R.id.ot_cal_next, monthIntent(context, id, 1, id * 11 + 6))
        rv.setOnClickPendingIntent(R.id.ot_cal_title, monthIntent(context, id, 0, id * 11 + 7))
        val cdata = if (data == null || data.optBoolean("locked", false)) null else data.optJSONObject("cal")
        val ws = cdata?.optInt("ws", 0) ?: 0
        val days = cdata?.optJSONObject("days")
        for (i in 0 until 7) {
            rv.setTextViewText(WD[i], NAMES[(ws + i) % 7])
            rv.setTextColor(WD[i], th.muted)
        }
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH)
        val dim = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val lead = (cal.get(Calendar.DAY_OF_WEEK) - 1 - ws + 7) % 7
        val prev = Calendar.getInstance()
        prev.set(Calendar.DAY_OF_MONTH, 1)
        prev.add(Calendar.MONTH, off - 1)
        val prevDim = prev.getActualMaximum(Calendar.DAY_OF_MONTH)
        val todayKey = OtData.today()
        val weeks = (lead + dim + 6) / 7
        // a short widget shows the weeks that fit (the one with today first when it is this month), a tall one the whole month
        val fitWeeks = fit(manager, id, 30, 112, 6).coerceAtLeast(2)
        val firstWeek = if (weeks > fitWeeks && off == 0) ((lead + Calendar.getInstance().get(Calendar.DAY_OF_MONTH) - 1) / 7).coerceAtMost(weeks - fitWeeks) else 0
        val lastWeek = minOf(weeks, firstWeek + fitWeeks)
        clearRows(rv, H)
        var todayCount = 0
        for (w in firstWeek until lastWeek) {
            val row = newRow(context, R.layout.ot_widget_calweek)
            for (c in 0 until 7) {
                val day = w * 7 + c - lead + 1
                val inMonth = day in 1..dim
                val shown = if (day < 1) prevDim + day else if (day > dim) day - dim else day
                val key = if (inMonth) String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day) else ""
                val n = if (inMonth) (days?.optInt(key, 0) ?: 0) else 0
                val isToday = key == todayKey
                row.setTextViewText(DAY[c], "$shown")
                row.setTextColor(DAY[c], if (isToday) th.onAcc else if (inMonth) th.text else OtUi.alpha(th.muted, 110))
                OtUi.tint(row, CIRCLE[c], th.acc)
                OtUi.show(row, CIRCLE[c], isToday)
                OtUi.tint(row, DOT[c], if (isToday) th.onAcc else th.acc)
                OtUi.show(row, DOT[c], n > 0)
                if (isToday) todayCount = n
            }
            addRow(rv, H, row)
        }
        OtUi.show(rv, H.empty, false)
        OtUi.show(rv, H.more, false)
        val info = if (off == 0) (if (todayCount > 0) "$todayCount task${if (todayCount == 1) "" else "s"} today" else "Nothing due today") else "Tap the month name to come back to today"
        rv.setTextViewText(R.id.ot_cal_info, if (data == null) "Open OpenTick once to fill this widget" else if (data.optBoolean("locked", false)) OtUi.LOCKED else info)
        rv.setTextColor(R.id.ot_cal_info, th.muted)
        rv.setOnClickPendingIntent(R.id.ot_cal_info, OtUi.appIntent(context, "page", "calendar", id * 11 + 8))
        rv.setOnClickPendingIntent(R.id.ot_cal_root, OtUi.appIntent(context, "page", "calendar", id * 11 + 9))
    }
}
