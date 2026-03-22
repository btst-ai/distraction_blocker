DEV_BLOCKED_SITES = [
    'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com', 'linkedin.com', 'bsky.app',
    'youtube.com', 'tiktok.com', 'rosa.gr', 'streetpress.com', 'franceinfo.fr', 'lemonde.fr', 'mediapart.fr',
    'slate.fr', 'actu.fr', 'next.ink', 'theguardian.com', 'bonpote.com', 'bbc.com', 'cnn.com', 'lapresselibre.info',
    'lecanardenchaine.fr', 'strava.com', 'intervals.icu', 'procyclingstats.com', 'whatsonzwift.com', 'zwiftinsider.com',
    'wandrer.earth', 'chess.com', 'lichess.org', 'flagle-game.com', 'geoguessr.com', 'sporcle.com', 'gmail.com',
    'wikipedia.org', 'electricitymaps.com', 'photos.google.com', 'letterboxd.com', 'xkcd.com', 'fflose.com'
]

NOGO_LIST = ['shein.com', 'temu.com', 'wish.com', 'aliexpress.com', 'x.com']

PUBLIC_BLOCKED_SITES = [
    'youtube.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com', 'linkedin.com',
    'tiktok.com', 'bsky.app', 'amazon.com', 'ebay.com', 'chess.com', 'strava.com', 'twitch.tv', 'bbc.com',
    'letterboxd.com', 'netflix.com', 'geoguessr.com', 'sporcle.com'
]

SITE_CATEGORIES = {
    'Social': ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com', 'linkedin.com', 'bsky.app'],
    'Video': ['youtube.com', 'tiktok.com', 'twitch.tv', 'netflix.com'],
    'News': ['franceinfo.fr', 'lemonde.fr', 'mediapart.fr', 'slate.fr', 'actu.fr', 'next.ink', 'theguardian.com',
             'bonpote.com', 'bbc.com', 'lapresselibre.info', 'lecanardenchaine.fr', 'streetpress.com', 'rosa.gr'],
    'Sports': ['strava.com', 'intervals.icu', 'procyclingstats.com', 'whatsonzwift.com', 'zwiftinsider.com', 'wandrer.earth'],
    'Games': ['chess.com', 'lichess.org', 'flagle-game.com', 'geoguessr.com', 'sporcle.com'],
    'Shopping': ['amazon.com', 'ebay.com'],
    'Other': ['mail.google.com', 'gmail.com', 'wikipedia.org', 'electricitymaps.com', 'photos.google.com', 'letterboxd.com', 'xkcd.com', 'fflose.com', 'cnn.com']
}

def get_category(domain):
    for category, domains in SITE_CATEGORIES.items():
        if domain in domains:
            return category
    return 'Other'
