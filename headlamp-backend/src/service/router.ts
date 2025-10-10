import { MiddlewareFactory } from "@backstage/backend-defaults/rootHttpRouter";
import {
  LoggerService,
  RootConfigService,
} from "@backstage/backend-plugin-api";
import express from "express";
import Router from "express-promise-router";
import { HeadlampKubernetesBuilder } from "../headlamp";
import { HttpAuthService } from "@backstage/backend-plugin-api";
import { spawn } from "child_process";
import { ObjectsByEntityRequest } from "@backstage/plugin-kubernetes-backend";
import { KubernetesRequestAuth } from "@backstage/plugin-kubernetes-common";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

async function spawnHeadlamp(
  logger: LoggerService,
  headlampBinaryPath: string,
  kubeconfigPath: string,
  pluginsPath: string
) {
  const headlampProcess = spawn(headlampBinaryPath, [
    "--kubeconfig",
    kubeconfigPath,
    "--plugins-dir",
    pluginsPath,
    "--base-url",
    "/api/headlamp",
    "--enable-dynamic-clusters",
  ]);

  headlampProcess.stdout.on("data", (data) => {
    logger.info(`Headlamp Server stdout: ${data}`);
  });

  headlampProcess.stderr.on("data", (data) => {
    logger.error(`Headlamp Server stderr: ${data}`);
  });

  // Handle process exit
  headlampProcess.on("exit", (code, signal) => {
    logger.error(
      `Headlamp process exited with code ${code} and signal ${signal}`
    );
  });

  // Handle process errors
  headlampProcess.on("error", (error) => {
    logger.error(`Headlamp process error: ${error}`);
  });

  return headlampProcess;
}

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

  // spawn headlamp server
  const headlampProcess = await spawnHeadlamp(
    logger,
    headlampBinaryPath,
    kubeconfigPath,
    pluginsPath
  );

  const router = Router();

  logger.info("Creating Headlamp Server router");

  router.use(express.json());

  router.get("/health", (_, response) => {
    response.json({ status: "ok", serverRunning: headlampProcess !== null });
  });

  router.post("/fetchKubeconfig", async (req, res) => {
    try {
      const credentials = await httpAuth.credentials(req);
      const requestBody: ObjectsByEntityRequest = req.body;
      const auth: KubernetesRequestAuth = requestBody.auth;

      const kubeconfig = await kubernetesBuilder.getKubeconfig(
        credentials,
        auth
      );
      res.json({ kubeconfig: Buffer.from(kubeconfig).toString("base64") });
    } catch (error) {
      logger.error(`Error fetching kubeconfig: ${error}`);
      res.status(500).json({ message: "Error fetching kubeconfig" });
    }
  });

  // spawn headlamp server if not already running
  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());

  // List of all static asset paths that headlamp serves
  const staticAssetPaths = [
    "/assets",
    "/android-chrome",
    "/apple-touch-icon",
    "/favicon",
    "/icon",
    "/logo",
    "/mstile",
    "/safari-pinned-tab",
    "/manifest.json",
    "/robots.txt",
    "/mockServiceWorker.js",
    "/index.html",
  ];

  async function authenticateRequest(req, res, next) {
    // Check for WebSocket upgrade requests more comprehensively
    const isWebSocket =
      req.headers.upgrade &&
      req.headers.upgrade.toLowerCase() === "websocket" &&
      req.headers.connection &&
      req.headers.connection.toLowerCase().includes("upgrade");

    if (
      staticAssetPaths.some((assetPath) => req.path.startsWith(assetPath)) ||
      req.path === "/" ||
      isWebSocket
    ) {
      next();
      return;
    }

    const token = req.headers["x-backstage-token"];
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
    timeout: 30000,
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req, res) => {
      logger.info(`Received request from Headlamp: ${proxyReq.path}`);
      proxyReq.path = req.path;
      fixRequestBody(proxyReq, req);
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Received response from Headlamp: ${proxyRes.statusCode}`);
      res.setHeader(
        "Content-Security-Policy",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval';`
      );

      // Allow embedding in iframes
      res.setHeader("X-Frame-Options", "ALLOWALL");
    },
    onError: (err, req, res) => {
      logger.error(`Error proxying request: ${err}`);
      res.status(500).json({ message: "Error proxying request" });
    },
  });

  router.use("/", authenticateRequest, proxy);

  return router;
}
