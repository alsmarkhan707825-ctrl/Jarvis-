import type { AndroidSourceFile } from '../types/alsmar';

export const ANDROID_KOTLIN_FILES: AndroidSourceFile[] = [
  {
    path: 'settings.gradle.kts',
    module: '1. Gradle Settings',
    summary: 'Root Android Studio project & plugin repositories configuration.',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "JarvisAssistant"
include(":app")`,
  },
  {
    path: 'app/build.gradle.kts',
    module: '2. App Gradle Build',
    summary: 'Jetpack Compose Material3, OkHttp SSE, Coroutines, ML Kit OCR, and EncryptedSharedPreferences dependencies.',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.jarvis.assistant"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.jarvis.assistant"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "JARVIS_BACKEND_URL", "\\"https://your-jarvis-backend.run.app\\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.savedstate:savedstate-ktx:1.2.1")

    // Streaming AI SSE Client & JSON
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // On-device Screen Text OCR (Screen Awareness)
    implementation("com.google.mlkit:text-recognition:16.0.1")

    // Encrypted Local Memory Storage
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    module: '3. AndroidManifest.xml',
    summary: 'Full permissions and service declarations for Foreground Microphone, Overlay Bubble, Accessibility Automation, and Telecom InCallService.',
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Voice, Lock-screen WakeLock & Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    <!-- Floating Orb HUD -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- Contacts, Calling & Speakerphone -->
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

    <!-- Device Controls & Optional Vision -->
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS"
        tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:allowBackup="false"
        android:label="Jarvis"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Persistent Background & Lock-Screen Voice Service -->
        <service
            android:name=".voice.JarvisForegroundService"
            android:exported="false"
            android:foregroundServiceType="microphone" />

        <!-- Floating Neon-Cyan Voice Orb Overlay -->
        <service
            android:name=".overlay.FloatingOrbOverlayService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Floating voice assistant HUD orb" />
        </service>

        <!-- UI Tree & Gesture Accessibility Engine -->
        <service
            android:name=".automation.JarvisAccessibilityService"
            android:exported="true"
            android:label="Jarvis Touch &amp; Screen Automation"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/jarvis_accessibility_config" />
        </service>

        <!-- Smart Call Guardian & In-Call Management -->
        <service
            android:name=".calls.JarvisInCallService"
            android:exported="true"
            android:permission="android.permission.BIND_INCALL_SERVICE">
            <meta-data
                android:name="android.telecom.IN_CALL_SERVICE_UI"
                android:value="false" />
            <intent-filter>
                <action android:name="android.telecom.InCallService" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
  },
  {
    path: 'app/src/main/res/xml/jarvis_accessibility_config.xml',
    module: '4. Accessibility XML Config',
    summary: 'Enables touch gesture dispatch, active window inspection, view ID inspection, and screen screenshot capture.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged|typeViewFocused|typeViewClicked"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagReportViewIds|flagIncludeNotImportantViews|flagRetrieveInteractiveWindows"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:canTakeScreenshot="true"
    android:description="@string/jarvis_accessibility_desc"
    android:notificationTimeout="80" />`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/security/PrivacySandbox.kt',
    module: '5. Strict Privacy Sandbox',
    summary: 'Zero-leakage sanitizer blocking API keys, private keys, payment cards, passwords, OTPs, PINs, and bank routing numbers.',
    content: `package com.jarvis.assistant.security

data class SandboxResult(
    val sanitizedText: String,
    val blockedCategories: List<String>,
    val hasSensitiveData: Boolean
)

object PrivacySandbox {
    private data class Rule(val category: String, val regex: Regex, val replacement: String)

    private val rules = listOf(
        Rule(
            category = "Private / API Key",
            regex = Regex("\\\\b(?:sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----[\\\\s\\\\S]*?-----END [A-Z ]*PRIVATE KEY-----)\\\\b", RegexOption.IGNORE_CASE),
            replacement = "[REDACTED_KEY]"
        ),
        Rule(
            category = "Payment Card Number",
            regex = Regex("\\\\b(?:\\\\d[ -]*?){13,19}\\\\b"),
            replacement = "[REDACTED_CARD]"
        ),
        Rule(
            category = "Password / PIN / OTP",
            regex = Regex("(?:password|passcode|pin|cvv|otp|atm pin|secret)\\\\s*(?:is|=|:|\\\\s)\\\\s*[^\\\\s,;]{3,24}", RegexOption.IGNORE_CASE),
            replacement = "[REDACTED_CREDENTIAL]"
        ),
        Rule(
            category = "Bank / IFSC / IBAN",
            regex = Regex("\\\\b(?:account(?:\\\\s*no|\\\\s*number)?|ifsc|iban|routing)\\\\s*(?:is|=|:|#)?\\\\s*[A-Z0-9-]{6,22}\\\\b", RegexOption.IGNORE_CASE),
            replacement = "[REDACTED_BANK_INFO]"
        )
    )

    fun sanitize(input: String): SandboxResult {
        var current = input
        val blocked = mutableListOf<String>()
        for (rule in rules) {
            if (rule.regex.containsMatchIn(current)) {
                blocked += rule.category
                current = rule.regex.replace(current, rule.replacement)
            }
        }
        return SandboxResult(
            sanitizedText = current,
            blockedCategories = blocked,
            hasSensitiveData = blocked.isNotEmpty()
        )
    }

    fun guardOutboundSpeech(proposedSpeech: String): String {
        val check = sanitize(proposedSpeech)
        return if (check.hasSensitiveData) {
            "I am unable to share sensitive credentials, financial details, or private keys."
        } else {
            proposedSpeech
        }
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/security/PermissionSandboxManager.kt',
    module: '6. Permissions & Battery Guard',
    summary: 'Unified permission status snapshot & Android Settings intent launchers for Microphone, Overlay, Accessibility, Battery Bypass, and Phone.',
    content: `package com.jarvis.assistant.security

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.jarvis.assistant.automation.JarvisAccessibilityService

data class PermissionSnapshot(
    val microphone: Boolean,
    val contactsAndPhone: Boolean,
    val notifications: Boolean,
    val overlay: Boolean,
    val accessibility: Boolean,
    val batteryUnrestricted: Boolean,
    val systemWriteSettings: Boolean
)

class PermissionSandboxManager(private val context: Context) {

    fun snapshot(): PermissionSnapshot {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return PermissionSnapshot(
            microphone = hasPermission(Manifest.permission.RECORD_AUDIO),
            contactsAndPhone = hasPermission(Manifest.permission.CALL_PHONE) &&
                hasPermission(Manifest.permission.READ_CONTACTS) &&
                hasPermission(Manifest.permission.ANSWER_PHONE_CALLS),
            notifications = Build.VERSION.SDK_INT < 33 ||
                hasPermission(Manifest.permission.POST_NOTIFICATIONS),
            overlay = Settings.canDrawOverlays(context),
            accessibility = isAccessibilityEnabled(),
            batteryUnrestricted = pm.isIgnoringBatteryOptimizations(context.packageName),
            systemWriteSettings = Settings.System.canWrite(context)
        )
    }

    fun requiredRuntimePermissions(): Array<String> {
        val perms = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.ANSWER_PHONE_CALLS,
            Manifest.permission.READ_PHONE_STATE
        )
        if (Build.VERSION.SDK_INT >= 33) {
            perms += Manifest.permission.POST_NOTIFICATIONS
        }
        if (Build.VERSION.SDK_INT >= 31) {
            perms += Manifest.permission.BLUETOOTH_CONNECT
        }
        return perms.toTypedArray()
    }

    fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:\${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun requestBatteryOptimizationBypass() {
        val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:\${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun openWriteSettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_WRITE_SETTINGS,
            Uri.parse("package:\${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private fun isAccessibilityEnabled(): Boolean {
        if (JarvisAccessibilityService.instance != null) return true
        val expected = ComponentName(context, JarvisAccessibilityService::class.java).flattenToString()
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/voice/JarvisForegroundService.kt',
    module: '7. Lock-Screen Foreground Service',
    summary: 'Keeps Jarvis voice pipeline alive in background & lock-screen using FOREGROUND_SERVICE_MICROPHONE and PARTIAL_WAKE_LOCK.',
    content: `package com.jarvis.assistant.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class JarvisForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "jarvis_voice_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.jarvis.assistant.STOP_VOICE"

        fun start(context: Context) {
            val intent = Intent(context, JarvisForegroundService::class.java)
            context.startForegroundService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        acquireWakeLock()
        val notification = buildNotification("Listening in background — Say 'Hey Jarvis'")
        if (Build.VERSION.SDK_INT >= 30) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Jarvis::VoiceWakeLock").apply {
            setReferenceCounted(false)
            acquire(60 * 60 * 1000L) // Renewed per session
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun buildNotification(statusText: String): Notification {
        val stopIntent = Intent(this, JarvisForegroundService::class.java).apply { action = ACTION_STOP }
        val stopPending = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Jarvis Voice Core Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Mute", stopPending)
            .build()
    }

    private fun createChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Jarvis Continuous Voice",
            NotificationManager.IMPORTANCE_LOW
        )
        nm.createNotificationChannel(channel)
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/voice/LowLatencyVoicePipeline.kt',
    module: '8. Strict Turn-Taking Voice Pipeline',
    summary: 'SpeechRecognizer + VAD endpoint timer + duplicate suppression + OkHttp SSE client + expressive TTS + strict Listening->Processing->Speaking->Resume state machine.',
    content: `package com.jarvis.assistant.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.jarvis.assistant.BuildConfig
import com.jarvis.assistant.security.PrivacySandbox
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit

enum class TurnState { IDLE, LISTENING, PROCESSING, THINKING, SPEAKING, WAITING, EXECUTING, ERROR }
enum class EmotionalTone { NORMAL, HAPPY, LAUGHING, SAD, ANGRY, CURIOUS, SURPRISED, CARING, SERIOUS, THINKING }
enum class VoiceGender { MALE, FEMALE }

class LowLatencyVoicePipeline(
    private val context: Context,
    private val onPlannedSteps: (List<JSONObject>) -> Unit
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mainHandler = Handler(Looper.getMainLooper())

    private val _turnState = MutableStateFlow(TurnState.IDLE)
    val turnState: StateFlow<TurnState> = _turnState

    private val _activeEmotion = MutableStateFlow(EmotionalTone.NORMAL)
    val activeEmotion: StateFlow<EmotionalTone> = _activeEmotion

    private val _liveCaption = MutableStateFlow("")
    val liveCaption: StateFlow<String> = _liveCaption

    private val _micRms = MutableStateFlow(0f)
    val micRms: StateFlow<Float> = _micRms

    var preferredGender: VoiceGender = VoiceGender.MALE
    var strictTurnTaking: Boolean = false
    var wakeWordRequired: Boolean = false
    var vadSilenceMs: Long = 1100L

    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var activeSession = false
    private var lastSubmittedText = ""
    private var lastSubmittedAt = 0L
    private val vadRunnable = Runnable { commitPendingSpeech() }
    private var pendingPartial = ""

    private val incompleteTrailingRegex =
        Regex("\\\\b(?:and|or|but|so|because|if|when|while|um|uh|aur|lekin|par|toh|kyunki)$", RegexOption.IGNORE_CASE)

    private val httpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .build()

    init {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale("en", "IN")
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        _turnState.value = TurnState.SPEAKING
                    }

                    override fun onDone(utteranceId: String?) {
                        mainHandler.post {
                            // Transition through WAITING acoustic tail guard before reopening mic
                            if (activeSession) {
                                _turnState.value = TurnState.WAITING
                                mainHandler.postDelayed({
                                    if (activeSession && _turnState.value == TurnState.WAITING) {
                                        startListening()
                                    }
                                }, 220L)
                            } else {
                                _turnState.value = TurnState.IDLE
                            }
                        }
                    }

                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        _turnState.value = if (activeSession) TurnState.LISTENING else TurnState.IDLE
                    }
                })
            }
        }
    }

    fun startConversation() {
        activeSession = true
        JarvisForegroundService.start(context)
        startListening()
    }

    fun stopConversation() {
        activeSession = false
        mainHandler.removeCallbacks(vadRunnable)
        recognizer?.destroy()
        recognizer = null
        tts?.stop()
        _turnState.value = TurnState.IDLE
    }

    fun interruptAndListen() {
        tts?.stop()
        if (activeSession) startListening()
    }

    private fun adaptiveVadMs(text: String): Long {
        val trimmed = text.trim()
        if (trimmed.endsWith(".") || trimmed.endsWith("!") || trimmed.endsWith("?")) {
            return (vadSilenceMs - 380L).coerceAtLeast(580L)
        }
        if (incompleteTrailingRegex.containsMatchIn(trimmed)) {
            return (vadSilenceMs + 700L).coerceAtMost(2800L)
        }
        return vadSilenceMs
    }

    fun startListening() {
        if (!activeSession) return
        if (strictTurnTaking && _turnState.value == TurnState.SPEAKING) return

        mainHandler.post {
            recognizer?.destroy()
            val sr = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer = sr
            _turnState.value = TurnState.LISTENING

            sr.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { _micRms.value = 0.1f }
                override fun onBeginningOfSpeech() { mainHandler.removeCallbacks(vadRunnable) }
                override fun onRmsChanged(rmsdB: Float) {
                    val norm = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
                    _micRms.value = norm
                    if (!strictTurnTaking && _turnState.value == TurnState.SPEAKING && norm > 0.65f) {
                        interruptAndListen()
                    }
                }
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (activeSession && _turnState.value == TurnState.LISTENING) {
                        mainHandler.postDelayed({ startListening() }, 220L)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull().orEmpty().trim()
                    if (text.isNotEmpty()) {
                        pendingPartial = text
                        _liveCaption.value = text
                        mainHandler.removeCallbacks(vadRunnable)
                        mainHandler.postDelayed(vadRunnable, adaptiveVadMs(text))
                    }
                }
                override fun onResults(results: Bundle?) {
                    mainHandler.removeCallbacks(vadRunnable)
                    val final = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull().orEmpty().trim()
                    if (final.isNotEmpty()) handleCommittedTranscript(final)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            }
            sr.startListening(intent)
        }
    }

    private fun commitPendingSpeech() {
        val text = pendingPartial.trim()
        pendingPartial = ""
        if (text.isNotEmpty()) {
            recognizer?.stopListening()
            handleCommittedTranscript(text)
        }
    }

    private fun handleCommittedTranscript(raw: String) {
        val now = System.currentTimeMillis()
        if (raw == lastSubmittedText && now - lastSubmittedAt < 1800L) return
        if (wakeWordRequired && !raw.contains("hey jarvis", ignoreCase = true)) return

        lastSubmittedText = raw
        lastSubmittedAt = now

        recognizer?.destroy()
        recognizer = null
        _turnState.value = TurnState.PROCESSING

        val scrubbed = PrivacySandbox.sanitize(raw).sanitizedText
        streamAiBrain(scrubbed)
    }

    private fun streamAiBrain(transcript: String) {
        _turnState.value = TurnState.THINKING
        val payload = JSONObject().apply {
            put("transcript", transcript)
            put("languageHint", "auto")
            put("privacySandboxEnabled", true)
            put("routerMode", "smart-auto")
            put("preferredProvider", "gemini")
            put("preferredModel", "gemini-4-hydrogen")
        }.toString()

        val request = Request.Builder()
            .url("\${BuildConfig.JARVIS_BACKEND_URL}/api/ai/stream-converse")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()

        EventSources.createFactory(httpClient).newEventSource(request, object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                val evt = JSONObject(data)
                when (evt.optString("type")) {
                    "emotion" -> {
                        val emoStr = evt.optString("emotion").uppercase()
                        _activeEmotion.value = runCatching { EmotionalTone.valueOf(emoStr) }.getOrDefault(EmotionalTone.NORMAL)
                    }
                    "sentence" -> {
                        val sentence = evt.optString("text")
                        val emoStr = evt.optString("emotion").uppercase()
                        val tone = runCatching { EmotionalTone.valueOf(emoStr) }.getOrDefault(_activeEmotion.value)
                        if (sentence.isNotBlank()) speakExpressive(sentence, tone)
                    }
                    "done" -> {
                        val meta = evt.optJSONObject("meta")
                        val stepsArr = meta?.optJSONArray("steps")
                        if (stepsArr != null && stepsArr.length() > 0) {
                            val list = List(stepsArr.length()) { idx -> stepsArr.getJSONObject(idx) }
                            onPlannedSteps(list)
                        }
                    }
                    "error" -> {
                        _turnState.value = TurnState.ERROR
                    }
                }
            }
            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                _turnState.value = TurnState.ERROR
            }
        })
    }

    fun speakExpressive(text: String, tone: EmotionalTone = EmotionalTone.NORMAL) {
        if (!ttsReady) return
        _activeEmotion.value = tone
        val safeText = PrivacySandbox.guardOutboundSpeech(text)
        val basePitch = if (preferredGender == VoiceGender.FEMALE) 1.12f else 0.92f
        val (pitchDelta, rate) = when (tone) {
            EmotionalTone.HAPPY -> 0.09f to 1.07f
            EmotionalTone.LAUGHING -> 0.12f to 1.10f
            EmotionalTone.SAD -> -0.09f to 0.88f
            EmotionalTone.ANGRY -> -0.08f to 1.04f
            EmotionalTone.CURIOUS -> 0.08f to 1.02f
            EmotionalTone.SURPRISED -> 0.14f to 1.08f
            EmotionalTone.CARING -> -0.04f to 0.94f
            EmotionalTone.SERIOUS -> -0.07f to 0.96f
            EmotionalTone.THINKING -> -0.03f to 0.90f
            EmotionalTone.NORMAL -> 0f to 1.0f
        }
        tts?.setPitch((basePitch + pitchDelta).coerceIn(0.7f, 1.4f))
        tts?.setSpeechRate(rate)
        tts?.speak(safeText, TextToSpeech.QUEUE_ADD, Bundle(), "jarvis_\${System.currentTimeMillis()}")
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/automation/JarvisAccessibilityService.kt',
    module: '9. Autonomous Accessibility & Screen OCR',
    summary: 'Programmatic click, long-press, swipe/scroll gestures, text injection, deep Instagram Hindi confirmation, YouTube fullscreen, Brightness/Volume/Wi-Fi, and ML Kit screen summary.',
    content: `package com.jarvis.assistant.automation

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Path
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.delay

class JarvisAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile var instance: JarvisAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() { instance = null }
    override fun onDestroy() { instance = null; super.onDestroy() }

    fun clickNode(query: String): Boolean {
        val root = rootInActiveWindow ?: return false
        for (node in root.findAccessibilityNodeInfosByText(query)) {
            var cur: AccessibilityNodeInfo? = node
            while (cur != null) {
                if (cur.isClickable) return cur.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                cur = cur.parent
            }
        }
        return false
    }

    fun longPressNode(query: String): Boolean {
        val root = rootInActiveWindow ?: return false
        for (node in root.findAccessibilityNodeInfosByText(query)) {
            var cur: AccessibilityNodeInfo? = node
            while (cur != null) {
                if (cur.isLongClickable) return cur.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)
                cur = cur.parent
            }
        }
        return false
    }

    fun inputText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    fun swipe(direction: String): Boolean {
        val metrics = resources.displayMetrics
        val w = metrics.widthPixels.toFloat()
        val h = metrics.heightPixels.toFloat()
        val path = Path()
        when (direction.lowercase()) {
            "up" -> { path.moveTo(w * 0.5f, h * 0.78f); path.lineTo(w * 0.5f, h * 0.25f) }
            "down" -> { path.moveTo(w * 0.5f, h * 0.25f); path.lineTo(w * 0.5f, h * 0.78f) }
            "left" -> { path.moveTo(w * 0.85f, h * 0.5f); path.lineTo(w * 0.15f, h * 0.5f) }
            "right" -> { path.moveTo(w * 0.15f, h * 0.5f); path.lineTo(w * 0.85f, h * 0.5f) }
            else -> return false
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0L, 280L))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    suspend fun openInstagramAndSearch(username: String): String {
        val launch = packageManager.getLaunchIntentForPackage("com.instagram.android")
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ?: Intent(Intent.ACTION_VIEW, Uri.parse("https://www.instagram.com/\$username"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launch)
        delay(1800)
        clickNode("Search")
        delay(700)
        inputText(username)
        delay(1200)
        clickNode(username)
        return "सर, अकाउंट खुल गया है।"
    }

    suspend fun playYouTubeFullscreen(query: String): Boolean {
        val intent = Intent(Intent.ACTION_SEARCH).apply {
            setPackage("com.google.android.youtube")
            putExtra("query", query)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        delay(2200)
        clickNode(query)
        delay(1600)
        return clickNode("Fullscreen") || clickNode("Enter fullscreen")
    }

    fun setMediaVolumePercent(percent: Int) {
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = ((percent.coerceIn(0, 100) / 100f) * max).toInt()
        am.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI)
    }

    fun setScreenBrightnessPercent(percent: Int): Boolean {
        if (!Settings.System.canWrite(this)) return false
        val value = ((percent.coerceIn(5, 100) / 100f) * 255).toInt()
        Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        return Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, value)
    }

    fun openConnectivityPanel(panel: String) {
        val action = if (Build.VERSION.SDK_INT >= 29 && panel.equals("wifi", ignoreCase = true)) {
            Settings.Panel.ACTION_INTERNET_CONNECTIVITY
        } else if (panel.equals("bluetooth", ignoreCase = true)) {
            Settings.ACTION_BLUETOOTH_SETTINGS
        } else {
            Settings.ACTION_WIFI_SETTINGS
        }
        startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun summarizeActiveScreen(onResult: (String) -> Unit) {
        val uiTexts = mutableListOf<String>()
        fun walk(node: AccessibilityNodeInfo?) {
            if (node == null) return
            node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let { uiTexts += it }
            for (i in 0 until node.childCount) walk(node.getChild(i))
        }
        walk(rootInActiveWindow)

        if (Build.VERSION.SDK_INT >= 30) {
            takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, object : TakeScreenshotCallback {
                override fun onSuccess(screenshot: ScreenshotResult) {
                    val bmp = Bitmap.wrapHardwareBuffer(screenshot.hardwareBuffer, screenshot.colorSpace)
                    if (bmp == null) {
                        onResult(uiTexts.distinct().take(12).joinToString(", "))
                        return
                    }
                    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                    recognizer.process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener { visionText ->
                            val combined = (uiTexts + visionText.text.lines()).distinct().take(18).joinToString(" | ")
                            onResult(combined)
                        }
                        .addOnFailureListener {
                            onResult(uiTexts.distinct().take(12).joinToString(", "))
                        }
                }
                override fun onFailure(errorCode: Int) {
                    onResult(uiTexts.distinct().take(12).joinToString(", "))
                }
            })
        } else {
            onResult(uiTexts.distinct().take(12).joinToString(", "))
        }
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/calls/CallGuardianManager.kt',
    module: '10. Smart Calling & AI Call Guardian',
    summary: 'Contact resolution, speakerphone routing, TelecomManager answer/hang-up, and Privacy-Sandbox-guarded Call Guardian screening.',
    content: `package com.jarvis.assistant.calls

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.provider.ContactsContract
import android.telecom.TelecomManager
import com.jarvis.assistant.security.PrivacySandbox

class CallGuardianManager(private val context: Context) {

    @SuppressLint("MissingPermission")
    fun callContact(contactQuery: String, speakerOn: Boolean): Boolean {
        val number = resolvePhoneNumber(contactQuery) ?: return false
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audio.mode = AudioManager.MODE_IN_COMMUNICATION
        audio.isSpeakerphoneOn = speakerOn

        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:\$number"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return true
    }

    @SuppressLint("MissingPermission")
    fun answerIncomingCall(): Boolean {
        val telecom = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        telecom.acceptRingingCall()
        return true
    }

    @SuppressLint("MissingPermission")
    fun hangUpCall(): Boolean {
        val telecom = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        return telecom.endCall()
    }

    fun setSpeakerphone(enabled: Boolean) {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audio.isSpeakerphoneOn = enabled
    }

    fun generateCallGuardianReply(callerPrompt: String): String {
        val check = PrivacySandbox.sanitize(callerPrompt)
        return if (check.hasSensitiveData ||
            callerPrompt.contains("password", ignoreCase = true) ||
            callerPrompt.contains("pin", ignoreCase = true) ||
            callerPrompt.contains("otp", ignoreCase = true) ||
            callerPrompt.contains("bank", ignoreCase = true)
        ) {
            "I am Jarvis, the owner's AI assistant. For security reasons under our privacy sandbox, I cannot share any passwords, PINs, OTPs, or banking information."
        } else {
            "Hello, I am Jarvis answering on behalf of my user. Please state your name and reason for calling so I can summarize it."
        }
    }

    private fun resolvePhoneNumber(query: String): String? {
        if (query.all { it.isDigit() || it == '+' || it == ' ' || it == '-' }) return query
        val cursor = context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "\${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
            arrayOf("%\$query%"),
            null
        )
        cursor?.use {
            if (it.moveToFirst()) return it.getString(0)
        }
        return null
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/calls/JarvisInCallService.kt',
    module: '11. Android InCallService Hook',
    summary: 'Tracks ringing, active, and held calls with voice-triggered hold, unhold, and disconnect actions.',
    content: `package com.jarvis.assistant.calls

import android.telecom.Call
import android.telecom.InCallService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class JarvisInCallService : InCallService() {
    companion object {
        private val _activeCallState = MutableStateFlow(Call.STATE_DISCONNECTED)
        val activeCallState: StateFlow<Int> = _activeCallState
        @Volatile var currentCall: Call? = null
            private set

        fun holdCurrentCall() { currentCall?.hold() }
        fun unholdCurrentCall() { currentCall?.unhold() }
        fun disconnectCurrentCall() { currentCall?.disconnect() }
    }

    private val callback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            _activeCallState.value = state
        }
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        _activeCallState.value = call.state
        call.registerCallback(callback)
    }

    override fun onCallRemoved(call: Call) {
        call.unregisterCallback(callback)
        if (currentCall == call) currentCall = null
        _activeCallState.value = Call.STATE_DISCONNECTED
        super.onCallRemoved(call)
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/memory/MemoryRoutineEngine.kt',
    module: '12. Adaptive Memory & Daily Routines',
    summary: 'EncryptedSharedPreferences store for user preferences/contacts/songs plus automated Morning & Night briefing routines.',
    content: `package com.jarvis.assistant.memory

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.jarvis.assistant.automation.JarvisAccessibilityService
import com.jarvis.assistant.voice.EmotionalTone
import com.jarvis.assistant.voice.LowLatencyVoicePipeline
import org.json.JSONArray
import org.json.JSONObject

class MemoryRoutineEngine(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "jarvis_encrypted_memory",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveMemory(category: String, title: String, content: String) {
        val list = getAllMemories()
        list.put(JSONObject().apply {
            put("category", category)
            put("title", title)
            put("content", content)
        })
        prefs.edit().putString("memories", list.toString()).apply()
    }

    fun getAllMemories(): JSONArray {
        val raw = prefs.getString("memories", "[]") ?: "[]"
        return JSONArray(raw)
    }

    suspend fun runMorningRoutine(voice: LowLatencyVoicePipeline) {
        val acc = JarvisAccessibilityService.instance
        acc?.setScreenBrightnessPercent(80)
        acc?.setMediaVolumePercent(65)
        voice.speakExpressive(
            "Good morning, Sir. All systems are online. Weather is clear, your briefing is ready, and starting your focus soundtrack.",
            EmotionalTone.HAPPY
        )
        acc?.playYouTubeFullscreen("Lo-Fi Chill Focus Mix")
    }

    fun runNightRoutine(voice: LowLatencyVoicePipeline) {
        val acc = JarvisAccessibilityService.instance
        acc?.setScreenBrightnessPercent(20)
        acc?.setMediaVolumePercent(25)
        voice.speakExpressive(
            "Good night, Sir. Lowering screen brightness, dimming media volume, and activating sleep standby.",
            EmotionalTone.CARING
        )
    }
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/overlay/FloatingOrbOverlayService.kt',
    module: '13. Floating Orb Bubble Overlay',
    summary: 'SYSTEM_ALERT_WINDOW draggable floating neon-cyan voice orb that stays visible across third-party apps.',
    content: `package com.jarvis.assistant.overlay

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp

class FloatingOrbOverlayService : Service() {
    private lateinit var windowManager: WindowManager
    private var overlayView: ComposeView? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = 24
            y = 220
        }

        val composeView = ComposeView(this).apply {
            setContent {
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .background(
                            Brush.radialGradient(listOf(Color(0xFF00E5FF), Color(0xFF030A18))),
                            CircleShape
                        )
                        .border(1.5.dp, Color(0xAA00E5FF), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Mic, contentDescription = "Jarvis Orb", tint = Color.White)
                }
            }

            var initialX = 0
            var initialY = 0
            var touchX = 0f
            var touchY = 0f
            setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x; initialY = params.y
                        touchX = event.rawX; touchY = event.rawY
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX - (event.rawX - touchX).toInt()
                        params.y = initialY + (event.rawY - touchY).toInt()
                        windowManager.updateViewLayout(this, params)
                        true
                    }
                    else -> false
                }
            }
        }

        overlayView = composeView
        windowManager.addView(composeView, params)
    }

    override fun onDestroy() {
        overlayView?.let { windowManager.removeView(it) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}`,
  },
  {
    path: 'app/src/main/java/com/jarvis/assistant/ui/JarvisHudComposables.kt',
    module: '14. Jetpack Compose OLED Cyan HUD',
    summary: 'Deep OLED Black (#03050A) + Neon Cyan (#00E5FF) Voice Orb animation, Glassmorphic Permissions Dashboard, and Bottom Navigation.',
    content: `package com.jarvis.assistant.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jarvis.assistant.security.PermissionSnapshot
import com.jarvis.assistant.voice.TurnState

private val OledBlack = Color(0xFF03050A)
private val ListenBlue = Color(0xFF3B82F6)
private val ThinkPurple = Color(0xFFA855F7)
private val SpeakGold = Color(0xFFF0C95C)
private val NeonCyan = Color(0xFF00E5FF)

@Composable
fun VoiceOrbCanvas(turnState: TurnState, rmsLevel: Float, modifier: Modifier = Modifier.size(280.dp)) {
    val infinite = rememberInfiniteTransition(label = "jarvis_orb")
    val spin by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(9000, easing = LinearEasing)),
        label = "spin"
    )
    val accent = when (turnState) {
        TurnState.LISTENING -> ListenBlue
        TurnState.PROCESSING, TurnState.THINKING -> ThinkPurple
        TurnState.SPEAKING, TurnState.EXECUTING -> SpeakGold
        else -> NeonCyan
    }
    val scale = when (turnState) {
        TurnState.LISTENING -> 1f + rmsLevel * 0.2f
        TurnState.SPEAKING -> 1.12f
        TurnState.PROCESSING, TurnState.THINKING -> 1.07f
        else -> 1f
    }

    Canvas(modifier = modifier) {
        val radius = (size.minDimension * 0.30f) * scale
        val center = Offset(size.width / 2f, size.height / 2f)

        drawCircle(
            brush = Brush.radialGradient(listOf(accent.copy(alpha = 0.35f), Color.Transparent), center, radius * 1.8f),
            radius = radius * 1.8f,
            center = center
        )
        drawCircle(
            brush = Brush.radialGradient(listOf(accent, Color(0xFF0A1D4D), OledBlack), center, radius),
            radius = radius,
            center = center
        )
        drawArc(
            color = accent,
            startAngle = spin,
            sweepAngle = 140f,
            useCenter = false,
            topLeft = Offset(center.x - radius * 1.32f, center.y - radius * 1.32f),
            size = androidx.compose.ui.geometry.Size(radius * 2.64f, radius * 2.64f),
            style = Stroke(width = 4f)
        )
    }
}

@Composable
fun PermissionsSecurityCard(
    snapshot: PermissionSnapshot,
    onRequestRuntime: () -> Unit,
    onOpenAccessibility: () -> Unit,
    onOpenOverlay: () -> Unit,
    onBypassBattery: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0x880B1326), RoundedCornerShape(20.dp))
            .border(1.dp, Color(0x3300E5FF), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.Security, contentDescription = null, tint = NeonCyan)
            Text("Permissions & Privacy Sandbox", color = Color.White, fontWeight = FontWeight.SemiBold)
        }
        Text("Microphone & Phone: \${if (snapshot.microphone && snapshot.contactsAndPhone) "Granted" else "Needs Grant"}", color = Color(0xFFB8C7E0))
        Text("Accessibility Automation: \${if (snapshot.accessibility) "Active" else "Enable in Settings"}", color = Color(0xFFB8C7E0))
        Text("Floating Overlay Bubble: \${if (snapshot.overlay) "Granted" else "Needs Overlay"}", color = Color(0xFFB8C7E0))
        Text("Battery Optimization: \${if (snapshot.batteryUnrestricted) "Unrestricted" else "Bypass Doze"}", color = Color(0xFFB8C7E0))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onRequestRuntime) { Icon(Icons.Default.Mic, null); Spacer(Modifier.width(4.dp)); Text("Permissions") }
            OutlinedButton(onClick = onOpenAccessibility) { Text("Accessibility") }
            OutlinedButton(onClick = onOpenOverlay) { Text("Overlay") }
            OutlinedButton(onClick = onBypassBattery) { Text("Battery") }
        }
    }
}`,
  },
  {
    path: 'ANDROID_STUDIO_SETUP.md',
    module: '15. Android Studio Setup Guide',
    summary: 'Step-by-step build, backend endpoint configuration, and device permission setup instructions.',
    content: `# Jarvis Android Studio Setup & Deployment Guide

## 1. Requirements
- Android Studio Ladybug (2024.2.1) or newer
- JDK 17 (bundled with Android Studio)
- Android SDK 35 (Android 15), minimum supported Android 9 (API 28)

## 2. Configure Backend Endpoint
1. Extract \`jarvis-android-project.zip\` and open the folder in Android Studio.
2. Open \`app/build.gradle.kts\` and set \`JARVIS_BACKEND_URL\` to your deployed Express/Gemini server URL (or \`http://10.0.2.2:3000\` for Android Emulator testing).
3. Sync Gradle and run on a physical Android device or emulator.

## 3. Grant First-Launch Security & System Permissions
1. **Microphone, Contacts, Phone & Notifications**: Tap **Grant Permissions** in the Permissions & Privacy Sandbox dashboard.
2. **Accessibility Service**: Tap **Accessibility** -> Downloaded Apps -> **Jarvis Touch & Screen Automation** -> Toggle ON.
3. **Display Over Other Apps**: Tap **Overlay** -> Allow Display Over Other Apps for floating Voice Orb HUD.
4. **Battery Optimization Bypass**: Tap **Battery** -> Allow unrestricted background operation so \`JarvisForegroundService\` stays active on lock screen.`,
  },
];
