// src/lib/services/__tests__/configurationManager.test.ts
// Tests for configuration management utilities

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationManager, ConfigurationPackage, DeploymentHistoryEntry } from '../configurationManager';
import { FeatureFlagManager, FeatureFlagConfig } from '../featureFlagManager';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn()
  }
}));

describe('ConfigurationManager', () => {
  let configurationManager: ConfigurationManager;
  let featureFlagManager: FeatureFlagManager;
  let mockFs: any;

  beforeEach(() => {
    mockFs = fs as any;
    
    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockRejectedValue(new Error('File not found'));
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ mtime: new Date() });

    featureFlagManager = new FeatureFlagManager();
    configurationManager = new ConfigurationManager(
      featureFlagManager,
      './test-config'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create configuration directories', () => {
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-config', { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-config/packages', { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-config/history', { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-config/backups', { recursive: true });
    });

    it('should load existing deployment history', async () => {
      const mockHistory = [
        {
          deploymentId: 'dep_123',
          packageId: 'pkg_123',
          environment: 'production',
          status: 'completed',
          startTime: Date.now(),
          deployedBy: 'test_user'
        }
      ];

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockHistory));

      const manager = new ConfigurationManager(featureFlagManager, './test-config-2');
      
      // Allow async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.readFile).toHaveBeenCalledWith('./test-config-2/deployment_history.json', 'utf-8');
    });
  });

  describe('Configuration Package Creation', () => {
    it('should create configuration package with valid data', async () => {
      const packageData = await configurationManager.createConfigurationPackage(
        'Test Package',
        'Test description',
        'development',
        'test_user',
        {
          featureFlags: {
            enableEmbeddings: false,
            enableExpansion: 'off'
          },
          deploymentStrategy: 'immediate',
          healthChecks: ['test_check']
        }
      );

      expect(packageData).toMatchObject({
        name: 'Test Package',
        description: 'Test description',
        environment: 'development',
        createdBy: 'test_user',
        deploymentStrategy: 'immediate',
        healthChecks: ['test_check']
      });

      expect(packageData.packageId).toMatch(/^pkg_/);
      expect(packageData.version).toBeTruthy();
      expect(packageData.validationResults).toHaveProperty('isValid');
      expect(packageData.featureFlags.enableEmbeddings).toBe(false);
      expect(packageData.featureFlags.enableExpansion).toBe('off');
    });

    it('should validate configuration during package creation', async () => {
      const packageData = await configurationManager.createConfigurationPackage(
        'Invalid Package',
        'Package with invalid config',
        'development',
        'test_user',
        {
          featureFlags: {
            abTestTrafficSplit: 1.5 // Invalid value
          }
        }
      );

      expect(packageData.validationResults.isValid).toBe(false);
      expect(packageData.validationResults.errors.length).toBeGreaterThan(0);
    });

    it('should save package to disk', async () => {
      await configurationManager.createConfigurationPackage(
        'Save Test',
        'Test saving',
        'development',
        'test_user'
      );

      expect(mockFs.writeFile).toHaveBeenCalled();
      
      const writeCall = mockFs.writeFile.mock.calls.find((call: any) => 
        call[0].includes('packages') && call[0].endsWith('.json')
      );
      
      expect(writeCall).toBeTruthy();
      expect(writeCall[1]).toContain('"name":"Save Test"');
    });
  });

  describe('Configuration Package Loading', () => {
    it('should load existing package', async () => {
      const mockPackage: ConfigurationPackage = {
        packageId: 'pkg_test',
        name: 'Test Package',
        description: 'Test',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now(),
        createdBy: 'test_user',
        featureFlags: featureFlagManager.getConfig(),
        abTests: [],
        hybridRetrievalDefaults: {},
        deploymentStrategy: 'immediate',
        rollbackStrategy: 'manual',
        healthChecks: [],
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPackage));

      const loadedPackage = await configurationManager.loadConfigurationPackage('pkg_test');

      expect(loadedPackage).toEqual(mockPackage);
      expect(mockFs.readFile).toHaveBeenCalledWith('./test-config/packages/pkg_test.json', 'utf-8');
    });

    it('should return null for non-existent package', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const loadedPackage = await configurationManager.loadConfigurationPackage('non_existent');

      expect(loadedPackage).toBeNull();
    });
  });

  describe('Configuration Deployment', () => {
    let mockPackage: ConfigurationPackage;

    beforeEach(() => {
      mockPackage = {
        packageId: 'pkg_deploy_test',
        name: 'Deploy Test',
        description: 'Test deployment',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now(),
        createdBy: 'test_user',
        featureFlags: {
          ...featureFlagManager.getConfig(),
          enableEmbeddings: false
        },
        abTests: [],
        hybridRetrievalDefaults: {},
        deploymentStrategy: 'immediate',
        rollbackStrategy: 'manual',
        healthChecks: ['feature_flag_health'],
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('pkg_deploy_test.json')) {
          return Promise.resolve(JSON.stringify(mockPackage));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should deploy valid configuration package', async () => {
      const result = await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user'
      );

      expect(result.success).toBe(true);
      expect(result.deploymentId).toMatch(/^dep_/);
      expect(result.errors).toHaveLength(0);
    });

    it('should perform dry run without applying changes', async () => {
      const result = await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user',
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      
      // Should not create backup in dry run
      const backupCalls = mockFs.writeFile.mock.calls.filter((call: any) => 
        call[0].includes('backups')
      );
      expect(backupCalls).toHaveLength(0);
    });

    it('should skip health checks when requested', async () => {
      const result = await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user',
        { skipHealthChecks: true }
      );

      expect(result.success).toBe(true);
      // Health checks should be skipped, so no health check failures
    });

    it('should force deployment of invalid configuration', async () => {
      mockPackage.validationResults = {
        isValid: false,
        errors: ['Test error'],
        warnings: [],
        safeDefaults: {}
      };

      const result = await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user',
        { forceDeployment: true }
      );

      expect(result.success).toBe(true);
    });

    it('should fail deployment of invalid configuration without force', async () => {
      mockPackage.validationResults = {
        isValid: false,
        errors: ['Test error'],
        warnings: [],
        safeDefaults: {}
      };

      const result = await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Test error');
    });

    it('should create backup before deployment', async () => {
      await configurationManager.deployConfiguration(
        'pkg_deploy_test',
        'deploy_user'
      );

      const backupCalls = mockFs.writeFile.mock.calls.filter((call: any) => 
        call[0].includes('backups') && call[0].includes('backup_')
      );
      
      expect(backupCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    let mockPackage: ConfigurationPackage;

    beforeEach(() => {
      mockPackage = {
        packageId: 'pkg_health_test',
        name: 'Health Test',
        description: 'Test health checks',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now(),
        createdBy: 'test_user',
        featureFlags: featureFlagManager.getConfig(),
        abTests: [],
        hybridRetrievalDefaults: {},
        deploymentStrategy: 'immediate',
        rollbackStrategy: 'automatic',
        healthChecks: ['feature_flag_health', 'hybrid_retrieval_health'],
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPackage));
    });

    it('should run health checks during deployment', async () => {
      const result = await configurationManager.deployConfiguration(
        'pkg_health_test',
        'deploy_user'
      );

      expect(result.success).toBe(true);
      // Health checks should pass for valid configuration
    });

    it('should handle unknown health checks', async () => {
      mockPackage.healthChecks = ['unknown_check'];
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPackage));

      const result = await configurationManager.deployConfiguration(
        'pkg_health_test',
        'deploy_user'
      );

      // Should still succeed but with warnings about unknown checks
      expect(result.success).toBe(true);
    });
  });

  describe('Rollback', () => {
    it('should rollback deployment using backup', async () => {
      const mockBackup = {
        deploymentId: 'dep_rollback_test',
        timestamp: Date.now(),
        featureFlags: featureFlagManager.getConfig(),
        configHistory: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await configurationManager.rollbackDeployment(
        'dep_rollback_test',
        'test_rollback'
      );

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail rollback when backup is missing', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('Backup not found'));

      const result = await configurationManager.rollbackDeployment(
        'dep_missing_backup',
        'test_rollback'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Package Listing', () => {
    it('should list available packages', async () => {
      const mockPackages = [
        'pkg_1.json',
        'pkg_2.json',
        'not_a_package.txt'
      ];

      const mockPackage1 = {
        packageId: 'pkg_1',
        name: 'Package 1',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now() - 1000,
        createdBy: 'user1',
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      const mockPackage2 = {
        packageId: 'pkg_2',
        name: 'Package 2',
        version: '2.0.0',
        environment: 'prod',
        createdAt: Date.now(),
        createdBy: 'user2',
        validationResults: { isValid: false, errors: ['error'], warnings: [], safeDefaults: {} }
      };

      mockFs.readdir.mockResolvedValueOnce(mockPackages);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('pkg_1.json')) {
          return Promise.resolve(JSON.stringify(mockPackage1));
        } else if (filePath.includes('pkg_2.json')) {
          return Promise.resolve(JSON.stringify(mockPackage2));
        }
        return Promise.reject(new Error('File not found'));
      });

      const packages = await configurationManager.listConfigurationPackages();

      expect(packages).toHaveLength(2);
      expect(packages[0].packageId).toBe('pkg_2'); // Most recent first
      expect(packages[1].packageId).toBe('pkg_1');
      expect(packages[0].validationPassed).toBe(false);
      expect(packages[1].validationPassed).toBe(true);
    });

    it('should handle corrupted package files gracefully', async () => {
      mockFs.readdir.mockResolvedValueOnce(['corrupted.json', 'valid.json']);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('corrupted.json')) {
          return Promise.resolve('invalid json');
        } else if (filePath.includes('valid.json')) {
          return Promise.resolve(JSON.stringify({
            packageId: 'valid',
            name: 'Valid Package',
            version: '1.0.0',
            environment: 'test',
            createdAt: Date.now(),
            createdBy: 'user',
            validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
          }));
        }
        return Promise.reject(new Error('File not found'));
      });

      const packages = await configurationManager.listConfigurationPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageId).toBe('valid');
    });
  });

  describe('Deployment History', () => {
    it('should track deployment history', async () => {
      const mockPackage = {
        packageId: 'pkg_history_test',
        name: 'History Test',
        description: 'Test history tracking',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now(),
        createdBy: 'test_user',
        featureFlags: featureFlagManager.getConfig(),
        abTests: [],
        hybridRetrievalDefaults: {},
        deploymentStrategy: 'immediate',
        rollbackStrategy: 'manual',
        healthChecks: [],
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPackage));

      await configurationManager.deployConfiguration('pkg_history_test', 'deploy_user');

      const history = configurationManager.getDeploymentHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const latestDeployment = history[0];
      expect(latestDeployment.packageId).toBe('pkg_history_test');
      expect(latestDeployment.deployedBy).toBe('deploy_user');
      expect(latestDeployment.status).toBe('completed');
    });

    it('should save deployment history to disk', async () => {
      const mockPackage = {
        packageId: 'pkg_save_history',
        name: 'Save History Test',
        description: 'Test history saving',
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now(),
        createdBy: 'test_user',
        featureFlags: featureFlagManager.getConfig(),
        abTests: [],
        hybridRetrievalDefaults: {},
        deploymentStrategy: 'immediate',
        rollbackStrategy: 'manual',
        healthChecks: [],
        validationResults: { isValid: true, errors: [], warnings: [], safeDefaults: {} }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPackage));

      await configurationManager.deployConfiguration('pkg_save_history', 'deploy_user');

      const historySaveCalls = mockFs.writeFile.mock.calls.filter((call: any) => 
        call[0].includes('deployment_history.json')
      );
      
      expect(historySaveCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old packages', async () => {
      const mockPackages = Array.from({ length: 60 }, (_, i) => ({
        packageId: `pkg_${i}`,
        name: `Package ${i}`,
        version: '1.0.0',
        environment: 'test',
        createdAt: Date.now() - (i * 1000),
        createdBy: 'user',
        validationPassed: true
      }));

      mockFs.readdir.mockResolvedValueOnce(
        mockPackages.map(p => `${p.packageId}.json`)
      );

      mockFs.readFile.mockImplementation((filePath: string) => {
        const packageId = path.basename(filePath, '.json');
        const pkg = mockPackages.find(p => p.packageId === packageId);
        return pkg ? Promise.resolve(JSON.stringify(pkg)) : Promise.reject(new Error('Not found'));
      });

      await configurationManager.cleanup({ keepPackages: 50 });

      // Should delete 10 old packages
      expect(mockFs.unlink).toHaveBeenCalledTimes(10);
    });

    it('should clean up old backups', async () => {
      const mockBackups = Array.from({ length: 30 }, (_, i) => `backup_${i}.json`);
      
      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath.includes('backups')) {
          return Promise.resolve(mockBackups);
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockImplementation((filePath: string) => {
        const index = parseInt(path.basename(filePath).split('_')[1]);
        return Promise.resolve({
          mtime: new Date(Date.now() - (index * 1000))
        });
      });

      await configurationManager.cleanup({ keepBackups: 20 });

      // Should delete 10 old backups
      expect(mockFs.unlink).toHaveBeenCalledTimes(10);
    });
  });

  describe('Configuration Export/Import', () => {
    it('should export configuration with metadata', () => {
      const exported = configurationManager.exportConfig();

      expect(exported).toHaveProperty('config');
      expect(exported).toHaveProperty('abTests');
      expect(exported).toHaveProperty('metadata');
      expect(exported.metadata).toHaveProperty('exportedAt');
      expect(exported.metadata).toHaveProperty('version');
      expect(exported.metadata).toHaveProperty('environment');
    });

    it('should import valid configuration', () => {
      const exported = configurationManager.exportConfig();
      
      // Modify configuration
      exported.config.enableEmbeddings = false;
      
      const result = configurationManager.importConfig(exported, 'test_import');
      
      expect(result.isValid).toBe(true);
    });
  });
});