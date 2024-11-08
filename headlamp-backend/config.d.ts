export interface Config {
  headlampBackend: {
    /**
     * binaryPath is the path to the Headlamp server binary.
     * @visibility backend
     */
    binaryPath?: string;

    /**
     * pluginsPath is the path to the directory containing the Headlamp plugins.
     * @visibility backend
     */
    pluginsPath?: string;
  };
}
