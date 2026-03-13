import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantConfig } from './entities/merchant-config.entity';
import { IMerchantConfigPlugin } from './interfaces/merchant-config-plugin.interface';

@Injectable()
export class MerchantConfigService {
  private plugins: Map<string, IMerchantConfigPlugin> = new Map();
  private configCache: Map<string, Map<string, any>> = new Map(); // merchantId -> key -> value

  constructor(
    @InjectRepository(MerchantConfig)
    private configRepository: Repository<MerchantConfig>,
  ) {}

  /**
   * Register a config plugin
   */
  registerPlugin(plugin: IMerchantConfigPlugin): void {
    this.plugins.set(plugin.getName(), plugin);
  }

  /**
   * Get plugin for a config key
   */
  private getPluginForKey(key: string): IMerchantConfigPlugin {
    // Find plugin that supports this key
    for (const plugin of this.plugins.values()) {
      if (plugin.getSupportedKeys().includes(key)) {
        return plugin;
      }
    }
    // Default to default plugin
    return this.plugins.get('default')!;
  }

  /**
   * Get config value for merchant
   */
  async getConfig(
    merchantId: number,
    key: string,
    defaultValue?: any,
  ): Promise<any> {
    const cacheKey = `${merchantId}_${key}`;
    const merchantCache = this.configCache.get(String(merchantId));

    if (merchantCache && merchantCache.has(key)) {
      return merchantCache.get(key);
    }

    const config = await this.configRepository.findOne({
      where: { merchant_id: merchantId, key },
    });

    if (config) {
      let value: any;
      try {
        value = JSON.parse(config.value);
      } catch {
        value = config.value;
      }

      // Cache it
      if (!merchantCache) {
        this.configCache.set(String(merchantId), new Map());
      }
      this.configCache.get(String(merchantId))!.set(key, value);

      return value;
    }

    // Try default from plugin
    const plugin = this.getPluginForKey(key);
    if (plugin.getDefaults && defaultValue === undefined) {
      const defaults = plugin.getDefaults();
      if (defaults[key] !== undefined) {
        return defaults[key];
      }
    }

    return defaultValue;
  }

  /**
   * Set config value for merchant
   */
  async setConfig(
    merchantId: number,
    key: string,
    value: any,
    pluginName?: string,
  ): Promise<void> {
    const plugin = pluginName
      ? this.plugins.get(pluginName)
      : this.getPluginForKey(key);

    if (!plugin) {
      throw new NotFoundException(`Config plugin not found`);
    }

    // Validate
    if (!plugin.validateConfig(key, value)) {
      throw new Error(`Invalid config value for key: ${key}`);
    }

    // Transform if needed
    let finalValue = value;
    if (plugin.transformConfig) {
      finalValue = plugin.transformConfig(key, value);
    }

    // Get old value for hook
    const oldValue = await this.getConfig(merchantId, key, null);

    // Save to database
    const valueString =
      typeof finalValue === 'string' ? finalValue : JSON.stringify(finalValue);

    let config = await this.configRepository.findOne({
      where: { merchant_id: merchantId, key },
    });

    if (config) {
      config.value = valueString;
      config.plugin_name = pluginName || plugin.getName();
    } else {
      config = this.configRepository.create({
        merchant_id: merchantId,
        key,
        value: valueString,
        plugin_name: pluginName || plugin.getName(),
      });
    }

    await this.configRepository.save(config);

    // Update cache
    if (!this.configCache.has(String(merchantId))) {
      this.configCache.set(String(merchantId), new Map());
    }
    this.configCache.get(String(merchantId))!.set(key, finalValue);

    // Call hook if exists
    if (plugin.onConfigChange) {
      await plugin.onConfigChange(merchantId, key, oldValue, finalValue);
    }
  }

  /**
   * Get all configs for merchant
   */
  async getAllConfigs(merchantId: number): Promise<Record<string, any>> {
    const configs = await this.configRepository.find({
      where: { merchant_id: merchantId },
    });

    const result: Record<string, any> = {};

    for (const config of configs) {
      try {
        result[config.key] = JSON.parse(config.value);
      } catch {
        result[config.key] = config.value;
      }
    }

    // Merge with defaults
    const plugin = this.plugins.get('default')!;
    if (plugin.getDefaults) {
      const defaults = plugin.getDefaults();
      for (const [key, value] of Object.entries(defaults)) {
        if (result[key] === undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Clear config cache for merchant
   */
  clearCache(merchantId: number): void {
    this.configCache.delete(String(merchantId));
  }
}
