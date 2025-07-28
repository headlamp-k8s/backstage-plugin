import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  configApiRef,
  useApi,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { headlampApiRef } from '../../api/types';
import {
  kubernetesApiRef,
  kubernetesAuthProvidersApiRef,
} from '@backstage/plugin-kubernetes-react';
import {
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Header } from '@backstage/core-components';
import MoreVert from '@material-ui/icons/MoreVert';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Popover from '@material-ui/core/Popover';
import { makeStyles, Theme } from '@material-ui/core/styles';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import SecurityIcon from '@material-ui/icons/Security';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';

// Constants
const CONSENT_STORAGE_KEY = 'headlamp-token-sharing-consent';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const TOKEN_TIMEOUT_MS = 30000;

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
    height: props => (props.isHeaderVisible ? 'calc(100vh - 88px)' : '100vh'), // 64px header + 24px toggle
    transition: 'height 0.3s ease-in-out',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  dialogContent: {
    minWidth: 400,
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
  retryAttempt: number;
}

function MoreOptions({
  onSendToken,
  onShareKubeconfig,
  isTokenSending,
  isKubeconfigSending,
  onClose,
  popoverOpen,
  retryAttempt,
}: MoreOptionsProps) {
  const classes = useStyles({ isHeaderVisible: false });
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>();

  const onOpen = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    onClose(); // This will set popoverOpen to true in the parent
  };

  const handleClose = () => {
    setAnchorEl(undefined);
    onClose();
  };

  // Close the popover when popoverOpen becomes false
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
        aria-controls="headlamp-menu"
        aria-expanded={!!anchorEl}
        aria-haspopup="true"
        role="button"
        onClick={onOpen}
        data-testid="menu-button"
        color="inherit"
        className={classes.button}
      >
        <MoreVert />
      </IconButton>
      <Popover
        aria-labelledby="headlamp-menu"
        open={Boolean(anchorEl) && popoverOpen}
        onClose={handleClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList>
          <MenuItem
            onClick={() => {
              onSendToken();
              handleClose();
            }}
            disabled={isTokenSending}
          >
            <ListItemIcon>
              {isTokenSending ? <CircularProgress size={20} /> : <VpnKeyIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText 
              primary={isTokenSending 
                ? retryAttempt > 0 
                  ? `Sharing Token (Retry ${retryAttempt}/${MAX_RETRY_ATTEMPTS})...` 
                  : "Sharing Token..." 
                : "Manually Share Token"
              }
            />
          </MenuItem>
          <MenuItem
            onClick={() => {
              onShareKubeconfig();
              handleClose();
            }}
            disabled={isKubeconfigSending}
          >
            <ListItemIcon>
              {isKubeconfigSending ? <CircularProgress size={20} /> : <SecurityIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText 
              primary={isKubeconfigSending 
                ? retryAttempt > 0 
                  ? `Sharing Kubeconfig (Retry ${retryAttempt}/${MAX_RETRY_ATTEMPTS})...` 
                  : "Sharing Kubeconfig..." 
                : "Manually Share Kubeconfig"
              }
            />
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}

interface ConsentDialogProps {
  open: boolean;
  onClose: () => void;
  onConsent: (consent: boolean) => void;
  rememberChoice: boolean;
  onRememberChoiceChange: (checked: boolean) => void;
  isTokenSending: boolean;
  isKubeconfigSending: boolean;
  error?: string;
  retryAttempt: number;
}

const useDialogStyles = makeStyles(theme => ({
  dialogContent: {
    minWidth: 400,
  },
}));

function ConsentDialog({
  open,
  onClose,
  onConsent,
  rememberChoice,
  onRememberChoiceChange,
  isTokenSending,
  isKubeconfigSending,
  error,
  retryAttempt,
}: ConsentDialogProps) {
  const classes = useDialogStyles();
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="consent-dialog-title"
      disableEscapeKeyDown
    >
      <DialogTitle id="consent-dialog-title">
        Authentication Required for Headlamp
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Typography gutterBottom>
          To provide seamless cluster management, Headlamp requires access to:
        </Typography>
        <Typography component="ul">
          <li>Your Backstage authentication token</li>
          <li>Your Kubernetes configuration</li>
        </Typography>
        <Typography gutterBottom sx={{ mt: 2 }}>
          By allowing access, Headlamp will automatically receive these
          credentials to authenticate with your clusters. This enables full
          cluster management capabilities. Without access, Headlamp's
          functionality will be limited.
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={rememberChoice}
              onChange={e => onRememberChoiceChange(e.target.checked)}
            />
          }
          label="Remember this preference"
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => onConsent(true)}
          color="primary"
          variant="contained"
          fullWidth
          disabled={isTokenSending || isKubeconfigSending}
          startIcon={
            isTokenSending || isKubeconfigSending ? (
              <CircularProgress size={20} color="inherit" />
            ) : null
          }
        >
          {isTokenSending
            ? retryAttempt > 0 
              ? `Sharing Token (Retry ${retryAttempt}/${MAX_RETRY_ATTEMPTS})...` 
              : "Sharing Token..."
            : isKubeconfigSending
            ? retryAttempt > 0 
              ? `Sharing Kubeconfig (Retry ${retryAttempt}/${MAX_RETRY_ATTEMPTS})...` 
              : "Sharing Kubeconfig..."
            : "Allow Access"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Add type definitions for the callback functions
type SyncTokenFunction = (isRetry?: boolean) => Promise<void>;
type ShareKubeconfigFunction = (isRetry?: boolean) => Promise<void>;
type RetryTokenSharingFunction = () => Promise<void>;
type RetryKubeconfigSharingFunction = () => Promise<void>;
type FetchAuthTokenMapFunction = () => Promise<{ [key: string]: string }>;

export function HeadlampComponent() {
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [consentGiven, setConsentGiven] = useState(
    localStorage.getItem(CONSENT_STORAGE_KEY) === 'true',
  );
  const [showDialog, setShowDialog] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(true);
  const [isStandalone, setIsStandalone] = useState<boolean | undefined>(undefined);
  const [isTokenSending, setIsTokenSending] = useState(false);
  const [isKubeconfigSending, setIsKubeconfigSending] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const classes = useStyles({ isHeaderVisible });

  const config = useApi(configApiRef);
  const headlampApi = useApi(headlampApiRef);
  const kubernetesApi = useApi(kubernetesApiRef);
  const kubernetesAuthProvidersApi = useApi(kubernetesAuthProvidersApiRef);
  const identityApi = useApi(identityApiRef);
  const [iframeURL, setIframeURL] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const navigate = useNavigate();
  const location = useLocation();

    /**
   * Handles messages received from the Headlamp server.
   * Navigates to a new path if a redirectPath is provided in the message.
   *
   * @param {MessageEvent} event - The message event from the Headlamp server.
   */
    const handleNavigateMessage = useCallback(
        (event: MessageEvent) => {
          if (event.origin !== new URL(iframeURL).origin) return;
    
          const data: HeadlampMessage = event.data;
    
          if (data.redirectPath) {
            navigate(data.redirectPath);
          }
        },
        [iframeURL, navigate],
      );
    
      useEffect(() => {
        window.addEventListener('message', handleNavigateMessage);
        return () => window.removeEventListener('message', handleNavigateMessage);
      }, [handleNavigateMessage]);

  // Declare all functions at the top
  const fetchAuthTokenMap = useCallback<FetchAuthTokenMapFunction>(async () => {
    const clusters = await kubernetesApi.getClusters();
    const clusterNames: string[] = [];
    clusters.forEach(c => {
      clusterNames.push(
        `${c.authProvider}${
          c.oidcTokenProvider ? `.${c.oidcTokenProvider}` : ''
        }`,
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

  const syncToken = useCallback<SyncTokenFunction>(async (isRetry = false) => {
    if (!isRetry) {
      setRetryAttempt(0);
    }
    setIsTokenSending(true);
    
    try {
      const { token } = await identityApi.getCredentials();
      if (!token) {
        throw new Error('Failed to get token from identity API');
      }
      
      if (!iframeRef.current || !iframeRef.current.contentWindow) {
        throw new Error('Iframe not ready or not accessible');
      }

      const targetOrigin = new URL(iframeURL).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_AUTH_TOKEN',
          payload: { token: token },
        },
        targetOrigin,
      );

      // Set a timeout to trigger retry if no acknowledgment is received
      const timeout = setTimeout(() => {
        if (isTokenSending) {
          const nextAttempt = retryAttempt + 1;
          if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
            setRetryAttempt(nextAttempt);
            syncToken(true);
          } else {
            setIsTokenSending(false);
            setRetryAttempt(0);
            setSnackbarMessage(`Failed to send token after ${MAX_RETRY_ATTEMPTS} attempts: No response received`);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            setPopoverOpen(false);
          }
        }
      }, TOKEN_TIMEOUT_MS);

      // Store cleanup function in ref instead of returning it
      retryTimeoutRef.current = timeout;
    } catch (error) {
      console.error('Token sharing error:', error);
      const nextAttempt = retryAttempt + 1;
      if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
        retryTimeoutRef.current = setTimeout(() => {
          setRetryAttempt(nextAttempt);
          syncToken(true);
        }, RETRY_DELAY_MS);
      } else {
        setIsTokenSending(false);
        setRetryAttempt(0);
        setSnackbarMessage('Failed to send token: ' + (error as Error).message);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setPopoverOpen(false);
      }
    }
  }, [iframeURL, retryAttempt, isTokenSending, identityApi]);

  const shareKubeconfig = useCallback<ShareKubeconfigFunction>(async (isRetry = false) => {
    if (!isRetry) {
      setRetryAttempt(0);
    }
    setIsKubeconfigSending(true);
    
    try {
      const authTokenMap = await fetchAuthTokenMap();
      const { kubeconfig } = await headlampApi.fetchKubeconfig(authTokenMap);
      if (!kubeconfig) {
        throw new Error('Failed to get kubeconfig from API');
      }
      
      if (!iframeRef.current || !iframeRef.current.contentWindow) {
        throw new Error('Iframe not ready or not accessible');
      }

      const targetOrigin = new URL(iframeURL).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_KUBECONFIG',
          payload: { kubeconfig: kubeconfig },
        },
        targetOrigin,
      );

      // Set a timeout to trigger retry if no acknowledgment is received
      const timeout = setTimeout(() => {
        if (isKubeconfigSending) {
          const nextAttempt = retryAttempt + 1;
          if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
            setRetryAttempt(nextAttempt);
            shareKubeconfig(true);
          } else {
            setIsKubeconfigSending(false);
            setRetryAttempt(0);
            setSnackbarMessage(`Failed to share kubeconfig after ${MAX_RETRY_ATTEMPTS} attempts: No response received`);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            setPopoverOpen(false);
          }
        }
      }, TOKEN_TIMEOUT_MS);

      // Store cleanup function in ref instead of returning it
      retryTimeoutRef.current = timeout;
    } catch (error) {
      console.error('Kubeconfig sharing error:', error);
      const nextAttempt = retryAttempt + 1;
      if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
        retryTimeoutRef.current = setTimeout(() => {
          setRetryAttempt(nextAttempt);
          shareKubeconfig(true);
        }, RETRY_DELAY_MS);
      } else {
        setIsKubeconfigSending(false);
        setRetryAttempt(0);
        setSnackbarMessage('Failed to share kubeconfig: ' + (error as Error).message);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setPopoverOpen(false);
      }
    }
  }, [fetchAuthTokenMap, headlampApi, iframeURL, retryAttempt, isKubeconfigSending]);

  const retryTokenSharing = useCallback<RetryTokenSharingFunction>(async () => {
    const nextAttempt = retryAttempt + 1;
    if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
      setRetryAttempt(nextAttempt);
      await syncToken(true);
    } else {
      setIsTokenSending(false);
      setRetryAttempt(0);
      setSnackbarMessage(`Failed to send token after ${MAX_RETRY_ATTEMPTS} attempts`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setDialogError(`Failed to send token after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
  }, [retryAttempt, syncToken]);

  const retryKubeconfigSharing = useCallback<RetryKubeconfigSharingFunction>(async () => {
    const nextAttempt = retryAttempt + 1;
    if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
      setRetryAttempt(nextAttempt);
      await shareKubeconfig(true);
    } else {
      setIsKubeconfigSending(false);
      setRetryAttempt(0);
      setSnackbarMessage(`Failed to share kubeconfig after ${MAX_RETRY_ATTEMPTS} attempts`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setDialogError(`Failed to share kubeconfig after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
  }, [retryAttempt, shareKubeconfig]);

  useEffect(() => {
    const checkConfig = async () => {
      // check if config has headlamp.url configured if yes then set iframeURL to the value and it is standalone
      const iframeUrl = config.getOptionalString('headlamp.url');
      console.log('iframeUrl', iframeUrl);
      if (iframeUrl) {
        const queryParams = new URLSearchParams(location.search).toString();
        const iframeUrlWithParams = iframeUrl.endsWith('/') ? iframeUrl + '?' + queryParams : iframeUrl + '/?' + queryParams;
        setIframeURL(iframeUrlWithParams);
        setIsStandalone(true);
        console.log('iframeUrl is configured', iframeUrl, true);
      } else {
        const iframeUrl = await headlampApi.getBaseUrl();
        const queryParams = new URLSearchParams(location.search).toString();
        const iframeUrlWithParams = iframeUrl.endsWith('/') ? iframeUrl + '?' + queryParams : iframeUrl + '/?' + queryParams;
        setIframeURL(iframeUrlWithParams);
        setIsStandalone(false);
        console.log('iframeUrl is not configured', iframeUrl, false);
        
        // Show consent dialog only if we're not in standalone mode and consent hasn't been given yet
        if (!consentGiven) {
          setShowDialog(true);
        }
      }
    };
    checkConfig();
  }, [config, headlampApi, consentGiven]);

  // Update useEffect to handle iframe ready state and initialize properly
  useEffect(() => {
    if (!iframeURL || isStandalone === undefined) {
      return; // Wait until we have the URL and know if we're standalone
    }

    // If we're not in standalone mode and we have a stored consent
    if (!isStandalone && localStorage.getItem(CONSENT_STORAGE_KEY) === 'true') {
      setConsentGiven(true);
      // We don't auto-open the dialog because we'll handle auth in the iframe load event
    } else if (!isStandalone) {
      // Only show dialog if not standalone and we don't have consent
      setShowDialog(true);
    }
  }, [iframeURL, isStandalone]);

  // Clean up retry timeout when component unmounts
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Add a useEffect to track when the iframe is ready
  useEffect(() => {
    // Only run this effect if we have all the required dependencies
    if (!iframeRef.current || !iframeURL || isStandalone === undefined) {
      return;
    }
    
    const handleIframeLoad = () => {
      console.log('Headlamp iframe loaded successfully');
      
      // If consent was already given, attempt to send credentials after iframe loads
      if (consentGiven && iframeURL && !isStandalone) {
        console.log('Auto-sharing credentials due to previous consent');
        setTimeout(() => {
          syncToken();
        }, 1000); // Small delay to ensure iframe is fully initialized
      }
    };
    
    // Add load event listener to iframe
    const currentIframe = iframeRef.current;
    if (currentIframe) {
      currentIframe.addEventListener('load', handleIframeLoad);
    }
    
    return () => {
      // Clean up event listener
      if (currentIframe) {
        currentIframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [iframeURL, consentGiven, isStandalone, syncToken]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate message origin
      if (!iframeURL || event.origin !== new URL(iframeURL).origin) return;
      
      console.log('Received message:', event.data);
      switch (event.data.type) {
        case 'BACKSTAGE_AUTH_TOKEN_ACK':
          setIsTokenSending(false);
          setRetryAttempt(0);
          setSnackbarMessage('Token sent successfully');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          setPopoverOpen(false);
          break;
        case 'BACKSTAGE_KUBECONFIG_ACK':
          setIsKubeconfigSending(false);
          setRetryAttempt(0);
          setSnackbarMessage('Kubeconfig shared successfully');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          setPopoverOpen(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeURL]);

  const sendKubeconfigWithRetry = useCallback(async () => {
    try {
      if (!iframeRef.current || !iframeRef.current.contentWindow) {
        throw new Error('Iframe not ready or not accessible');
      }

      const authTokenMap = await fetchAuthTokenMap();
      const { kubeconfig } = await headlampApi.fetchKubeconfig(authTokenMap);
      if (!kubeconfig) {
        throw new Error('Failed to get kubeconfig from API');
      }

      const targetOrigin = new URL(iframeURL).origin;
      console.log('Sending kubeconfig to Headlamp iframe');
      
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_KUBECONFIG',
          payload: { kubeconfig: kubeconfig },
        },
        targetOrigin,
      );

      // Wait for kubeconfig ACK
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Kubeconfig sharing timed out'));
        }, TOKEN_TIMEOUT_MS);

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== targetOrigin) return;
          if (event.data.type === 'BACKSTAGE_KUBECONFIG_ACK') {
            console.log('Kubeconfig acknowledged by Headlamp');
            clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            resolve();
          }
        };

        window.addEventListener('message', handleMessage);
      });

      setIsKubeconfigSending(false);
      setRetryAttempt(0);
    } catch (error) {
      console.error('Kubeconfig sharing error:', error);
      const nextAttempt = retryAttempt + 1;
      if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
        retryTimeoutRef.current = setTimeout(() => {
          retryKubeconfigSharing();
        }, RETRY_DELAY_MS);
      } else {
        setIsKubeconfigSending(false);
        setRetryAttempt(0);
        setDialogError(`Kubeconfig sharing failed after ${MAX_RETRY_ATTEMPTS} attempts: ${(error as Error).message}`);
      }
    }
  }, [fetchAuthTokenMap, headlampApi, iframeURL, retryAttempt, retryKubeconfigSharing]);

  const sendTokenWithRetry = useCallback(async () => {
    try {
      // Ensure iframe is ready
      if (!iframeRef.current || !iframeRef.current.contentWindow) {
        throw new Error('Iframe not ready or not accessible');
      }
      
      const { token } = await identityApi.getCredentials();
      if (!token) {
        throw new Error('Failed to get token from identity API');
      }

      const targetOrigin = new URL(iframeURL).origin;
      console.log('Sending token to Headlamp iframe');
      
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'BACKSTAGE_AUTH_TOKEN',
          payload: { token: token },
        },
        targetOrigin,
      );

      // Wait for token ACK
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Token sharing timed out'));
        }, TOKEN_TIMEOUT_MS);

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== targetOrigin) return;
          if (event.data.type === 'BACKSTAGE_AUTH_TOKEN_ACK') {
            console.log('Token acknowledged by Headlamp');
            clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            resolve();
          }
        };

        window.addEventListener('message', handleMessage);
      });

      // After token ACK, start kubeconfig sharing
      setIsTokenSending(false);
      setIsKubeconfigSending(true);
      setRetryAttempt(0);

      await sendKubeconfigWithRetry();

      // Both operations completed successfully
      setShowDialog(false);
      setSnackbarMessage('Authentication completed successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Token sharing error:', error);
      const nextAttempt = retryAttempt + 1;
      if (nextAttempt <= MAX_RETRY_ATTEMPTS) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTokenSharing();
        }, RETRY_DELAY_MS);
      } else {
        setIsTokenSending(false);
        setRetryAttempt(0);
        setDialogError(`Token sharing failed after ${MAX_RETRY_ATTEMPTS} attempts: ${(error as Error).message}`);
      }
    }
  }, [identityApi, iframeURL, retryAttempt, retryTokenSharing, sendKubeconfigWithRetry]);

  const handleConsentResponse = useCallback(async (consent: boolean) => {
    if (!consent) {
      setConsentGiven(false);
      setShowDialog(false);
      return;
    }

    setConsentGiven(true);
    if (rememberChoice) {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    }

    try {
      // Start with token sharing
      setIsTokenSending(true);
      setDialogError(undefined);
      setRetryAttempt(0);
      
      await sendTokenWithRetry();
    } catch (error) {
      setIsTokenSending(false);
      setIsKubeconfigSending(false);
      setRetryAttempt(0);
      setDialogError((error as Error).message);
    }
  }, [rememberChoice, sendTokenWithRetry]);

  return (
    <>
      {!isStandalone && (
        <div>
          {isHeaderVisible && (
            <Header title="Headlamp" subtitle="Kubernetes Dashboard">
              <MoreOptions
                onSendToken={syncToken}
                onShareKubeconfig={shareKubeconfig}
                isTokenSending={isTokenSending}
                isKubeconfigSending={isKubeconfigSending}
                onClose={() => setPopoverOpen(!popoverOpen)}
                popoverOpen={popoverOpen}
                retryAttempt={retryAttempt}
              />
            </Header>
          )}
          <div 
            className={classes.toggleStrip}
            onClick={() => setIsHeaderVisible(!isHeaderVisible)}
          >
            {isHeaderVisible ? (
              <KeyboardArrowUpIcon />
            ) : (
              <KeyboardArrowDownIcon />
            )}
          </div>
        </div>
      )}

      <div className={classes.iframeContainer}>
        <iframe
          ref={iframeRef}
          src={iframeURL}
          title="Headlamp"
          className={classes.iframe}
        />
      </div>

      {!isStandalone && (
        <ConsentDialog
          open={showDialog}
          onClose={() => {
            // Just close the dialog but don't change consent status
            setShowDialog(false);
          }}
          onConsent={handleConsentResponse}
          rememberChoice={rememberChoice}
          onRememberChoiceChange={setRememberChoice}
          isTokenSending={isTokenSending}
          isKubeconfigSending={isKubeconfigSending}
          error={dialogError}
          retryAttempt={retryAttempt}
        />
      )}

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