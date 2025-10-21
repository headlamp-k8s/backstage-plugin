import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Popover from '@material-ui/core/Popover';
import { makeStyles, Theme } from '@material-ui/core/styles';
import MoreVert from '@material-ui/icons/MoreVert';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import SecurityIcon from '@material-ui/icons/Security';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';

// Backstage imports
import { configApiRef, useApi, identityApiRef } from '@backstage/core-plugin-api';
import { Header } from '@backstage/core-components';
import { kubernetesApiRef, kubernetesAuthProvidersApiRef } from '@backstage/plugin-kubernetes-react';
import { headlampApiRef } from '../../api/types';

interface StyleProps {
  isHeaderVisible: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>(theme => ({
  button: {
    color: theme.page.fontColor,
  },
  headerContainer: {
    position: 'relative',
  },
  toggleStrip: {
    height: 24,
    width: '100%',
    backgroundColor: theme.palette.background.paper,
    borderRadius: '0 0 8px 8px',
    boxShadow: theme.shadows[1],
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.background.default,
    },
  },
  iframeContainer: {
    height: props => (props.isHeaderVisible ? 'calc(100vh - 88px)' : '100vh'),
    transition: 'height 0.3s ease-in-out',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
}));

/**
 * HeadlampMessage is the type for messages received from headlamp iframe.
 */
interface HeadlampMessage {
  action: string;
  redirectPath: string;
}

interface MoreOptionsProps {
  onSendToken: () => void;
  onShareKubeconfig: () => void;
  isTokenSending: boolean;
  isKubeconfigSending: boolean;
  onClose: () => void;
  popoverOpen: boolean;
}

function MoreOptions({
  onSendToken,
  onShareKubeconfig,
  isTokenSending,
  isKubeconfigSending,
  onClose,
  popoverOpen,
}: MoreOptionsProps) {
  const classes = useStyles({ isHeaderVisible: false });
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>();

  const onOpen = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    onClose();
  };

  const handleClose = () => {
    setAnchorEl(undefined);
    onClose();
  };

  useEffect(() => {
    if (!popoverOpen) {
      setAnchorEl(undefined);
    }
  }, [popoverOpen]);

  return (
    <>
      <IconButton
        id="headlamp-menu"
        aria-label="More options"
        onClick={onOpen}
        data-testid="menu-button"
        color="inherit"
        className={classes.button}
      >
        <MoreVert />
      </IconButton>
      <Popover
        open={Boolean(anchorEl) && popoverOpen}
        onClose={handleClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList>
          <MenuItem onClick={() => { onSendToken(); handleClose(); }} disabled={isTokenSending}>
            <ListItemIcon>
              {isTokenSending ? <CircularProgress size={20} /> : <VpnKeyIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText primary={isTokenSending ? "Sharing Token..." : "Manually Share Token"} />
          </MenuItem>
          <MenuItem onClick={() => { onShareKubeconfig(); handleClose(); }} disabled={isKubeconfigSending}>
            <ListItemIcon>
              {isKubeconfigSending ? <CircularProgress size={20} /> : <SecurityIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText primary={isKubeconfigSending ? "Sharing Kubeconfig..." : "Manually Share Kubeconfig"} />
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}



export function HeadlampComponent() {
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState<boolean | undefined>(undefined);
  const [isTokenSending, setIsTokenSending] = useState(false);
  const [isKubeconfigSending, setIsKubeconfigSending] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [iframeURL, setIframeURL] = useState('');
  const [credentialsSent, setCredentialsSent] = useState(false);
  const [headlampReady, setHeadlampReady] = useState(false);
  const [tokenAcknowledged, setTokenAcknowledged] = useState(false);
  const [kubeconfigAcknowledged, setKubeconfigAcknowledged] = useState(false);
   
  const classes = useStyles({ isHeaderVisible });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Backstage APIs
  const config = useApi(configApiRef);
  const headlampApi = useApi(headlampApiRef);
  const kubernetesApi = useApi(kubernetesApiRef);
  const kubernetesAuthProvidersApi = useApi(kubernetesAuthProvidersApiRef);
  const identityApi = useApi(identityApiRef);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle messages from iframe
  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      if (iframeURL && event.origin !== new URL(iframeURL).origin) return;
      
      const data = event.data;
      
      // Handle HEADLAMP_READY message
      if (data.type === 'HEADLAMP_READY') {
        console.log('Received HEADLAMP_READY message from iframe');
        setHeadlampReady(true);
        return;
      }
      
      // Handle token acknowledgment
      if (data.type === 'BACKSTAGE_AUTH_TOKEN_ACK') {
        console.log('Token acknowledged by Headlamp iframe');
        setTokenAcknowledged(true);
        setIsTokenSending(false);
        setSnackbarMessage('Token sent successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        return;
      }
      
      // Handle kubeconfig acknowledgment
      if (data.type === 'BACKSTAGE_KUBECONFIG_ACK') {
        console.log('Kubeconfig acknowledged by Headlamp iframe');
        setKubeconfigAcknowledged(true);
        setIsKubeconfigSending(false);
        setSnackbarMessage('Kubeconfig shared successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        return;
      }
      
      // Handle navigation messages (both formats)
      if (data.redirectPath) {
        console.log('Navigating to:', data.redirectPath);
        navigate(data.redirectPath);
        return;
      }
      
      // Handle navigation messages with action format
      if (data.action === 'navigate' && data.redirectPath) {
        console.log('Navigating to:', data.redirectPath);
        navigate(data.redirectPath);
        return;
      }
    },
    [iframeURL, navigate],
  );

  useEffect(() => {
    // Only add message listener when iframeURL is properly set
    if (!iframeURL) return;
    
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleIframeMessage, iframeURL]);

  // Fetch auth token map for kubeconfig
  const fetchAuthTokenMap = useCallback(async () => {
    const clusters = await kubernetesApi.getClusters();
    const clusterNames: string[] = [];
    clusters.forEach((c: any) => {
      clusterNames.push(
        `${c.authProvider}${c.oidcTokenProvider ? `.${c.oidcTokenProvider}` : ''}`,
      );
    });

    const authTokenMap: { [key: string]: string } = {};
    for (const clusterName of clusterNames) {
      const auth = await kubernetesAuthProvidersApi.getCredentials(clusterName);
      if (auth.token) {
        authTokenMap[clusterName] = auth.token;
      }
    }
    return authTokenMap;
  }, [kubernetesApi, kubernetesAuthProvidersApi]);

  // Send token to iframe
  const sendToken = useCallback(async () => {
    setIsTokenSending(true);
    setTokenAcknowledged(false);
    try {
      const { token } = await identityApi.getCredentials();
      if (!token || !iframeRef.current?.contentWindow) {
        throw new Error('Token or iframe not available');
      }

      const targetOrigin = new URL(iframeURL).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_AUTH_TOKEN',
          payload: { token: token },
        },
        targetOrigin,
      );

      console.log('Token sent to Headlamp iframe, waiting for acknowledgment...');
      // Don't show success snackbar here - wait for acknowledgment
    } catch (error) {
      console.error('Token sharing error:', error);
      setIsTokenSending(false);
      setSnackbarMessage(`Failed to send token: ${(error as Error).message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [identityApi, iframeURL]);

  // Send kubeconfig to iframe
  const sendKubeconfig = useCallback(async () => {
    setIsKubeconfigSending(true);
    setKubeconfigAcknowledged(false);
    try {
      const authTokenMap = await fetchAuthTokenMap();
      const { kubeconfig } = await headlampApi.fetchKubeconfig(authTokenMap);
      
      if (!kubeconfig || !iframeRef.current?.contentWindow) {
        throw new Error('Kubeconfig or iframe not available');
      }

      const targetOrigin = new URL(iframeURL).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_KUBECONFIG',
          payload: { kubeconfig: kubeconfig },
        },
        targetOrigin,
      );

      console.log('Kubeconfig sent to Headlamp iframe, waiting for acknowledgment...');
      // Don't show success snackbar here - wait for acknowledgment
    } catch (error) {
      console.error('Kubeconfig sharing error:', error);
      setIsKubeconfigSending(false);
      setSnackbarMessage(`Failed to share kubeconfig: ${(error as Error).message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [fetchAuthTokenMap, headlampApi, iframeURL]);

  // Send both credentials automatically when Headlamp is ready
  const sendCredentials = useCallback(async () => {
    if (credentialsSent || isStandalone || !headlampReady) return;
    
    console.log('Sending credentials to Headlamp iframe');
    try {
      await sendToken();
      await sendKubeconfig();
      setCredentialsSent(true);
    } catch (error) {
      console.error('Failed to send credentials:', error);
    }
  }, [credentialsSent, isStandalone, headlampReady, sendToken, sendKubeconfig]);

  // Initialize iframe URL
  useEffect(() => {
    const initializeIframe = async () => {
      const configuredUrl = config.getOptionalString('headlamp.url');
      const queryParams = new URLSearchParams(location.search).toString();
      
      let baseUrl: string;
      if (configuredUrl) {
        baseUrl = configuredUrl;
        setIsStandalone(true);
        console.log('Using configured Headlamp URL:', configuredUrl);
      } else {
        baseUrl = await headlampApi.getBaseUrl();
        setIsStandalone(false);
        console.log('Using Headlamp API URL:', baseUrl);
      }
      
      const finalUrl = baseUrl.endsWith('/') 
        ? `${baseUrl}?${queryParams}` 
        : `${baseUrl}/?${queryParams}`;
      
      setIframeURL(finalUrl);
    };

    initializeIframe();
  }, [config, headlampApi, location.search]);

  // Handle iframe load event
  useEffect(() => {
    if (!iframeRef.current || !iframeURL) return undefined;

    const handleIframeLoad = () => {
      console.log('Headlamp iframe loaded, waiting for HEADLAMP_READY message...');
      // Reset ready state when iframe reloads
      setHeadlampReady(false);
      setCredentialsSent(false);
      setTokenAcknowledged(false);
      setKubeconfigAcknowledged(false);
    };

    const currentIframe = iframeRef.current;
    currentIframe.addEventListener('load', handleIframeLoad);

    return () => {
      currentIframe.removeEventListener('load', handleIframeLoad);
    };
  }, [iframeURL]);

  // Send credentials when Headlamp becomes ready
  useEffect(() => {
    if (headlampReady && !credentialsSent && !isStandalone) {
      sendCredentials();
    }
  }, [headlampReady, credentialsSent, isStandalone, sendCredentials]);

  return (
    <>
      {!isStandalone && (
        <div>
          {isHeaderVisible && (
            <Header title="Headlamp" subtitle="Kubernetes Dashboard">
              <MoreOptions
                onSendToken={sendToken}
                onShareKubeconfig={sendKubeconfig}
                isTokenSending={isTokenSending}
                isKubeconfigSending={isKubeconfigSending}
                onClose={() => setPopoverOpen(!popoverOpen)}
                popoverOpen={popoverOpen}
              />
            </Header>
          )}
          <IconButton 
            className={classes.toggleStrip}
            onClick={() => setIsHeaderVisible(!isHeaderVisible)}
            aria-label={isHeaderVisible ? "Hide header" : "Show header"}
          >
            {isHeaderVisible ? (
              <KeyboardArrowUpIcon />
            ) : (
              <KeyboardArrowDownIcon />
            )}
          </IconButton>
        </div>
      )}

      <div className={classes.iframeContainer}>
        {iframeURL && (
          <iframe
            ref={iframeRef}
            src={iframeURL}
            title="Headlamp"
            className={classes.iframe}
          />
        )}
      </div>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
