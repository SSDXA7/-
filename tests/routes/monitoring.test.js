const { describe, test, expect, jest, beforeEach, afterEach } = require('@jest/globals');
const supertest = require('supertest');
const express = require('express');

describe('Monitoring Routes', () => {
  let app;
  let request;
  let mockMetricsManager;
  let mockHealthCheckManager;

  beforeEach(() => {
    // 创建模拟服务
    mockMetricsManager = {
      getMetrics: jest.fn(),
      getMetricsAsJson: jest.fn(),
      getSummary: jest.fn(),
      reset: jest.fn()
    };

    mockHealthCheckManager = {
      createMiddleware: jest.fn(),
      checkService: jest.fn(),
      getUnhealthyServices: jest.fn(),
      getServicesSummary: jest.fn(),
      checkAllServices: jest.fn()
    };

    // 模拟依赖模块
    jest.doMock('../../src/services/metricsManager', () => mockMetricsManager);
    jest.doMock('../../src/services/healthCheckManager', () => mockHealthCheckManager);
    jest.doMock('../../src/config', () => ({
      isDevelopment: () => true,
      server: { nodeEnv: 'test' },
      monitoring: { enabled: true }
    }));

    // 创建 Express 应用
    app = express();
    app.use(express.json());
    
    const monitoringRoutes = require('../../src/routes/monitoring');
    app.use('/monitoring', monitoringRoutes);

    request = supertest(app);
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Metrics Endpoints', () => {
    test('GET /monitoring/metrics should return prometheus format metrics', async () => {
      const mockMetrics = 'http_requests_total 100\nhttp_request_duration_seconds 0.5';
      mockMetricsManager.getMetrics.mockResolvedValue(mockMetrics);

      const response = await request.get('/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toBe(mockMetrics);
      expect(mockMetricsManager.getMetrics).toHaveBeenCalled();
    });

    test('GET /monitoring/metrics/json should return JSON format metrics', async () => {
      const mockMetrics = [
        { name: 'http_requests_total', value: 100 },
        { name: 'http_request_duration_seconds', value: 0.5 }
      ];
      mockMetricsManager.getMetricsAsJson.mockResolvedValue(mockMetrics);

      const response = await request.get('/monitoring/metrics/json');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        metrics: mockMetrics
      });
    });

    test('GET /monitoring/metrics/summary should return metrics summary', async () => {
      const mockSummary = {
        totalMetrics: 10,
        categories: { http: 2, transactions: 3 }
      };
      mockMetricsManager.getSummary.mockResolvedValue(mockSummary);

      const response = await request.get('/monitoring/metrics/summary');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        summary: mockSummary
      });
    });

    test('POST /monitoring/metrics/reset should reset metrics in development', async () => {
      const response = await request.post('/monitoring/metrics/reset');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        message: 'Metrics reset successfully'
      });
      expect(mockMetricsManager.reset).toHaveBeenCalled();
    });
  });

  describe('Health Check Endpoints', () => {
    test('GET /monitoring/health should use basic health middleware', async () => {
      const mockMiddleware = jest.fn((req, res) => {
        res.json({ status: 'healthy' });
      });
      mockHealthCheckManager.createMiddleware.mockReturnValue(mockMiddleware);

      const response = await request.get('/monitoring/health');

      expect(mockHealthCheckManager.createMiddleware).toHaveBeenCalledWith(false);
      expect(response.body).toMatchObject({ status: 'healthy' });
    });

    test('GET /monitoring/health/detailed should use detailed health middleware', async () => {
      const mockMiddleware = jest.fn((req, res) => {
        res.json({ 
          healthy: true,
          services: { solana: { healthy: true } }
        });
      });
      mockHealthCheckManager.createMiddleware.mockReturnValue(mockMiddleware);

      const response = await request.get('/monitoring/health/detailed');

      expect(mockHealthCheckManager.createMiddleware).toHaveBeenCalledWith(true);
    });

    test('GET /monitoring/health/:service should check specific service', async () => {
      const mockResult = { healthy: true, latency: 100 };
      mockHealthCheckManager.checkService.mockResolvedValue(mockResult);

      const response = await request.get('/monitoring/health/solana');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockHealthCheckManager.checkService).toHaveBeenCalledWith('solana');
    });

    test('GET /monitoring/health/:service should return 404 for unknown service', async () => {
      mockHealthCheckManager.checkService.mockRejectedValue(
        new Error('Service unknown not registered')
      );

      const response = await request.get('/monitoring/health/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Service unknown not registered'
      });
    });

    test('GET /monitoring/health/unhealthy should return unhealthy services', async () => {
      const mockUnhealthy = [
        { name: 'database', error: 'Connection failed' }
      ];
      mockHealthCheckManager.getUnhealthyServices.mockReturnValue(mockUnhealthy);

      const response = await request.get('/monitoring/health/unhealthy');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        count: 1,
        services: mockUnhealthy
      });
    });

    test('POST /monitoring/health/check should trigger manual health check', async () => {
      const mockResults = {
        healthy: true,
        services: { solana: { healthy: true } }
      };
      mockHealthCheckManager.checkAllServices.mockResolvedValue(mockResults);

      const response = await request.post('/monitoring/health/check');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
      expect(mockHealthCheckManager.checkAllServices).toHaveBeenCalled();
    });

    test('POST /monitoring/health/check should check specific service', async () => {
      const mockResult = { healthy: true, latency: 50 };
      mockHealthCheckManager.checkService.mockResolvedValue(mockResult);

      const response = await request
        .post('/monitoring/health/check')
        .send({ service: 'solana' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        service: 'solana',
        result: mockResult
      });
    });
  });

  describe('Status Endpoint', () => {
    test('GET /monitoring/status should return comprehensive system status', async () => {
      const mockHealthSummary = {
        registeredServices: 4,
        services: { solana: { healthy: true } }
      };
      const mockMetricsSummary = {
        totalMetrics: 15,
        categories: { http: 3 }
      };

      mockHealthCheckManager.getServicesSummary.mockReturnValue(mockHealthSummary);
      mockMetricsManager.getSummary.mockResolvedValue(mockMetricsSummary);

      const response = await request.get('/monitoring/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        status: 'running',
        health: mockHealthSummary,
        metrics: mockMetricsSummary,
        system: expect.objectContaining({
          uptime: expect.any(Number),
          memory: expect.any(Object),
          platform: expect.any(String)
        }),
        configuration: expect.any(Object)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle metrics endpoint errors', async () => {
      mockMetricsManager.getMetrics.mockRejectedValue(new Error('Metrics error'));

      const response = await request.get('/monitoring/metrics');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Failed to get metrics'
      });
    });

    test('should handle health check errors', async () => {
      mockHealthCheckManager.checkService.mockRejectedValue(new Error('Health check error'));

      const response = await request.get('/monitoring/health/solana');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Health check failed'
      });
    });
  });
});