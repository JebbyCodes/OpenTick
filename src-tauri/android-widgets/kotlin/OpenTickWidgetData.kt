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

    // tasks ticked on the widget that the app has not applied yet
    fun pendingDone(ctx: Context): Set<String> {
        val out = HashSet<String>()
        val list = readActions(ctx)
        for (i in 0 until list.length()) {
            val o = list.optJSONObject(i) ?: continue
            if (o.optString("op") == "done") out.add(o.optString("id"))
        }
        return out
    }

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun color(theme: JSONObject?, key: String, fallback: String): Int {
        return try { Color.parseColor(theme?.optString(key, fallback)?.takeIf { it.isNotBlank() } ?: fallback) } catch (e: Exception) { Color.parseColor(fallback) }
    }
}
