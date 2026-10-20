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

/** The four boxes of the matrix, each with its colour, count and top tasks. */
class OpenTickMatrixWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_matrix

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        head(context, id, rv, th, "ot_mx", "Matrix", "", "add", "", "page", "matrix")
        val arr = data?.optJSONArray("mx")
        for (i in 0 until 4) {
            val q = arr?.optJSONObject(i)
            val col = OtUi.hex(q?.optString("c"), th.acc)
            OtUi.tint(rv, OtUi.rid(context, "ot_mx_b$i"), th.card)
            OtUi.tint(rv, OtUi.rid(context, "ot_mx_h$i"), col)
            val name = OtUi.rid(context, "ot_mx_n$i")
            rv.setTextViewText(name, q?.optString("n", "") ?: "")
            rv.setTextColor(name, col)
            val c = OtUi.rid(context, "ot_mx_c$i")
            val k = q?.optInt("k", 0) ?: 0
            rv.setTextViewText(c, if (q == null) "" else q.optString("sub", "") + " · $k")
            rv.setTextColor(c, th.muted)
            val items = q?.optJSONArray("items")
            for (j in 0 until 3) {
                val t = OtUi.rid(context, "ot_mx_t${i}_$j")
                val o = items?.optJSONObject(j)
                OtUi.show(rv, t, o != null)
                if (o == null) continue
                rv.setTextViewText(t, "• " + o.optString("t"))
                rv.setTextColor(t, th.text)
                val tid = o.optString("id")
                rv.setOnClickPendingIntent(t, OtUi.appIntent(context, "open", tid, (tid.hashCode() * 19) xor id))
            }
            rv.setOnClickPendingIntent(OtUi.rid(context, "ot_mx_q$i"), OtUi.appIntent(context, "page", "matrix", id * 11 + 5 + i))
        }
        rv.setTextViewText(OtUi.rid(context, "ot_mx_sub"), if (data == null) "Open OpenTick once" else "")
        rv.setTextColor(OtUi.rid(context, "ot_mx_sub"), th.muted)
    }
}
