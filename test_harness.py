import boto3
import uuid
import sys

# We use the lucian24 profile
session = boto3.Session(profile_name="lucian24", region_name="us-east-1")
client = session.client("bedrock-agentcore")

harness_arn = "arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3"
# UUID is 36 chars which is >= 33 chars requirement
session_id = str(uuid.uuid4())

print(f"Invoking harness with session ID: {session_id}")

try:
    response = client.invoke_harness(
        harnessArn=harness_arn,
        runtimeSessionId=session_id,
        messages=[{"role": "user", "content": [{"text": "What is the current deviation for the UPPER_FLANGE? If it is out of tolerance, provide the repair procedure."}]}],
    )

    for event in response["stream"]:
        if "contentBlockDelta" in event:
            delta = event["contentBlockDelta"].get("delta", {})
            if "text" in delta:
                print(delta["text"], end="", flush=True)
        elif "messageStop" in event:
            print(f"\nStop reason: {event['messageStop'].get('stopReason')}")
        elif "internalServerException" in event or "validationException" in event or "runtimeClientError" in event:
            print(f"\nError event: {event}")
    print()
except Exception as e:
    print(f"Error invoking harness: {e}")
