import re
R='/Users/joshua/Documents/Code/'
def sections(path):
    return open(R+path).read()
mb=sections('mailbag/launch/producthunt.md')
def msec(h):
    return re.split(r'\n## ',mb.split('## '+h,1)[1].split('\n',1)[1])[0].strip()
aw=sections('airwell/launch/producthunt.md')
aw_c=aw.split('First comment (maker story):\n',1)[1].split('\n\nPricing line:')[0].strip()
RAW='https://raw.githubusercontent.com/nulljosh/'
APPS={
'mailbag':dict(name='Mailbag',tagline=msec('Tagline (<=60)'),desc=msec('Description (<=260)'),
  url='https://mailbag.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/mailbag',
  logo=RAW+'mailbag/main/brand/icon-1024.png',gallery=['https://mailbag.jaybulb.com/og.png'],
  cats=['Email clients','Productivity'],tags=['Productivity','Tech','Email'],pricing='free',
  comment=msec('First comment (maker story)'),date='Oct 29'),
'airwell':dict(name='Airwell',tagline='A quiet minute for your breath.',desc="Four guided breathing patterns and a circle that expands and contracts on your behalf. No account, no download, no timer running out on you. Pick a pattern, breathe with it. That's the whole product.",
  url='https://airwell.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/airwell',
  logo='https://airwell.jaybulb.com/apple-touch-icon.png',gallery=['https://airwell.jaybulb.com/og.png'],
  cats=['Meditation apps','Productivity'],tags=['Health & Fitness','Productivity','Tech'],pricing='free_options',
  comment=aw_c,date='Oct 30'),
'atlin':dict(name='Atlin',tagline='Homes for rent or sale, ranked by deal',desc='Type a city. Atlin shows what is for rent or for sale there, scores each home against the typical price for its size and puts the best deals first. Every price in the local currency, every label in your language. Web, iPhone and Mac.',
  url='https://atlin.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/atlin',
  logo=RAW+'atlin/main/brand/icon-1024.png',gallery=['https://atlin.jaybulb.com/og.png'],
  cats=['Real estate software','Productivity'],tags=['Tech','Productivity','Real Estate'],pricing='free',
  comment="Hi, I'm Josh, I built Atlin. Renting in Vancouver meant a dozen tabs and no sense of whether a price was fair.\n\nSo Atlin does one thing: you type a city, it pulls what is for rent or for sale, and scores each home against the typical price for its size. The best deals sit at the top. It works for any place on earth, with prices in the local currency, square feet or metres per country, and labels in your language.\n\nThere is a web app, an iPhone and Mac app, and a terminal version. Listings come from public sources, so coverage is thinner in some cities than others, and I would like to hear where it misses.\n\nHappy to answer anything.",date='Nov 2'),
'cartons':dict(name='Cartons',tagline='Days until each package arrives',desc='Paste a UPS tracking number or the whole link from a shipping email. Cartons reads the status straight from UPS and puts a countdown to delivery next to each package. No account, no ads, no server. Your list syncs through iCloud.',
  url='https://cartons.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/cartons',
  logo='https://cartons.jaybulb.com/icon.png',gallery=['https://cartons.jaybulb.com/og.jpg'],
  cats=['Productivity'],tags=['Productivity','Tech','Shopping'],pricing='free_options',
  comment="Hi, I'm Josh, I built Cartons. I only ever want one answer about a package: how many days until it shows up.\n\nSo Cartons shows exactly that. Paste a UPS tracking number, or the whole link from a shipping email, and it reads the status from UPS and puts a countdown next to the package. It also shows the last scan, the service and where it is headed, and it sends a notification when a package moves.\n\nThere is no account and no server. Your list stays on your phone and syncs through iCloud. It reads UPS only for now. The web app is free to try, and the iPhone, iPad and Mac app is $0.99 once.\n\nHappy to answer anything.",date='Nov 3'),
'hermes':dict(name='Hermes',tagline='App Store Connect, on your Mac',desc='A native Mac app for App Store Connect. Every app, every platform and every review state in one window. Versions, builds, TestFlight, reviews and purchases without the dashboard. Every change shows the exact command and asks first.',
  url='https://cyllene.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/cyllene',
  logo=RAW+'hermes/main/brand/icon-1024.png',gallery=['https://hermes.jaybulb.com/shots/app-list.png'],
  cats=['Developer tools','Productivity'],tags=['Developer Tools','Tech','Productivity'],pricing='free',
  comment="Hi, I'm Josh, I built Hermes. App Store Connect is a website built for one app at a time, and I ship a lot of apps.\n\nHermes is a Mac app built for all of them at once: every app in one list with its icon, its live version on each platform and where it stands in review. Open one for versions, metadata, screenshots, builds, TestFlight, reviews, submissions, prices and purchases. Every change shows the exact command first and asks before it runs.\n\nIt talks to App Store Connect with your own key, so nothing goes through a server of mine. There is also an iPhone and iPad version.\n\nHappy to answer anything.",date='Nov 4'),
'hamurapi':dict(name='Hamurapi',tagline='Be king for 10 years. Feed your people.',desc='The 1968 game Hamurabi, redrawn. You get 100 people, 1,000 acres and a barn of grain, and ten years to rule. Buy land, feed your people, plant. Then the rats, the harvest and the sickness decide how it went. Plays in a browser, free.',
  url='https://hamurapi.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/labs/tree/main/hamurapi',
  logo=RAW+'labs/main/hamurapi/brand/icon-1024.png',gallery=['https://hamurapi.jaybulb.com/og.png'],
  cats=['Games'],tags=['Games','Tech','Retro'],pricing='free_options',
  comment="Hi, I'm Josh, I built Hamurapi. In 1968 Doug Dyment wrote Hamurabi, a text game where you rule an old city for ten years. I wanted to see it.\n\nSo every number is on screen as something you can see: houses for people, plots for land, sacks for grain. A good harvest makes the crowd cheer, rats run at the barn, and people you starve leave as ghosts whose graves stay. Between harvests ten small story events happen, each with two choices.\n\nThere is a new game with three levels, the classic 1968 game with nothing added, and a daily game where everyone gets the same luck so you can compare grades. The web game is free. The iPhone and Mac apps are free for the first week after Apple approves them, then $0.99 once.\n\nHappy to answer anything.",date='Nov 5'),
'vancouvervice':dict(name='Vancouver Vice',tagline='A GTA-style game set in Vancouver',desc='A third person, GTA-style game set in Vancouver and Victoria. Steal a car on Granville, lose the cops on the Burrard Bridge, and watch the stars climb. Play in your browser, or grab the Mac, Windows or Linux app.',
  url='https://vancouvervice.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/vancouvervice',
  logo='https://vancouvervice.jaybulb.com/icon.png',gallery=['https://vancouvervice.jaybulb.com/img/key-art.png'],
  cats=['Games'],tags=['Games','Tech','Gaming'],pricing='free',
  comment="Hi, I'm Josh, I built Vancouver Vice. Rent is four grand and it rains nine months a year, so I made a game about it.\n\nIt is a third person, GTA-style game set in the real city. The Unreal build streams Google's 3D scan of Vancouver, so you start outside the actual Apple Store on Georgia. You can play as Joshua downtown, Ben in Kits or Alexandre in Victoria and switch any time. Your family gets pulled in along the way.\n\nThe browser version runs on a phone or a computer, and there are builds for Mac, Windows and Linux on GitHub. It is a joke about the city I live in, made with real love for it.\n\nHappy to answer anything.",date='Nov 6'),
}

# 2026-10-30 backfill: one a week, PH caps scheduling at 30 days out
sg=sections('sighting/launch/producthunt.md')
APPS.update({
'sighting':dict(name='Sighting',tagline='A lost and found board for pets, no account.',
  desc=sg.split('Description (233): ',1)[1].split('\n',1)[0],
  url='https://sighting.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/sighting',
  logo=RAW+'sighting/main/brand/icon-1024.png',gallery=[RAW+'sighting/main/launch/gallery/01-web.png'],
  cats=['Pets','Social Networking'],tags=['Pets','Tech','Open Source'],pricing='free',
  comment=sg.split('## First comment\n',1)[1].strip(),date='Nov 13'),
'blackcomb':dict(name='Blackcomb',tagline='A WebKit browser with nothing in the way',
  desc='A WebKit browser for Mac, iPhone and iPad. Tabs, a start page, a reading list it can read aloud, per-site rules, and a floating window on Mac. History stays on your device. Free.',
  url='https://blackcomb.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/blackcomb',
  logo=RAW+'blackcomb/main/brand/icon-1024.png',gallery=[RAW+'blackcomb/main/launch/gallery/00-live.png'],
  cats=['Browsers','Productivity'],tags=['Productivity','Mac','Tech'],pricing='free',
  comment="Hi, I'm Josh, I built Blackcomb. It's named for the mountain above Whistler.\n\nI wanted a browser that is just WebKit with nothing in the way: address bar, tabs, back, forward. Then a few things I actually use. A start page with your reading list. Saved articles you can read offline or have read aloud. Per-site rules for scripts, images, dark mode and zoom. And on Mac, a floating window that stays on top while you work.\n\nHistory and bookmarks never leave your device, private tabs record nothing, and a tracker blocker is built in. The landing page is the browser itself, so you can try it right there. Free.\n\nHappy to answer anything.",date='Nov 20'),
'turing':dict(name='Turing',tagline='Samantha, a small private AI that lives on your Mac',
  desc='Samantha is a small, free, private AI that runs on your Mac. She paints, runs your apps, keeps notes and reminders, finds files, does the math and researches. Try her right on the page.',
  url='https://turing.jaybulb.com/?ref=ph',github='https://github.com/nulljosh/turing',
  logo=RAW+'turing/main/brand/icon-1024.png',gallery=[RAW+'turing/main/launch/gallery/00-live.png'],
  cats=['AI assistants','Mac'],tags=['Artificial Intelligence','Mac','Open Source'],pricing='free',
  comment="Hi, I'm Josh. Turing is where I build small language models on my own Mac, and Samantha is the first one.\n\nShe is tiny on purpose, a half-billion-parameter model I fine-tuned myself, so she runs on a Mac with nothing sent anywhere. She paints, opens and runs your apps, keeps notes and reminders, finds files, does the math, and researches with sources. Anything that writes, sends or leaves a file asks you first.\n\nYou can talk to her right on the page before you download anything. Free and open source, with the weights on Hugging Face.\n\nHappy to answer anything about the training.",date='Nov 27'),
})
