/**
 * Tests unitaires pour le système de modération
 * 
 * Tests pour :
 * - Détection de doublons
 * - Détection de flood
 * - Validation de domaine
 * - Vérification de durée vidéo
 * - Fonctions de modération
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        neq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn(() => Promise.resolve({ data: null, error: null })),
    delete: jest.fn(() => Promise.resolve({ data: null, error: null }))
  }))
};

// Mock des fonctions de modération
const mockModerationFunctions = {
  checkDuplicates: jest.fn(),
  validateDomain: jest.fn(),
  checkFlood: jest.fn(),
  checkVideoDuration: jest.fn(),
  processAutomodSubmission: jest.fn()
};

describe('Moderation System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate submissions within same contest', async () => {
      const mockSubmission = {
        contest_id: 'contest-123',
        platform_video_id: 'video-456',
        network: 'youtube'
      };

      // Mock existing submission
      mockSupabase.from().select().eq().neq().single.mockResolvedValueOnce({
        data: {
          id: 'existing-submission-123',
          created_at: '2024-01-01T00:00:00Z',
          status: 'approved'
        },
        error: null
      });

      const result = await mockModerationFunctions.checkDuplicates(mockSubmission);
      
      expect(result.isDuplicate).toBe(true);
      expect(result.details.duplicate_count).toBe(1);
    });

    it('should not detect duplicates for different contests', async () => {
      const mockSubmission = {
        contest_id: 'contest-456',
        platform_video_id: 'video-456',
        network: 'youtube'
      };

      // Mock no existing submissions
      mockSupabase.from().select().eq().neq().single.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await mockModerationFunctions.checkDuplicates(mockSubmission);
      
      expect(result.isDuplicate).toBe(false);
      expect(result.details.duplicate_count).toBe(0);
    });

    it('should not detect duplicates for rejected submissions', async () => {
      const mockSubmission = {
        contest_id: 'contest-123',
        platform_video_id: 'video-456',
        network: 'youtube'
      };

      // Mock rejected submission
      mockSupabase.from().select().eq().neq().single.mockResolvedValueOnce({
        data: {
          id: 'rejected-submission-123',
          created_at: '2024-01-01T00:00:00Z',
          status: 'rejected'
        },
        error: null
      });

      const result = await mockModerationFunctions.checkDuplicates(mockSubmission);
      
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Domain Validation', () => {
    it('should validate YouTube URLs', async () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=abc123',
        'https://youtu.be/abc123',
        'https://youtube.com/embed/abc123'
      ];

      for (const url of validUrls) {
        const result = await mockModerationFunctions.validateDomain(url);
        expect(result.isValid).toBe(true);
      }
    });

    it('should validate TikTok URLs', async () => {
      const validUrls = [
        'https://www.tiktok.com/@user/video/1234567890',
        'https://vm.tiktok.com/abc123'
      ];

      for (const url of validUrls) {
        const result = await mockModerationFunctions.validateDomain(url);
        expect(result.isValid).toBe(true);
      }
    });

    it('should validate Instagram URLs', async () => {
      const validUrls = [
        'https://www.instagram.com/p/abc123/',
        'https://www.instagram.com/reel/abc123/'
      ];

      for (const url of validUrls) {
        const result = await mockModerationFunctions.validateDomain(url);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid domains', async () => {
      const invalidUrls = [
        'https://example.com/video',
        'https://vimeo.com/123456',
        'https://dailymotion.com/video/abc123',
        'invalid-url'
      ];

      for (const url of invalidUrls) {
        const result = await mockModerationFunctions.validateDomain(url);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('Flood Detection', () => {
    it('should detect flood submissions', async () => {
      const creatorId = 'creator-123';
      const mockRecentSubmissions = [
        { id: 'sub-1', created_at: '2024-01-01T00:00:00Z' },
        { id: 'sub-2', created_at: '2024-01-01T00:00:30Z' },
        { id: 'sub-3', created_at: '2024-01-01T00:01:00Z' },
        { id: 'sub-4', created_at: '2024-01-01T00:01:30Z' }
      ];

      mockSupabase.from().select().eq().gte().order.mockResolvedValueOnce({
        data: mockRecentSubmissions,
        error: null
      });

      const result = await mockModerationFunctions.checkFlood(creatorId);
      
      expect(result.isFlood).toBe(true);
      expect(result.details.recent_submissions_count).toBe(4);
    });

    it('should not detect flood for normal submission rate', async () => {
      const creatorId = 'creator-123';
      const mockRecentSubmissions = [
        { id: 'sub-1', created_at: '2024-01-01T00:00:00Z' }
      ];

      mockSupabase.from().select().eq().gte().order.mockResolvedValueOnce({
        data: mockRecentSubmissions,
        error: null
      });

      const result = await mockModerationFunctions.checkFlood(creatorId);
      
      expect(result.isFlood).toBe(false);
      expect(result.details.recent_submissions_count).toBe(1);
    });

    it('should not detect flood for submissions outside timeframe', async () => {
      const creatorId = 'creator-123';
      const mockRecentSubmissions = [
        { id: 'sub-1', created_at: '2024-01-01T00:00:00Z' },
        { id: 'sub-2', created_at: '2024-01-01T00:02:00Z' } // 2 minutes later
      ];

      mockSupabase.from().select().eq().gte().order.mockResolvedValueOnce({
        data: mockRecentSubmissions,
        error: null
      });

      const result = await mockModerationFunctions.checkFlood(creatorId);
      
      expect(result.isFlood).toBe(false);
    });
  });

  describe('Video Duration Check', () => {
    it('should flag videos that are too short', async () => {
      const mockSubmission = {
        meta: {
          duration: 5 // 5 seconds
        }
      };

      const result = await mockModerationFunctions.checkVideoDuration(mockSubmission);
      
      expect(result.violation).toBe(true);
      expect(result.details.violation_type).toBe('duration_too_short');
      expect(result.details.duration_seconds).toBe(5);
    });

    it('should approve videos that meet minimum duration', async () => {
      const mockSubmission = {
        meta: {
          duration: 30 // 30 seconds
        }
      };

      const result = await mockModerationFunctions.checkVideoDuration(mockSubmission);
      
      expect(result.violation).toBe(false);
      expect(result.details.duration_seconds).toBe(30);
    });

    it('should handle submissions without duration metadata', async () => {
      const mockSubmission = {
        meta: {}
      };

      const result = await mockModerationFunctions.checkVideoDuration(mockSubmission);
      
      expect(result.violation).toBe(false);
      expect(result.details.duration_seconds).toBe('unknown');
    });
  });

  describe('Automod Processing', () => {
    it('should approve clean submissions', async () => {
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://youtube.com/watch?v=abc123',
        network: 'youtube',
        platform_video_id: 'abc123',
        meta: { duration: 30 }
      };

      // Mock all checks passing
      mockModerationFunctions.checkDuplicates.mockResolvedValue({ isDuplicate: false });
      mockModerationFunctions.validateDomain.mockResolvedValue({ isValid: true });
      mockModerationFunctions.checkFlood.mockResolvedValue({ isFlood: false });
      mockModerationFunctions.checkVideoDuration.mockResolvedValue({ violation: false });

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      expect(result.status).toBe('approved');
      expect(result.violations).toEqual([]);
    });

    it('should reject submissions with violations', async () => {
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://example.com/video',
        network: 'youtube',
        platform_video_id: 'abc123'
      };

      // Mock violations
      mockModerationFunctions.checkDuplicates.mockResolvedValue({ isDuplicate: false });
      mockModerationFunctions.validateDomain.mockResolvedValue({ isValid: false });
      mockModerationFunctions.checkFlood.mockResolvedValue({ isFlood: false });
      mockModerationFunctions.checkVideoDuration.mockResolvedValue({ violation: false });

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      expect(result.status).toBe('rejected');
      expect(result.violations).toContain('invalid_domain');
    });

    it('should flag for human review when flood detected', async () => {
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://youtube.com/watch?v=abc123',
        network: 'youtube',
        platform_video_id: 'abc123'
      };

      // Mock flood detection
      mockModerationFunctions.checkDuplicates.mockResolvedValue({ isDuplicate: false });
      mockModerationFunctions.validateDomain.mockResolvedValue({ isValid: true });
      mockModerationFunctions.checkFlood.mockResolvedValue({ isFlood: true });
      mockModerationFunctions.checkVideoDuration.mockResolvedValue({ violation: false });

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      expect(result.status).toBe('pending_review');
      expect(result.violations).toContain('flood');
    });

    it('should handle multiple violations', async () => {
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://example.com/video',
        network: 'youtube',
        platform_video_id: 'abc123',
        meta: { duration: 5 }
      };

      // Mock multiple violations
      mockModerationFunctions.checkDuplicates.mockResolvedValue({ isDuplicate: true });
      mockModerationFunctions.validateDomain.mockResolvedValue({ isValid: false });
      mockModerationFunctions.checkFlood.mockResolvedValue({ isFlood: false });
      mockModerationFunctions.checkVideoDuration.mockResolvedValue({ violation: true });

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      expect(result.status).toBe('rejected');
      expect(result.violations).toContain('duplicate');
      expect(result.violations).toContain('invalid_domain');
      expect(result.violations).toContain('duration_too_short');
    });
  });

  describe('Moderation Queue Processing', () => {
    it('should process pending submissions in correct order', async () => {
      const mockQueueItems = [
        { id: 'queue-1', submission_id: 'sub-1', priority: 2, created_at: '2024-01-01T00:00:00Z' },
        { id: 'queue-2', submission_id: 'sub-2', priority: 1, created_at: '2024-01-01T00:01:00Z' },
        { id: 'queue-3', submission_id: 'sub-3', priority: 2, created_at: '2024-01-01T00:02:00Z' }
      ];

      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: mockQueueItems,
        error: null
      });

      // Mock automod processing
      mockModerationFunctions.processAutomodSubmission.mockResolvedValue({
        submission_id: 'sub-1',
        status: 'approved',
        violations: [],
        processing_time_ms: 100
      });

      const results = [];
      for (const item of mockQueueItems) {
        const result = await mockModerationFunctions.processAutomodSubmission(item.submission_id);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0].submission_id).toBe('sub-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from().select().eq().neq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(mockModerationFunctions.checkDuplicates({})).rejects.toThrow();
    });

    it('should handle network errors in automod processing', async () => {
      mockModerationFunctions.checkDuplicates.mockRejectedValue(new Error('Network error'));

      await expect(mockModerationFunctions.processAutomodSubmission('submission-123')).rejects.toThrow('Network error');
    });

    it('should mark submissions as failed when processing errors occur', async () => {
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123'
      };

      mockModerationFunctions.checkDuplicates.mockRejectedValue(new Error('Processing error'));

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      expect(result.status).toBe('pending_review');
      expect(result.violations).toContain('processing_error');
    });
  });

  describe('Performance Tests', () => {
    it('should process submissions within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const mockSubmission = {
        id: 'submission-123',
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://youtube.com/watch?v=abc123',
        network: 'youtube',
        platform_video_id: 'abc123'
      };

      // Mock fast responses
      mockModerationFunctions.checkDuplicates.mockResolvedValue({ isDuplicate: false });
      mockModerationFunctions.validateDomain.mockResolvedValue({ isValid: true });
      mockModerationFunctions.checkFlood.mockResolvedValue({ isFlood: false });
      mockModerationFunctions.checkVideoDuration.mockResolvedValue({ violation: false });

      const result = await mockModerationFunctions.processAutomodSubmission(mockSubmission.id);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processing_time_ms).toBeLessThan(5000);
    });

    it('should handle batch processing efficiently', async () => {
      const batchSize = 10;
      const mockSubmissions = Array.from({ length: batchSize }, (_, i) => ({
        id: `submission-${i}`,
        contest_id: 'contest-123',
        creator_id: 'creator-123',
        video_url: 'https://youtube.com/watch?v=abc123',
        network: 'youtube',
        platform_video_id: `abc${i}`
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        mockSubmissions.map(submission => 
          mockModerationFunctions.processAutomodSubmission(submission.id)
        )
      );

      const totalTime = Date.now() - startTime;
      expect(results).toHaveLength(batchSize);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});

// Mock implementations for testing
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Export mock functions for use in other tests
export {
  mockModerationFunctions,
  mockSupabase
};
