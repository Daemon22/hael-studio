import { Router, type IRouter } from "express";
import healthRouter from "./health";
import runtimeRouter from "./runtime";
import workspaceRouter from "./workspace";
import orrenRouter from "./orren";
import projectsRouter from "./projects";
import authRouter from "./auth";
import buildsRouter from "./builds";
import runtimeProvenanceRouter from "./runtimeProvenance";
import repositoryRouter from "./repository";
import terminalRouter from "./terminal";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(runtimeProvenanceRouter);
router.use(projectsRouter);
const projectRouter: IRouter = Router({ mergeParams: true });
projectRouter.use(repositoryRouter);
projectRouter.use(terminalRouter);
projectRouter.use(workspaceRouter);
projectRouter.use(runtimeRouter);
projectRouter.use(buildsRouter);
router.use("/projects/:projectId", projectRouter);
router.use(workspaceRouter);
router.use(runtimeRouter);
router.use(orrenRouter);

export default router;
