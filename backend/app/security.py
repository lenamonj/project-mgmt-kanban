import hashlib
import hmac
import os

# Password hashing with the standard library (PBKDF2-HMAC-SHA256). No native
# build dependency, which keeps the app portable across platforms.

_ITERATIONS = 200_000
_ALGO = "sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(_ALGO, password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_{_ALGO}${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
        algo = scheme.split("_", 1)[1]
        digest = hashlib.pbkdf2_hmac(
            algo, password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
    except (ValueError, IndexError):
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)
