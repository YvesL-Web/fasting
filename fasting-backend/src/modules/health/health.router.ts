import { Router } from "express";
import { FAST_TYPES } from "@fasting/shared";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    fastTypes: FAST_TYPES
  });
});
