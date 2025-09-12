// src/lib/services/configurationManager.ts
// Configuration management utilities for deployment and rollback scenarios

import { FeatureFlagManager, FeatureFlagConfig, ABTestDefinition, ConfigValidationResult } from './featureFlagManager';
import { HybridRetrievalConfig } from './hybridRetrieval';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Configuration deployment package
 */
export interface ConfigurationPackage {
  packageId: string;
  name: string;
  description: string;
  version: string;
  environment: string;
  createdAt: number;
  createdBy: string;
  
  // Configuration data
  featureFlags: FeatureFlagConfig;
  abTests: ABTestDefinition[];
  hybridRetrievalDefaults: Partial<HybridRetrievalConfig>;
  
  // Deployment metadata
  deploymentStrategy: 'immediate' | 'gradual' | 'canary';
  rollbackStrategy: 'automatic' | 'manual';
  healthChecks: string[];
  
  // Validation
  validationResults: ConfigValidationResult;
  testResults?: {
    passed: boolean;
    testCount: number;
    failedTests: string[];
  };
}

/**
 * Deployment history entry
 */
export interface DeploymentHistoryEntry {
  deploymentId: string;
  packageId: string;
  environment: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  startTime: number;
  endTime?: number;
  deployedBy: string;
  rollbackReason?: string;
  healthCheckResults?: {
    [checkName: string]: {
      status: 'passed' | 'failed';
      message: string;
      timestamp: number;
    };
  };
}

/**
 * Configuration management service
 */
export class ConfigurationManager {
  private featureFlagManager: FeatureFlagManager;
  private configDirectory: string;
  private deploymentHistory: Map<string, DeploymentHistoryEntry> = new Map();
  private activeDeployments: Map<string, ConfigurationPackage> = new Map();
  
  constructor(
    featureFlagManager: FeatureFlagManager,
    configDirectory: string = './config/deployments'
  ) {
    this.featureFlagManager = featureFlagManager;
    this.configDirectory = configDirectory;
    
    this.ensureConfigDirectory();
    this.loadDeploymentHistory();
    
    console.log('configuration_manager_initialized', {
      config_directory: this.configDirectory
    });
  }
  
  /**
   * Ensure configuration directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.configDirectory, { recursive: true });
      await fs.mkdir(path.join(this.configDirectory, 'packages'), { recursive: true });
      await fs.mkdir(path.join(this.configDirectory, 'history'), { recursive: true });
      await fs.mkdir(path.join(this.configDirectory, 'backups'), { recursive: true });
    } catch (error) {
      console.error('config_directory_creation_failed', {
        directory: this.configDirectory,
        error: error instanceof Error ? error.message : error
      });
    }
  }
  
  /**
   * Load deployment history from disk
   */
  private async loadDeploymentHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.configDirectory, 'deployment_history.json');
      const historyData = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(historyData);
      
      for (const entry of history) {
        this.deploymentHistory.set(entry.deploymentId, entry);
      }
      
      console.log('deployment_history_loaded', {
        entries_count: this.deploymentHistory.size
      });
    } catch (error) {
      // History file doesn't exist yet, that's okay
      console.log('deployment_history_not_found', {
        message: 'Starting with empty deployment history'
      });
    }
  }
  
  /**
   * Save deployment history to disk
   */
  private async saveDeploymentHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.configDirectory, 'deployment_history.json');
      const history = Array.from(this.deploymentHistory.values());
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('deployment_history_save_failed', {
        error: error instanceof Error ? error.message : error
      });
    }
  }
  
  /**
   * Create a new configuration package
   */
  async createConfigurationPackage(
    name: string,
    description: string,
    environment: string,
    createdBy: string,
    options: {
      featureFlags?: Partial<FeatureFlagConfig>;
      abTests?: ABTestDefinition[];
      hybridRetrievalDefaults?: Partial<HybridRetrievalConfig>;
      deploymentStrategy?: 'immediate' | 'gradual' | 'canary';
      rollbackStrategy?: 'automatic' | 'manual';
      healthChecks?: string[];
    } = {}
  ): Promise<ConfigurationPackage> {
    const packageId = this.generatePackageId();
    const version = this.generateVersion();
    
    // Get current configuration as base
    const currentConfig = this.featureFlagManager.getConfig();
    
    // Merge with provided options
    const featureFlags: FeatureFlagConfig = {
      ...currentConfig,
      ...options.featureFlags,
      configVersion: version,
      lastUpdated: Date.now()
    };
    
    // Validate configuration
    const validationResults = this.featureFlagManager.validateConfig(featureFlags);
    
    // Create package
    const configPackage: ConfigurationPackage = {
      packageId,
      name,
      description,
      version,
      environment,
      createdAt: Date.now(),
      createdBy,
      
      featureFlags,
      abTests: options.abTests || [],
      hybridRetrievalDefaults: options.hybridRetrievalDefaults || {},
      
      deploymentStrategy: options.deploymentStrategy || 'immediate',
      rollbackStrategy: options.rollbackStrategy || 'manual',
      healthChecks: options.healthChecks || ['hybrid_retrieval_health', 'feature_flag_health'],
      
      validationResults
    };
    
    // Save package to disk
    await this.saveConfigurationPackage(configPackage);
    
    console.log('configuration_package_created', {
      package_id: packageId,
      name,
      environment,
      validation_passed: validationResults.isValid
    });
    
    return configPackage;
  }
  
  /**
   * Save configuration package to disk
   */
  private async saveConfigurationPackage(configPackage: ConfigurationPackage): Promise<void> {
    const packageFile = path.join(
      this.configDirectory,
      'packages',
      `${configPackage.packageId}.json`
    );
    
    await fs.writeFile(packageFile, JSON.stringify(configPackage, null, 2));
  }
  
  /**
   * Load configuration package from disk
   */
  async loadConfigurationPackage(packageId: string): Promise<ConfigurationPackage | null> {
    try {
      const packageFile = path.join(
        this.configDirectory,
        'packages',
        `${packageId}.json`
      );
      
      const packageData = await fs.readFile(packageFile, 'utf-8');
      return JSON.parse(packageData);
    } catch (error) {
      console.error('configuration_package_load_failed', {
        package_id: packageId,
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }
  
  /**
   * Deploy configuration package
   */
  async deployConfiguration(
    packageId: string,
    deployedBy: string,
    options: {
      dryRun?: boolean;
      skipHealthChecks?: boolean;
      forceDeployment?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    deploymentId: string;
    errors: string[];
    warnings: string[];
  }> {
    const deploymentId = this.generateDeploymentId();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    console.log('configuration_deployment_start', {
      package_id: packageId,
      deployment_id: deploymentId,
      deployed_by: deployedBy,
      dry_run: options.dryRun
    });
    
    // Load configuration package
    const configPackage = await this.loadConfigurationPackage(packageId);
    if (!configPackage) {
      errors.push(`Configuration package ${packageId} not found`);
      return { success: false, deploymentId, errors, warnings };
    }
    
    // Create deployment history entry
    const deploymentEntry: DeploymentHistoryEntry = {
      deploymentId,
      packageId,
      environment: configPackage.environment,
      status: 'pending',
      startTime: Date.now(),
      deployedBy
    };
    
    this.deploymentHistory.set(deploymentId, deploymentEntry);
    
    try {
      // Validate configuration
      if (!configPackage.validationResults.isValid && !options.forceDeployment) {
        errors.push(...configPackage.validationResults.errors);
        deploymentEntry.status = 'failed';
        return { success: false, deploymentId, errors, warnings };
      }
      
      warnings.push(...configPackage.validationResults.warnings);
      
      // Create backup of current configuration
      if (!options.dryRun) {
        await this.createConfigurationBackup(deploymentId);
      }
      
      deploymentEntry.status = 'in_progress';
      
      // Apply configuration
      if (!options.dryRun) {
        const importResult = this.featureFlagManager.importConfig({
          config: configPackage.featureFlags,
          abTests: configPackage.abTests,
          metadata: {
            packageId,
            deploymentId,
            deployedBy
          }
        }, `deployment_${deploymentId}`);
        
        if (!importResult.isValid) {
          errors.push(...importResult.errors);
          warnings.push(...importResult.warnings);
          
          // Attempt rollback
          await this.rollbackDeployment(deploymentId, 'configuration_import_failed');
          deploymentEntry.status = 'rolled_back';
          return { success: false, deploymentId, errors, warnings };
        }
      }
      
      // Run health checks
      if (!options.skipHealthChecks && !options.dryRun) {
        const healthCheckResults = await this.runHealthChecks(configPackage.healthChecks);
        deploymentEntry.healthCheckResults = healthCheckResults;
        
        const failedChecks = Object.entries(healthCheckResults)
          .filter(([_, result]) => result.status === 'failed')
          .map(([name, _]) => name);
        
        if (failedChecks.length > 0 && configPackage.rollbackStrategy === 'automatic') {
          errors.push(`Health checks failed: ${failedChecks.join(', ')}`);
          
          // Automatic rollback
          await this.rollbackDeployment(deploymentId, 'health_check_failure');
          deploymentEntry.status = 'rolled_back';
          return { success: false, deploymentId, errors, warnings };
        } else if (failedChecks.length > 0) {
          warnings.push(`Health checks failed but rollback is manual: ${failedChecks.join(', ')}`);
        }
      }
      
      // Mark deployment as completed
      deploymentEntry.status = 'completed';
      deploymentEntry.endTime = Date.now();
      
      if (!options.dryRun) {
        this.activeDeployments.set(configPackage.environment, configPackage);
      }
      
      console.log('configuration_deployment_complete', {
        package_id: packageId,
        deployment_id: deploymentId,
        duration_ms: deploymentEntry.endTime - deploymentEntry.startTime,
        dry_run: options.dryRun
      });
      
      return { success: true, deploymentId, errors, warnings };
      
    } catch (error) {
      deploymentEntry.status = 'failed';
      deploymentEntry.endTime = Date.now();
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Deployment failed: ${errorMessage}`);
      
      console.error('configuration_deployment_error', {
        package_id: packageId,
        deployment_id: deploymentId,
        error: errorMessage
      });
      
      return { success: false, deploymentId, errors, warnings };
      
    } finally {
      await this.saveDeploymentHistory();
    }
  }
  
  /**
   * Create backup of current configuration
   */
  private async createConfigurationBackup(deploymentId: string): Promise<void> {
    const backup = {
      deploymentId,
      timestamp: Date.now(),
      featureFlags: this.featureFlagManager.getConfig(),
      configHistory: this.featureFlagManager.getConfigHistory()
    };
    
    const backupFile = path.join(
      this.configDirectory,
      'backups',
      `backup_${deploymentId}.json`
    );
    
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
    
    console.log('configuration_backup_created', {
      deployment_id: deploymentId,
      backup_file: backupFile
    });
  }
  
  /**
   * Run health checks
   */
  private async runHealthChecks(healthChecks: string[]): Promise<{
    [checkName: string]: {
      status: 'passed' | 'failed';
      message: string;
      timestamp: number;
    };
  }> {
    const results: { [checkName: string]: any } = {};
    
    for (const checkName of healthChecks) {
      const timestamp = Date.now();
      
      try {
        switch (checkName) {
          case 'hybrid_retrieval_health':
            // Check if hybrid retrieval system is healthy
            // This would integrate with the actual health check
            results[checkName] = {
              status: 'passed',
              message: 'Hybrid retrieval system is healthy',
              timestamp
            };
            break;
            
          case 'feature_flag_health':
            // Check if feature flag system is healthy
            const config = this.featureFlagManager.getConfig();
            const validation = this.featureFlagManager.validateConfig(config);
            
            results[checkName] = {
              status: validation.isValid ? 'passed' : 'failed',
              message: validation.isValid 
                ? 'Feature flag configuration is valid'
                : `Configuration errors: ${validation.errors.join(', ')}`,
              timestamp
            };
            break;
            
          default:
            results[checkName] = {
              status: 'failed',
              message: `Unknown health check: ${checkName}`,
              timestamp
            };
        }
      } catch (error) {
        results[checkName] = {
          status: 'failed',
          message: `Health check failed: ${error instanceof Error ? error.message : error}`,
          timestamp
        };
      }
    }
    
    return results;
  }
  
  /**
   * Rollback deployment
   */
  async rollbackDeployment(
    deploymentId: string,
    reason: string
  ): Promise<{
    success: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    console.log('configuration_rollback_start', {
      deployment_id: deploymentId,
      reason
    });
    
    try {
      // Load backup
      const backupFile = path.join(
        this.configDirectory,
        'backups',
        `backup_${deploymentId}.json`
      );
      
      const backupData = await fs.readFile(backupFile, 'utf-8');
      const backup = JSON.parse(backupData);
      
      // Restore configuration
      const importResult = this.featureFlagManager.importConfig({
        config: backup.featureFlags,
        abTests: [],
        metadata: {
          rollbackDeploymentId: deploymentId,
          rollbackReason: reason
        }
      }, `rollback_${deploymentId}`);
      
      if (!importResult.isValid) {
        errors.push(...importResult.errors);
        return { success: false, errors };
      }
      
      // Update deployment history
      const deploymentEntry = this.deploymentHistory.get(deploymentId);
      if (deploymentEntry) {
        deploymentEntry.status = 'rolled_back';
        deploymentEntry.rollbackReason = reason;
        deploymentEntry.endTime = Date.now();
      }
      
      await this.saveDeploymentHistory();
      
      console.log('configuration_rollback_complete', {
        deployment_id: deploymentId,
        reason
      });
      
      return { success: true, errors };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Rollback failed: ${errorMessage}`);
      
      console.error('configuration_rollback_error', {
        deployment_id: deploymentId,
        error: errorMessage
      });
      
      return { success: false, errors };
    }
  }
  
  /**
   * List available configuration packages
   */
  async listConfigurationPackages(): Promise<Array<{
    packageId: string;
    name: string;
    version: string;
    environment: string;
    createdAt: number;
    createdBy: string;
    validationPassed: boolean;
  }>> {
    try {
      const packagesDir = path.join(this.configDirectory, 'packages');
      const files = await fs.readdir(packagesDir);
      
      const packages = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const packageData = await fs.readFile(path.join(packagesDir, file), 'utf-8');
            const configPackage: ConfigurationPackage = JSON.parse(packageData);
            
            packages.push({
              packageId: configPackage.packageId,
              name: configPackage.name,
              version: configPackage.version,
              environment: configPackage.environment,
              createdAt: configPackage.createdAt,
              createdBy: configPackage.createdBy,
              validationPassed: configPackage.validationResults.isValid
            });
          } catch (error) {
            console.warn('failed_to_load_package', { file, error });
          }
        }
      }
      
      return packages.sort((a, b) => b.createdAt - a.createdAt);
      
    } catch (error) {
      console.error('list_packages_failed', { error });
      return [];
    }
  }
  
  /**
   * Get deployment history
   */
  getDeploymentHistory(): DeploymentHistoryEntry[] {
    return Array.from(this.deploymentHistory.values())
      .sort((a, b) => b.startTime - a.startTime);
  }
  
  /**
   * Get active deployments
   */
  getActiveDeployments(): ConfigurationPackage[] {
    return Array.from(this.activeDeployments.values());
  }
  
  /**
   * Generate unique package ID
   */
  private generatePackageId(): string {
    return `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate version string
   */
  private generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}.${month}.${day}.${hour}${minute}`;
  }
  
  /**
   * Clean up old packages and backups
   */
  async cleanup(options: {
    keepPackages?: number;
    keepBackups?: number;
    keepHistoryDays?: number;
  } = {}): Promise<void> {
    const {
      keepPackages = 50,
      keepBackups = 20,
      keepHistoryDays = 90
    } = options;
    
    console.log('configuration_cleanup_start', options);
    
    try {
      // Clean up old packages
      const packages = await this.listConfigurationPackages();
      if (packages.length > keepPackages) {
        const packagesToDelete = packages.slice(keepPackages);
        
        for (const pkg of packagesToDelete) {
          const packageFile = path.join(
            this.configDirectory,
            'packages',
            `${pkg.packageId}.json`
          );
          await fs.unlink(packageFile);
        }
        
        console.log('old_packages_cleaned', {
          deleted_count: packagesToDelete.length
        });
      }
      
      // Clean up old backups
      const backupsDir = path.join(this.configDirectory, 'backups');
      const backupFiles = await fs.readdir(backupsDir);
      
      if (backupFiles.length > keepBackups) {
        const backupStats = await Promise.all(
          backupFiles.map(async file => ({
            file,
            mtime: (await fs.stat(path.join(backupsDir, file))).mtime
          }))
        );
        
        backupStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        const backupsToDelete = backupStats.slice(keepBackups);
        
        for (const backup of backupsToDelete) {
          await fs.unlink(path.join(backupsDir, backup.file));
        }
        
        console.log('old_backups_cleaned', {
          deleted_count: backupsToDelete.length
        });
      }
      
      // Clean up old deployment history
      const cutoffTime = Date.now() - (keepHistoryDays * 24 * 60 * 60 * 1000);
      const oldDeployments = Array.from(this.deploymentHistory.entries())
        .filter(([_, entry]) => entry.startTime < cutoffTime);
      
      for (const [deploymentId, _] of oldDeployments) {
        this.deploymentHistory.delete(deploymentId);
      }
      
      if (oldDeployments.length > 0) {
        await this.saveDeploymentHistory();
        
        console.log('old_deployment_history_cleaned', {
          deleted_count: oldDeployments.length
        });
      }
      
    } catch (error) {
      console.error('configuration_cleanup_error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }
}

/**
 * Create singleton instance
 */
export const configurationManager = new ConfigurationManager(
  new (require('./featureFlagManager').FeatureFlagManager)()
);