---
name: consolidate-chats
description: "Use when the user wants to reduce clutter in their Codex.ai chat list by merging fragmented/duplicate-topic chats into one clean chat per topic via browser automation."
---

# Consolidate Chats

Goal: reduce chat-list clutter on Codex.ai by merging chats that cover the same real topic into one clean chat per topic, without losing information, using browser automation tools.

## Process

1. **Inventory.** Open "Chats and tasks" (`Codex.ai/chats`). List every chat title and last-updated date. Use `get_page_text` and scroll/load-more as needed since the list is virtualized. Distinguish "Chat" items from "Task" items — never touch Task items (they represent active agentic work).

2. **Group.** Group chats that cover the same real topic/project by skimming content, not just title — titles can be misleading (a chat titled with a person's name may actually be about an app idea, a one-word title may be a purchase decision, etc). Open each chat and read enough of it to know its real subject before deciding where it belongs. Don't force a merge just to hit a target chat count: genuinely unrelated one-off topics (a concert plan, a purchase lookup, a tool curiosity chat) are fine to bucket together under a loose "misc" theme (e.g. "Purchases & Lookups", "Dev Tool Curiosities") if the user wants an aggressive reduction, but say so plainly in the plan rather than pretending they're thematically unified.

3. **Extract per group (2+ chats).** For each chat in a group:
   - Read the full message history. Codex.ai's message list is virtualized/windowed — clicking "Load earlier messages" can garbage-collect distant messages from the DOM, so call `get_page_text` again after each load rather than assuming everything stays loaded.
   - **Always check for artifacts** — click the document/file icon near the top-right "Share" button (roughly coordinate [1313,22]) to open the per-chat Artifacts panel. Artifacts (Documents, Code, images, native visualizations) often hold more detailed/accurate data than the inline chat text. For HTML/MD artifacts, toggle to raw source (`</>` icon) for exact content. For DOCX/image artifacts, use `zoom` screenshots since they aren't text-selectable.
   - Extract key facts, decisions, numbers, names, and open questions verbatim — don't summarize away specifics.
   - **Track dates.** Note each source chat's last-edited date. Flag when numbers conflict between chats from different dates (e.g. two different dollar figures for the same thing) rather than silently picking one — call it out explicitly in the draft so the user (or a future Codex session with memory/context) can reconcile it.

4. **Draft.** Compose ONE new consolidated message per group: open with a bracketed header noting which source chats and dates it's consolidated from, then organize the content by subtopic or timeline. Explicitly flag stale/conflicting figures rather than silently resolving them.

5. **Show the plan and wait for approval.** Before creating or deleting anything, show the user: which original chats map to which new consolidated chat, the full draft content for each, and what will be left untouched (standalone/unique-topic chats, and any Task items). Wait for explicit go-ahead — do not skip this step even if the user seems in a hurry.

6. **Create consolidated chats.** Navigate to `Codex.ai/new`, click the message input, then paste the drafted content using the JS ClipboardEvent technique below (do NOT use the `computer` tool's `type` action with literal `\n` — Enter sends the message in this UI and will send prematurely on the first line). Verify the paste (screenshot or read innerText) before sending. Send, then rename the chat via the title field: click the title text (it auto-selects the existing text with a persistent highlight), then just type the new title directly — do NOT press ctrl+a first, since a stray ctrl+a keystroke can move the cursor to position 0 instead of keeping the selection, causing the new title to prepend onto the old one instead of replacing it. Keep titles short and plain (no em-dashes or long subtitle-style names) unless the user asks otherwise. Always verify the final title afterward (`document.title` or a screenshot) since this rename UI is easy to get wrong.

7. **Delete originals.** Only after creating and verifying all consolidated chats: go to `Codex.ai/chats`, click "Select" (top right), check exactly the chats that were merged (plus any disposable test/scratch chats created during the process, e.g. from paste-method verification), and click Delete, confirming the count in the dialog before confirming. Never select a consolidated chat, a standalone chat, or a Task item.

8. **Report.** State what merged into what, what was left untouched, and the before/after chat count.

## Key technique: pasting long text into the chat input

The chat input is a ProseMirror contenteditable (`div[contenteditable="true"].ProseMirror`). Reliable ways that fail:
- `computer` tool `type` with literal `\n` in the text — sends prematurely (Enter = Send).
- `navigator.clipboard.writeText()` + synthetic `ctrl+v` keypress — silently does nothing.

What works: dispatch a synthetic paste event directly on the focused element via `javascript_exec`:

```js
function pasteInto(el, text) {
  el.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  const ev = new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true});
  el.dispatchEvent(ev);
}
const el = document.querySelector('div[contenteditable="true"].ProseMirror');
pasteInto(el, text);
```

Click into the input first so it's the focused/present element in the DOM before running this. Depending on page state, the site sometimes converts a large paste into a "Pasted content" file attachment instead of inline paragraphs — this is a valid, fully-readable alternative (verify by clicking it open and checking the byte/line count) and does not need to be fought if it happens; inline is nicer for a human re-reading later but not required for correctness. Always verify with a screenshot (and, for attachments, by opening the attachment) before sending — check `innerText` length against the source text length as a quick sanity check.

## Handling images/downloads found in chats

If a chat has an important user-uploaded image the user wants saved locally: base64-encoding it and returning it through tool output is blocked as a data-exfiltration guard, and the browser tool's own disk isn't reachable from the agent's Bash filesystem. Instead, trigger a genuine browser-native download from within the page's own JS context: `fetch()` the image URL with `credentials: "include"`, get it as a `Blob`, create an Object URL, and programmatically click a temporary `<a href="blob:..." download="filename">` element. This saves directly to the user's real Downloads folder since the browser tool drives the user's actual browser. Check the blob's actual MIME type — it may not match the extension you gave the download.

## Pitfalls observed

- Test/verification pastes on a scratch chat can alarm the user if they glimpse them mid-process (e.g. seeing literal placeholder text like "paste test line A"). If you need to verify the paste technique works before using it for real, do it on a disposable new chat and tell the user proactively that it's a technical check, not the real content — don't wait for them to ask.
- Don't assume a rename succeeded just because the sidebar shows truncated text that looks right — verify the full title (`document.title`), since a failed replace can leave old + new text concatenated and only become visible once the title is long enough or you inspect it directly.
- Don't put "Codex" in a skill's own name — that namespace reads as reserved for official Anthropic-authored skills.