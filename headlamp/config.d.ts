export interface Config {
    /** Configurations for the Headlamp plugin */
    headlamp?: {
      /**
       * The url of the Headlamp. Defaults to `window.location.protocol}//${window.location.hostname}:4466`.
       * @visibility frontend
       */
      url?: string;
    };
}