import hashlib
import hmac


def verify_meta_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    """Verify Meta's X-Hub-Signature-256 header over the raw request body.

    Header looks like "sha256=<hex digest>". Comparison is constant-time.
    """
    if not signature_header or not app_secret:
        return False

    prefix = "sha256="
    if not signature_header.startswith(prefix):
        return False

    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header[len(prefix):]
    return hmac.compare_digest(expected, provided)
