import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentCoreClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HARNESS_ARN = 'arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3';

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

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    const body = await req.json();
    const { prompt, sessionId } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Invalid request: prompt is required' }, { status: 400 });
    }

    // Sessions must be >= 33 chars for AgentCore runtime
    const currentSessionId: string = sessionId || (uuidv4() + '-1');

    const command = new InvokeHarnessCommand({
      harnessArn: HARNESS_ARN,
      runtimeSessionId: currentSessionId,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
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

      // Extract feature name using robust regex matching known inspection features or json
      const featureFromPrompt = prompt.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);
      const featureFromJson = fullText.match(/"feature_name"\s*:\s*"([^"]+)"/i) || fullText.match(/'feature_name'\s*:\s*'([^']+)'/i);
      const featureFromText = fullText.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);

      let feature = (
        featureFromJson?.[1] ||
        featureFromPrompt?.[1] ||
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
        const queryRes = await fetch('https://echoforge-mcp.onrender.com/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_name: feature }),
        }).then((r) => r.json()).catch(() => null);

        if (queryRes?.deviation_info) {
          toolResult = queryRes.deviation_info;
        }
      } else {
        const repairRes = await fetch('https://echoforge-mcp.onrender.com/repair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_name: feature, deviation_microns: devMicrons }),
        }).then((r) => r.json()).catch(() => null);

        if (repairRes?.repair_procedure) {
          toolResult = repairRes.repair_procedure;
        }
      }

      if (toolResult) {
        // Send tool output back to Bedrock Harness to produce final natural language analysis
        const followUpCommand = new InvokeHarnessCommand({
          harnessArn: HARNESS_ARN,
          runtimeSessionId: currentSessionId,
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: `The factory sensor responded with: "${toolResult}". Please provide the final metrology verdict, state clearly the measured deviation vs tolerance zone, and if it exceeds tolerance, ask if the operator wants the CNC repair procedure.`
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

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[EchoForge API] AgentCore invocation error:', msg);
    return NextResponse.json(
      { error: 'Failed to invoke AgentCore Harness', details: msg },
      { status: 500 }
    );
  }
}
