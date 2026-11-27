package com.alshalfa.tasks;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.widget.Toast;

import java.util.ArrayList;

/** Invisible screen that asks the phone's voice typing for a task and adds it. */
public class VoiceActivity extends Activity {

    private static final int REQ = 1;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "Say your task");
        try {
            startActivityForResult(i, REQ);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Voice typing isn't available. Turn on Google voice typing in Settings.", Toast.LENGTH_LONG).show();
            finish();
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ && res == RESULT_OK && data != null) {
            ArrayList<String> heard = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (heard != null && !heard.isEmpty()) {
                String text = heard.get(0).trim();
                if (text.length() > 0) {
                    text = Character.toUpperCase(text.charAt(0)) + text.substring(1);
                    Model m = Model.get(this);
                    m.add(text, getIntent().getLongExtra("list", m.defaultListId()));
                    m.changed();
                    Toast.makeText(this, "Added: " + text, Toast.LENGTH_SHORT).show();
                }
            }
        }
        finish();
    }
}
