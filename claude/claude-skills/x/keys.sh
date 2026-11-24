#!/bin/zsh
# Store @nulljosh1's X API keys in Keychain (input hidden, never echoed or saved to disk).
for k in X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_SECRET; do
  read -s "v?$k: "; echo
  security add-generic-password -U -s x-nulljosh1 -a $k -w "$v" && echo "  saved $k"
done
python3 "${0:A:h}/post.py" --whoami
