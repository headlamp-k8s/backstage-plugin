import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Progress } from '@backstage/core-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { configApiRef, useApi, identityApiRef } from '@backstage/core-plugin-api';
import { headlampApiRef } from '../../api/types';
import { kubernetesApiRef,kubernetesAuthProvidersApiRef } from '@backstage/plugin-kubernetes-react';


/**
 * HeadlampMessage is the type for messages received from headlamp iframe.
 */
interface HeadlampMessage {
  action: string;
  redirectPath: string;
}

/**
 * HeadlampComponent is responsible for rendering an iframe that displays
 * the Headlamp UI and handles messages from the iframe.
 */
export function HeadlampComponent() {
  const config = useApi(configApiRef);
  const headlampApi = useApi(headlampApiRef);
  const refreshInterval = 5000;
  const [isStandalone, setIsStandalone] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverStarted, setServerStarted] = useState(false);
  const [iframeUrlReady, setIframeUrlReady] = useState(false);
  const kubernetesApi = useApi(kubernetesApiRef);
  const kubernetesAuthProvidersApi = useApi(kubernetesAuthProvidersApiRef);

  const fetchAuthTokenMap = async () => {
    const clusters = await kubernetesApi.getClusters();
    const clusterNames: string[] = []
    clusters.forEach(c=>{
      clusterNames.push(
        `${c.authProvider}${
          c.oidcTokenProvider ? `.${c.oidcTokenProvider}` : ''
        }`)
    })

    const authTokenMap: {[key: string]: string} = {}
    for (const clusterName of clusterNames) {
      const auth = await kubernetesAuthProvidersApi.getCredentials(clusterName);
      authTokenMap[clusterName] = auth.token;
    }
    return authTokenMap;
  }

  // Check if Headlamp is running standalone or not
  useEffect(() => {
    const checkHealth = async () => {
      const res = await headlampApi.health();
      const standalone = res?.status !== 'ok';
      setIsStandalone(standalone);
    };

    checkHealth();
  }, [headlampApi]);

  const checkServerRunning = async () => {
    const res = await headlampApi.health();
    setServerRunning(res?.serverRunning);
  }

  // Start server if not standalone
  useEffect(() => {
    const startServer = async () => {
      if (!isStandalone && !serverStarted) {
        const authTokenMap = await fetchAuthTokenMap();
        await headlampApi.startServer(authTokenMap);
        setServerStarted(true);
      }
    }
    startServer();
  }, [isStandalone, serverStarted]);

  // Check server status only after server has been started
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const checkServerStatus = async () => {
      if (!serverRunning) {
        await checkServerRunning();
        if (!serverRunning) {
          timeoutId = setTimeout(checkServerStatus, refreshInterval);
        }
      }
    };

    if (!isStandalone && serverStarted && !serverRunning) {
      checkServerStatus();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isStandalone, serverStarted, serverRunning]);

  const [headlampUrl, setHeadlampUrl] = useState('');
  const [iframeSrc, setIframeSrc] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const initUrl = async () => {
      const baseUrl = await headlampApi.getBaseUrl();
      const url = config.getOptionalString('headlamp.url') || (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
      setHeadlampUrl(url);
    };
    initUrl();
  }, [config]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search).toString();
    setIframeSrc(queryParams ? `${headlampUrl}?${queryParams}` : headlampUrl);
  }, [headlampUrl, location.search]);

  /**
   * Handles messages received from the Headlamp server.
   * Navigates to a new path if a redirectPath is provided in the message.
   *
   * @param {MessageEvent} event - The message event from the Headlamp server.
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== new URL(headlampUrl).origin) return;

      const data: HeadlampMessage = event.data;

      if (data.redirectPath) {
        navigate(data.redirectPath);
      }
    },
    [headlampUrl, navigate],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Add periodic refresh of kubeconfig
  useEffect(() => {
    if (!isStandalone) {
      const refreshKubeconfigPeriodically = async () => {
        const authTokenMap = await fetchAuthTokenMap();
        console.log('Refreshing kubeconfig');
        await headlampApi.refreshKubeconfig(authTokenMap);
      };

      // Initial refresh
      refreshKubeconfigPeriodically();

      // Set up interval for periodic refresh (every minute)
      const intervalId = setInterval(refreshKubeconfigPeriodically, 60000);

      // Cleanup interval on component unmount
      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [isStandalone, headlampApi]);

  const identityApi = useApi(identityApiRef);
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const syncToken = async () => {
      console.log('Syncing token');
      try{
        const {token} = await identityApi.getCredentials();
        if (!token || !iframeRef.current) return;

        // Post the token to the iframe
        iframeRef.current.contentWindow?.postMessage({
          type: 'BACKSTAGE_AUTH_TOKEN', payload: {token},
        }, new URL(iframeSrc).origin)

        console.log('Token posted to iframe');

      } catch (error){
        console.error('Error syncing token', error);
      }
    }

    // Only start token syncing if server is running
    if (serverRunning && iframeRef.current) {
      // Initial sync when iframe loads
      iframeRef.current.addEventListener('load', syncToken);

      syncToken();
      // Set up polling for token changes
      let previousToken = '';
      pollInterval = setInterval(async () => {
        try {
          const {token} = await identityApi.getCredentials();
          if (token && token !== previousToken) {
            previousToken = token;
            syncToken();
          }
        } catch (error) {
          console.error('Error checking token', error);
        }
      }, refreshInterval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (iframeRef.current) {
        iframeRef.current.removeEventListener('load', syncToken);
      }
    };
  }, [identityApi, iframeSrc, serverRunning,iframeUrlReady]);

  // Check if the iframe URL is responding with valid HTML
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkIframeUrl = async () => {
      if (iframeSrc && !iframeUrlReady) {
        try {
          const response = await fetch(iframeSrc);
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            setIframeUrlReady(true);
            // Clear any existing timeout since we're ready
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          } else {
            // If not ready, check again after interval
            timeoutId = setTimeout(checkIframeUrl, refreshInterval);
          }
        } catch (error) {
          console.error('Error checking iframe URL:', error);
          // If error occurs, check again after interval
          timeoutId = setTimeout(checkIframeUrl, refreshInterval);
        }
      }
    };

    // Only start checking if we have a URL and it's not ready yet
    if (iframeSrc && !iframeUrlReady) {
      checkIframeUrl();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [iframeSrc, iframeUrlReady, refreshInterval]);

  // Show loading in these cases:
  // 1. Not standalone and server not started yet
  // 2. Not standalone and server started but not running yet
  // 3. URL or iframeSrc not initialized yet
  // 4. Iframe URL not responding with valid HTML yet
  if ((!isStandalone && (!serverStarted || !serverRunning)) || 
      !headlampUrl || 
      !iframeSrc || 
      !iframeUrlReady) {
    return <Progress />;
  }

  // Only render iframe when server is running, URLs are set, and iframe URL is responding
  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      title="Headlamp"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
      }}
    />
  );
}
