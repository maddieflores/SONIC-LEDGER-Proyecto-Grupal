from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_preferences_change_ranking():
    items = [
        {'id': 'rock', 'title': 'Rock', 'tags': ['rock', 'guitarra']},
        {'id': 'jazz', 'title': 'Jazz', 'tags': ['jazz', 'piano']},
    ]
    for preference in ['rock', 'jazz']:
        response = client.post('/recommendations', json={'preferences': [preference], 'items': items})
        assert response.status_code == 200
        assert response.json()['items'][0]['id'] == preference


def test_reject_empty_profile():
    assert client.post('/recommendations', json={'preferences': [], 'items': []}).status_code == 422
