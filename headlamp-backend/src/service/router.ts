import { MiddlewareFactory } from "@backstage/backend-defaults/rootHttpRouter";
import {
  LoggerService,
  RootConfigService,
} from "@backstage/backend-plugin-api";
import express from "express";
import Router from "express-promise-router";
import { HeadlampKubernetesBuilder } from "../headlamp";
import { HttpAuthService } from "@backstage/backend-plugin-api";
import fs from "fs";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { BackstageCredentials } from "@backstage/backend-plugin-api";

export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
  kubernetesBuilder: HeadlampKubernetesBuilder;
  httpAuth: HttpAuthService;
  kubeconfigPath: string;
  headlampBinaryPath: string;
  pluginsPath: string;
}

export async function createRouter(
  options: RouterOptions
): Promise<express.Router> {
  const {
    logger,
    config,
    kubernetesBuilder,
    httpAuth,
    kubeconfigPath,
    headlampBinaryPath,
    pluginsPath,
  } = options;

  const router = Router();
  let headlampProcess: ChildProcessWithoutNullStreams | null = null;

  logger.info("Creating Headlamp Server router");

  router.use(express.json());

  router.get("/health", (_, response) => {
    response.json({ status: "ok" });
  });

  router.post("/refreshKubeconfig", async (req, res) => {
    try {
      const credentials = await httpAuth.credentials(req);

      const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials);

      // write kubeconfig to file
      fs.writeFileSync(kubeconfigPath, kubeconfig);
      res.json({ status: "ok" });
    } catch (error) {
      logger.error(`Error refreshing kubeconfig: ${error}`);
      res.status(500).json({ message: "Error refreshing kubeconfig" });
    }
  });

  // spawn headlamp server if not already running
  router.post("/start", async (req, res) => {
    try {
      const credentials = await httpAuth.credentials(req);
      if (!headlampProcess) {
        headlampProcess = await spawnHeadlamp(
          logger,
          credentials,
          kubernetesBuilder,
          headlampBinaryPath,
          kubeconfigPath,
          pluginsPath
        );
        res.json({ message: "Headlamp Server started" });
      } else {
        logger.info("Headlamp Server already running, refreshing kubeconfig");
        const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials);

        // write kubeconfig to file
        fs.writeFileSync(kubeconfigPath, kubeconfig);
        res.json({ message: "Headlamp Server kubeconfig refreshed" });
      }
    } catch (error) {
      logger.error(`Error starting Headlamp Server: ${error}`);
      res.status(500).json({ message: "Error starting Headlamp Server" });
    }
  });

  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());
  return router;
}

async function spawnHeadlamp(
  logger: LoggerService,
  credentials: BackstageCredentials,
  kubernetesBuilder: HeadlampKubernetesBuilder,
  headlampBinaryPath: string,
  kubeconfigPath: string,
  pluginsPath: string
) {
  try {
    const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials);
    fs.writeFileSync(kubeconfigPath, kubeconfig);
  } catch (error) {
    logger.error(`Error creating kubeconfig from kubernetes config: ${error}`);
  }
  const headlampProcess = spawn(headlampBinaryPath, [
    "--kubeconfig",
    kubeconfigPath,
    "--plugins-dir",
    pluginsPath,
  ]);

  headlampProcess.stdout.on("data", (data) => {
    logger.info(`Headlamp Server stdout: ${data}`);
  });

  headlampProcess.stderr.on("data", (data) => {
    logger.error(`Headlamp Server stderr: ${data}`);
  });

  return headlampProcess;
}
