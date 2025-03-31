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
  const [isLoaded, setIsLoaded] = useState(false);
  const refreshInterval = 5000;
  const [isStandalone, setIsStandalone] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  // if not, start the server
  useEffect(() => {
    const checkHealth = async () => {
      const res = await headlampApi.health();
      const standalone = res?.status !== 'ok';
      setIsStandalone(standalone);
      
      if (!standalone) {
        const authTokenMap = await fetchAuthTokenMap();

        console.log('Starting Headlamp server');
        headlampApi.startServer(authTokenMap);
      }
    };

    checkHealth();
  }, [headlampApi]);


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
   * Checks if the Headlamp server is ready by making a fetch request.
   * Sets the component as loaded if the server responds successfully.
   */
  useEffect(() => {
    const checkHeadlampReady = async () => {
      try {
        const response = await fetch(`${headlampUrl}`);
        if (response.ok) {
          setIsLoaded(true);
        } else {
          throw new Error(`Headlamp not ready: ${response.statusText}`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to check Headlamp readiness:', err);
      }
    };

    if (!isLoaded) {
      checkHeadlampReady();
      const timer = setInterval(checkHeadlampReady, refreshInterval);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [isLoaded, headlampUrl]);

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
    
    // wait for iframe to load before syncing token
    if (iframeRef.current) {
      iframeRef.current.addEventListener('load', syncToken);
    }

    let previousToken = ''
    const pollInterval = setInterval(async () => {
      try{
        const {token} = await identityApi.getCredentials();
        if (token && token !== previousToken){
          previousToken = token;
          syncToken();
        }
      } catch (error){
        console.error('Error checking token', error);
      }
    }, 15000);
    
    return () => clearInterval(pollInterval);

  }, [identityApi,iframeSrc]);

  if (!isLoaded) {
    return <Progress />;
  }


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
