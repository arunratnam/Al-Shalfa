package com.ezstorage.fuel;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/**
 * Shares the app's own files (camera photos, PDFs to share) with other apps through content:// links.
 *   content://com.ezstorage.fuel.files/camera/… → cache/camera
 *   content://com.ezstorage.fuel.files/share/…  → cache/share
 *   content://com.ezstorage.fuel.files/ext/…    → app's external files folder
 */
public class FilesProvider extends ContentProvider {

    /** "<application id>.files", so each company's app (white-label build) has its own. */
    static String authority(Context c) {
        return c.getPackageName() + ".files";
    }

    public static Uri uri(Context c, String path) {
        return Uri.parse("content://" + authority(c) + "/" + Uri.encode(path, "/"));
    }

    public static File file(Context c, Uri u) {
        String p = u.getPath();
        if (p == null) return new File(c.getCacheDir(), "none");
        p = p.startsWith("/") ? p.substring(1) : p;
        if (p.contains("..")) return new File(c.getCacheDir(), "none");
        if (p.startsWith("ext/")) return new File(c.getExternalFilesDir(null), p.substring(4));
        if (p.startsWith("camera/") || p.startsWith("share/")) return new File(c.getCacheDir(), p);
        return new File(c.getCacheDir(), "none");
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException {
        File f = file(getContext(), u);
        int m;
        if (mode.contains("w")) {
            f.getParentFile().mkdirs();
            try {
                f.createNewFile();
            } catch (IOException ignored) {
            }
            m = ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE
                    | (mode.contains("t") ? ParcelFileDescriptor.MODE_TRUNCATE : 0);
        } else {
            m = ParcelFileDescriptor.MODE_READ_ONLY;
        }
        return ParcelFileDescriptor.open(f, m);
    }

    @Override
    public String getType(Uri u) {
        return MainActivity.mime(u.getPath() == null ? "" : u.getPath());
    }

    @Override
    public Cursor query(Uri u, String[] projection, String sel, String[] args, String sort) {
        File f = file(getContext(), u);
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override
    public Uri insert(Uri u, ContentValues v) {
        return null;
    }

    @Override
    public int delete(Uri u, String s, String[] a) {
        return 0;
    }

    @Override
    public int update(Uri u, ContentValues v, String s, String[] a) {
        return 0;
    }
}
