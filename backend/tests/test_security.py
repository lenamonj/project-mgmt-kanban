from app.security import hash_password, verify_password


def test_hash_is_salted_and_verifies():
    h1 = hash_password("hunter2")
    h2 = hash_password("hunter2")
    assert h1 != h2  # unique salt per call
    assert verify_password("hunter2", h1)
    assert verify_password("hunter2", h2)


def test_wrong_password_fails():
    h = hash_password("correct")
    assert not verify_password("incorrect", h)


def test_malformed_hash_does_not_raise():
    assert not verify_password("anything", "")
    assert not verify_password("anything", "garbage")
    assert not verify_password("anything", "pbkdf2_sha256$only$two")
