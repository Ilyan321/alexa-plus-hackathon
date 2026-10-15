import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentCoreClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore';
import { v4 as uuidv4 } from 'uuid';

const HARNESS_ARN = 'arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3';

const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || 'us-east-1';

const credentials =
  process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = new BedrockAgentCoreClient({
  region,
  ...(credentials ? { credentials } : {}),
});

export async function POST(req: NextRequest) {
  try {
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
