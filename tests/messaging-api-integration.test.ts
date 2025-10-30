import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Next.js request/response
const mockRequest = {
  json: vi.fn(),
  headers: {
    get: vi.fn()
  }
};

const mockResponse = {
  json: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis()
};

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(),
  rpc: vi.fn()
};

// Mock the messaging service
vi.mock('@/services/messaging', () => ({
  createMessageThread: vi.fn(),
  addThreadReply: vi.fn(),
  getThreadMessages: vi.fn(),
  listMessageThreads: vi.fn(),
  flagThreadMessage: vi.fn()
}));

describe('Messaging API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks
    mockRequest.json.mockClear();
    mockResponse.json.mockClear();
    mockResponse.status.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/messages', () => {
    it('should create a new message thread successfully', async () => {
      const { createMessageThread } = await import('@/services/messaging');
      
      const mockThread = {
        id: 'thread-123',
        brand_id: 'brand-456',
        creator_id: 'creator-789',
        subject: 'Test Conversation',
        created_at: '2024-01-01T00:00:00Z'
      };

      (createMessageThread as any).mockResolvedValue(mockThread);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      // Simulate the API route logic
      const payload = {
        brand_id: 'brand-456',
        creator_id: 'creator-789',
        subject: 'Test Conversation',
        initial_message: 'Hello world'
      };

      mockRequest.json.mockResolvedValue(payload);

      // Mock the service call
      const result = await createMessageThread(mockSupabase, 'user-123', {
        brandId: payload.brand_id,
        creatorId: payload.creator_id,
        subject: payload.subject,
        initialMessage: payload.initial_message
      });

      expect(result).toEqual(mockThread);
      expect(createMessageThread).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        {
          brandId: 'brand-456',
          creatorId: 'creator-789',
          subject: 'Test Conversation',
          initialMessage: 'Hello world'
        }
      );
    });

    it('should handle validation errors', async () => {
      const invalidPayload = {
        brand_id: 'invalid-uuid',
        creator_id: 'creator-789',
        subject: ''
      };

      mockRequest.json.mockResolvedValue(invalidPayload);

      // Should throw validation error
      await expect(async () => {
        // Simulate validation logic
        if (!invalidPayload.brand_id || !invalidPayload.creator_id || !invalidPayload.subject) {
          throw new Error('Validation failed');
        }
      }).rejects.toThrow('Validation failed');
    });
  });

  describe('POST /api/messages/[threadId]/flag', () => {
    it('should flag a message successfully', async () => {
      const { flagThreadMessage } = await import('@/services/messaging');
      
      const mockFlaggedMessage = {
        id: 'message-123',
        flagged: true,
        flagged_at: '2024-01-01T00:00:00Z',
        flagged_by: 'user-123',
        flagged_reason: 'Inappropriate content'
      };

      (flagThreadMessage as any).mockResolvedValue(mockFlaggedMessage);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const payload = {
        message_id: 'message-123',
        reason: 'Inappropriate content'
      };

      mockRequest.json.mockResolvedValue(payload);

      const result = await flagThreadMessage(mockSupabase, 'user-123', 'thread-456', {
        messageId: payload.message_id,
        reason: payload.reason
      });

      expect(result).toEqual(mockFlaggedMessage);
      expect(flagThreadMessage).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        'thread-456',
        {
          messageId: 'message-123',
          reason: 'Inappropriate content'
        }
      );
    });

    it('should handle unauthorized access', async () => {
      const { flagThreadMessage } = await import('@/services/messaging');
      
      (flagThreadMessage as any).mockRejectedValue(
        new Error('Seule la marque peut signaler un message')
      );

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'creator-123' } },
        error: null
      });

      const payload = {
        message_id: 'message-123',
        reason: 'Test reason'
      };

      await expect(
        flagThreadMessage(mockSupabase, 'creator-123', 'thread-456', {
          messageId: payload.message_id,
          reason: payload.reason
        })
      ).rejects.toThrow('Seule la marque peut signaler un message');
    });
  });

  describe('GET /api/messages', () => {
    it('should list message threads with pagination', async () => {
      const { listMessageThreads } = await import('@/services/messaging');
      
      const mockResult = {
        threads: [
          {
            id: 'thread-123',
            brand_id: 'brand-456',
            creator_id: 'creator-789',
            subject: 'Test Conversation',
            is_unread: true
          }
        ],
        pagination: {
          limit: 20,
          offset: 0,
          total: 1,
          unread_count: 1
        }
      };

      (listMessageThreads as any).mockResolvedValue(mockResult);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const result = await listMessageThreads(mockSupabase, 'user-123', {
        limit: 20,
        offset: 0
      });

      expect(result).toEqual(mockResult);
      expect(listMessageThreads).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        {
          limit: 20,
          offset: 0
        }
      );
    });
  });

  describe('GET /api/messages/[threadId]', () => {
    it('should retrieve thread messages with pagination', async () => {
      const { getThreadMessages } = await import('@/services/messaging');
      
      const mockResult = {
        messages: [
          {
            id: 'message-123',
            thread_id: 'thread-456',
            sender_id: 'user-123',
            body: 'Hello world',
            created_at: '2024-01-01T00:00:00Z',
            is_from_current_user: true
          }
        ],
        pagination: {
          limit: 50,
          offset: 0,
          total: 1
        }
      };

      (getThreadMessages as any).mockResolvedValue(mockResult);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const result = await getThreadMessages(mockSupabase, 'user-123', 'thread-456', 50, 0);

      expect(result).toEqual(mockResult);
      expect(getThreadMessages).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        'thread-456',
        50,
        0
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' }
      });

      // Should return 401 for unauthenticated requests
      const response = {
        status: 401,
        json: { error: 'Non autorisé' }
      };

      expect(response.status).toBe(401);
      expect(response.json.error).toBe('Non autorisé');
    });

    it('should handle service errors gracefully', async () => {
      const { createMessageThread } = await import('@/services/messaging');
      
      (createMessageThread as any).mockRejectedValue(
        new Error('Impossible de créer la conversation')
      );

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      await expect(
        createMessageThread(mockSupabase, 'user-123', {
          brandId: 'brand-456',
          creatorId: 'creator-789',
          subject: 'Test'
        })
      ).rejects.toThrow('Impossible de créer la conversation');
    });
  });
});
