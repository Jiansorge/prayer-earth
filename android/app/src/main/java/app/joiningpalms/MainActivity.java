package app.joiningpalms;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register BEFORE super: BridgeActivity.onCreate builds the bridge at
        // its end (load() -> bridgeBuilder.create()), and registerPlugin only
        // feeds that builder. Called after super, the registration would be
        // accepted and silently dropped - the JS face would never reach native,
        // and the prayer would go quiet every time the app is backgrounded.
        registerPlugin(PrayerAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
