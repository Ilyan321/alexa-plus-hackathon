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

    // Detect if Nova Pro outputted an action intent to invoke RenderServerTarget or query/repair
    const hasToolIntent =
      /RenderServerTarget___(queryDeviation|getRepairProcedure)/i.test(fullText) ||
      /Action:\s*RenderServerTarget/i.test(fullText) ||
      /\bqueryDeviation\b/i.test(fullText) ||
      /\bgetRepairProcedure\b/i.test(fullText);

    if (hasToolIntent) {
      const isRepair = /getRepairProcedure|repair/i.test(fullText);
      const isQuery = !isRepair;

      // Prioritize the user's explicit current prompt so previous multi-turn history does not hijack the feature
      const featureFromPrompt = prompt.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);
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
