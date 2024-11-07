/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Progress } from '@backstage/core-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const refreshInterval = 5000;

  const headlampUrl =
    config.getOptionalString('headlamp.url') ||
    `${window.location.protocol}//${window.location.hostname}:4466`;
  const navigate = useNavigate();
  const location = useLocation();

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

  if (!isLoaded) {
    return <Progress />;
  }

  const queryParams = new URLSearchParams(location.search).toString();
  const iframeSrc = queryParams ? `${headlampUrl}?${queryParams}` : headlampUrl;

  return (
    <iframe
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
