import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMessageThread, addThreadReply, getThreadMessages, listMessageThreads } from '@/services/messaging';
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
const mockBrandId = 'brand-123';
const mockCreatorId = 'creator-456';
const mockUserId = 'user-789';
const mockThreadId = 'thread-abc';

const mockThread = {
  id: mockThreadId,
  brand_id: mockBrandId,
  creator_id: mockCreatorId,
  subject: 'Test Conversation',
  last_message: 'Hello world',
  unread_for_brand: false,
  unread_for_creator: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockMessage = {
  id: 'message-123',
  thread_id: mockThreadId,
  sender_id: mockUserId,
  body: 'Hello world',
  attachments: [],
  created_at: '2024-01-01T00:00:00Z',
  sender: {
    id: mockUserId,
    name: 'Test User',
    handle: 'testuser',
    profile_image_url: null
  }
};

describe('Messaging Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createMessageThread', () => {
    it('should create a new message thread successfully', async () => {
      // Mock successful thread creation
      const mockInsert = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockThread,
              error: null
            })
          })
        })
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: mockBrandId, role: 'brand' },
            error: null
          })
        })
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSelect,
            insert: mockInsert
          };
        }
        if (table === 'messages') {\r\n          return {\r\n            select: vi.fn().mockImplementation((columns?: string, options?: any) => {\r\n              if (columns === '*' && options?.count === 'exact') {\r\n                return {\r\n                  or: vi.fn().mockReturnValue({\r\n                    eq: vi.fn().mockReturnValue({ count: 0 })\r\n                  })\r\n                };\r\n              }\r\n\r\n              return {\r\n                or: vi.fn().mockReturnValue({\r\n                  order: vi.fn().mockReturnValue({\r\n                    range: vi.fn().mockResolvedValue({\r\n                      data: mockThreads,\r\n                      error: null,\r\n                      count: mockThreads.length\r\n                    })\r\n                  })\r\n                })\r\n              };\r\n            })\r\n          };\r\n        }\r\n        if (table === 'messages_thread') {
          return {
            insert: mockInsert
          };
        }
        return {};
      });

      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await createMessageThread(mockSupabase, mockUserId, {
        brandId: mockBrandId,
        creatorId: mockCreatorId,
        subject: 'Test Conversation',
        initialMessage: 'Hello world'
      });

      expect(result).toEqual(mockThread);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.any(Object));
    });

    it('should throw error when brand or creator not found', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      await expect(
        createMessageThread(mockSupabase, mockUserId, {
          brandId: mockBrandId,
          creatorId: mockCreatorId,
          subject: 'Test Conversation'
        })
      ).rejects.toThrow('Profils introuvables pour la conversation');
    });

    it('should throw error when user is not brand or creator', async () => {
      const otherUserId = 'other-user';

      await expect(
        createMessageThread(mockSupabase, otherUserId, {
          brandId: mockBrandId,
          creatorId: mockCreatorId,
          subject: 'Test Conversation'
        })
      ).rejects.toThrow('Vous devez ÃƒÂªtre le brand ou le crÃƒÂ©ateur pour initier la conversation');
    });
  });

  describe('addThreadReply', () => {
    it('should add a reply to a thread successfully', async () => {
      // Mock thread access check
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockThread,
            error: null
          })
        })
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockMessage,
            error: null
          })
        })
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {\r\n          return {\r\n            select: vi.fn().mockImplementation((columns?: string, options?: any) => {\r\n              if (columns === '*' && options?.count === 'exact') {\r\n                return {\r\n                  or: vi.fn().mockReturnValue({\r\n                    eq: vi.fn().mockReturnValue({ count: 0 })\r\n                  })\r\n                };\r\n              }\r\n\r\n              return {\r\n                or: vi.fn().mockReturnValue({\r\n                  order: vi.fn().mockReturnValue({\r\n                    range: vi.fn().mockResolvedValue({\r\n                      data: mockThreads,\r\n                      error: null,\r\n                      count: mockThreads.length\r\n                    })\r\n                  })\r\n                })\r\n              };\r\n            })\r\n          };\r\n        }\r\n        if (table === 'messages_thread') {
          return {
            insert: mockInsert
          };
        }
        return {};
      });

      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await addThreadReply(mockSupabase, mockUserId, mockThreadId, {
        body: 'Hello world',
        attachments: []
      });

      expect(result).toEqual({
        id: mockMessage.id,
        thread_id: mockMessage.thread_id,
        sender_id: mockMessage.sender_id,
        body: mockMessage.body,
        attachments: mockMessage.attachments,
        created_at: mockMessage.created_at,
        sender: mockMessage.sender,
        is_from_current_user: true
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.any(Object));
    });

    it('should throw error when thread not found', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      await expect(
        addThreadReply(mockSupabase, mockUserId, mockThreadId, {
          body: 'Hello world'
        })
      ).rejects.toThrow('Conversation introuvable');
    });

    it('should throw error when user is not participant', async () => {
      const otherUserId = 'other-user';
      const otherThread = {
        ...mockThread,
        brand_id: 'other-brand',
        creator_id: 'other-creator'
      };

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: otherThread,
              error: null
            })
          })
        })
      });

      await expect(
        addThreadReply(mockSupabase, otherUserId, mockThreadId, {
          body: 'Hello world'
        })
      ).rejects.toThrow('AccÃƒÂ¨s refusÃƒÂ© ÃƒÂ  cette conversation');
    });

    it('should throw error when no body and no attachments', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockThread,
              error: null
            })
          })
        })
      });

      await expect(
        addThreadReply(mockSupabase, mockUserId, mockThreadId, {
          body: '',
          attachments: []
        })
      ).rejects.toThrow('Un message ou une piÃƒÂ¨ce jointe est requis');
    });
  });

  describe('getThreadMessages', () => {
    it('should retrieve messages from a thread successfully', async () => {
      const mockMessages = [mockMessage];

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'messages') {\r\n          return {\r\n            select: vi.fn().mockImplementation((columns?: string, options?: any) => {\r\n              if (columns === '*' && options?.count === 'exact') {\r\n                return {\r\n                  or: vi.fn().mockReturnValue({\r\n                    eq: vi.fn().mockReturnValue({ count: 0 })\r\n                  })\r\n                };\r\n              }\r\n\r\n              return {\r\n                or: vi.fn().mockReturnValue({\r\n                  order: vi.fn().mockReturnValue({\r\n                    range: vi.fn().mockResolvedValue({\r\n                      data: mockThreads,\r\n                      error: null,\r\n                      count: mockThreads.length\r\n                    })\r\n                  })\r\n                })\r\n              };\r\n            })\r\n          };\r\n        }\r\n        if (table === 'messages_thread') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: mockMessages,
                    error: null,
                    count: mockMessages.length
                  })
                })
              })
            })
          };
        }
        return {};
      });

      const result = await getThreadMessages(mockSupabase, mockUserId, mockThreadId, 50, 0);

      expect(result.messages).toEqual(mockMessages.map(msg => ({
        ...msg,
        is_from_current_user: msg.sender_id === mockUserId
      })));
      expect(result.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: mockMessages.length
      });
    });
  });

  describe('listMessageThreads', () => {
    it('should list message threads successfully', async () => {
      const mockThreads = [mockThread];

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'brand' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'messages') {\r\n          return {\r\n            select: vi.fn().mockImplementation((columns?: string, options?: any) => {\r\n              if (columns === '*' && options?.count === 'exact') {\r\n                return {\r\n                  or: vi.fn().mockReturnValue({\r\n                    eq: vi.fn().mockReturnValue({ count: 0 })\r\n                  })\r\n                };\r\n              }\r\n\r\n              return {\r\n                or: vi.fn().mockReturnValue({\r\n                  order: vi.fn().mockReturnValue({\r\n                    range: vi.fn().mockResolvedValue({\r\n                      data: mockThreads,\r\n                      error: null,\r\n                      count: mockThreads.length\r\n                    })\r\n                  })\r\n                })\r\n              };\r\n            })\r\n          };\r\n        }\r\n        return {};
      });

      const result = await listMessageThreads(mockSupabase, mockUserId, {
        limit: 20,
        offset: 0
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]).toEqual({
        ...mockThread,
        brand: undefined,
        creator: undefined,
        is_unread: mockThread.unread_for_brand
      });
      expect(result.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 1,
        unread_count: 0
      });
    });
  });
});
