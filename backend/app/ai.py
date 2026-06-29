import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# Load the repo-root .env for local runs. In Docker the env comes from env_file.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MODEL = "openai/gpt-oss-120b"
BASE_URL = "https://openrouter.ai/api/v1"
TIMEOUT_SECONDS = 30

_client_instance: OpenAI | None = None


def _client() -> OpenAI:
    global _client_instance
    if _client_instance is None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        _client_instance = OpenAI(
            base_url=BASE_URL, api_key=api_key, timeout=TIMEOUT_SECONDS
        )
    return _client_instance


def chat(messages: list[dict], response_format: dict | None = None) -> str:
    kwargs = {"model": MODEL, "messages": messages}
    if response_format is not None:
        kwargs["response_format"] = response_format
    completion = _client().chat.completions.create(**kwargs)
    content = completion.choices[0].message.content
    if content is None:
        raise RuntimeError("AI returned no content")
    return content


def two_plus_two() -> str:
    """Connectivity check: ask the model a trivial question."""
    return chat(
        [{"role": "user", "content": "What is 2+2? Reply with just the number."}]
    )
