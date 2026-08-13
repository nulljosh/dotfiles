#!/bin/bash
# Pull public Duolingo profile stats. Usage: profile.sh [username]
set -euo pipefail
USERNAME="${1:-nulljosh}"

curl -s "https://www.duolingo.com/2017-06-30/users?username=${USERNAME}" | python3 -c "
import json, sys, datetime
users = json.load(sys.stdin).get('users', [])
if not users:
    sys.exit('No user found for \"$USERNAME\"')
d = users[0]
joined = datetime.datetime.fromtimestamp(d.get('creationDate', 0)).date()
print(f\"username: {d.get('username')}\")
print(f\"name: {d.get('name')}\")
print(f\"total XP: {d.get('totalXp')}\")
print(f\"streak: {d.get('streak')}\")
print(f\"joined: {joined}\")
print()
print('Courses:')
for c in sorted(d.get('courses', []), key=lambda c: -c['xp']):
    print(f\"  {c['title']:20s} xp={c['xp']:6d} crowns={c['crowns']}\")
"
