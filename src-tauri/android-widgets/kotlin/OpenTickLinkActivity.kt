package __PACKAGE__

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * The door other apps knock on: opentick://… links (the OpenTick Bridge, see docs/INTEGRATION.md).
 * Like a widget tap, the link is only noted here; OpenTick checks it (the Bridge must be switched on and the app paired) and answers
 * the other app itself through the link's x-success / x-error address. Nothing is decided or run in this class.
 */
class OpenTickLinkActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val uri = intent?.data
        // only our own scheme, and a sane length, is passed on
        if (uri != null && uri.scheme == "opentick") {
            val s = uri.toString()
            if (s.length <= 8000) OtData.queueAction(this, "link", s)
        }
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            startActivity(launch)
        }
        finish()
    }
}
