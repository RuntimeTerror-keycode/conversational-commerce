import json
from pathlib import Path

from edge.contracts import AgentTurnRequest, AgentTurnResponse

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES_DIR / name).read_text())


def test_agent_turn_request_fixture_parses():
    fixture = load_fixture("agent-turn.json")
    parsed = AgentTurnRequest(**fixture)
    assert parsed.customerRef == "919999999999"
    assert parsed.source == "text"


def test_agent_turn_response_fixture_parses():
    fixture = load_fixture("agent-turn-response.json")
    parsed = AgentTurnResponse(**fixture)
    assert parsed.sessionState == "active"
    assert len(parsed.blocks) == 1
