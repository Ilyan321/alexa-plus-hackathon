const { BedrockAgentCoreClient, CreateHarnessCommand } = require('@aws-sdk/client-bedrock-agentcore');
const fs = require('fs');

const client = new BedrockAgentCoreClient({ region: 'us-east-1', profile: 'lucian24' });

async function main() {
  const input = JSON.parse(fs.readFileSync('../create-harness-input.json', 'utf8'));
  input.harnessName = "EchoForgeHarnessV9"; // new version
  const command = new CreateHarnessCommand(input);
  try {
    const response = await client.send(command);
    console.log("Harness created! ARN:", response.harnessArn);
    // write to a file so we know
    fs.writeFileSync('./new-harness.txt', response.harnessArn);
  } catch (error) {
    console.error("Error creating harness:", error);
  }
}

main();
