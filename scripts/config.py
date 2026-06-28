MASTER_SITES_RAW = [
    # domain, category, is_public
    ('facebook.com', 'Social', True),
    ('instagram.com', 'Social', True),
    ('x.com', 'Social', True),
    ('twitter.com', 'Social', True),
    ('reddit.com', 'Social', True),
    ('linkedin.com', 'Social', True),
    ('bsky.app', 'Social', True),

    ('youtube.com', 'Video', True),
    ('tiktok.com', 'Video', True),
    ('twitch.tv', 'Video', True),
    ('netflix.com', 'Video', True),

    ('bbc.com', 'News', True),
    ('franceinfo.fr', 'News', False),
    ('lemonde.fr', 'News', False),
    ('mediapart.fr', 'News', False),
    ('slate.fr', 'News', False),
    ('actu.fr', 'News', False),
    ('next.ink', 'News', False),
    ('theguardian.com', 'News', False),
    ('bonpote.com', 'News', False),
    ('lapresselibre.info', 'News', False),
    ('lecanardenchaine.fr', 'News', False),
    ('streetpress.com', 'News', False),
    ('rosa.gr', 'News', False),
    ('cnn.com', 'News', False),

    ('strava.com', 'Sports', True),
    ('intervals.icu', 'Sports', False),
    ('procyclingstats.com', 'Sports', False),
    ('whatsonzwift.com', 'Sports', False),
    ('zwiftinsider.com', 'Sports', False),
    ('wandrer.earth', 'Sports', False),

    ('chess.com', 'Games', True),
    ('geoguessr.com', 'Games', True),
    ('sporcle.com', 'Games', True),
    ('lichess.org', 'Games', True),
    ('flagle-game.com', 'Games', False),

    ('amazon.com', 'Shopping', True),
    ('ebay.com', 'Shopping', True),

    ('letterboxd.com', 'Other', True),
    ('mail.google.com', 'Other', False),
    ('wikipedia.org', 'Other', True),
    ('electricitymaps.com', 'Other', False),
    ('photos.google.com', 'Other', False),
    ('xkcd.com', 'Other', True),
    ('fflose.com', 'Other', False),
]

# Sort: public first (not is_public == False), then by category, then by domain
def sort_key(item):
    domain, category, is_public = item
    return (not is_public, category, domain)

MASTER_SITES_RAW.sort(key=sort_key)

DEV_BLOCKED_SITES = [item[0] for item in MASTER_SITES_RAW]
PUBLIC_BLOCKED_SITES = [item[0] for item in MASTER_SITES_RAW if item[2]]

SITE_CATEGORIES = {}
for domain, category, _ in MASTER_SITES_RAW:
    if category not in SITE_CATEGORIES:
        SITE_CATEGORIES[category] = []
    SITE_CATEGORIES[category].append(domain)

NOGO_LIST = ['shein.com', 'temu.com', 'wish.com', 'aliexpress.com']

def get_category(domain):
    for category, domains in SITE_CATEGORIES.items():
        if domain in domains:
            return category
    return 'Other'
