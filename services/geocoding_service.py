import urllib.request
import urllib.parse
import json
import time
from flask import current_app

_last_request_time = 0


def geocode_address(address):
    global _last_request_time

    if not address or not address.strip():
        return None

    try:
        elapsed = time.time() - _last_request_time
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)

        params = urllib.parse.urlencode({
            'q': address,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1
        })
        url = f'https://nominatim.openstreetmap.org/search?{params}'

        req = urllib.request.Request(url, headers={
            'User-Agent': 'TeachWise/1.0 (tutoring platform)'
        })

        _last_request_time = time.time()

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())

        if not data:
            current_app.logger.warning(f'Geocoding returned no results for: {address}')
            return None

        result = data[0]
        lat = float(result['lat'])
        lng = float(result['lon'])

        addr = result.get('address', {})
        city = (addr.get('city') or addr.get('town') or
                addr.get('village') or addr.get('county') or '')

        return {'lat': lat, 'lng': lng, 'city': city}

    except Exception as e:
        current_app.logger.error(f'Geocoding error for "{address}": {e}')
        return None


def geocode_and_save(model_instance, address):
    result = geocode_address(address)
    if result:
        model_instance.latitude = result['lat']
        model_instance.longitude = result['lng']
        model_instance.city = result['city']
        return True
    return False
