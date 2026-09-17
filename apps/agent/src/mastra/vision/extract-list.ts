import { generateObject } from "ai";
import { z } from "zod";
import type { InboundMedia } from "@cc/contracts";
import { rawMainModel } from "../models.js";

/**
 * Deliberately outside the agent. The image is read once here and only the
 * extracted text reaches the conversation, so a base64 blob can never land in
 * the memory thread and be replayed into every later turn.
 */
export const MAX_LIST_ITEMS = 8;

const ExtractedList = z.object({
  items: z
    .array(
      z.object({
        item: z.string().describe("The product as written, transliterated to Latin script if handwritten in Malayalam."),
        quantity: z.number().nullable().describe("Number written beside the item, or null if none is given."),
        unit: z.string().nullable().describe("Unit as written — kg, g, packet, litre, nos — or null if none is given."),
        legible: z.boolean().describe("False when the handwriting is a guess rather than a confident read."),
      }),
    )
    .describe("Every purchasable item on the list, top to bottom. Omit headings, dates, totals and doodles."),
  readable: z.boolean().describe("False if this is not a shopping list at all, or is too unclear to read."),
});

export type ExtractedList = z.infer<typeof ExtractedList>;

const PROMPT = [
  "This is a photo a customer sent to a grocery shop on WhatsApp. It is usually a handwritten shopping list.",
  "Read every item they want to buy, in the order written.",
  "The writing may be Malayalam script, English, or Manglish (Malayalam in Latin letters). Transliterate Malayalam script to Latin script — do not translate to English, because the shop's search understands Manglish terms like 'ari', 'chaya podi', 'mulaku podi'.",
  "Record the quantity and unit only where they are actually written. Never invent one.",
  "Mark legible: false for any item you are guessing at, so the customer can be asked.",
  "Set readable: false if the photo is not a shopping list, or you cannot read it at all.",
].join("\n");

export async function extractList(media: InboundMedia): Promise<ExtractedList> {
  const { object } = await generateObject({
    model: rawMainModel,
    schema: ExtractedList,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", data: media.dataBase64, mediaType: media.mimeType },
        ],
      },
    ],
  });

  return { ...object, items: object.items.slice(0, MAX_LIST_ITEMS) };
}
