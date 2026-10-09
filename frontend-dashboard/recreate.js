const { BedrockAgentCoreClient, CreateGatewayCommand, CreateGatewayTargetCommand, CreateHarnessCommand } = require('@aws-sdk/client-bedrock-agentcore');

const client = new BedrockAgentCoreClient({ region: 'us-east-1' });

async function main() {
  try {
    // 1. Create Gateway
    console.log("Creating Gateway...");
    const gRes = await client.send(new CreateGatewayCommand({
      name: "echoforgegateway2",
      description: "Updated gateway for EchoForge"
    }));
    const gatewayArn = gRes.gatewayArn;
    const gatewayId = gRes.gatewayId;
    console.log("Gateway ARN:", gatewayArn);

    // 2. Create Gateway Target
    console.log("Creating Gateway Target...");
    const tRes = await client.send(new CreateGatewayTargetCommand({
      gatewayIdentifier: gatewayArn,
      targetConfiguration: {
        mcp: {
          openApiSchema: {
            s3: {
              uri: "s3://echoforge-schema-937f3aca-78ed-40a0-a436-6f58c4294221/openapi.json"
            }
          }
        }
      }
    }));
    console.log("Target Created.");

    // 3. Create Harness
    console.log("Creating Harness...");
    const hRes = await client.send(new CreateHarnessCommand({
      harnessName: "EchoForgeHarnessV9",
      executionRoleArn: "arn:aws:iam::152307755678:role/EchoForgeHarnessRole",
      model: {
        bedrockModelConfig: {
          modelId: "us.amazon.nova-pro-v1:0",
          apiFormat: "converse_stream"
        }
      },
      systemPrompt: [{ text: "You are EchoForge, an industrial metrology assistant. You can retrieve real-time deviation metrics from the factory and provide engineering repair procedures using your connected tools. If deviation exceeds tolerance, always provide the repair procedure using your getRepairProcedure tool." }],
      tools: [
        {
          type: "agentcore_gateway",
          name: "echoforge_mcp",
          config: {
            agentCoreGateway: {
              gatewayArn: gatewayArn
            }
          }
        }
      ],
      maxIterations: 10,
      maxTokens: 4096,
      timeoutSeconds: 300
    }));
    console.log("Harness ARN:", hRes.harnessArn);
  } catch (e) {
    console.error(e);
  }
}
main();
