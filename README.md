# Amazon Developer Hackathon: Build, Ship, Shape 🚀

> **Track:** Alexa+ (Next-Generation Ambient AI)  
> **Challenge:** Self-Hosted MCP Server / Agent Skills Integration  
> **Status:** Architecture & Research Phase  

---

## 🎯 Project Overview
This repository contains our entry for the **Amazon Developer Hackathon: Build, Ship, Shape (2026)**.

- **Lead / Project Manager:** [Ilyan321](https://github.com/Ilyan321)
- **Primary Track:** Alexa+ (Model Context Protocol / Agent Skills)
- **Target Deadline:** October 24, 2026

## 📁 Repository Structure
```
├── planning/          # Hackathon rules, ideation, architecture, friction logs
├── src/               # Core source code (MCP server / Agent Skills / simulation)
├── docs/              # Submission notes, architecture diagrams, demo scripts
└── README.md          # Project documentation
```

## 🏆 Goals & Strategy
1. **Solve a High-Impact Problem:** Build a real-world, context-aware capability for Alexa+ that judges will remember.
2. **Deep Technical Integration:** Fully implement the latest Model Context Protocol (MCP) spec (2025-11-25+ Streamable HTTP).
3. **Friction Log Bonus:** Maintain an active friction log to capture developer experience insights for the Amazon developer team (up to +10% bonus).
4. **AWS Builder / Open Source Mini-Challenge:** Integrate AWS services (e.g., Bedrock) to qualify for secondary prize tiers.

## 🚀 Deployment Verification

The EchoForge Next.js SSR frontend is deployed on AWS Amplify with a custom domain (`echoforge.aenox.me`) and connects end-to-end to AWS Bedrock AgentCore and the edge MCP metrology server.

### 1. Check Amplify Build Status
```bash
aws amplify get-job \
  --app-id d304e4j649i2te \
  --branch-name main \
  --job-id 3 \
  --query 'job.summary.status' \
  --output text
```
**Expected output:**
```text
SUCCEED
```

### 2. Test Live API Endpoint
```bash
curl -s -X POST https://echoforge.aenox.me/api/agent \
     -H "Content-Type: application/json" \
     -d '{"prompt":"What is the deviation of the UPPER_FLANGE?"}'
```
**Expected output:**
```json
{
  "text": "The deviation for UPPER_FLANGE is 1.8 microns, which is within the 2.0 micron tolerance threshold. No repair procedure is needed at this moment.",
  "sessionId": "...",
  "stopReason": "end_turn"
}
```
*(If deviation exceeds 2.0 microns, Bedrock AgentCore autonomously invokes the repair procedure tool and includes CNC offset suggestions in the response.)*
