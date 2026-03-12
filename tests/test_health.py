"""Tests for the health check endpoint."""
import json


class TestHealthCheck:
    def test_health_endpoint_returns_200(self, client):
        resp = client.get('/health')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert 'checks' in data
        assert data['checks']['database'] == 'ok'
