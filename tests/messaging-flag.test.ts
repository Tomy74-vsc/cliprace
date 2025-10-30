import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { flagThreadMessage } from '../src/services/messaging';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  },
  storage: {
    from: vi.fn()
  },
  rpc: vi.fn()
} as unknown as SupabaseClient<any>;

// Mock data
const mockUserId = 'user-789';
const mockThreadId = 'thread-abc';
const mockMessageId = 'message-123';

const mockThread = {
  id: mockThreadId,
  brand_id: 'brand-123',
  creator_id: 'creator-456'
};

const mockMessage = {
  id: mockMessageId,
  flagged: false
};

describe('Messaging Flag System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('flagThreadMessage', () => {
    it('should flag a message successfully when user is brand', async () => {
      // Mock thread access check
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockThread,
            error: null
          })
        })
      });

      // Mock message fetch
      const mockMessageSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMessage,
              error: null
            })
          })
        })
      });

      // Mock update
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: mockMessageId,
                  flagged: true,
                  flagged_at: '2024-01-01T00:00:00Z',
                  flagged_by: mockUserId,
                  flagged_reason: 'Inappropriate content'
                },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {
          return {
            select: mockSelect
          };
        }
        if (table === 'messages_thread') {
          return {
            select: mockMessageSelect,
            update: mockUpdate
          };
        }
        return {};
      });

      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await flagThreadMessage(mockSupabase, mockUserId, mockThreadId, {
        messageId: mockMessageId,
        reason: 'Inappropriate content'
      });

      expect(result).toEqual({
        id: mockMessageId,
        flagged: true,
        flagged_at: '2024-01-01T00:00:00Z',
        flagged_by: mockUserId,
        flagged_reason: 'Inappropriate content'
      });

      // Vérifier que l'audit log a été appelé
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_audit_event', {
        p_action: 'update',
        p_entity: 'messages_thread',
        p_entity_id: mockMessageId,
        p_data: {
          action: 'flagged',
          thread_id: mockThreadId,
          reason: 'Inappropriate content'
        }
      });
    });

    it('should throw error when user is not brand', async () => {
      const creatorUserId = 'creator-456';
      const creatorThread = {
        ...mockThread,
        brand_id: 'other-brand',
        creator_id: creatorUserId
      };

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: creatorThread,
              error: null
            })
          })
        })
      });

      await expect(
        flagThreadMessage(mockSupabase, creatorUserId, mockThreadId, {
          messageId: mockMessageId,
          reason: 'Test reason'
        })
      ).rejects.toThrow('Seule la marque peut signaler un message');
    });

    it('should throw error when message not found', async () => {
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockThread,
                  error: null
                })
              })
            })
          };
        }
        if (table === 'messages_thread') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' }
                  })
                })
              })
            })
          };
        }
        return {};
      });

      await expect(
        flagThreadMessage(mockSupabase, mockUserId, mockThreadId, {
          messageId: mockMessageId,
          reason: 'Test reason'
        })
      ).rejects.toThrow('Message introuvable');
    });

    it('should return existing flagged message if already flagged', async () => {
      const alreadyFlaggedMessage = {
        ...mockMessage,
        flagged: true,
        flagged_at: '2024-01-01T00:00:00Z',
        flagged_by: mockUserId,
        flagged_reason: 'Already flagged'
      };

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockThread,
                  error: null
                })
              })
            })
          };
        }
        if (table === 'messages_thread') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: alreadyFlaggedMessage,
                    error: null
                  })
                })
              })
            })
          };
        }
        return {};
      });

      const result = await flagThreadMessage(mockSupabase, mockUserId, mockThreadId, {
        messageId: mockMessageId,
        reason: 'New reason'
      });

      expect(result).toEqual(alreadyFlaggedMessage);
    });

    it('should handle audit log failure gracefully', async () => {
      // Mock successful flagging but failed audit log
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockThread,
            error: null
          })
        })
      });

      const mockMessageSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMessage,
              error: null
            })
          })
        })
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: mockMessageId,
                  flagged: true,
                  flagged_at: '2024-01-01T00:00:00Z',
                  flagged_by: mockUserId,
                  flagged_reason: 'Test reason'
                },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {
          return {
            select: mockSelect
          };
        }
        if (table === 'messages_thread') {
          return {
            select: mockMessageSelect,
            update: mockUpdate
          };
        }
        return {};
      });

      // Mock audit log failure
      mockSupabase.rpc = vi.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Audit log failed' } 
      });

      // Should not throw error even if audit log fails
      const result = await flagThreadMessage(mockSupabase, mockUserId, mockThreadId, {
        messageId: mockMessageId,
        reason: 'Test reason'
      });

      expect(result).toEqual({
        id: mockMessageId,
        flagged: true,
        flagged_at: '2024-01-01T00:00:00Z',
        flagged_by: mockUserId,
        flagged_reason: 'Test reason'
      });
    });
  });
});
