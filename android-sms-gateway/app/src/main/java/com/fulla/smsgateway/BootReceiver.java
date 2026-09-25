package com.fulla.smsgateway;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.i(TAG, "Device rebooted. Checking if Fulla SMS Gateway was active...");

            SharedPreferences prefs = context.getSharedPreferences("FullaSmsGatewayPrefs", Context.MODE_PRIVATE);
            boolean wasEnabled = prefs.getBoolean("service_enabled", false);
            String serverUrl = prefs.getString("server_url", "");

            if (wasEnabled && !serverUrl.isEmpty()) {
                Log.i(TAG, "Auto-restarting Fulla SMS Gateway background service...");
                Intent serviceIntent = new Intent(context, SmsGatewayService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}
