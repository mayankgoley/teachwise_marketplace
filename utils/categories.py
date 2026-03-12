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
