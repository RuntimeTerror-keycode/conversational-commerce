"""Re-exports the shared Pydantic contracts from packages/contracts/python.

That module lives outside this package (it is shared with no other Python
project yet, so it is not published) — import it by path instead of
duplicating the models here.
"""
import sys
from pathlib import Path

_CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "python"
if str(_CONTRACTS_DIR) not in sys.path:
    sys.path.insert(0, str(_CONTRACTS_DIR))

from contracts import (  # noqa: E402
    AgentTurnRequest,
    AgentTurnResponse,
    NotifyRequest,
    ReplyBlock,
    TextBlock,
)

__all__ = ["AgentTurnRequest", "AgentTurnResponse", "NotifyRequest", "ReplyBlock", "TextBlock"]
