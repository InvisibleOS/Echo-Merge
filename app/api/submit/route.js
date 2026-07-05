import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';

import { exec } from 'child_process';
import path from 'path';

// Helper to run the python pipeline asynchronously
function triggerPythonPipeline(submissionData) {
  const pythonScript = path.join(process.cwd(), '..', 'Data_Logic', 'process_single_submission.py');
  
  // Use spawn/exec to run the python script
  // process.cwd() is likely the frontend directory (e.g. /frontend).
  // The Data_Logic dir is a sibling.
  
  const payload = JSON.stringify(submissionData).replace(/"/g, '\\"');
  const pythonExecutable = path.join(process.cwd(), '..', '.venv', 'bin', 'python');
  const command = `echo "${payload}" | ${pythonExecutable} ${pythonScript}`;
  
  console.log(`Triggering Python Pipeline for submission ${submissionData.id}...`);
  
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
      audio_url,
      photo_url,
      language,
      geo,
      citizen_id_hash,
    } = body;

    if (!language || !citizen_id_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: language or citizen_id_hash' },
        { status: 400 }
      );
    }

    // Step 1: Insert the raw submission into Supabase
    const { data: rawData, error: rawError } = await supabase
      .from('submissions')
      .insert({
        channel,
        raw_text,
        audio_url,
        photo_url,
        language,
        geo,
        citizen_id_hash,
      })
      .select()
      .single();

    if (rawError) {
      return NextResponse.json({ error: rawError.message }, { status: 400 });
    }

    const submissionId = rawData.id;

    // Trigger the real Python backend pipeline asynchronously
    // This will handle NLP enrichment, embedding, priority scoring, and MP solution planning
    triggerPythonPipeline(rawData);

    return NextResponse.json(
      {
        message: 'Submission received. AI processing has started in the background.',
        submission: rawData,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error during orchestration: ' + error.message },
      { status: 500 }
    );
  }
}
