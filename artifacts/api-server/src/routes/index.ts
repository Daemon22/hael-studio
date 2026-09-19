import { Router, type IRouter } from "express";
import healthRouter from "./health";
import runtimeRouter from "./runtime";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspaceRouter);
router.use(runtimeRouter);

export default router;
