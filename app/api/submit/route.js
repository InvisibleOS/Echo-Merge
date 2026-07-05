import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

// Helper to run the python pipeline asynchronously
function triggerPythonPipeline(enrichedData) {
  const pythonScript = path.join(process.cwd(), 'Data_Logic', 'process_single_submission.py');
  
  const payload = JSON.stringify(enrichedData).replace(/"/g, '\\"');
  const pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python');
  const command = `echo "${payload}" | ${pythonExecutable} ${pythonScript}`;
  
  console.log(`Triggering Python Pipeline for submission ${enrichedData.id}...`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Python Pipeline Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Python Pipeline stderr: ${stderr}`);
    }
    console.log(`Python Pipeline Output:\n${stdout}`);
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      channel = 'web',
      raw_text,
      audio_base64,
      photo_base64,
      language,
      geo,
      citizen_id_hash = 'anon_' + Math.random().toString(36).substr(2, 9),
    } = body;


    // 1. Prepare payload for Ingestion Service
    // The ingestion service expects `audio_url` and `photo_url`, but it natively 
    // supports processing Base64 Data URIs as URLs!
    const ingestionPayload = {
      id: "live-" + Date.now().toString(),
      channel,
      raw_text,
      audio_url: audio_base64, 
      photo_url: photo_base64,
      language,
      geo,
      citizen_id_hash,
    };

    // 2. Call the Python Ingestion Service (running on port 5001)
    console.log("Calling Ingestion Service at :5001/enrich...");
    const ingestionRes = await fetch('http://127.0.0.1:5001/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingestionPayload),
    });

    if (!ingestionRes.ok) {
      const errorText = await ingestionRes.text();
      console.error("Ingestion Service Failed:", errorText);
      return NextResponse.json({ error: 'Ingestion Service Error: ' + errorText }, { status: 500 });
    }

    const enrichedSubmission = await ingestionRes.json();
    console.log("Received Enriched Submission:", enrichedSubmission.id);

    // 3. Trigger Data_Logic pipeline asynchronously
    triggerPythonPipeline(enrichedSubmission);

    return NextResponse.json(
      {
        message: 'Submission received. AI processing has started in the background.',
        submission_id: enrichedSubmission.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Server error during orchestration: ' + error.message },
      { status: 500 }
    );
  }
}
