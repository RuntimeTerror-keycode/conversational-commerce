import logging

from app.config import META_ACCESS_TOKEN
from app.services.whatsapp import send_text, send_whatsapp_list, send_whatsapp_poll

from .contracts import CartSummaryBlock, ReplyBlock

logger = logging.getLogger("edge.render")


def _cart_summary_text(block: CartSummaryBlock) -> str:
    lines = ["Your cart:", ""]
    for item in block.items:
        lines.append(
            f"{item.productName} × {item.quantity:g} {item.unit} — ₹{item.price:.2f}"
        )
    lines.append("")
    lines.append(f"Total: ₹{block.total:.2f}")
    return "\n".join(lines)


def send_blocks(customer_ref: str, blocks: list[ReplyBlock], trace_id: str) -> None:
    """Render ReplyBlocks into Meta Send Message API calls.

    If no WhatsApp token is configured, log the payload instead so local
    tests and the walking skeleton still work without Meta credentials.
    """
    if not META_ACCESS_TOKEN:
        for block in blocks:
            logger.info(
                "meta_send_stub traceId=%s customerRef=%s type=%s payload=%s",
                trace_id,
                customer_ref,
                block.type,
                block.model_dump(),
            )
        return

    for block in blocks:
        try:
            if block.type == "text":
                send_text(customer_ref, block.body)
            elif block.type == "buttons":
                send_whatsapp_poll(
                    destination=customer_ref,
                    question=block.body,
                    options=[
                        {"id": button.id, "title": button.label}
                        for button in block.buttons
                    ],
                )
            elif block.type == "list":
                send_whatsapp_list(
                    destination=customer_ref,
                    body=block.body,
                    rows=[row.model_dump() for row in block.rows],
                    header=block.header,
                )
            elif block.type == "cart_summary":
                send_text(customer_ref, _cart_summary_text(block))
            else:
                logger.warning(
                    "unknown_block_type traceId=%s type=%s",
                    trace_id,
                    getattr(block, "type", None),
                )
                continue

            logger.info(
                "meta_send traceId=%s customerRef=%s type=%s",
                trace_id,
                customer_ref,
                block.type,
            )
        except Exception:
            logger.exception(
                "meta_send_failed traceId=%s customerRef=%s type=%s",
                trace_id,
                customer_ref,
                block.type,
            )
