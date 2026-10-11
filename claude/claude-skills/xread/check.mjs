// attach to the xreader Chrome over CDP and count bookmarks
import {chromium} from 'playwright-core';
const b=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=b.contexts()[0];const p=await ctx.newPage();
await p.goto('https://x.com/i/bookmarks',{waitUntil:'domcontentloaded'});await p.waitForTimeout(5000);
console.log(p.url(), await p.locator('article[data-testid="tweet"]').count());
await p.close();await b.close();
