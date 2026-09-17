// Re-exports the shared wire contract — apps/api must not define its own
// parallel shapes for these. See packages/contracts/src/index.ts and
// apps/Whatsapp contract.md.
export {
  WhatsappAddress,
  WhatsappSearchRequest,
  WhatsappRow,
  WhatsappSearchResponse,
  WhatsappSelectRequest,
  WhatsappCartLine,
  WhatsappCart,
  WhatsappSubstitute,
  WhatsappSelectResponse,
} from '@cc/contracts';
