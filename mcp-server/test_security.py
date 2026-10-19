"""Regression tests for authentication and Origin/Host validation."""

import os
import unittest
from unittest.mock import patch

import httpx

os.environ["MCP_AUTH_TOKEN"] = "test-mcp-token"
import server


class MCPRequestSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app),
            base_url="https://echoforge-mcp-fresh.onrender.com",
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_is_public(self):
        response = await self.client.get("/health")
        self.assertEqual(response.status_code, 200)

    async def test_all_tool_and_rest_routes_require_bearer_token(self):
        for path in ("/mcp", "/sse", "/messages", "/query", "/repair"):
            with self.subTest(path=path):
                response = await self.client.post(path)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.headers.get("www-authenticate"), "Bearer")

    async def test_wrong_token_is_rejected(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={"Authorization": "Bearer wrong-token"},
        )
        self.assertEqual(response.status_code, 401)

    async def test_valid_token_allows_rest_query(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("deviation_info", response.json())

    async def test_query_is_public_when_no_token_is_configured(self):
        async def app(scope, receive, send):
            response = server.JSONResponse({"ok": True})
            await response(scope, receive, send)

        with patch.dict(os.environ, {"MCP_AUTH_TOKEN": ""}):
            middleware = server.MCPRequestSecurityMiddleware(app)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=middleware),
            base_url="https://echoforge-mcp-fresh.onrender.com",
        ) as client:
            response = await client.post("/query")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})

    async def test_invalid_query_feature_is_rejected(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "NOT_A_PART"},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        self.assertEqual(response.status_code, 400)

    async def test_malformed_query_json_is_rejected(self):
        response = await self.client.post(
            "/query",
            content="{invalid",
            headers={
                "Authorization": "Bearer test-mcp-token",
                "Content-Type": "application/json",
            },
        )
        self.assertEqual(response.status_code, 400)

    async def test_disallowed_origin_is_rejected_even_with_valid_token(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={
                "Authorization": "Bearer test-mcp-token",
                "Origin": "https://untrusted.example",
            },
        )
        self.assertEqual(response.status_code, 403)

    async def test_disallowed_host_is_rejected_even_with_valid_token(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={
                "Authorization": "Bearer test-mcp-token",
                "Host": "untrusted.example",
            },
        )
        self.assertEqual(response.status_code, 421)

    async def test_repair_response_never_contains_machine_settings(self):
        response = await self.client.post(
            "/repair",
            json={"feature_name": "TURBINE_BLADE_ROOT", "deviation_microns": 1.75},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        self.assertEqual(response.status_code, 200)
        text = response.json()["repair_procedure"]
        self.assertIn("SIMULATION ONLY", text)
        self.assertIn("NOT A CNC INSTRUCTION", text)
        self.assertNotIn("RPM", text)
        self.assertNotIn("45A", text)

    async def test_unsupported_repair_feature_is_rejected(self):
        response = await self.client.post(
            "/repair",
            json={"feature_name": "UNKNOWN_BORE", "deviation_microns": 2.0},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        self.assertEqual(response.status_code, 400)

    async def test_invalid_repair_deviation_is_rejected(self):
        response = await self.client.post(
            "/repair",
            json={"feature_name": "UPPER_FLANGE", "deviation_microns": "NaN"},
            headers={"Authorization": "Bearer test-mcp-token"},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
