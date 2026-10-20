package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Pinned and recent notes with the first line of each; "+" starts a new note. */
class OpenTickNotesWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_notes
    private val ROWS = 6

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = data?.optJSONArray("notes")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, "ot_nt", "Notes", if (total > 0) "$total" else "", "newnote", "", "page", "notes")
        val rowsFit = fit(manager, id, 59, 60, ROWS)
        emptyText(context, rv, th, "ot_nt", data, total == 0, "No notes yet")
        for (n in 0 until ROWS) {
            val r = OtUi.rid(context, "ot_nt_r$n")
            val o = if (n < rowsFit && arr != null) arr.optJSONObject(n) else null
            OtUi.show(rv, r, o != null)
            if (o == null) continue
            val nid = o.optString("id")
            OtUi.tint(rv, OtUi.rid(context, "ot_nt_b$n"), th.card)
            val t = OtUi.rid(context, "ot_nt_t$n")
            rv.setTextViewText(t, (if (o.optBoolean("pin", false)) "★ " else "") + o.optString("t"))
            rv.setTextColor(t, th.text)
            val s = OtUi.rid(context, "ot_nt_s$n")
            rv.setTextViewText(s, o.optString("s"))
            rv.setTextColor(s, th.muted)
            rv.setOnClickPendingIntent(r, OtUi.appIntent(context, "note", nid, (nid.hashCode() * 13) xor id))
        }
        moreText(context, rv, th, "ot_nt", total - minOf(rowsFit, total), id, "page", "notes")
    }
}
