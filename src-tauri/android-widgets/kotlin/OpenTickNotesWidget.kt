package __PACKAGE__

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import __PACKAGE__.R

/** Pinned and recent notes with the first line of each; "+" starts a new note. */
class OpenTickNotesWidget : OtBaseWidget() {
    override val layout = R.layout.ot_widget_notes
    private val H = Hd(R.id.ot_nt_bg, R.id.ot_nt_title, R.id.ot_nt_sub, R.id.ot_nt_add, R.id.ot_nt_plus, R.id.ot_nt_empty, R.id.ot_nt_list, R.id.ot_nt_more)
    private val ROWS = 6

    override fun fill(context: Context, manager: AppWidgetManager, id: Int, rv: RemoteViews, data: JSONObject?, th: OtTheme) {
        val arr = items(data, "notes")
        val total = arr?.length() ?: 0
        head(context, id, rv, th, H, "Notes", if (total > 0) "$total" else "", "newnote", "", "page", "notes")
        val rowsFit = fit(manager, id, 59, 60, ROWS)
        emptyText(rv, th, H, data, total == 0, "No notes yet")
        clearRows(rv, H)
        val shown = minOf(rowsFit, total)
        for (n in 0 until shown) {
            val o = arr?.optJSONObject(n) ?: continue
            val nid = o.optString("id")
            val row = newRow(context, R.layout.ot_widget_row_note)
            OtUi.tint(row, R.id.ot_rn_bg, th.card)
            row.setTextViewText(R.id.ot_rn_title, (if (o.optBoolean("pin", false)) "★ " else "") + o.optString("t"))
            row.setTextColor(R.id.ot_rn_title, th.text)
            row.setTextViewText(R.id.ot_rn_snip, o.optString("s"))
            row.setTextColor(R.id.ot_rn_snip, th.muted)
            row.setOnClickPendingIntent(R.id.ot_rn_root, OtUi.appIntent(context, "note", nid, (nid.hashCode() * 13) xor id))
            addRow(rv, H, row)
        }
        moreText(context, rv, th, H, total - shown, id, "page", "notes")
    }
}
