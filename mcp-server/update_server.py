import json

with open("server.py", "r") as f:
    content = f.read()

new_endpoint = """
async def rest_repair(request):
    try:
        body = await request.json()
        feature = body.get("feature_name", "UPPER_FLANGE")
        deviation = float(body.get("deviation_microns", 0.0))
        return JSONResponse({"repair_procedure": get_repair_procedure(feature, deviation)})
    except:
        return JSONResponse({"repair_procedure": get_repair_procedure("UPPER_FLANGE", 0.0)})

"""

content = content.replace("async def rest_query(request):", new_endpoint + "async def rest_query(request):")
content = content.replace("Route(\"/query\", endpoint=rest_query, methods=[\"POST\"])", "Route(\"/query\", endpoint=rest_query, methods=[\"POST\"]),\n        Route(\"/repair\", endpoint=rest_repair, methods=[\"POST\"])")

with open("server.py", "w") as f:
    f.write(content)
