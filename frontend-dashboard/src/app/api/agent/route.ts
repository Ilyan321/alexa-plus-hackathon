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

    // Detect if Nova Pro outputted an action intent to invoke RenderServerTarget
    const toolCallMatch = fullText.match(/RenderServerTarget___(queryDeviation|getRepairProcedure)[^\w\d{]*(\{[^}]+\})/i) ||
      fullText.match(/Action:\s*RenderServerTarget___(queryDeviation|getRepairProcedure)[\s\S]*?(?:Parameters|Input)?:\s*(\{[^}]+\})/i);

    if (toolCallMatch) {
      const toolName = toolCallMatch[1];
      let args: any = {};
      try {
        args = JSON.parse(toolCallMatch[2]);
      } catch {
        const featureMatch = fullText.match(/"feature_name"\s*:\s*"([^"]+)"/i);
        if (featureMatch) args.feature_name = featureMatch[1];
      }

      const feature = (args.feature_name || 'UPPER_FLANGE').toUpperCase();
      let toolResult = '';

      if (toolName.toLowerCase().includes('query')) {
        const queryRes = await fetch('https://echoforge-mcp.onrender.com/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_name: feature }),
        }).then((r) => r.json()).catch(() => null);

        if (queryRes?.deviation_info) {
          toolResult = queryRes.deviation_info;
        }
      } else if (toolName.toLowerCase().includes('repair')) {
        const devMicrons = parseFloat(args.deviation_microns || 2.1);
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
