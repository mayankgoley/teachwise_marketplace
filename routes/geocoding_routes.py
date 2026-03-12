from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required
from extensions import limiter
from services.cache_service import cache_get, cache_set
import hashlib
import urllib.request
import urllib.parse
import json

geocoding_bp = Blueprint('geocoding_bp', __name__, url_prefix='/api/geocode')


@geocoding_bp.route('/search')
@login_required
@limiter.limit('10 per minute')
def forward_geocode():
    """Forward geocoding: address -> lat/lng."""
    q = request.args.get('q', '').strip()
    if not q or len(q) < 3:
        return jsonify([]), 400

    # Check cache
    cache_key = f"geo:fwd:{hashlib.md5(q.lower().encode()).hexdigest()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        params = urllib.parse.urlencode({
            'q': q,
            'format': 'json',
            'limit': 5,
            'addressdetails': 1,
            'viewbox': '-118.8,34.4,-117.6,33.5',
            'bounded': 0
        })
        url = f'https://nominatim.openstreetmap.org/search?{params}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'TeachWise/1.0 (support@teachwise.com)'
        })

        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.getcode()
            if status == 429:
                return jsonify({'error': 'Rate limited, please wait'}), 503
            data = json.loads(response.read().decode())

        results = []
        for item in data:
            addr = item.get('address', {})
            city = (addr.get('city') or addr.get('town') or
                    addr.get('village') or addr.get('county') or '')
            results.append({
                'lat': float(item['lat']),
                'lng': float(item['lon']),
                'display_name': item.get('display_name', ''),
                'city': city
            })

        cache_set(cache_key, results, ttl=86400)
        return jsonify(results)

    except urllib.error.HTTPError as e:
        if e.code == 429:
            return jsonify({'error': 'Rate limited, please wait'}), 503
        return jsonify({'error': 'Geocoding service unavailable'}), 503
    except Exception as e:
        current_app.logger.error(f'Forward geocode error: {e}')
        return jsonify({'error': 'Geocoding service unavailable'}), 503


@geocoding_bp.route('/reverse')
@login_required
@limiter.limit('10 per minute')
def reverse_geocode():
    """Reverse geocoding: lat/lng -> address."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)

    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    # Check cache
    cache_key = f"geo:rev:{round(lat, 5)}:{round(lng, 5)}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        params = urllib.parse.urlencode({
            'lat': lat,
            'lon': lng,
            'format': 'json',
            'addressdetails': 1
        })
        url = f'https://nominatim.openstreetmap.org/reverse?{params}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'TeachWise/1.0 (support@teachwise.com)'
        })

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())

        addr = data.get('address', {})
        city = (addr.get('city') or addr.get('town') or
                addr.get('village') or addr.get('county') or '')
        state = addr.get('state', '')

        result = {
            'display_name': data.get('display_name', ''),
            'city': city,
            'state': state
        }

        cache_set(cache_key, result, ttl=86400)
        return jsonify(result)

    except Exception as e:
        current_app.logger.error(f'Reverse geocode error: {e}')
        return jsonify({'error': 'Geocoding service unavailable'}), 503
