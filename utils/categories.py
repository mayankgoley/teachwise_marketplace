import json
import os

_DATA = None
_ICON_MAP = {
    'book-open': 'fas fa-book-open',
    'globe': 'fas fa-globe',
    'music': 'fas fa-music',
    'sparkles': 'fas fa-star',
    'trophy': 'fas fa-trophy',
    'shield': 'fas fa-shield-alt',
    'dumbbell': 'fas fa-dumbbell',
    'heart': 'fas fa-heart',
    'chef-hat': 'fas fa-utensils',
    'palette': 'fas fa-palette',
    'scissors': 'fas fa-cut',
    'laptop': 'fas fa-laptop-code',
    'briefcase': 'fas fa-briefcase',
    'video': 'fas fa-video',
    'user': 'fas fa-user',
    'sparkle': 'fas fa-magic',
    'stethoscope': 'fas fa-stethoscope',
    'wrench': 'fas fa-wrench',
    'gamepad': 'fas fa-gamepad',
    'book': 'fas fa-book',
    'plane': 'fas fa-plane',
    'calendar': 'fas fa-calendar-alt',
    'leaf': 'fas fa-leaf',
    'scale': 'fas fa-balance-scale',
}

_COLOR_CYCLE = [
    'bg-blue-500', 'bg-green-500', 'bg-red-400', 'bg-yellow-500',
    'bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-sky-500',
    'bg-fuchsia-500', 'bg-blue-600', 'bg-green-600', 'bg-red-500',
    'bg-yellow-600', 'bg-purple-600', 'bg-indigo-600', 'bg-pink-600',
]

# Inline CSS gradients — avoids Tailwind purge issues with dynamic class names
_STYLE_MAP = {
    'academics': {'gradient': 'linear-gradient(to bottom right, #3b82f6, #2563eb, #4338ca)', 'animation': 'shimmer'},
    'languages': {'gradient': 'linear-gradient(to bottom right, #34d399, #22c55e, #0d9488)', 'animation': 'shimmer'},
    'music': {'gradient': 'linear-gradient(to bottom right, #f472b6, #f43f5e, #ef4444)', 'animation': 'pulse-glow'},
    'dance': {'gradient': 'linear-gradient(to bottom right, #fb923c, #f59e0b, #eab308)', 'animation': 'wave'},
    'sports': {'gradient': 'linear-gradient(to bottom right, #f59e0b, #f97316, #dc2626)', 'animation': 'shimmer'},
    'martial_arts': {'gradient': 'linear-gradient(to bottom right, #a855f7, #7c3aed, #4338ca)', 'animation': 'pulse-glow'},
    'fitness': {'gradient': 'linear-gradient(to bottom right, #ec4899, #d946ef, #9333ea)', 'animation': 'wave'},
    'yoga_wellness': {'gradient': 'linear-gradient(to bottom right, #4ade80, #10b981, #14b8a6)', 'animation': 'breathe'},
    'cooking': {'gradient': 'linear-gradient(to bottom right, #f97316, #ef4444, #f43f5e)', 'animation': 'shimmer'},
    'visual_arts': {'gradient': 'linear-gradient(to bottom right, #a78bfa, #a855f7, #d946ef)', 'animation': 'wave'},
    'crafts': {'gradient': 'linear-gradient(to bottom right, #fbbf24, #eab308, #f97316)', 'animation': 'shimmer'},
    'technology': {'gradient': 'linear-gradient(to bottom right, #22d3ee, #3b82f6, #4f46e5)', 'animation': 'pulse-glow'},
    'business': {'gradient': 'linear-gradient(to bottom right, #64748b, #4b5563, #52525b)', 'animation': 'shimmer'},
    'creative_media': {'gradient': 'linear-gradient(to bottom right, #fb7185, #ec4899, #9333ea)', 'animation': 'wave'},
    'life_skills': {'gradient': 'linear-gradient(to bottom right, #38bdf8, #3b82f6, #6366f1)', 'animation': 'shimmer'},
    'fashion_beauty': {'gradient': 'linear-gradient(to bottom right, #f472b6, #fb7185, #d946ef)', 'animation': 'breathe'},
    'health_medical': {'gradient': 'linear-gradient(to bottom right, #2dd4bf, #06b6d4, #3b82f6)', 'animation': 'pulse-glow'},
    'trades': {'gradient': 'linear-gradient(to bottom right, #2563eb, #4f46e5, #7c3aed)', 'animation': 'shimmer'},
    'games_strategy': {'gradient': 'linear-gradient(to bottom right, #22c55e, #10b981, #0d9488)', 'animation': 'wave'},
    'religion_philosophy': {'gradient': 'linear-gradient(to bottom right, #818cf8, #a855f7, #8b5cf6)', 'animation': 'breathe'},
    'aviation_nautical': {'gradient': 'linear-gradient(to bottom right, #0ea5e9, #2563eb, #4338ca)', 'animation': 'shimmer'},
    'event_planning': {'gradient': 'linear-gradient(to bottom right, #f59e0b, #f97316, #ec4899)', 'animation': 'wave'},
    'environmental': {'gradient': 'linear-gradient(to bottom right, #22c55e, #059669, #15803d)', 'animation': 'breathe'},
    'legal': {'gradient': 'linear-gradient(to bottom right, #f43f5e, #dc2626, #e11d48)', 'animation': 'shimmer'},
}

_FALLBACK_STYLES = [
    {'gradient': 'linear-gradient(to bottom right, #3b82f6, #2563eb, #4338ca)', 'animation': 'shimmer'},
    {'gradient': 'linear-gradient(to bottom right, #34d399, #22c55e, #0d9488)', 'animation': 'wave'},
    {'gradient': 'linear-gradient(to bottom right, #f472b6, #f43f5e, #ef4444)', 'animation': 'pulse-glow'},
    {'gradient': 'linear-gradient(to bottom right, #fb923c, #f59e0b, #eab308)', 'animation': 'shimmer'},
    {'gradient': 'linear-gradient(to bottom right, #a855f7, #7c3aed, #4338ca)', 'animation': 'breathe'},
    {'gradient': 'linear-gradient(to bottom right, #22d3ee, #3b82f6, #4f46e5)', 'animation': 'wave'},
    {'gradient': 'linear-gradient(to bottom right, #fb7185, #ec4899, #9333ea)', 'animation': 'shimmer'},
    {'gradient': 'linear-gradient(to bottom right, #f59e0b, #f97316, #dc2626)', 'animation': 'pulse-glow'},
]


def load_categories():
    global _DATA
    if _DATA is not None:
        return _DATA
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'categories.json')
    with open(path, 'r') as f:
        raw = json.load(f)
    _DATA = raw['platform_categories']
    for i, cat in enumerate(_DATA):
        cat['fa_icon'] = _ICON_MAP.get(cat.get('icon', ''), 'fas fa-folder')
        cat['color'] = _COLOR_CYCLE[i % len(_COLOR_CYCLE)]
        style = _STYLE_MAP.get(cat['id'])
        if not style:
            style = _FALLBACK_STYLES[i % len(_FALLBACK_STYLES)]
        cat['gradient_css'] = style['gradient']
        cat['animation'] = style['animation']
        topic_count = 0
        for sub in cat.get('subcategories', []):
            topic_count += len(sub.get('topics', []))
        cat['topic_count'] = topic_count
    return _DATA


def get_all_topics():
    categories = load_categories()
    topics = []
    for cat in categories:
        for sub in cat.get('subcategories', []):
            topics.extend(sub.get('topics', []))
    return sorted(set(topics))


def get_category_by_id(cat_id):
    for cat in load_categories():
        if cat['id'] == cat_id:
            return cat
    return None


def get_categories_json():
    categories = load_categories()
    return json.dumps([{
        'id': c['id'],
        'name': c['name'],
        'subcategories': [{
            'id': s['id'],
            'name': s['name'],
            'topics': s.get('topics', [])
        } for s in c.get('subcategories', [])]
    } for c in categories])
