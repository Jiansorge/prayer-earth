package app.joiningpalms;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The JS face of the playback bracket: speech.js calls startPlayback() when a
 * prayer job activates and stopPlayback() when the job ends, and this starts /
 * stops PrayerPlaybackService. Registered in MainActivity - see the ordering
 * note there: the bridge is built inside super.onCreate, so a later
 * registration would be dropped silently.
 */
@CapacitorPlugin(name = "PrayerAudio")
public class PrayerAudioPlugin extends Plugin {

    @PluginMethod()
    public void startPlayback(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), PrayerPlaybackService.class);
            // startForegroundService on O+ so the system enforces the prompt
            // startForeground() call; the service does it in onStartCommand.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(i);
            } else {
                getContext().startService(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start the playback service", e);
        }
    }

    @PluginMethod()
    public void stopPlayback(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), PrayerPlaybackService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not stop the playback service", e);
        }
    }
}
