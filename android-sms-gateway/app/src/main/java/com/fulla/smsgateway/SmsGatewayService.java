package com.fulla.smsgateway;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class SmsGatewayService extends Service {
    private static final String TAG = "SmsGatewayService";
    private static final String CHANNEL_ID = "fulla_sms_gateway_channel";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_STATUS_UPDATE = "com.fulla.smsgateway.STATUS_UPDATE";
    public static final String EXTRA_STATUS = "extra_status";
    public static final String EXTRA_LOG = "extra_log";

    public static final String SENT_SMS_ACTION = "com.fulla.smsgateway.SMS_SENT";

    private PowerManager.WakeLock wakeLock;
    private OkHttpClient httpClient;
    private WebSocket webSocket;
    private Handler handler;
    private Runnable heartbeatRunnable;

    private String serverUrl = "";
    private String apiKey = "";
    private boolean isRunning = false;
    private int totalSent = 0;

    private BroadcastReceiver smsSentReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());

        createNotificationChannel();
        acquireWakeLock();

        httpClient = new OkHttpClient.Builder()
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(20, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();

        registerSmsReceiver();
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FullaSmsGateway::WakeLock");
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 24 hours max
        }
    }

    private void registerSmsReceiver() {
        smsSentReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String messageId = intent.getStringExtra("message_id");
                int resultCode = getResultCode();
                if (resultCode == android.app.Activity.RESULT_OK) {
                    totalSent++;
                    notifyLog("✅ SMS " + messageId + " dispatched to network successfully.");
                    reportSmsStatus(messageId, "SENT", null);
                } else {
                    String error = "Result code: " + resultCode;
                    notifyLog("❌ SMS " + messageId + " failed to send: " + error);
                    reportSmsStatus(messageId, "FAILED", error);
                }
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsSentReceiver, new IntentFilter(SENT_SMS_ACTION), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(smsSentReceiver, new IntentFilter(SENT_SMS_ACTION));
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification("Connecting to gateway server..."));

        SharedPreferences prefs = getSharedPreferences("FullaSmsGatewayPrefs", MODE_PRIVATE);
        serverUrl = prefs.getString("server_url", "").trim();
        apiKey = prefs.getString("api_key", "").trim();

        if (serverUrl.isEmpty()) {
            notifyLog("Error: Server URL is empty. Please configure in app.");
            updateNotification("Error: No server URL");
            return START_STICKY;
        }

        connectWebSocket();
        return START_STICKY;
    }

    private void connectWebSocket() {
        if (webSocket != null) {
            try {
                webSocket.close(1000, "Reconnecting");
            } catch (Exception ignored) {}
        }

        // Convert http/https to ws/wss
        String wsUrl = serverUrl;
        if (wsUrl.startsWith("http://")) {
            wsUrl = "ws://" + wsUrl.substring(7);
        } else if (wsUrl.startsWith("https://")) {
            wsUrl = "wss://" + wsUrl.substring(8);
        } else if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
            wsUrl = "ws://" + wsUrl;
        }

        if (wsUrl.endsWith("/")) {
            wsUrl = wsUrl.substring(0, wsUrl.length() - 1);
        }
        wsUrl += "/ws/sms-device";

        notifyLog("Connecting to: " + wsUrl);
        updateNotification("Connecting to " + wsUrl);

        Request request = new Request.Builder().url(wsUrl).build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                isRunning = true;
                notifyStatus("CONNECTED");
                notifyLog("🟢 Connected to Fulla Gateway Server!");
                updateNotification("🟢 Online & Ready to Send SMS");

                // Send Auth payload with device info
                sendAuthPayload();
                startHeartbeat();
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                handleIncomingMessage(text);
            }

            @Override
            public void onClosing(WebSocket ws, int code, String reason) {
                notifyLog("WebSocket closing: " + reason);
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                isRunning = false;
                notifyStatus("DISCONNECTED");
                notifyLog("🔴 Disconnected from server. Reconnecting in 5s...");
                updateNotification("🔴 Disconnected (Retrying...)");
                scheduleReconnect();
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, @Nullable Response response) {
                isRunning = false;
                notifyStatus("DISCONNECTED");
                notifyLog("⚠️ Connection error: " + t.getMessage());
                updateNotification("⚠️ Connection Error (Retrying...)");
                scheduleReconnect();
            }
        });
    }

    private void sendAuthPayload() {
        try {
            JSONObject auth = new JSONObject();
            auth.put("type", "AUTH");
            auth.put("apiKey", apiKey);

            JSONObject info = new JSONObject();
            info.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            info.put("androidVersion", Build.VERSION.RELEASE);
            info.put("battery", getBatteryLevel());
            info.put("carrier", getSimCarrier());

            auth.put("info", info);

            if (webSocket != null) {
                webSocket.send(auth.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to create auth payload", e);
        }
    }

    private void startHeartbeat() {
        stopHeartbeat();
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (webSocket != null && isRunning) {
                    try {
                        JSONObject hb = new JSONObject();
                        hb.put("type", "HEARTBEAT");

                        JSONObject info = new JSONObject();
                        info.put("battery", getBatteryLevel());
                        info.put("carrier", getSimCarrier());
                        hb.put("info", info);

                        webSocket.send(hb.toString());
                    } catch (Exception ignored) {}
                    handler.postDelayed(this, 20000);
                }
            }
        };
        handler.postDelayed(heartbeatRunnable, 20000);
    }

    private void stopHeartbeat() {
        if (heartbeatRunnable != null) {
            handler.removeCallbacks(heartbeatRunnable);
            heartbeatRunnable = null;
        }
    }

    private void scheduleReconnect() {
        stopHeartbeat();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                connectWebSocket();
            }
        }, 5000);
    }

    private void handleIncomingMessage(String text) {
        try {
            JSONObject json = new JSONObject(text);
            String type = json.optString("type", "");

            if ("SEND_SMS".equalsIgnoreCase(type) || "SEND_SMS".equalsIgnoreCase(json.optString("action", ""))) {
                String id = json.getString("id");
                String to = json.getString("to");
                String message = json.getString("message");

                notifyLog("📩 Received SMS request for: " + to);
                dispatchSms(id, to, message);
            } else if ("AUTH_SUCCESS".equalsIgnoreCase(type)) {
                notifyLog("✅ Server authorized device key!");
            } else if ("AUTH_FAILED".equalsIgnoreCase(type)) {
                notifyLog("❌ Server rejected API Key: " + json.optString("message", "Invalid key"));
                updateNotification("❌ Auth Failed: Check API Key");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling message", e);
        }
    }

    private void dispatchSms(String id, String to, String message) {
        try {
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            Intent sentIntent = new Intent(SENT_SMS_ACTION);
            sentIntent.putExtra("message_id", id);
            sentIntent.putExtra("recipient", to);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent piSent = PendingIntent.getBroadcast(this, (int) System.currentTimeMillis(), sentIntent, flags);

            // Handle long messages
            if (message.length() > 160) {
                ArrayList<String> parts = smsManager.divideMessage(message);
                ArrayList<PendingIntent> sentIntents = new ArrayList<>();
                for (int i = 0; i < parts.size(); i++) {
                    sentIntents.add(piSent);
                }
                smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, null);
            } else {
                smsManager.sendTextMessage(to, null, message, piSent, null);
            }

            notifyLog("📤 SMS handed off to SIM radio for " + to);
        } catch (Exception e) {
            notifyLog("❌ SMS Dispatch Exception: " + e.getMessage());
            reportSmsStatus(id, "FAILED", e.getMessage());
        }
    }

    private void reportSmsStatus(String id, String status, String error) {
        try {
            JSONObject res = new JSONObject();
            res.put("type", "SMS_STATUS");
            res.put("id", id);
            res.put("status", status);
            if (error != null) res.put("error", error);

            if (webSocket != null) {
                webSocket.send(res.toString());
            }
        } catch (Exception ignored) {}
    }

    private int getBatteryLevel() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
            return bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private String getSimCarrier() {
        try {
            TelephonyManager tm = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            if (tm != null) {
                String simOp = tm.getSimOperatorName();
                if (simOp != null && !simOp.trim().isEmpty()) return simOp;
                String netOp = tm.getNetworkOperatorName();
                if (netOp != null && !netOp.trim().isEmpty()) return netOp;
            }
            return "Cellular SIM";
        } catch (Exception e) {
            return "Active SIM";
        }
    }

    private void notifyStatus(String status) {
        Intent intent = new Intent(ACTION_STATUS_UPDATE);
        intent.putExtra(EXTRA_STATUS, status);
        sendBroadcast(intent);
    }

    private void notifyLog(String logMsg) {
        Intent intent = new Intent(ACTION_STATUS_UPDATE);
        intent.putExtra(EXTRA_LOG, logMsg);
        sendBroadcast(intent);
        Log.i(TAG, logMsg);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Fulla SMS Gateway Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains background connection to dispatch OTP SMS");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Fulla SMS Gateway")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(text));
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopHeartbeat();
        if (webSocket != null) {
            try {
                webSocket.close(1000, "Service stopped");
            } catch (Exception ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (smsSentReceiver != null) {
            try {
                unregisterReceiver(smsSentReceiver);
            } catch (Exception ignored) {}
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
