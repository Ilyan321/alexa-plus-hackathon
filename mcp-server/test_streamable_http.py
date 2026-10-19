"""
Verification test suite for EchoForge Streamable HTTP MCP server (Spec 2025-11-25).
Verifies:
1. /health endpoint
2. Existing REST /query & /repair compatibility
3. MCP JSON-RPC 2.0 initialize over Streamable HTTP (/mcp)
4. MCP tools/list returning query_dmo_deviation & get_repair_procedure
5. MCP tools/call executing live metrology inspection query
"""

import asyncio
import os
import httpx

os.environ["MCP_AUTH_TOKEN"] = "test-mcp-token"
from server import app

async def test_echoforge_mcp_compliance():
    lifespan = app.router.lifespan_context(app)
    await lifespan.__aenter__()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://localhost:8000",
    ) as client:
        # 1. Health check
        h = await client.get("/health")
        assert h.status_code == 200
        assert h.json()["mcp_protocol_version"] == "2025-11-25"
        print("✓ PASS: /health reports MCP 2025-11-25 support")

        # 2. Existing REST compatibility
        q = await client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        assert q.status_code == 200
        assert "deviation" in q.json()["deviation_info"].lower()
        print("✓ PASS: Existing /query backwards compatibility intact")

        r = await client.post(
            "/repair",
            json={"feature_name": "UPPER_FLANGE", "deviation_microns": 2.5},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        assert r.status_code == 200
        assert "NOT A CNC INSTRUCTION" in r.json()["repair_procedure"]
        print("✓ PASS: Existing /repair backwards compatibility intact")

        # 3. Streamable HTTP MCP handshake (Spec 2025-11-25)
        init_res = await client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "alexa-plus-crawler", "version": "1.0.0"}
                }
            },
            headers={
                "mcp-protocol-version": "2025-11-25",
                "Authorization": "Bearer test-mcp-token",
            }
        )
        assert init_res.status_code == 200
        session_id = init_res.headers.get("mcp-session-id")
        assert session_id is not None
        print(f"✓ PASS: Streamable HTTP initialize successful (session ID: {session_id})")

        # 4. tools/list over Streamable HTTP
        tools_res = await client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            },
            headers={
                "mcp-protocol-version": "2025-11-25",
                "mcp-session-id": session_id,
                "Authorization": "Bearer test-mcp-token",
            }
        )
        assert tools_res.status_code == 200
        assert "query_dmo_deviation" in tools_res.text
        assert "get_repair_procedure" in tools_res.text
        print("✓ PASS: Streamable HTTP tools/list verified")

        # 5. tools/call over Streamable HTTP
        call_res = await client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "query_dmo_deviation",
                    "arguments": {"feature_name": "TURBINE_BLADE_ROOT"}
                }
            },
            headers={
                "mcp-protocol-version": "2025-11-25",
                "mcp-session-id": session_id,
                "Authorization": "Bearer test-mcp-token",
            }
        )
        assert call_res.status_code == 200
        assert "TURBINE_BLADE_ROOT" in call_res.text
        print("✓ PASS: Streamable HTTP tools/call verified")
    await lifespan.__aexit__(None, None, None)

    print("\nALL MCP STREAMABLE HTTP VERIFICATION TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_echoforge_mcp_compliance())
