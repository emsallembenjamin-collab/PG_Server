/**
 * Merchant Config Plugin Interface
 * Implement this interface to create custom merchant configuration handlers
 */
export interface IMerchantConfigPlugin {
  /**
   * Get plugin name
   */
  getName(): string;

  /**
   * Get supported config keys
   */
  getSupportedKeys(): string[];

  /**
   * Validate config value
   */
  validateConfig(key: string, value: any): boolean;

  /**
   * Transform config value (for display or processing)
   */
  transformConfig?(key: string, value: any): any;

  /**
   * Get default config values
   */
  getDefaults?(): Record<string, any>;

  /**
   * Process config change (hooks for side effects)
   */
  onConfigChange?(
    merchantId: number,
    key: string,
    oldValue: any,
    newValue: any,
  ): Promise<void>;
}
