package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.widget.RemoteViews

/** Small helpers shared by every OpenTick widget: intents, colours, and the few things that are drawn (progress bars and rings). */
object OtUi {
    const val ACTION_ACT = "__PACKAGE__.WIDGET_ACT"
    /** Shown instead of data while encryption is on and the person has not allowed a readable summary for widgets. */
    const val LOCKED = "Locked: open OpenTick"

    private fun flags(): Int =
        if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT

    /** Opens OpenTick through the invisible stop-over activity, which records what was tapped (op: open, add, nav, page, note, newnote, focus). */
    fun appIntent(context: Context, op: String, id: String, code: Int): PendingIntent {
        val i = Intent(context, OpenTickWidgetActivity::class.java).putExtra("op", op).putExtra("id", id).setAction("$op:$id")
        return PendingIntent.getActivity(context, code, i, flags())
    }

    /** A tap the widget handles itself, without opening the app (ticking a task or a habit, a calendar arrow). */
    fun actIntent(context: Context, cls: Class<*>, op: String, id: String, code: Int): PendingIntent {
        val i = Intent(context, cls).setAction(ACTION_ACT).putExtra("op", op).putExtra("id", id)
        return PendingIntent.getBroadcast(context, code, i, flags())
    }

    /** A view's id by name, so the repeated rows of a layout (ot_ls_n0, ot_ls_n1 ...) do not need an array each. */
    fun rid(context: Context, name: String): Int = context.resources.getIdentifier(name, "id", context.packageName)

    fun tint(rv: RemoteViews, viewId: Int, color: Int) { rv.setInt(viewId, "setColorFilter", color) }

    fun show(rv: RemoteViews, viewId: Int, on: Boolean) { rv.setViewVisibility(viewId, if (on) android.view.View.VISIBLE else android.view.View.GONE) }

    fun alpha(color: Int, a: Int): Int = (color and 0x00FFFFFF) or (a shl 24)

    fun hex(s: String?, fallback: Int): Int = try { if (s.isNullOrBlank()) fallback else Color.parseColor(s) } catch (e: Exception) { fallback }

    fun minutes(hm: String?): Int {
        if (hm == null) return 0
        val p = hm.split(":")
        return if (p.size < 2) 0 else (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0)
    }

    fun clock(hm: String?): String = hm ?: ""

    /** A rounded progress bar. */
    fun bar(widthPx: Int, heightPx: Int, frac: Float, fg: Int, bg: Int): Bitmap {
        val b = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val r = heightPx / 2f
        p.color = bg
        c.drawRoundRect(RectF(0f, 0f, widthPx.toFloat(), heightPx.toFloat()), r, r, p)
        val f = frac.coerceIn(0f, 1f)
        if (f > 0f) {
            p.color = fg
            val w = maxOf(heightPx.toFloat(), widthPx * f)
            c.drawRoundRect(RectF(0f, 0f, w, heightPx.toFloat()), r, r, p)
        }
        return b
    }

    /** A progress ring (the focus timer). It starts at the top and runs clockwise. */
    fun ring(sizePx: Int, frac: Float, fg: Int, bg: Int): Bitmap {
        val b = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val stroke = sizePx * 0.075f
        val box = RectF(stroke / 2f, stroke / 2f, sizePx - stroke / 2f, sizePx - stroke / 2f)
        p.style = Paint.Style.STROKE
        p.strokeWidth = stroke
        p.strokeCap = Paint.Cap.ROUND
        p.color = bg
        c.drawArc(box, 0f, 360f, false, p)
        val f = frac.coerceIn(0f, 1f)
        if (f > 0f) {
            p.color = fg
            c.drawArc(box, -90f, 360f * f, false, p)
        }
        return b
    }

    /** Asks every OpenTick widget on the home screen to redraw. */
    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val all: Array<Class<*>> = arrayOf(
            OpenTickTasksWidget::class.java, OpenTickQuickWidget::class.java, OpenTickListsWidget::class.java, OpenTickProjectsWidget::class.java,
            OpenTickNotesWidget::class.java, OpenTickCalendarWidget::class.java, OpenTickTimetableWidget::class.java, OpenTickMatrixWidget::class.java,
            OpenTickHabitsWidget::class.java, OpenTickFocusWidget::class.java
        )
        for (cls in all) {
            val ids = manager.getAppWidgetIds(ComponentName(context, cls))
            if (ids.isNotEmpty()) {
                val i = Intent(context, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                context.sendBroadcast(i)
            }
        }
    }
}
