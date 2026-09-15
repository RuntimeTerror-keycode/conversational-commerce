import logging

from .contracts import ReplyBlock

logger = logging.getLogger("edge.render")


def send_blocks(customer_ref: str, blocks: list[ReplyBlock], trace_id: str) -> None:
    """Render ReplyBlocks into Meta Send Message API calls.

    Stubbed for the walking skeleton — logs what would be sent instead of
    calling the Meta Graph API.
    """
    for block in blocks:
        logger.info(
            "meta_send_stub traceId=%s customerRef=%s type=%s payload=%s",
            trace_id,
            customer_ref,
            block.type,
            block.model_dump(),
        )
