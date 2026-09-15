import httpx

from .config import Settings
from .contracts import AgentTurnRequest, AgentTurnResponse


async def call_agent_turn(request: AgentTurnRequest, settings: Settings) -> AgentTurnResponse:
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            settings.agent_turn_url,
            json=request.model_dump(),
            headers={"X-Service-Token": settings.service_shared_secret},
        )
        resp.raise_for_status()
        return AgentTurnResponse.model_validate(resp.json())
