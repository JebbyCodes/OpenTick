package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * What every OpenTick widget has in common: it reads the data file the app keeps (the theme and the numbers), draws itself into its layout,
 * and redraws when it is resized or when something on it was tapped. A widget that fails to fill in still shows its layout, never a crash.
 */
abstract class OtBaseWidget : AppWidgetProvider() {
    abstract val layout: Int

    abstract fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) push(context, manager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: Bundle) {
        push(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == OtUi.ACTION_ACT) {
            onAction(context, intent)
            OtUi.refreshAll(context)
        }
    }

    /** By default a tap that did not open the app (a task or habit ticked) is noted for the app to apply. */
    open fun onAction(context: Context, intent: Intent) {
        val op = intent.getStringExtra("op") ?: return
        OtData.queueAction(context, op, intent.getStringExtra("id"))
    }

    fun push(context: Context, manager: AppWidgetManager, id: Int) {
        val rv = RemoteViews(context.packageName, layout)
        try {
            val data = OtData.readData(context)
            fill(context, manager, id, rv, data, OtTheme.from(data?.optJSONObject("theme")))
        } catch (e: Exception) { /* show the empty layout rather than nothing */ }
        manager.updateAppWidget(id, rv)
    }

    /** How many rows of this height fit under a header, from the widget's current size. */
    fun fit(manager: AppWidgetManager, id: Int, rowDp: Int, headerDp: Int, max: Int): Int {
        val minH = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200)
        return ((minH - headerDp) / rowDp).coerceIn(1, max)
    }

    /** The parts every header shares: title colours, the round accent "+", and tapping the title. */
    fun head(context: Context, id: Int, rv: RemoteViews, th: OtTheme, k: String, title: String, sub: String, addOp: String, addId: String, openOp: String, openId: String) {
        rv.setInt(OtUi.rid(context, k + "_bg"), "setColorFilter", th.bg)
        val t = OtUi.rid(context, k + "_title")
        rv.setTextViewText(t, title)
        rv.setTextColor(t, th.text)
        val s = OtUi.rid(context, k + "_sub")
        rv.setTextViewText(s, sub)
        rv.setTextColor(s, th.muted)
        rv.setOnClickPendingIntent(t, OtUi.appIntent(context, openOp, openId, id * 11 + 1))
        rv.setOnClickPendingIntent(s, OtUi.appIntent(context, openOp, openId, id * 11 + 2))
        val add = OtUi.rid(context, k + "_add")
        if (add != 0) {
            OtUi.tint(rv, add, th.acc)
            OtUi.tint(rv, OtUi.rid(context, k + "_plus"), th.onAcc)
            rv.setOnClickPendingIntent(add, OtUi.appIntent(context, addOp, addId, id * 11 + 3))
            rv.setOnClickPendingIntent(OtUi.rid(context, k + "_plus"), OtUi.appIntent(context, addOp, addId, id * 11 + 3))
        }
    }

    /** Shows an "empty" message (or hides it) and hides the unused rows. */
    fun emptyText(context: Context, rv: RemoteViews, th: OtTheme, k: String, data: JSONObject?, empty: Boolean, msg: String) {
        val e = OtUi.rid(context, k + "_empty")
        rv.setTextColor(e, th.muted)
        rv.setTextViewText(e, if (data == null) "Open OpenTick once to fill this widget" else msg)
        OtUi.show(rv, e, empty || data == null)
    }

    fun moreText(context: Context, rv: RemoteViews, th: OtTheme, k: String, hidden: Int, id: Int, openOp: String, openId: String) {
        val m = OtUi.rid(context, k + "_more")
        rv.setTextColor(m, th.muted)
        OtUi.show(rv, m, hidden > 0)
        if (hidden > 0) {
            rv.setTextViewText(m, "+$hidden more")
            rv.setOnClickPendingIntent(m, OtUi.appIntent(context, openOp, openId, id * 11 + 4))
        }
    }
}
