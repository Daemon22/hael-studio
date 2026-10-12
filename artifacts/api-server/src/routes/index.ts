import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import runtimeRouter from "./runtime.js";
import workspaceRouter from "./workspace.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspaceRouter);
router.use(runtimeRouter);

export default router;
