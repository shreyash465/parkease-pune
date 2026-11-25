package com.aenrox.parkease

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.Dialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {

  private val appUrl = "https://parkease.aenrox.com/"
  private var webViewRef: WebView? = null
  private var popupDialog: Dialog? = null
  private var lastBackPressMs = 0L

  private var pageProgress by mutableIntStateOf(0)
  private var showSplash by mutableStateOf(true)

  private var pendingGeoOrigin: String? = null
  private var pendingGeoCallback: GeolocationPermissions.Callback? = null

  private val locationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
    pendingGeoOrigin = null
    pendingGeoCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(AndroidColor.parseColor("#0F172A")),
      navigationBarStyle = SystemBarStyle.light(AndroidColor.WHITE, AndroidColor.WHITE)
    )

    setupBackHandler()

    setContent {
      LaunchedEffect(Unit) {
        // Safety guard: dismiss splash even on very slow connections
        delay(6000)
        showSplash = false
      }

      ParkEaseShell(
        progress = pageProgress,
        showSplash = showSplash,
        onCreateWebView = { createConfiguredWebView() }
      )
    }
  }

  private fun setupBackHandler() {
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val wv = webViewRef
        if (wv == null) {
          finish()
          return
        }
        wv.evaluateJavascript("(function(){ return window.handleNativeBack ? window.handleNativeBack() : false; })()") { result ->
          if (result == "true") {
            return@evaluateJavascript
          }
          if (wv.canGoBack()) {
            wv.goBack()
          } else {
            val now = System.currentTimeMillis()
            if (now - lastBackPressMs < 2000) {
              finish()
            } else {
              lastBackPressMs = now
              Toast.makeText(this@MainActivity, "Press back again to exit ParkEase", Toast.LENGTH_SHORT).show()
            }
          }
        }
      }
    })
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun createConfiguredWebView(): WebView {
    val wv = WebView(this)
    wv.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    wv.setBackgroundColor(AndroidColor.parseColor("#F8FAFC"))

    configureSettings(wv.settings)

    val cookieManager = CookieManager.getInstance()
    cookieManager.setAcceptCookie(true)
    cookieManager.setAcceptThirdPartyCookies(wv, true)

    wv.addJavascriptInterface(ParkEaseBridge(wv), "ParkEaseBridge")

    wv.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        return handleExternalSchemes(request.url.toString())
      }

      override fun onPageFinished(view: WebView, url: String?) {
        super.onPageFinished(view, url)
        if (url != null && !url.startsWith("file:///android_asset/offline.html")) {
          showSplash = false
        }
        CookieManager.getInstance().flush()
      }

      override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
      ) {
        super.onReceivedError(view, request, error)
        if (request.isForMainFrame) {
          showSplash = false
          view.loadUrl("file:///android_asset/offline.html")
        }
      }
    }

    wv.webChromeClient = object : WebChromeClient() {
      override fun onProgressChanged(view: WebView?, newProgress: Int) {
        pageProgress = newProgress
        if (newProgress >= 95) {
          showSplash = false
        }
      }

      override fun onJsAlert(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult?
      ): Boolean {
        AlertDialog.Builder(this@MainActivity)
          .setTitle("ParkEase")
          .setMessage(message ?: "")
          .setPositiveButton("OK") { _, _ -> result?.confirm() }
          .setOnCancelListener { result?.cancel() }
          .show()
        return true
      }

      override fun onJsConfirm(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult?
      ): Boolean {
        AlertDialog.Builder(this@MainActivity)
          .setTitle("Confirm Action")
          .setMessage(message ?: "")
          .setPositiveButton("Confirm") { _, _ -> result?.confirm() }
          .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
          .setOnCancelListener { result?.cancel() }
          .show()
        return true
      }

      override fun onGeolocationPermissionsShowPrompt(
        origin: String,
        callback: GeolocationPermissions.Callback
      ) {
        val hasFine = ContextCompat.checkSelfPermission(
          this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (hasFine) {
          callback.invoke(origin, true, false)
        } else {
          pendingGeoOrigin = origin
          pendingGeoCallback = callback
          locationPermissionLauncher.launch(
            arrayOf(
              Manifest.permission.ACCESS_FINE_LOCATION,
              Manifest.permission.ACCESS_COARSE_LOCATION
            )
          )
        }
      }

      override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?
      ): Boolean {
        // Support Razorpay NetBanking / 3DS authentication popups
        val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
        val childWebView = WebView(this@MainActivity)
        configureSettings(childWebView.settings)
        CookieManager.getInstance().setAcceptThirdPartyCookies(childWebView, true)

        val dialog = Dialog(this@MainActivity, android.R.style.Theme_Light_NoTitleBar_Fullscreen)
        dialog.setContentView(childWebView)

        childWebView.webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
            return handleExternalSchemes(req.url.toString())
          }
        }
        childWebView.webChromeClient = object : WebChromeClient() {
          override fun onCloseWindow(window: WebView?) {
            dialog.dismiss()
            childWebView.destroy()
          }
        }
        dialog.setOnDismissListener {
          if (popupDialog === dialog) popupDialog = null
        }

        popupDialog = dialog
        dialog.show()
        transport.webView = childWebView
        resultMsg.sendToTarget()
        return true
      }

      override fun onCloseWindow(window: WebView?) {
        popupDialog?.dismiss()
        popupDialog = null
      }
    }

    webViewRef = wv
    wv.loadUrl(appUrl)
    return wv
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun configureSettings(settings: WebSettings) {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.setGeolocationEnabled(true)
    settings.javaScriptCanOpenWindowsAutomatically = true
    settings.setSupportMultipleWindows(true)
    settings.loadWithOverviewMode = true
    settings.useWideViewPort = true
    settings.setSupportZoom(false)
    settings.builtInZoomControls = false
    settings.displayZoomControls = false
    settings.cacheMode = WebSettings.LOAD_DEFAULT
    settings.userAgentString = "${settings.userAgentString} ParkEaseAndroid/1.0"
  }

  private fun handleExternalSchemes(url: String): Boolean {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
      return false
    }

    if (url.startsWith("intent://")) {
      return try {
        val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
        if (intent.resolveActivity(packageManager) != null) {
          startActivity(intent)
        } else {
          val fallback = intent.getStringExtra("browser_fallback_url")
          if (!fallback.isNullOrEmpty()) {
            webViewRef?.loadUrl(fallback)
          } else {
            Toast.makeText(this, "Required app not installed on device", Toast.LENGTH_SHORT).show()
          }
        }
        true
      } catch (_: Exception) {
        true
      }
    }

    // Indian UPI & communication schemes (upi://, tez://, gpay://, phonepe://, paytmmp://, bhim://, credpay://, tel:, mailto:)
    return try {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      startActivity(intent)
      true
    } catch (_: ActivityNotFoundException) {
      Toast.makeText(
        this,
        "No supported UPI app found (install GPay, PhonePe, or Paytm)",
        Toast.LENGTH_LONG
      ).show()
      true
    } catch (_: Exception) {
      true
    }
  }

  inner class ParkEaseBridge(private val webView: WebView) {
    @JavascriptInterface
    fun reloadApp() {
      runOnUiThread {
        webView.loadUrl(appUrl)
      }
    }
  }

  override fun onDestroy() {
    popupDialog?.dismiss()
    webViewRef?.destroy()
    super.onDestroy()
  }
}

@Composable
private fun ParkEaseShell(
  progress: Int,
  showSplash: Boolean,
  onCreateWebView: () -> WebView
) {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFF0F172A))
      .windowInsetsPadding(WindowInsets.safeDrawing)
  ) {
    AndroidView(
      factory = { onCreateWebView() },
      modifier = Modifier
        .fillMaxSize()
        .background(Color(0xFFF8FAFC))
    )

    if (progress in 1..99 && !showSplash) {
      LinearProgressIndicator(
        progress = { progress / 100f },
        modifier = Modifier
          .fillMaxWidth()
          .height(3.dp)
          .align(Alignment.TopCenter),
        color = Color(0xFF2563EB),
        trackColor = Color(0xFFE2E8F0)
      )
    }

    AnimatedVisibility(
      visible = showSplash,
      exit = fadeOut()
    ) {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.Center,
          modifier = Modifier.padding(24.dp)
        ) {
          Box(
            modifier = Modifier
              .size(72.dp)
              .clip(RoundedCornerShape(18.dp))
              .background(Color(0xFF1E293B)),
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = "P",
              color = Color.White,
              fontSize = 38.sp,
              fontWeight = FontWeight.ExtraBold
            )
          }
          Spacer(modifier = Modifier.height(18.dp))
          Text(
            text = "ParkEase",
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
          )
          Spacer(modifier = Modifier.height(4.dp))
          Text(
            text = "PUNE MOBILITY NETWORK",
            color = Color(0xFF94A3B8),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.5.sp
          )
          Spacer(modifier = Modifier.height(28.dp))
          CircularProgressIndicator(
            modifier = Modifier.size(26.dp),
            color = Color(0xFF2563EB),
            strokeWidth = 2.5.dp
          )
        }
      }
    }
  }
}
