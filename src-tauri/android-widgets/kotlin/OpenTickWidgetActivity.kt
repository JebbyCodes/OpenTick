package __PACKAGE__

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Invisible stop-over: notes what was tapped on a widget, then opens OpenTick (which applies it) and closes itself. */
class OpenTickWidgetActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val op = intent?.getStringExtra("op") ?: "open"
        val id = intent?.getStringExtra("id")
        if (op == "add" || (op == "open" && !id.isNullOrEmpty())) OtData.queueAction(this, op, id)
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            startActivity(launch)
        }
        finish()
    }
}
