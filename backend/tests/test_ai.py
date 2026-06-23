from types import SimpleNamespace

from app import ai


def test_chat_calls_model(monkeypatch):
    captured = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        message = SimpleNamespace(content="4")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
    )
    monkeypatch.setattr(ai, "_client", lambda: fake_client)

    result = ai.chat([{"role": "user", "content": "What is 2+2?"}])

    assert result == "4"
    assert captured["model"] == ai.MODEL
    assert captured["messages"][0]["content"] == "What is 2+2?"
