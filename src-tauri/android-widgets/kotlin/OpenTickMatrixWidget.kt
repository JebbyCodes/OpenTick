package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** The four boxes of the matrix, each with its colour, count and top tasks. */
class OpenTickMatrixWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_matrix
    private val H = Hd(R.id.ot_mx_bg, R.id.ot_mx_title, R.id.ot_mx_sub, R.id.ot_mx_add, R.id.ot_mx_plus, 0, 0, 0)
    private val Q = intArrayOf(R.id.ot_mx_q0, R.id.ot_mx_q1, R.id.ot_mx_q2, R.id.ot_mx_q3)
    private val BG = intArrayOf(R.id.ot_mx_b0, R.id.ot_mx_b1, R.id.ot_mx_b2, R.id.ot_mx_b3)
    private val BAR = intArrayOf(R.id.ot_mx_h0, R.id.ot_mx_h1, R.id.ot_mx_h2, R.id.ot_mx_h3)
    private val NAME = intArrayOf(R.id.ot_mx_n0, R.id.ot_mx_n1, R.id.ot_mx_n2, R.id.ot_mx_n3)
    private val COUNT = intArrayOf(R.id.ot_mx_c0, R.id.ot_mx_c1, R.id.ot_mx_c2, R.id.ot_mx_c3)
    private val TASK = arrayOf(
        intArrayOf(R.id.ot_mx_t0_0, R.id.ot_mx_t0_1, R.id.ot_mx_t0_2),
        intArrayOf(R.id.ot_mx_t1_0, R.id.ot_mx_t1_1, R.id.ot_mx_t1_2),
        intArrayOf(R.id.ot_mx_t2_0, R.id.ot_mx_t2_1, R.id.ot_mx_t2_2),
        intArrayOf(R.id.ot_mx_t3_0, R.id.ot_mx_t3_1, R.id.ot_mx_t3_2)
    )

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        head(context, id, rv, th, H, "Matrix", if (data == null) "Open OpenTick once" else if (data.optBoolean("locked", false)) OtUi.LOCKED else "", "add", "", "page", "matrix")
        val arr = items(data, "mx")
        for (i in 0 until 4) {
            val q = arr?.optJSONObject(i)
            val col = OtUi.hex(q?.optString("c"), th.acc)
            OtUi.tint(rv, BG[i], th.card)
            OtUi.tint(rv, BAR[i], col)
            rv.setTextViewText(NAME[i], q?.optString("n", "") ?: "")
            rv.setTextColor(NAME[i], col)
            val k = q?.optInt("k", 0) ?: 0
            rv.setTextViewText(COUNT[i], if (q == null) "" else q.optString("sub", "") + " · $k")
            rv.setTextColor(COUNT[i], th.muted)
            val items = q?.optJSONArray("items")
            for (j in 0 until 3) {
                val t = TASK[i][j]
                val o = items?.optJSONObject(j)
                OtUi.show(rv, t, o != null)
                if (o == null) continue
                rv.setTextViewText(t, "• " + o.optString("t"))
                rv.setTextColor(t, th.text)
                val tid = o.optString("id")
                rv.setOnClickPendingIntent(t, OtUi.appIntent(context, "open", tid, (tid.hashCode() * 19) xor id))
            }
            rv.setOnClickPendingIntent(Q[i], OtUi.appIntent(context, "page", "matrix", id * 11 + 5 + i))
        }
    }
}
