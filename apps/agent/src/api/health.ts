import type { Request, Response } from "express";

export function health(_req: Request, res: Response) {
  res.status(200).json({ ok: true, service: "ai" });
}
