import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

access_key = "AKIA5YU64BPCPZX25E6U"
secret_key = "YOUR_SECRET_KEY_HERE" # Replace with actual secret if needed, or leave to see the error

try:
    sts_client = boto3.client(
        'sts',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='us-east-1'
    )
    response = sts_client.get_caller_identity()
    print("Success:", response)
except (NoCredentialsError, PartialCredentialsError) as e:
    print("Credential Error:", e)
except ClientError as e:
    print("ClientError:", e.response.get('Error', {}).get('Code', 'Unknown'), "-", e.response.get('Error', {}).get('Message', 'Unknown'))
except Exception as e:
    print("Exception:", type(e).__name__, str(e))