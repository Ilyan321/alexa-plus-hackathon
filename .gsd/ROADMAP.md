# Hackathon Roadmap: Project Forge

## Phase 1: Infrastructure & Environment (Days 1-3)
**Objective:** Set up the cloud and local environments, ensuring we have API access and the necessary IAM roles.
*   [ ] Register for the Amazon Developer Console and AWS (claim hackathon credits).
*   [ ] Configure AWS Bedrock model access (Claude 3.5 Sonnet).
*   [ ] Set up the local Python virtual environment.
*   [ ] Create a basic "Hello World" Alexa Skill in the Developer Console Simulator.

## Phase 2: The Local Edge (Days 4-7)
**Objective:** Build the local Python MCP server and the dummy data generator.
*   [ ] Write a Python script to generate mock `.DMO` (Coordinate Measuring) files.
*   [ ] Write the MCP Server using the official Python MCP SDK.
*   [ ] Implement the `query_dmo_deviation` tool within the MCP Server.
*   [ ] Expose the local MCP server to the internet using `ngrok` (for testing with the cloud).

## Phase 3: The Cloud Brain (Days 8-11)
**Objective:** Connect AWS Bedrock to the local MCP server so it can "reason" about local files.
*   [ ] Set up an AWS Lambda function as the backend for the Alexa Skill.
*   [ ] Configure Bedrock AgentCore to use the ngrok URL as an MCP Streamable HTTP endpoint.
*   [ ] Test the prompt: "Check the local system for the upper flange deviation."

## Phase 4: Integration & UX (Days 12-13)
**Objective:** Connect Alexa to the Lambda function and polish the voice responses.
*   [ ] Link the Alexa Custom Skill to the AWS Lambda ARN.
*   [ ] Refine the LLM system prompt so Alexa responds concisely (e.g., "It passes," rather than a long essay).
*   [ ] Conduct end-to-end testing purely via the Alexa Developer Console Simulator.

## Phase 5: Submission Polish (Days 14-15)
**Objective:** Finalize the video, code cleanup, and documentation.
*   [ ] Record the 3-minute split-screen demo video.
*   [ ] Complete the `friction_log.md` with documented AWS/MCP setup issues.
*   [ ] Finalize the GitHub `README.md` and apply an Open Source license.
*   [ ] Submit the project.
