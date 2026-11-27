package com.ezstorage.fuel;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Hosts the EZ Fuel web app (bundled in assets/web) in a WebView.
 * The files are served from https://appassets.androidplatform.net/ so storage and sign-in work normally.
 */
public class MainActivity extends Activity {

    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/web/index.html";
    private static final int REQ_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setFitsSystemWindows(true);
        if (Build.VERSION.SDK_INT >= 20) {
            // keep the page clear of the status and navigation bars (Android 15+ draws edge to edge)
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                    v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(),
                            in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
                    return in;
                }
            });
        }
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " EZFuelAndroid/1");

        web.addJavascriptInterface(new Bridge(), "EZAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.endsWith("/")) path = (path == null ? "/" : path) + "index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mime(path), "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // other links (e.g. password reset) open in the browser
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = cb;
                Intent camera = cameraIntent();
                if (p.isCaptureEnabled()) {
                    try {
                        startActivityForResult(camera, REQ_FILE);
                        return true;
                    } catch (Exception e) {
                        // no camera app: fall through to the picker
                    }
                }
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                Intent go = Intent.createChooser(pick, "Receipt photo");
                go.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                try {
                    startActivityForResult(go, REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    pendingFiles = null;
                    Toast.makeText(MainActivity.this, "No camera or gallery app found.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        if (b != null) web.restoreState(b);
        else web.loadUrl(START);
    }

    private Intent cameraIntent() {
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        File dir = new File(getCacheDir(), "camera");
        dir.mkdirs();
        cameraUri = FilesProvider.uri(this, "camera/receipt-" + System.currentTimeMillis() + ".jpg");
        i.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return i;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || pendingFiles == null) return;
        Uri[] result = null;
        if (res == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraUri != null && FilesProvider.file(this, cameraUri).length() > 0) {
                result = new Uri[]{cameraUri};
            }
        }
        pendingFiles.onReceiveValue(result);
        pendingFiles = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    static String mime(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".pdf")) return "application/pdf";
        if (p.endsWith(".csv")) return "text/csv";
        return "application/octet-stream";
    }

    /** Called from the web app to save or share PDFs and spreadsheets. */
    class Bridge {
        @JavascriptInterface
        public boolean saveFile(String base64, String name, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                final Uri uri;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/EZ Fuel");
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    os.write(bytes);
                    os.close();
                } else {
                    File dir = new File(getExternalFilesDir(null), "Downloads");
                    dir.mkdirs();
                    File f = new File(dir, name);
                    FileOutputStream os = new FileOutputStream(f);
                    os.write(bytes);
                    os.close();
                    uri = FilesProvider.uri(MainActivity.this, "ext/Downloads/" + name);
                }
                runOnUiThread(new Runnable() {
                    public void run() {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
                                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK));
                        } catch (Exception ignored) {
                            // no viewer installed; the file is still saved
                        }
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Opens WhatsApp (or WhatsApp Business) with the PDF attached; falls back to the share menu. */
        @JavascriptInterface
        public void shareWhatsApp(String base64, String name, final String mime) {
            final Uri uri = writeShare(base64, name);
            if (uri == null) return;
            runOnUiThread(new Runnable() {
                public void run() {
                    for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                        Intent send = new Intent(Intent.ACTION_SEND).setType(mime).setPackage(pkg)
                                .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(send);
                            return;
                        } catch (ActivityNotFoundException ignored) {
                        }
                    }
                    Toast.makeText(MainActivity.this, "WhatsApp isn't installed. Choose another app.", Toast.LENGTH_LONG).show();
                    startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType(mime)
                            .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "Share claim"));
                }
            });
        }

        private Uri writeShare(String base64, String name) {
            try {
                File dir = new File(getCacheDir(), "share");
                dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream os = new FileOutputStream(f);
                os.write(Base64.decode(base64, Base64.DEFAULT));
                os.close();
                return FilesProvider.uri(MainActivity.this, "share/" + name);
            } catch (Exception e) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this, "Couldn't prepare the file.", Toast.LENGTH_LONG).show();
                    }
                });
                return null;
            }
        }

        @JavascriptInterface
        public void shareFile(String base64, String name, final String mime) {
            try {
                File dir = new File(getCacheDir(), "share");
                dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream os = new FileOutputStream(f);
                os.write(Base64.decode(base64, Base64.DEFAULT));
                os.close();
                final Uri uri = FilesProvider.uri(MainActivity.this, "share/" + name);
                runOnUiThread(new Runnable() {
                    public void run() {
                        Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, "Share claim"));
                    }
                });
            } catch (Exception e) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this, "Couldn't share the file.", Toast.LENGTH_LONG).show();
                    }
                });
            }
        }
    }
}
