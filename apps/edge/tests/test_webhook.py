import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from edge.main import app
from edge.security import verify_meta_signature

APP_SECRET = "test-secret"

WEBHOOK_PAYLOAD = {
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "waba1",
            "changes": [
                {
                    "field": "messages",
                    "value": {
                        "messaging_product": "whatsapp",
                        "messages": [
                            {
                                "from": "919999999999",
                                "id": "wamid.demo001",
                                "timestamp": "1700000000",
                                "type": "text",
                                "text": {"body": "2 kg ari und?"},
                            }
                        ],
                    },
                }
            ],
        }
    ],
}


def _sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def test_verify_meta_signature_accepts_matching_digest():
    body = b'{"hello":"world"}'
    sig = _sign(body, APP_SECRET)
    assert verify_meta_signature(body, sig, APP_SECRET) is True


def test_verify_meta_signature_rejects_bad_digest():
    body = b'{"hello":"world"}'
    assert verify_meta_signature(body, "sha256=deadbeef", APP_SECRET) is False


def test_verify_meta_signature_rejects_missing_header():
    body = b'{"hello":"world"}'
    assert verify_meta_signature(body, None, APP_SECRET) is False


def test_webhook_rejects_bad_signature(monkeypatch):
    monkeypatch.setenv("META_APP_SECRET", APP_SECRET)
    client = TestClient(app)

    res = client.post(
        "/webhook",
        content=json.dumps(WEBHOOK_PAYLOAD),
        headers={"X-Hub-Signature-256": "sha256=wrong"},
    )

    assert res.status_code == 401


def test_webhook_acks_valid_signature(monkeypatch):
    monkeypatch.setenv("META_APP_SECRET", APP_SECRET)
    client = TestClient(app)
    body = json.dumps(WEBHOOK_PAYLOAD).encode("utf-8")
    sig = _sign(body, APP_SECRET)

    res = client.post(
        "/webhook",
        content=body,
        headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
    )

    assert res.status_code == 200


def test_webhook_acks_without_app_secret(monkeypatch):
    monkeypatch.delenv("META_APP_SECRET", raising=False)
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    client = TestClient(app)
    body = json.dumps(WEBHOOK_PAYLOAD).encode("utf-8")

    res = client.post(
        "/webhook",
        content=body,
        headers={"Content-Type": "application/json"},
    )

    assert res.status_code == 200


def test_health():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "service": "edge"}


def test_notify_rejects_bad_token(monkeypatch):
    monkeypatch.setenv("SERVICE_SHARED_SECRET", "edge-secret")
    client = TestClient(app)

    res = client.post(
        "/notify",
        json={
            "traceId": "trc_test",
            "customerRef": "919999999999",
            "blocks": [{"type": "text", "body": "order accepted"}],
            "reason": "order_accepted",
        },
        headers={"X-Service-Token": "wrong"},
    )

    assert res.status_code == 401


def test_notify_accepts_valid_token(monkeypatch):
    monkeypatch.setenv("SERVICE_SHARED_SECRET", "edge-secret")
    client = TestClient(app)

    res = client.post(
        "/notify",
        json={
            "traceId": "trc_test",
            "customerRef": "919999999999",
            "blocks": [{"type": "text", "body": "order accepted"}],
            "reason": "order_accepted",
        },
        headers={"X-Service-Token": "edge-secret"},
    )

    assert res.status_code == 202
