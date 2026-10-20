package __PACKAGE__

import android.content.Context
import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The widgets and the web app share two small JSON files in the app's data folder:
 *   opentick-widget.json          written by the app: today's tasks and the theme colours
 *   opentick-widget-actions.json  written here: what was done on a widget while the app was closed (the app applies it when it opens)
 */
object OtData {
    const val DATA = "opentick-widget.json"
    const val ACTIONS = "opentick-widget-actions.json"

    // Tauri puts its app-data folder in a slightly different place from version to version, so look for the file instead of guessing.
    fun find(ctx: Context, name: String): File? {
        val hits = ArrayList<File>()
        val roots = listOfNotNull(ctx.filesDir, ctx.dataDir).distinct()
        for (r in roots) walk(r, 0, name, hits)
        return hits.maxByOrNull { it.lastModified() }
    }

    private fun walk(dir: File, depth: Int, name: String, hits: MutableList<File>) {
        if (depth > 3) return
        val kids = dir.listFiles() ?: return
        for (k in kids) {
            if (k.isDirectory) {
                val n = k.name
                if (n == "cache" || n == "code_cache" || n == "lib" || n.startsWith("app_webview")) continue
                walk(k, depth + 1, name, hits)
            } else if (k.name == name) hits.add(k)
        }
    }

    fun readData(ctx: Context): JSONObject? {
        return try {
            val f = find(ctx, DATA) ?: return null
            JSONObject(f.readText())
        } catch (e: Exception) { null }
    }

    private fun actionsFile(ctx: Context): File {
        val data = find(ctx, DATA)
        val dir = data?.parentFile ?: ctx.filesDir
        return File(dir, ACTIONS)
    }

    private fun readActions(ctx: Context): JSONArray {
        return try {
            val f = find(ctx, ACTIONS) ?: actionsFile(ctx)
            if (f.exists()) JSONArray(f.readText().ifBlank { "[]" }) else JSONArray()
        } catch (e: Exception) { JSONArray() }
    }

    @Synchronized
    fun queueAction(ctx: Context, op: String, id: String?) {
        try {
            val list = readActions(ctx)
            list.put(JSONObject().put("op", op).put("id", id ?: "").put("at", System.currentTimeMillis()))
            val f = find(ctx, ACTIONS) ?: actionsFile(ctx)
            f.parentFile?.mkdirs()
            f.writeText(list.toString())
        } catch (e: Exception) { /* the widget still works without the note */ }
    }

    // ids ticked on a widget (op "done" for a task, "habit" for a habit) that the app has not applied yet
    fun pending(ctx: Context, op: String): Set<String> {
        val out = HashSet<String>()
        val list = readActions(ctx)
        for (i in 0 until list.length()) {
            val o = list.optJSONObject(i) ?: continue
            if (o.optString("op") == op) out.add(o.optString("id"))
        }
        return out
    }

    fun pendingDone(ctx: Context): Set<String> = pending(ctx, "done")

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun color(theme: JSONObject?, key: String, fallback: String): Int {
        return try { Color.parseColor(theme?.optString(key, fallback)?.takeIf { it.isNotBlank() } ?: fallback) } catch (e: Exception) { Color.parseColor(fallback) }
    }
}

/** The app's colours (written by the app next to the data), so every widget matches the theme you picked. */
class OtTheme(val bg: Int, val card: Int, val text: Int, val muted: Int, val acc: Int, val onAcc: Int, val red: Int, val line: Int) {
    companion object {
        fun from(t: JSONObject?): OtTheme = OtTheme(
            OtData.color(t, "bg", "#282828"), OtData.color(t, "card", "#32302f"), OtData.color(t, "text", "#ebdbb2"), OtData.color(t, "muted", "#a89984"),
            OtData.color(t, "acc", "#fabd2f"), OtData.color(t, "onAcc", "#282828"), OtData.color(t, "red", "#fb4934"), OtData.color(t, "line", "#3c3836")
        )
    }
}
