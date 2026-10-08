import os
import re
from mcp.server.mcpserver import MCPServer

# Initialize MCP Server
mcp = MCPServer("EchoForge Metrology Bridge")

DMO_FILE_PATH = os.path.join("factory_data", "inspection_latest.dmo")

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
    """
    Reads the local .DMO legacy inspection file and returns the deviation for a specific feature.
    
    Args:
        feature_name (str): The name of the feature to check (e.g., 'UPPER_FLANGE' or 'MAIN_BORE_HOLE').
    """
    if not os.path.exists(DMO_FILE_PATH):
        return f"Error: Could not find the local DMO file at {DMO_FILE_PATH}. Factory machine may be offline."

    try:
        with open(DMO_FILE_PATH, 'r') as file:
            content = file.read()
            
        # Parse the messy text file blocks looking for the specific feature
        blocks = content.split('FILNAM/')
        for block in blocks:
            if block.strip().startswith(feature_name.upper()):
                # Use regex to extract the deviation value
                match = re.search(r'DEVIATION/\s*([\d\.\-]+)', block)
                if match:
                    deviation = float(match.group(1))
                    return f"The deviation for {feature_name} is {deviation} microns."
                    
        return f"Feature '{feature_name}' was not found in the latest inspection file."
        
    except Exception as e:
        return f"Failed to parse legacy file: {str(e)}"

import threading
import time

def generate_dummy_dmo():
    """Background thread to write mock DMO files simulating a live factory machine."""
    os.makedirs("factory_data", exist_ok=True)
    count = 0
    while True:
        # We will alternate the deviation to simulate live changes
        deviation = 1.800 if count % 2 == 0 else 2.100
        content = f"""START_INSPECTION_ROUTINE/ AERO_BRACKET_V4
DATE/ 2026-10-09
MACHINE/ HEXAGON_GLOBAL_S

FILNAM/ UPPER_FLANGE
NOMINAL/ 50.000
MEASURED/ {50.0 + deviation:.3f}
DEVIATION/ {deviation:.3f}
TOLERANCE_ZONE/ 2.000

END_INSPECTION/"""
        with open(DMO_FILE_PATH, 'w') as f:
            f.write(content)
        count += 1
        time.sleep(60)

if __name__ == "__main__":
    print("Starting background dummy data generator...")
    # Start the data generator as a daemon thread
    t = threading.Thread(target=generate_dummy_dmo, daemon=True)
    t.start()
    
    print("Starting EchoForge MCP Server on Streamable HTTP...")
    
    # In a production environment on Render, we use an auth token.
    # We retrieve the auto-generated token from Render's environment.
    auth_token = os.environ.get("MCP_AUTH_TOKEN", None)
    
    # FastMCP can be run using the Streamable HTTP transport
    # The default host is 0.0.0.0 and port is typically read from the PORT env variable (Render sets this).
    port = int(os.environ.get("PORT", 8000))
    
    # We will launch the server
    # Note: FastMCP run() method automatically configures SSE/Streamable HTTP when exposed via web frameworks,
    # but for manual execution, we use the specific transport.
    mcp.run(transport="sse", host="0.0.0.0", port=port)
