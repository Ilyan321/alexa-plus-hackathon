"""Regression tests for authentication and Origin/Host validation."""

import unittest

import httpx

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

    async def test_rest_routes_are_public(self):
        for path, payload in (
            ("/query", {"feature_name": "UPPER_FLANGE"}),
            ("/repair", {"feature_name": "UPPER_FLANGE", "deviation_microns": 1.0}),
        ):
            with self.subTest(path=path):
                response = await self.client.post(path, json=payload)
                self.assertEqual(response.status_code, 200)

    async def test_query_ignores_legacy_bearer_token(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={"Authorization": "Bearer old-token"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("deviation_info", response.json())

    async def test_invalid_query_feature_is_rejected(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "NOT_A_PART"},
        )
        self.assertEqual(response.status_code, 400)

    async def test_malformed_query_json_is_rejected(self):
        response = await self.client.post(
            "/query",
            content="{invalid",
            headers={
                "Content-Type": "application/json",
            },
        )
        self.assertEqual(response.status_code, 400)

    async def test_disallowed_origin_is_rejected(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={
                "Origin": "https://untrusted.example",
            },
        )
        self.assertEqual(response.status_code, 403)

    async def test_disallowed_host_is_rejected(self):
        response = await self.client.post(
            "/query",
            json={"feature_name": "UPPER_FLANGE"},
            headers={
                "Host": "untrusted.example",
            },
        )
        self.assertEqual(response.status_code, 421)

    async def test_repair_response_never_contains_machine_settings(self):
        response = await self.client.post(
            "/repair",
            json={"feature_name": "TURBINE_BLADE_ROOT", "deviation_microns": 1.75},
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
