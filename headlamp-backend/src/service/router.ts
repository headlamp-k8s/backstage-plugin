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
import { ObjectsByEntityRequest } from "@backstage/plugin-kubernetes-backend";
import { KubernetesRequestAuth } from "@backstage/plugin-kubernetes-common";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import path from "path";

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
      response.json({ status: "ok", serverRunning: headlampProcess !== null});
  });

  router.post("/refreshKubeconfig", async (req, res) => {
    try {
      const credentials = await httpAuth.credentials(req);
      const requestBody: ObjectsByEntityRequest = req.body; 
      const auth = requestBody.auth;

      const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials,auth);

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
      const requestBody: ObjectsByEntityRequest = req.body;
      const auth: KubernetesRequestAuth = requestBody.auth;

      if (!headlampProcess) {
        headlampProcess = await spawnHeadlamp(
          logger,
          credentials,
          kubernetesBuilder,
          auth,
          headlampBinaryPath,
          kubeconfigPath,
          pluginsPath
        );
        res.json({ message: "Headlamp Server started" });
      } else {
        logger.info("Headlamp Server already running, refreshing kubeconfig");
        const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials,auth);

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

  // List of all static asset paths that headlamp serves
  const staticAssetPaths = [
    '/assets',
    '/android-chrome',
    '/apple-touch-icon',
    '/favicon',
    '/icon',
    '/logo',
    '/mstile',
    '/safari-pinned-tab',
    '/manifest.json',
    '/robots.txt',
    '/mockServiceWorker.js',
    '/index.html'
  ];

  async function authenticateRequest(req,res,next){

    console.log(`Authenticating request: ${req.path}`);
    // Skip authentication for static assets
    if (staticAssetPaths.some(assetPath => req.path.startsWith(assetPath)) || req.path === '/')  {
      next();
      return;
    }

    const token = req.headers['x-backstage-token'];
    if (!token) {
      res.status(401).json({ message: "Unauthorized - No token provided" });
      return;
    }

    try {
      // Create a separate request object for token validation
      const authReq = { ...req };
      authReq.headers = { ...req.headers };
      authReq.headers.authorization = `Bearer ${token}`;
      
      // Verify the token using Backstage's auth service
      const credentials = await httpAuth.credentials(authReq);
      if (!credentials) {
        res.status(401).json({ message: "Unauthorized - Invalid token" });
        return;
      }
      next();
    } catch (error) {
      logger.error(`Authentication error: ${error}`);
      res.status(401).json({ message: "Unauthorized - Authentication failed" });
    }
  }

  const proxy = createProxyMiddleware({
    target: "http://localhost:4466",
    ws: true,
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    onProxyReq: fixRequestBody,
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Received response from Headlamp: ${proxyRes.statusCode}`);
      res.setHeader(
        'Content-Security-Policy',
        `script-src 'self' 'unsafe-inline' 'unsafe-eval';`
      );

      // Allow embedding in iframes
      res.setHeader('X-Frame-Options', 'ALLOWALL');
    },
    onError: (err, req, res) => {
      logger.error(`Error proxying request: ${err}`);
      res.status(500).json({ message: "Error proxying request" });
    }
  });

  router.use("/", authenticateRequest, proxy);

  return router;
}


async function spawnHeadlamp(
  logger: LoggerService,
  credentials: BackstageCredentials,
  kubernetesBuilder: HeadlampKubernetesBuilder,
  auth: KubernetesRequestAuth,
  headlampBinaryPath: string,
  kubeconfigPath: string,
  pluginsPath: string
) {
  try {
    const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials,auth);
    fs.writeFileSync(kubeconfigPath, kubeconfig);
  } catch (error) {
    logger.error(`Error creating kubeconfig from kubernetes config: ${error}`);
  }
  const headlampProcess = spawn(headlampBinaryPath, [
    "--kubeconfig",
    kubeconfigPath,
    "--plugins-dir",
    pluginsPath,
    "--base-url",
    "/api/headlamp"
  ]);

  headlampProcess.stdout.on("data", (data) => {
    logger.info(`Headlamp Server stdout: ${data}`);
  });

  headlampProcess.stderr.on("data", (data) => {
    logger.error(`Headlamp Server stderr: ${data}`);
  });

  return headlampProcess;
}
