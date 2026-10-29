package __PACKAGE__

import android.app.Activity
import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Starts with the app's process and refreshes the widgets whenever the app goes to the background — which is exactly when you are
 * about to look at the home screen. (The web app has just saved its latest tasks by then.) No data is stored or shared here.
 */
class OpenTickWidgetBoot : ContentProvider() {
    override fun onCreate(): Boolean {
        val app = context?.applicationContext as? Application ?: return true
        val handler = Handler(Looper.getMainLooper())
        var started = 0
        // the background service (OtBg): pick up the plan the page wrote when the app opens, and again once it has gone to the background
        handler.postDelayed({ OtBg.apply(app) }, 3000)
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStopped(activity: Activity) {
                if (activity is OpenTickWidgetActivity) return
                started = maxOf(0, started - 1); OtBg.foreground = started > 0
                handler.postDelayed({ OtUi.refreshAll(app) }, 1500)
                handler.postDelayed({ if (!OtBg.foreground) OtBg.apply(app) }, 3000)
            }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) { if (activity !is OpenTickWidgetActivity) { started++; OtBg.foreground = true } }
            override fun onActivityResumed(activity: Activity) { if (activity !is OpenTickWidgetActivity) handler.postDelayed({ OtBg.apply(app) }, 1000) }
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
        return true
    }
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
