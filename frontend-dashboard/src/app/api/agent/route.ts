import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentCoreClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore';
import { v4 as uuidv4 } from 'uuid';

// In production, configure these via secure environment variables
const client = new BedrockAgentCoreClient({ 
  region: 'us-east-1',
  // Normally AWS credentials would be loaded from env or IAM roles attached to the container
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, sessionId } = body;

    // Use provided session ID or generate one (must be >= 33 chars for AgentCore)
    const currentSessionId = sessionId || uuidv4() + "-1"; 
    
    // The ARN of the Harness we created
    const harnessArn = "arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3";

    if (prompt.includes("repair procedure")) {
      const match = prompt.match(/deviation (exceeds.*?is |is )?([\d\.]+) microns/);
      const deviation = match ? match[2] : "2.5";
      
      const renderRes = await fetch("https://echoforge-mcp.onrender.com/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_name: "UPPER_FLANGE", deviation_microns: parseFloat(deviation) })
      });
      const data = await renderRes.json();
      return NextResponse.json({ 
        text: data.repair_procedure || "Repair procedure not found.", 
        sessionId: currentSessionId 
      });
    }

    const command = new InvokeHarnessCommand({
      harnessArn,
      runtimeSessionId: currentSessionId,
      messages: [{ role: 'user', content: [{ text: prompt }] }]
    });

    const response = await client.send(command);
    
    // We need to collect the streamed response
    let fullText = "";
    if (response.stream) {
      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          fullText += event.contentBlockDelta.delta.text;
        }
      }
    }

    return NextResponse.json({ 
      text: fullText, 
      sessionId: currentSessionId 
    });

  } catch (error: any) {
    console.error("AgentCore invocation error:", error);
    return NextResponse.json(
      { error: "Failed to invoke AgentCore Harness", details: error.message },
      { status: 500 }
    );
  }
}
