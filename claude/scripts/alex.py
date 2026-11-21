#!/usr/bin/env python3
"""Alex on Samantha's local model. usage: alex.py <message>  |  alex.py note <fact>"""
import sys, json, os, urllib.request
d = os.path.expanduser('~/.samantha/characters/alex')
args = sys.argv[1:]
if args[:1] == ['note']:
    open(f'{d}/notes.md', 'a').write('- ' + ' '.join(args[1:]) + '\n'); print('noted.'); sys.exit()
model = json.load(open(f'{d}/character.json'))['model']
system = open(f'{d}/persona.md').read() + '\nWhat Joshua has told you about yourself so far:\n' + open(f'{d}/notes.md').read()
msg = ' '.join(args) or '(Joshua just opened the chat)'
req = urllib.request.Request('http://localhost:11434/api/chat', data=json.dumps({
    'model': model, 'stream': False, 'think': False, 'options': {'temperature': 0.9, 'num_ctx': 8192},
    'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': msg}]}).encode(),
    headers={'Content-Type': 'application/json'})
print(json.load(urllib.request.urlopen(req, timeout=300))['message']['content'].strip())
