import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';

// Mock function representing Person 3's AI Enrichment module
async function mockAIEnrichment(rawSubmission) {
  const text = (rawSubmission.raw_text || '').toLowerCase();
  
  let category = 'Public Infrastructure';
  let need_type = 'General Maintenance';
  let urgency = 'medium';
  let normalized_text_en = rawSubmission.raw_text || 'Citizen submission';
  
  if (text.includes('road') || text.includes('pothole') || text.includes('सड़क') || text.includes('potholes') || text.includes('ರಸ್ತೆ')) {
    category = 'Roads & Transport';
    need_type = 'Pothole Repair';
    urgency = 'high';
    normalized_text_en = 'The road has major potholes and is unsafe for traffic.';
  } else if (text.includes('water') || text.includes('drain') || text.includes('leak') || text.includes('पानी') || text.includes('ನೀರು') || text.includes('drainage')) {
    category = 'Water & Sanitation';
    need_type = 'Drainage Repair';
    urgency = 'high';
    normalized_text_en = 'Blocked drainage is causing water overflow and health issues.';
  } else if (text.includes('light') || text.includes('street') || text.includes('dark') || text.includes('बिजली') || text.includes('ಕತ್ತಲು')) {
    category = 'Public Safety';
    need_type = 'Streetlight Repair';
    urgency = 'medium';
    normalized_text_en = 'Streetlights are broken, causing safety concerns at night.';
  } else if (text.includes('waste') || text.includes('garbage') || text.includes('trash') || text.includes('कचरा') || text.includes('ಕಸ')) {
    category = 'Waste Management';
    need_type = 'Garbage Clearance';
    urgency = 'medium';
    normalized_text_en = 'Garbage has accumulated at the corner and needs clearance.';
  }
  
  return {
    normalized_text_en,
    category,
    need_type,
    urgency,
    sentiment: 'frustrated',
    canonical_location: rawSubmission.geo ? `Ward 42 (${rawSubmission.geo.lat}, ${rawSubmission.geo.lng})` : 'Ward 42',
    extracted_entities: { keywords: [need_type.toLowerCase()] }
  };
}

// Mock function representing Person 4's Embedding Generation module
async function mockEmbeddingGeneration(text) {
  const vector = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    const seed = Math.sin(hash + i) * 10000;
    vector.push(Number((seed - Math.floor(seed)).toFixed(6)));
  }
  return vector;
}

// Orchestrator to update the priorities aggregation
async function triggerPriorityAggregation(supabaseClient, enriched, submissionId, geo) {
  const { category, need_type, urgency } = enriched;
  
  const { data: existing, error: fetchError } = await supabaseClient
    .from('priorities')
    .select('*')
    .eq('category', category)
    .eq('title', need_type)
    .maybeSingle();
    
  if (fetchError) {
    console.error('Error fetching priority item:', fetchError);
    return;
  }
  
  const scoreWeight = urgency === 'high' ? 3.0 : urgency === 'medium' ? 2.0 : 1.0;
  
  if (existing) {
    const newCount = existing.demand_count + 1;
    const newScore = Number(existing.demand_score) + scoreWeight;
    
    let newHotspot = { ...existing.hotspot_geo };
    if (geo && geo.lat && geo.lng) {
      const lat = (Number(existing.hotspot_geo.lat || geo.lat) * existing.demand_count + Number(geo.lat)) / newCount;
      const lng = (Number(existing.hotspot_geo.lng || geo.lng) * existing.demand_count + Number(geo.lng)) / newCount;
      newHotspot = { lat, lng, density: newCount };
    }
    
    const newEvidence = [...(existing.supporting_evidence || [])];
    if (newEvidence.length < 5) {
      newEvidence.push({
        submission_id: submissionId,
        text: enriched.normalized_text_en,
      });
    }
    
    const { error: updateError } = await supabaseClient
      .from('priorities')
      .update({
        demand_count: newCount,
        demand_score: newScore,
        hotspot_geo: newHotspot,
        supporting_evidence: newEvidence,
        updated_at: new Date().toISOString(),
      })
      .eq('work_id', existing.work_id);
      
    if (updateError) {
      console.error('Error updating priority item:', updateError);
    }
  } else {
    const hotspot_geo = (geo && geo.lat && geo.lng) 
      ? { lat: Number(geo.lat), lng: Number(geo.lng), density: 1 } 
      : { lat: 12.9716, lng: 77.5946, density: 1 };
      
    const supporting_evidence = [{
      submission_id: submissionId,
      text: enriched.normalized_text_en,
    }];
    
    const { count } = await supabaseClient
      .from('priorities')
      .select('*', { count: 'exact', head: true });
      
    const rank = (count || 0) + 1;
    
    const { error: insertError } = await supabaseClient
      .from('priorities')
      .insert({
        title: need_type,
        category: category,
        demand_score: scoreWeight,
        demand_count: 1,
        hotspot_geo,
        supporting_evidence,
        rank,
        explanation: `Synthesized priority for ${need_type} based on citizen reports regarding ${category.toLowerCase()}.`,
      });
      
    if (insertError) {
      console.error('Error inserting new priority item:', insertError);
    }
  }
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

    // Step 2: Await Person 3 AI Enrichment (returns EnrichedSubmission JSON)
    // TODO: Await Person 3 AI Enrichment (returns EnrichedSubmission JSON)
    const enrichedData = await mockAIEnrichment(rawData);

    // Step 3: Await Person 4 Embedding Generation (returns vector)
    // TODO: Await Person 4 Embedding Generation (returns vector)
    const embeddingVector = await mockEmbeddingGeneration(enrichedData.normalized_text_en);

    // Step 4: Insert the enriched data into enriched_submissions and the vector into embeddings
    const { error: enrichedError } = await supabase
      .from('enriched_submissions')
      .insert({
        id: submissionId,
        normalized_text_en: enrichedData.normalized_text_en,
        category: enrichedData.category,
        need_type: enrichedData.need_type,
        urgency: enrichedData.urgency,
        sentiment: enrichedData.sentiment,
        canonical_location: enrichedData.canonical_location,
        extracted_entities: enrichedData.extracted_entities,
      });

    if (enrichedError) {
      console.error('Failed to save enriched submission:', enrichedError.message);
    }

    const { error: embeddingError } = await supabase
      .from('embeddings')
      .insert({
        submission_id: submissionId,
        vector: embeddingVector,
      });

    if (embeddingError) {
      console.error('Failed to save embedding vector:', embeddingError.message);
    }

    // Step 5: Trigger an aggregation update (or insert) to the priorities table based on the new data
    await triggerPriorityAggregation(supabase, enrichedData, submissionId, geo);

    return NextResponse.json(
      {
        message: 'Submission fully processed and orchestrated successfully',
        submission: rawData,
        enrichment: enrichedData,
        hasEmbedding: !!embeddingVector,
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
