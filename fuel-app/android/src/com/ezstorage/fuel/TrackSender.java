package com.ezstorage.fuel;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;

/**
 * Sends on-duty locations to Firestore over its REST API, signed in as the driver (the same account as the app),
 * so the security rules apply exactly as they do in the app:
 *   live/{uid}           the latest position (overwritten each time)
 *   route/{uid}_{date}   today's route: points [{t, lat, lng, acc}] appended
 * No Android classes here, so it can be tested on a normal computer against the Firebase emulator.
 */
public class TrackSender {
    public static class Point {
        public final long t;
        public final double lat, lng;
        public final int acc;
        public final String date;

        public Point(long t, double lat, double lng, int acc, String date) {
            this.t = t;
            this.lat = lat;
            this.lng = lng;
            this.acc = acc;
            this.date = date;
        }
    }

    private final String apiKey, projectId, uid, name;
    private String refreshToken, idToken;
    private long idTokenUntil;
    /** Overridable for the emulator: e.g. "http://10.0.2.2:8080" and "http://10.0.2.2:9099/securetoken.googleapis.com". */
    String firestoreBase = "https://firestore.googleapis.com", tokenBase = "https://securetoken.googleapis.com";

    public TrackSender(String apiKey, String projectId, String uid, String name, String refreshToken) {
        this.apiKey = apiKey;
        this.projectId = projectId;
        this.uid = uid;
        this.name = name;
        this.refreshToken = refreshToken;
    }

    public String refreshToken() {
        return refreshToken;
    }

    /** Thrown when the account can no longer send (signed out, turned off, tracking switched off). */
    public static class Stop extends Exception {
        public Stop(String m) {
            super(m);
        }
    }

    private String token() throws Exception {
        if (idToken != null && System.currentTimeMillis() < idTokenUntil) return idToken;
        String body = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refreshToken, "UTF-8");
        HttpURLConnection c = open(tokenBase + "/v1/token?key=" + URLEncoder.encode(apiKey, "UTF-8"), "POST",
                "application/x-www-form-urlencoded", null);
        write(c, body);
        int code = c.getResponseCode();
        String res = read(c, code);
        if (code == 400 || code == 401 || code == 403) throw new Stop("sign-in expired: " + res);
        if (code != 200) throw new Exception("token " + code + " " + res);
        JSONObject j = new JSONObject(res);
        idToken = j.getString("id_token");
        if (j.has("refresh_token")) refreshToken = j.getString("refresh_token");
        idTokenUntil = System.currentTimeMillis() + (Long.parseLong(j.optString("expires_in", "3600")) - 300) * 1000L;
        return idToken;
    }

    private static JSONObject num(double v) throws Exception {
        return new JSONObject().put("doubleValue", v);
    }

    private static JSONObject integer(long v) throws Exception {
        return new JSONObject().put("integerValue", String.valueOf(v));
    }

    private static JSONObject str(String v) throws Exception {
        return new JSONObject().put("stringValue", v);
    }

    /** The commit request for some points (sent oldest first; the newest becomes the live position). */
    public JSONObject commitBody(List<Point> points) throws Exception {
        String root = "projects/" + projectId + "/databases/(default)/documents/";
        JSONArray writes = new JSONArray();
        // route documents, one per day
        List<String> dates = new ArrayList<>();
        for (Point p : points) if (!dates.contains(p.date)) dates.add(p.date);
        for (String d : dates) {
            JSONArray vals = new JSONArray();
            for (Point p : points) {
                if (!p.date.equals(d)) continue;
                vals.put(new JSONObject().put("mapValue", new JSONObject().put("fields", new JSONObject()
                        .put("t", integer(p.t)).put("lat", num(p.lat)).put("lng", num(p.lng)).put("acc", integer(p.acc)))));
            }
            JSONObject doc = new JSONObject().put("name", root + "route/" + uid + "_" + d)
                    .put("fields", new JSONObject().put("ownerUid", str(uid)).put("name", str(name)).put("date", str(d)));
            writes.put(new JSONObject().put("update", doc)
                    .put("updateMask", new JSONObject().put("fieldPaths", new JSONArray().put("ownerUid").put("name").put("date")))
                    .put("updateTransforms", new JSONArray().put(new JSONObject().put("fieldPath", "points")
                            .put("appendMissingElements", new JSONObject().put("values", vals)))));
        }
        Point last = points.get(points.size() - 1);
        JSONObject live = new JSONObject().put("name", root + "live/" + uid).put("fields", new JSONObject()
                .put("ownerUid", str(uid)).put("name", str(name)).put("date", str(last.date))
                .put("t", integer(last.t)).put("lat", num(last.lat)).put("lng", num(last.lng)).put("acc", integer(last.acc)));
        writes.put(new JSONObject().put("update", live)
                .put("updateTransforms", new JSONArray().put(new JSONObject().put("fieldPath", "at").put("setToServerValue", "REQUEST_TIME"))));
        return new JSONObject().put("writes", writes);
    }

    /** Sends the points; throws Stop when the server says this account may not track any more. */
    public void send(List<Point> points) throws Exception {
        if (points.isEmpty()) return;
        String url = firestoreBase + "/v1/projects/" + projectId + "/databases/(default)/documents:commit";
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpURLConnection c = open(url, "POST", "application/json", token());
            write(c, commitBody(points).toString());
            int code = c.getResponseCode();
            String res = read(c, code);
            if (code == 200) return;
            if (code == 401 && attempt == 0) {
                idToken = null;
                continue;
            }
            if (code == 403) throw new Stop("not allowed: " + res);
            throw new Exception("commit " + code + " " + res);
        }
    }

    private static HttpURLConnection open(String url, String method, String type, String bearer) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(20000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", type);
        if (bearer != null) c.setRequestProperty("Authorization", "Bearer " + bearer);
        return c;
    }

    private static void write(HttpURLConnection c, String body) throws Exception {
        OutputStream o = c.getOutputStream();
        o.write(body.getBytes("UTF-8"));
        o.close();
    }

    private static String read(HttpURLConnection c, int code) throws Exception {
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        if (in == null) return "";
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        in.close();
        return b.toString("UTF-8");
    }
}
