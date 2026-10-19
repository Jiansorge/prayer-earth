package app.joiningpalms;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps a mediaPlayback foreground service alive while a prayer is active.
 *
 * Android 17's background audio hardening mutes any app that is neither
 * visible nor running a foreground service (the CONTROL_AUDIO app op: the
 * stream goes to mutedState=opControlAudio seconds after minimize, and audio
 * focus requests made from the background fail). The web layer cannot start a
 * service itself, so speech.js calls PrayerAudioPlugin.startPlayback() when a
 * job activates and stopPlayback() when it dies; this service is that bracket.
 *
 * The service deliberately does nothing else: no media session, no playback.
 * It exists purely to satisfy the lifecycle check while the WebView keeps
 * playing the recorded phrases and the ambient bed.
 */
public class PrayerPlaybackService extends Service {
    private static final String CHANNEL_ID = "prayer_playback";
    private static final int NOTIFICATION_ID = 7;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // IMPORTANCE_LOW: the notification appears silently (no sound, no
            // heads-up) and cannot be swiped away while the service runs - it
            // is a lifecycle marker, not a message for the user.
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.playback_channel),
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.playback_notification))
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build();
        // The type must be passed here as well as declared in the manifest:
        // startForeground without it throws on targetSdk 34+ and is silently
        // insufficient for the Android 17 check even when it does not.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        // Sticky so a low-memory kill of the service (process surviving)
        // restores the exemption instead of leaving the prayer muted again.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
