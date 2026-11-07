package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import __PACKAGE__.R

/**
 * The views every list-style widget header and body is made of (the ids come from the generated layout): the background, the title and its
 * smaller line, the round "+", the "nothing here" text, the box the rows are added to, and the "+N more" line. A zero means the widget has none.
 */
class Hd(val bg: Int, val title: Int, val sub: Int, val add: Int, val plus: Int, val empty: Int, val list: Int, val more: Int)

/**
 * What every OpenTick widget has in common: it reads the data file the app keeps (the theme and the numbers), draws itself into its layout,
 * and redraws when it is resized or when something on it was tapped. A widget that fails to fill in still shows a card, never a crash.
 *
 * Widgets with a list build one small RemoteViews per row (its own layout, with plain ids) and add it to the list box. That keeps every layout
 * small, and nothing is looked up by name at run time, which is what a minified release build can break.
 */
abstract class OtBaseWidget : AppWidgetProvider() {
    abstract val layout: Int

    abstract fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme)

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) { try { push(context, manager, id) } catch (e: Throwable) { /* one widget never stops the others */ } }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: Bundle) {
        try { push(context, manager, id) } catch (e: Throwable) { /* the next update draws it */ }
    }

    // A widget host shows "Can't load widget" when this receiver throws, so nothing in here is allowed to: a tap that goes wrong is dropped.
    override fun onReceive(context: Context, intent: Intent) {
        try { super.onReceive(context, intent) } catch (e: Throwable) { /* the next update draws the widget again */ }
        try {
            if (intent.action == OtUi.ACTION_ACT) {
                onAction(context, intent)
                OtUi.refreshAll(context)
            }
        } catch (e: Throwable) { /* ignore: see above */ }
    }

    /** By default a tap that did not open the app (a task or habit ticked) is noted for the app to apply. */
    open fun onAction(context: Context, intent: Intent) {
        val op = intent.getStringExtra("op") ?: return
        OtData.queueAction(context, op, intent.getStringExtra("id"))
    }

    /**
     * Draws the widget. If filling it in fails half-way, what was filled is thrown away: a half-filled RemoteViews can hold an action the home
     * screen cannot apply, and then the whole widget shows "Can't load widget". A small plain card says what happened instead (and a tap
     * opens OpenTick), so a problem is visible and reportable rather than a blank error from the launcher.
     */
    fun push(context: Context, manager: AppWidgetManager, id: Int) {
        var rv: RemoteViews
        try {
            rv = RemoteViews(context.packageName, layout)
            val data = OtData.readData(context)
            fill(context, manager, id, rv, data, OtTheme.from(data?.optJSONObject("theme")))
        } catch (e: Throwable) {
            rv = fallback(context, id, "${e.javaClass.simpleName}${e.message?.let { ": " + it.take(60) } ?: ""}")
        }
        try { manager.updateAppWidget(id, rv) } catch (e: Throwable) {
            try { manager.updateAppWidget(id, fallback(context, id, "${e.javaClass.simpleName}")) } catch (e2: Throwable) { /* nothing more can be done */ }
        }
    }

    /** The plain card shown when a widget could not be drawn: it cannot fail, because it only sets one text and one tap. */
    fun fallback(context: Context, id: Int, why: String): RemoteViews {
        val rv = RemoteViews(context.packageName, R.layout.ot_widget_loading)
        try {
            rv.setTextViewText(R.id.ot_ld_text, if (why.isEmpty()) "OpenTick\nTap to open" else "OpenTick · tap to open\n$why")
            rv.setOnClickPendingIntent(R.id.ot_ld_root, OtUi.appIntent(context, "open", "", id * 11 + 9))
        } catch (e: Throwable) { /* the card still shows */ }
        return rv
    }

    /** How many rows of this height fit under a header, from the widget's current size. */
    fun fit(manager: AppWidgetManager, id: Int, rowDp: Int, headerDp: Int, max: Int): Int {
        val minH = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200)
        return ((minH - headerDp) / rowDp).coerceIn(1, max)
    }

    /** The widget's current width in dp (what the home screen says it is, or a normal four-cell width). */
    fun widthDp(manager: AppWidgetManager, id: Int): Int = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)

    /** A list from the app's data, or null while there is no data or it is locked (so a locked widget never draws what it must not show). */
    fun items(data: JSONObject?, key: String): JSONArray? = if (data == null || data.optBoolean("locked", false)) null else data.optJSONArray(key)

    /** The parts every header shares: title colours, the round accent "+", and tapping the title. */
    fun head(context: Context, id: Int, rv: RemoteViews, th: OtTheme, h: Hd, title: String, sub: String, addOp: String, addId: String, openOp: String, openId: String) {
        rv.setInt(h.bg, "setColorFilter", th.bg)
        rv.setTextViewText(h.title, title)
        rv.setTextColor(h.title, th.text)
        rv.setTextViewText(h.sub, sub)
        rv.setTextColor(h.sub, th.muted)
        rv.setOnClickPendingIntent(h.title, OtUi.appIntent(context, openOp, openId, id * 11 + 1))
        rv.setOnClickPendingIntent(h.sub, OtUi.appIntent(context, openOp, openId, id * 11 + 2))
        if (h.add != 0) {
            OtUi.tint(rv, h.add, th.acc)
            OtUi.tint(rv, h.plus, th.onAcc)
            rv.setOnClickPendingIntent(h.add, OtUi.appIntent(context, addOp, addId, id * 11 + 3))
            rv.setOnClickPendingIntent(h.plus, OtUi.appIntent(context, addOp, addId, id * 11 + 3))
        }
    }

    /** Shows an "empty" message (or hides it). */
    fun emptyText(rv: RemoteViews, th: OtTheme, h: Hd, data: JSONObject?, empty: Boolean, msg: String) {
        rv.setTextColor(h.empty, th.muted)
        val locked = data?.optBoolean("locked", false) == true
        rv.setTextViewText(h.empty, if (data == null) "Open OpenTick once to fill this widget" else if (locked) OtUi.LOCKED else msg)
        OtUi.show(rv, h.empty, empty || data == null || locked)
    }

    fun moreText(context: Context, rv: RemoteViews, th: OtTheme, h: Hd, hidden: Int, id: Int, openOp: String, openId: String) {
        rv.setTextColor(h.more, th.muted)
        OtUi.show(rv, h.more, hidden > 0)
        if (hidden > 0) {
            rv.setTextViewText(h.more, "+$hidden more")
            rv.setOnClickPendingIntent(h.more, OtUi.appIntent(context, openOp, openId, id * 11 + 4))
        }
    }

    /**
     * Empties the row box. This has to happen on every draw: the home screen may apply a RemoteViews on top of the one it already shows,
     * and rows added again without clearing would pile up.
     */
    fun clearRows(rv: RemoteViews, h: Hd) { rv.removeAllViews(h.list) }

    /** A fresh, empty row made from a row layout. */
    fun newRow(context: Context, rowLayout: Int): RemoteViews = RemoteViews(context.packageName, rowLayout)

    fun addRow(rv: RemoteViews, h: Hd, row: RemoteViews) { rv.addView(h.list, row) }
}
