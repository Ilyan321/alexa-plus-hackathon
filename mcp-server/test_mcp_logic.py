import os
import sys

# Add current directory to path so we can import server
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server

def run_tests():
    print("Running MCP Logic Tests...")
    
    test_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_data")
    
    # 1. Test: Missing File
    server.DMO_FILE_PATH = os.path.join(test_data_dir, "nonexistent.dmo")
    result = server.query_dmo_deviation("UPPER_FLANGE")
    assert "Error: Could not find" in result, f"Expected Missing File error, got: {result}"
    print("✓ Missing File test passed")

    # 2. Test: Happy Path
    server.DMO_FILE_PATH = os.path.join(test_data_dir, "happy_path.dmo")
    result = server.query_dmo_deviation("UPPER_FLANGE")
    assert "1.8 microns" in result, f"Expected 1.8 microns, got: {result}"
    print("✓ Happy Path test passed (UPPER_FLANGE)")

    result = server.query_dmo_deviation("MAIN_BORE_HOLE")
    assert "0.02 microns" in result, f"Expected 0.02 microns, got: {result}"
    print("✓ Happy Path test passed (MAIN_BORE_HOLE)")

    # 3. Test: Missing Feature
    result = server.query_dmo_deviation("MISSING_FEATURE")
    assert "not found" in result, f"Expected Missing Feature message, got: {result}"
    print("✓ Missing Feature test passed")

    # 4. Test: Malformed Data
    server.DMO_FILE_PATH = os.path.join(test_data_dir, "malformed.dmo")
    
    # Wait, the logic does block.strip().startswith(feature_name.upper())
    # If the text is: "FILNAM/   WEIRD_SPACING_FEATURE"
    # Content is split by "FILNAM/"
    # The block starts with "   WEIRD_SPACING_FEATURE"
    # block.strip() starts with "WEIRD_SPACING_FEATURE"
    # So `query_dmo_deviation("WEIRD_SPACING_FEATURE")` should work!
    result = server.query_dmo_deviation("WEIRD_SPACING_FEATURE")
    assert "-0.54 microns" in result, f"Expected -0.54 microns, got: {result}"
    print("✓ Malformed Data test passed (WEIRD_SPACING_FEATURE)")

    # Test "NO_SPACE_FEATURE" (FILNAM/NO_SPACE_FEATURE)
    result = server.query_dmo_deviation("NO_SPACE_FEATURE")
    assert "1.02 microns" in result, f"Expected 1.02 microns, got: {result}"
    print("✓ Malformed Data test passed (NO_SPACE_FEATURE)")
    
    print("All tests passed successfully!")

if __name__ == "__main__":
    run_tests()
