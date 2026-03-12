/**
 * LocationPicker — Reusable map + search + radius component.
 * Requires Leaflet.js to be loaded on the page.
 */
class LocationPicker {
  constructor(config = {}) {
    this.mapContainerId = config.mapContainerId || 'map';
    this.searchInputId = config.searchInputId || 'addressSearch';
    this.latFieldId = config.latFieldId || 'lat';
    this.lngFieldId = config.lngFieldId || 'lng';
    this.addressFieldId = config.addressFieldId || 'address';
    this.labelFieldId = config.labelFieldId || null;
    this.showRadius = config.showRadius || false;
    this.radiusFieldId = config.radiusFieldId || null;
    this.radiusUnit = config.radiusUnit || 'miles';
    this.draggable = config.draggable !== false;
    this.defaultCenter = config.defaultCenter || [34.0522, -118.2437];
    this.defaultZoom = config.defaultZoom || 11;
    this.initialLat = config.initialLat || null;
    this.initialLng = config.initialLng || null;
    this.onLocationChange = config.onLocationChange || null;

    this._debounceTimer = null;
    this._map = null;
    this._marker = null;
    this._radiusCircle = null;
    this._suggestionsEl = null;

    this._init();
  }

  _init() {
    const container = document.getElementById(this.mapContainerId);
    if (!container) return;

    // Initialize map
    const center = (this.initialLat && this.initialLng)
      ? [this.initialLat, this.initialLng]
      : this.defaultCenter;
    const zoom = (this.initialLat && this.initialLng) ? 14 : this.defaultZoom;

    this._map = L.map(this.mapContainerId).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this._map);

    // Create marker
    if (this.initialLat && this.initialLng) {
      this._createMarker(this.initialLat, this.initialLng);
    }

    // Map click to place marker
    this._map.on('click', (e) => {
      this._createMarker(e.latlng.lat, e.latlng.lng);
      this._updateFields(e.latlng.lat, e.latlng.lng);
      this._reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // Search input
    const searchInput = document.getElementById(this.searchInputId);
    if (searchInput) {
      this._setupSearch(searchInput);
    }

    // Radius
    if (this.showRadius && this.radiusFieldId) {
      const radiusField = document.getElementById(this.radiusFieldId);
      if (radiusField) {
        radiusField.addEventListener('change', () => {
          this.setRadius(parseFloat(radiusField.value) || 10);
        });
        radiusField.addEventListener('input', () => {
          this.setRadius(parseFloat(radiusField.value) || 10);
        });
      }
    }
  }

  _createMarker(lat, lng) {
    if (this._marker) {
      this._marker.setLatLng([lat, lng]);
    } else {
      this._marker = L.marker([lat, lng], { draggable: this.draggable }).addTo(this._map);
      if (this.draggable) {
        this._marker.on('dragend', () => {
          const pos = this._marker.getLatLng();
          this._updateFields(pos.lat, pos.lng);
          this._reverseGeocode(pos.lat, pos.lng);
        });
      }
    }
    this._map.setView([lat, lng], Math.max(this._map.getZoom(), 14));

    // Update radius circle if showing
    if (this.showRadius && this.radiusFieldId) {
      const radiusField = document.getElementById(this.radiusFieldId);
      if (radiusField) {
        this.setRadius(parseFloat(radiusField.value) || 10);
      }
    }
  }

  _updateFields(lat, lng) {
    const latField = document.getElementById(this.latFieldId);
    const lngField = document.getElementById(this.lngFieldId);
    if (latField) latField.value = lat.toFixed(6);
    if (lngField) lngField.value = lng.toFixed(6);

    if (this.onLocationChange) {
      const addrField = document.getElementById(this.addressFieldId);
      this.onLocationChange(lat, lng, addrField ? addrField.value : '');
    }
  }

  _reverseGeocode(lat, lng) {
    fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          const addrField = document.getElementById(this.addressFieldId);
          if (addrField) addrField.value = data.display_name;
          const searchInput = document.getElementById(this.searchInputId);
          if (searchInput) searchInput.value = data.display_name;
        }
      })
      .catch(() => {});
  }

  _setupSearch(input) {
    // Create suggestions dropdown
    this._suggestionsEl = document.createElement('div');
    this._suggestionsEl.className = 'lp-suggestions';
    this._suggestionsEl.style.display = 'none';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(this._suggestionsEl);

    input.addEventListener('input', () => {
      clearTimeout(this._debounceTimer);
      const q = input.value.trim();
      if (q.length < 3) {
        this._suggestionsEl.style.display = 'none';
        return;
      }
      this._debounceTimer = setTimeout(() => this._search(q), 500);
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !this._suggestionsEl.contains(e.target)) {
        this._suggestionsEl.style.display = 'none';
      }
    });
  }

  _search(query) {
    fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(results => {
        if (!Array.isArray(results) || results.length === 0) {
          this._suggestionsEl.style.display = 'none';
          return;
        }
        this._suggestionsEl.innerHTML = '';
        results.forEach(item => {
          const div = document.createElement('div');
          div.className = 'lp-suggestion-item';
          div.textContent = item.display_name;
          div.addEventListener('click', () => {
            this._createMarker(item.lat, item.lng);
            this._updateFields(item.lat, item.lng);
            const addrField = document.getElementById(this.addressFieldId);
            if (addrField) addrField.value = item.display_name;
            const searchInput = document.getElementById(this.searchInputId);
            if (searchInput) searchInput.value = item.display_name;
            this._suggestionsEl.style.display = 'none';
          });
          this._suggestionsEl.appendChild(div);
        });
        this._suggestionsEl.style.display = 'block';
      })
      .catch(() => {
        this._suggestionsEl.style.display = 'none';
      });
  }

  setLocation(lat, lng) {
    this._createMarker(lat, lng);
    this._updateFields(lat, lng);
    this._reverseGeocode(lat, lng);
  }

  setRadius(miles) {
    if (!this._marker) return;
    const pos = this._marker.getLatLng();
    const meters = this.radiusUnit === 'miles' ? miles * 1609.34 : miles * 1000;

    if (this._radiusCircle) {
      this._radiusCircle.setLatLng(pos);
      this._radiusCircle.setRadius(meters);
    } else {
      this._radiusCircle = L.circle(pos, {
        radius: meters,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 2
      }).addTo(this._map);
    }
  }

  getLocation() {
    const latField = document.getElementById(this.latFieldId);
    const lngField = document.getElementById(this.lngFieldId);
    const addrField = document.getElementById(this.addressFieldId);
    return {
      lat: latField ? parseFloat(latField.value) : null,
      lng: lngField ? parseFloat(lngField.value) : null,
      address: addrField ? addrField.value : ''
    };
  }

  destroy() {
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
    if (this._suggestionsEl) {
      this._suggestionsEl.remove();
      this._suggestionsEl = null;
    }
  }
}
