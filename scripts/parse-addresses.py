import json
import sys

result = {}

for line in sys.stdin:
    key, value, *rest = line.strip().split(": ")
    result[key] = value

print(json.dumps(result, indent=2))
