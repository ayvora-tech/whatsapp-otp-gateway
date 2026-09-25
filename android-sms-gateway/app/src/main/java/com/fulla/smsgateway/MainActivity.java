package com.fulla.smsgateway;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQ_CODE = 101;

    private EditText etServerUrl;
    private EditText etApiKey;
    private Button btnToggleService;
    private Button btnBatteryOpt;
    private TextView tvStatusBadge;
    private TextView tvCarrier;
    private TextView tvBattery;
    private TextView tvSentCount;
    private TextView tvLogs;

    private SharedPreferences prefs;
    private boolean isServiceActive = false;
    private int sentCounter = 0;
    private final StringBuilder logBuilder = new StringBuilder();

    private BroadcastReceiver statusReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("FullaSmsGatewayPrefs", MODE_PRIVATE);

        initViews();
        loadSavedConfig();
        checkAndRequestPermissions();
        updateDeviceTelemetry();
        checkBatteryOptimization();

        setupStatusReceiver();
    }

    private void initViews() {
        etServerUrl = findViewById(R.id.etServerUrl);
        etApiKey = findViewById(R.id.etApiKey);
        btnToggleService = findViewById(R.id.btnToggleService);
        btnBatteryOpt = findViewById(R.id.btnBatteryOpt);
        tvStatusBadge = findViewById(R.id.tvStatusBadge);
        tvCarrier = findViewById(R.id.tvCarrier);
        tvBattery = findViewById(R.id.tvBattery);
        tvSentCount = findViewById(R.id.tvSentCount);
        tvLogs = findViewById(R.id.tvLogs);

        btnToggleService.setOnClickListener(v -> toggleGatewayService());
        btnBatteryOpt.setOnClickListener(v -> requestIgnoreBatteryOptimization());
    }

    private void loadSavedConfig() {
        String savedUrl = prefs.getString("server_url", "http://192.168.1.100:3000");
        String savedKey = prefs.getString("api_key", "");
        isServiceActive = prefs.getBoolean("service_enabled", false);

        etServerUrl.setText(savedUrl);
        etApiKey.setText(savedKey);

        updateServiceButtonState();
    }

    private void saveConfig() {
        String url = etServerUrl.getText().toString().trim();
        String key = etApiKey.getText().toString().trim();

        prefs.edit()
                .putString("server_url", url)
                .putString("api_key", key)
                .putBoolean("service_enabled", isServiceActive)
                .apply();
    }

    private void toggleGatewayService() {
        if (!hasRequiredPermissions()) {
            Toast.makeText(this, "Please grant SMS and Phone permissions first", Toast.LENGTH_LONG).show();
            checkAndRequestPermissions();
            return;
        }

        String url = etServerUrl.getText().toString().trim();
        String key = etApiKey.getText().toString().trim();

        if (url.isEmpty()) {
            Toast.makeText(this, "Please enter your Server URL", Toast.LENGTH_SHORT).show();
            return;
        }

        if (key.isEmpty()) {
            Toast.makeText(this, "Please enter your API Key", Toast.LENGTH_SHORT).show();
            return;
        }

        if (!isServiceActive) {
            // Start service
            isServiceActive = true;
            saveConfig();

            Intent serviceIntent = new Intent(this, SmsGatewayService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }

            appendLog("Starting Fulla SMS Gateway background service...");
            Toast.makeText(this, "SMS Gateway service started", Toast.LENGTH_SHORT).show();
        } else {
            // Stop service
            isServiceActive = false;
            saveConfig();

            Intent serviceIntent = new Intent(this, SmsGatewayService.class);
            stopService(serviceIntent);

            tvStatusBadge.setText("Disconnected");
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.rose));
            appendLog("SMS Gateway service stopped.");
            Toast.makeText(this, "SMS Gateway service stopped", Toast.LENGTH_SHORT).show();
        }

        updateServiceButtonState();
    }

    private void updateServiceButtonState() {
        if (isServiceActive) {
            btnToggleService.setText("Disconnect Gateway");
            btnToggleService.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.rose));
            tvStatusBadge.setText("Active");
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.wa_green));
        } else {
            btnToggleService.setText("Connect & Start Gateway");
            btnToggleService.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.wa_green));
            tvStatusBadge.setText("Disconnected");
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.rose));
        }
    }

    private void setupStatusReceiver() {
        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent.hasExtra(SmsGatewayService.EXTRA_STATUS)) {
                    String status = intent.getStringExtra(SmsGatewayService.EXTRA_STATUS);
                    if ("CONNECTED".equals(status)) {
                        tvStatusBadge.setText("Connected");
                        tvStatusBadge.setTextColor(ContextCompat.getColor(MainActivity.this, R.color.wa_green));
                    } else if ("DISCONNECTED".equals(status)) {
                        tvStatusBadge.setText("Disconnected");
                        tvStatusBadge.setTextColor(ContextCompat.getColor(MainActivity.this, R.color.rose));
                    }
                }

                if (intent.hasExtra(SmsGatewayService.EXTRA_LOG)) {
                    String log = intent.getStringExtra(SmsGatewayService.EXTRA_LOG);
                    if (log != null && log.contains("dispatched to network successfully")) {
                        sentCounter++;
                        tvSentCount.setText(String.valueOf(sentCounter));
                    }
                    appendLog(log);
                }

                updateDeviceTelemetry();
            }
        };

        IntentFilter filter = new IntentFilter(SmsGatewayService.ACTION_STATUS_UPDATE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(statusReceiver, filter);
        }
    }

    private void appendLog(String message) {
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        logBuilder.insert(0, "[" + time + "] " + message + "\n");
        // Keep logs under 3000 chars
        if (logBuilder.length() > 3000) {
            logBuilder.setLength(3000);
        }
        tvLogs.setText(logBuilder.toString());
    }

    private void updateDeviceTelemetry() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
            int level = bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : -1;
            tvBattery.setText(level >= 0 ? level + "%" : "Unknown");
        } catch (Exception ignored) {}

        try {
            TelephonyManager tm = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            if (tm != null) {
                String simOp = tm.getSimOperatorName();
                if (simOp != null && !simOp.trim().isEmpty()) {
                    tvCarrier.setText(simOp);
                    return;
                }
                String netOp = tm.getNetworkOperatorName();
                if (netOp != null && !netOp.trim().isEmpty()) {
                    tvCarrier.setText(netOp);
                    return;
                }
            }
            tvCarrier.setText("Cellular SIM");
        } catch (Exception e) {
            tvCarrier.setText("Active SIM");
        }
    }

    private boolean hasRequiredPermissions() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private void checkAndRequestPermissions() {
        List<String> needed = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.SEND_SMS);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.READ_PHONE_STATE);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            boolean allGranted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted) {
                appendLog("✅ All SMS & Phone permissions granted.");
                updateDeviceTelemetry();
            } else {
                appendLog("⚠️ Permission was denied. SMS sending requires SMS permission.");
            }
        }
    }

    private void checkBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) {
                btnBatteryOpt.setText("✅ Battery Optimization Disabled (Active)");
                btnBatteryOpt.setEnabled(false);
                btnBatteryOpt.setTextColor(ContextCompat.getColor(this, R.color.wa_green));
            }
        }
    }

    @SuppressLint("BatteryLife")
    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(this, "Unable to open battery optimization settings: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkBatteryOptimization();
        updateDeviceTelemetry();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (statusReceiver != null) {
            try {
                unregisterReceiver(statusReceiver);
            } catch (Exception ignored) {}
        }
    }
}
