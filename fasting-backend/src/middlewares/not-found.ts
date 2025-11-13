import type { Request, Response, NextFunction } from "express";

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: "NotFound", path: req.path });
};
