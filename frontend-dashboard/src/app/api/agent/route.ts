import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentCoreClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HARNESS_ARN = 'arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim();
const MCP_SERVER_URL = 'https://echoforge-mcp-fresh.onrender.com';
const MAX_PROMPT_LENGTH = 4_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{33,256}$/;

function getClient() {
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return new BedrockAgentCoreClient({
      region,
      credentials: {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      },
    });
  }

  // Fallback to default credential provider chain (e.g. local AWS_PROFILE or IAM role)
  return new BedrockAgentCoreClient({ region });
}

async function postMcp(path: 'query' | 'repair', body: Record<string, unknown>) {
  const response = await fetch(`${MCP_SERVER_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(MCP_AUTH_TOKEN ? { Authorization: `Bearer ${MCP_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`MCP ${path} request failed with HTTP ${response.status}`);
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      const rawBody = await req.text();
      if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
        return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
      }
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const { prompt, sessionId } = body as { prompt?: unknown; sessionId?: unknown };

    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must contain 1 to ${MAX_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // AgentCore requires a long session ID. Restrict it to opaque URL-safe characters.
    if (sessionId !== undefined && (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId))) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }
    const currentSessionId = sessionId || `${uuidv4()}-1`;

    const featureFromPrompt = prompt.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);
    const explicitMetrologyRequest = /\b(deviations?|tolerances?|readings?|values?|status|inspect|inspection|sensor|measure|query|check|current|live)\b/i.test(prompt);
    const explicitRepairRequest = /\b(repair procedure|repair instructions|CNC procedure|rework procedure|retrieve.*repair|repair.*procedure)\b/i.test(prompt);

    // A known inspection feature is deterministic: query the measurement service first
    // instead of asking the language model to decide whether to call it.
    if (featureFromPrompt && (explicitMetrologyRequest || explicitRepairRequest)) {
      const feature = featureFromPrompt[1].toUpperCase();
      const deviationMatch = prompt.match(/([0-9.]+)\s*micron/i);
      const deviationMicrons = deviationMatch ? parseFloat(deviationMatch[1]) : 2.1;
      const result = explicitRepairRequest
        ? await postMcp('repair', { feature_name: feature, deviation_microns: deviationMicrons })
        : await postMcp('query', { feature_name: feature });
      const report = explicitRepairRequest ? result?.repair_procedure : result?.deviation_info;

      if (!report || typeof report !== 'string') {
        throw new Error(`MCP returned no ${explicitRepairRequest ? 'repair procedure' : 'deviation reading'}`);
      }

      return NextResponse.json({
        text: `### ${explicitRepairRequest ? 'CNC Repair Procedure' : 'Live Deviation Report'}: ${feature}\n\n${report}`,
        sessionId: currentSessionId,
        stopReason: 'end_turn',
      });
    }

    const client = getClient();

    const command = new InvokeHarnessCommand({
      harnessArn: HARNESS_ARN,
      runtimeSessionId: currentSessionId,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      maxIterations: 3,
      maxTokens: 1_000,
      timeoutSeconds: 45,
    });

    const response = await client.send(command);

    // Collect the full streamed text from all content block deltas
    let fullText = '';
    let stopReason = '';

    if (response.stream) {
      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          fullText += event.contentBlockDelta.delta.text;
        }
        if (event.messageStop?.stopReason) {
          stopReason = event.messageStop.stopReason;
        }
      }
    }

    // AgentCore action payloads can appear as plain JSON instead of the named action marker.
    const hasToolIntent =
      /RenderServerTarget___(queryDeviation|getRepairProcedure)/i.test(fullText) ||
      /Action:\s*RenderServerTarget/i.test(fullText) ||
      /\bqueryDeviation\b/i.test(fullText) ||
      /\bgetRepairProcedure\b/i.test(fullText) ||
      /["']feature_name["']\s*:/i.test(fullText) ||
      Boolean(featureFromPrompt && (explicitMetrologyRequest || explicitRepairRequest));

    if (hasToolIntent) {
      const isRepair = /\bgetRepairProcedure\b/i.test(fullText) || explicitRepairRequest;
      const isQuery = !isRepair;

      // Prioritize the user's explicit current prompt so previous multi-turn history does not hijack the feature
      const featureFromJson = fullText.match(/"feature_name"\s*:\s*"([^"]+)"/i) || fullText.match(/'feature_name'\s*:\s*'([^']+)'/i);
      const featureFromText = fullText.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);

      const feature = (
        featureFromPrompt?.[1] ||
        featureFromJson?.[1] ||
        featureFromText?.[1] ||
        'UPPER_FLANGE'
      ).toUpperCase();

      // Extract deviation microns if repair
      const deviationMatch = fullText.match(/"deviation_microns"\s*:\s*([0-9.]+)/i) ||
        fullText.match(/([0-9.]+)\s*micron/i) ||
        prompt.match(/([0-9.]+)\s*micron/i);
      const devMicrons = deviationMatch ? parseFloat(deviationMatch[1]) : 2.1;

      let toolResult = '';

      if (isQuery) {
        const queryRes = await postMcp('query', { feature_name: feature });

        if (queryRes?.deviation_info) {
          toolResult = queryRes.deviation_info;
        }
      } else {
        const repairRes = await postMcp('repair', {
          feature_name: feature,
          deviation_microns: devMicrons,
        });

        if (repairRes?.repair_procedure) {
          toolResult = repairRes.repair_procedure;
        }
      }

      if (toolResult) {
        // Send tool output back to Bedrock Harness to produce final natural language analysis
        const isHistoryExplicitlyRequested = /\b(history|trend|past readings|previous readings|log|audit|all readings)\b/i.test(prompt);

        const followUpCommand = new InvokeHarnessCommand({
          harnessArn: HARNESS_ARN,
          runtimeSessionId: currentSessionId,
          maxIterations: 1,
          maxTokens: 700,
          timeoutSeconds: 30,
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: isHistoryExplicitlyRequested
                    ? `The operator explicitly asked for history/trends. The factory sensor responded with: "${toolResult}". Summarize the readings concisely.`
                    : `The factory sensor responded with: "${toolResult}". Provide ONLY the single latest active metrology verdict for ${feature}. Do NOT list historical timestamps, past test runs, or multiple audit rows unless specifically asked. State clearly the current measured deviation vs the tolerance zone, state if it is within or out of tolerance, and if out of tolerance, ask if the operator wants the CNC repair procedure.`
                }
              ]
            }
          ],
        });

        const followUpRes = await client.send(followUpCommand);
        let synthesizedText = '';
        if (followUpRes.stream) {
          for await (const event of followUpRes.stream) {
            if (event.contentBlockDelta?.delta?.text) {
              synthesizedText += event.contentBlockDelta.delta.text;
            }
          }
        }

        if (synthesizedText && !synthesizedText.includes('RenderServerTarget___')) {
          fullText = synthesizedText;
        } else {
          // Fallback clean structured report if Nova Pro repeats action string
          fullText = `### Metrology Report: ${feature}\n\n${toolResult}`;
        }
      }
    }

    // Safety guard: ensure no raw RenderServerTarget___ or Action: leaked into fullText
    if (/RenderServerTarget|Action:\s*RenderServerTarget/i.test(fullText)) {
      fullText = fullText
        .replace(/Action:\s*RenderServerTarget[^\n]*\n?/gi, '')
        .replace(/RenderServerTarget___\w+/gi, '')
        .replace(/Input:\s*\{[^}]*\}\n?/gi, '')
        .trim();
    }

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: 'Agent returned an empty response. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      text: fullText,
      sessionId: currentSessionId,
      stopReason,
    });

  } catch (error) {
    console.error(
      '[EchoForge API] AgentCore invocation failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Failed to process the request. Please try again.' },
      { status: 500 }
    );
  }
}
