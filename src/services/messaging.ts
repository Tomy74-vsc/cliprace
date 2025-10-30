import { randomUUID } from 'crypto';
import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { storeFileWithQuarantine, sanitizeFileName } from '@/lib/antivirus';

export class MessagingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MessagingError';
    this.status = status;
  }
}

const ATTACHMENT_BUCKET = 'message_attachments';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/', 'video/'];
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

export interface AttachmentPayload {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface StoredAttachment {
  id: string;
  bucket: string;
  path: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface CreateThreadInput {
  brandId: string;
  creatorId: string;
  subject: string;
  initialMessage?: string;
}

export interface ThreadListFilters {
  brandId?: string;
  creatorId?: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface ReplyInput {
  body: string;
  attachments?: AttachmentPayload[];
}

export interface FlagMessageInput {
  messageId: string;
  reason?: string;
}

type SupabaseServerClient = SupabaseClient<any>;

function isAllowedMimeType(mime: string) {
  if (!mime) {
    return false;
  }
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) {
    return true;
  }
  return ALLOWED_ATTACHMENT_MIME_PREFIXES.some(prefix => mime.startsWith(prefix));
}

async function scanAttachmentForMalware(file: AttachmentPayload) {
  const scannerUrl = process.env.MALWARE_SCANNER_ENDPOINT;
  if (!scannerUrl) {
    return;
  }

  // Integration point for an external malware scanning service.
  // Expected contract: POST file binary to scannerUrl and throw on positive detection.
  // Deliberately left as a stub to avoid runtime network calls without configuration.
  return;
}

async function fetchUserRole(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    throw new MessagingError('Impossible de dterminer le rle utilisateur', 500);
  }

  return data?.role as 'brand' | 'creator' | 'admin' | null;
}

async function ensureParticipantAccess(
  supabase: SupabaseServerClient,
  threadId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, brand_id, creator_id')
    .eq('id', threadId)
    .single();

  if (error || !data) {
    throw new MessagingError('Conversation introuvable', 404);
  }

  if (data.brand_id !== userId && data.creator_id !== userId) {
    throw new MessagingError('Accs refus  cette conversation', 403);
  }

  return data as { id: string; brand_id: string; creator_id: string };
}

async function uploadMessageAttachments(
  supabase: SupabaseServerClient,
  threadId: string,
  userId: string,
  attachments: AttachmentPayload[] = []
): Promise<StoredAttachment[]> {
  if (!attachments.length) {
    return [];
  }

  const uploaded: StoredAttachment[] = [];

  for (const file of attachments) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new MessagingError("Piece jointe trop volumineuse (max 10 Mo)", 413);
    }

    if (!isAllowedMimeType(file.type)) {
      throw new MessagingError("Type de fichier non autorise", 415);
    }

    await scanAttachmentForMalware(file);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeFileName(file.name || "attachment");
    const objectPath = `${threadId}/${randomUUID()}_${safeName}`;
    const uploadFile = new File([buffer], safeName, {
      type: file.type || "application/octet-stream",
    });

    const storeResult = await storeFileWithQuarantine(uploadFile, {
      userId,
      destinationBucket: ATTACHMENT_BUCKET,
      destinationPath: objectPath,
    });

    if (storeResult.status !== "approved" || !storeResult.path) {
      throw new MessagingError("Piece jointe rejetee par la protection antivirus", 400);
    }

    uploaded.push({
      id: randomUUID(),
      bucket: ATTACHMENT_BUCKET,
      path: storeResult.path,
      name: safeName,
      size: uploadFile.size,
      mime_type: file.type || "application/octet-stream",
    });
  }

  return uploaded;
}
async function deleteUploadedAttachments(
  supabase: SupabaseServerClient,
  attachments: StoredAttachment[]
) {
  if (!attachments.length) {
    return;
  }

  try {
    await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove(attachments.map(item => item.path));
  } catch (error) {
    console.error('Echec du nettoyage des pieces jointes messages:', error);
  }
}

export async function listMessageThreads(
  supabase: SupabaseServerClient,
  userId: string,
  filters: ThreadListFilters = {}
) {
  const role = await fetchUserRole(supabase, userId);
  const unreadKey = role === 'brand' ? 'unread_for_brand' : 'unread_for_creator';

  const {
    brandId,
    creatorId,
    limit = 20,
    offset = 0,
    unreadOnly = false
  } = filters;

  let query = supabase
    .from('messages')
    .select(
      `
        id,
        brand_id,
        creator_id,
        subject,
        last_message,
        unread_for_brand,
        unread_for_creator,
        created_at,
        updated_at,
        profiles_brand:brand_id(
          id,
          name,
          handle,
          profile_image_url
        ),
        profiles_creator:creator_id(
          id,
          name,
          handle,
          profile_image_url
        )
      `,
      { count: 'exact' }
    )
    .or(`brand_id.eq.${userId},creator_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  if (creatorId) {
    query = query.eq('creator_id', creatorId);
  }

  if (unreadOnly) {
    query = query.eq(unreadKey, true);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    throw new MessagingError('Impossible de rcuprer les conversations', 500);
  }

  const { count: unreadCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .or(`brand_id.eq.${userId},creator_id.eq.${userId}`)
    .eq(unreadKey, true);

  const threads = (data || []).map(item => ({
    id: item.id,
    brand_id: item.brand_id,
    creator_id: item.creator_id,
    subject: item.subject,
    last_message: item.last_message,
    unread_for_brand: item.unread_for_brand,
    unread_for_creator: item.unread_for_creator,
    created_at: item.created_at,
    updated_at: item.updated_at,
    brand: item.profiles_brand,
    creator: item.profiles_creator,
    is_unread: unreadKey === 'unread_for_brand' ? item.unread_for_brand : item.unread_for_creator
  }));

  return {
    threads,
    pagination: {
      limit,
      offset,
      total: count ?? threads.length,
      unread_count: unreadCount ?? 0
    }
  };
}

export async function createMessageThread(
  supabase: SupabaseServerClient,
  userId: string,
  input: CreateThreadInput
) {
  const { brandId, creatorId, subject, initialMessage } = input;

  if (userId !== brandId && userId !== creatorId) {
    throw new MessagingError('Vous devez tre le brand ou le crateur pour initier la conversation', 403);
  }

  const { data: brand, error: brandError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', brandId)
    .single();

  const { data: creator, error: creatorError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', creatorId)
    .single();

  if (brandError || creatorError || !brand || !creator) {
    throw new MessagingError('Profils introuvables pour la conversation', 404);
  }

  if (brand.role !== 'brand' || creator.role !== 'creator') {
    throw new MessagingError('Les rles brand/creator ne sont pas valides', 400);
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      brand_id: brandId,
      creator_id: creatorId,
      subject,
      last_message: initialMessage ? initialMessage.slice(0, 100) : null,
      unread_for_brand: userId !== brandId,
      unread_for_creator: userId !== creatorId
    })
    .select()
    .single();

  if (error || !data) {
    throw new MessagingError('Impossible de crer la conversation', 500);
  }

  // Log audit event for thread creation
  try {
    await supabase.rpc('log_audit_event', {
      p_action: 'insert',
      p_entity: 'messages',
      p_entity_id: data.id,
      p_data: {
        brand_id: brandId,
        creator_id: creatorId,
        subject,
        has_initial_message: !!initialMessage
      }
    });
  } catch (auditError) {
    console.error('chec du logging audit pour cration thread:', auditError);
  }

  if (initialMessage) {
    const { error: messageError } = await supabase
      .from('messages_thread')
      .insert({
        thread_id: data.id,
        sender_id: userId,
        body: initialMessage,
        attachments: []
      });

    if (messageError) {
      console.error('chec du message initial:', messageError);
    }
  }

  return data;
}

export async function getThreadMessages(
  supabase: SupabaseServerClient,
  userId: string,
  threadId: string,
  limit = 50,
  offset = 0
) {
  const thread = await ensureParticipantAccess(supabase, threadId, userId);

  const { data, error, count } = await supabase
    .from('messages_thread')
    .select(`
      id,
      thread_id,
      sender_id,
      body,
      attachments,
      flagged,
      flagged_at,
      flagged_by,
      flagged_reason,
      created_at,
      profiles:sender_id(
        id,
        name,
        handle,
        profile_image_url
      )
    `, { count: 'exact' })
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new MessagingError("Impossible de rcuprer les messages du thread", 500);
  }

  const updateKey = userId === thread.brand_id ? 'unread_for_brand' : 'unread_for_creator';
  await supabase
    .from('messages')
    .update({ [updateKey]: false })
    .eq('id', threadId);

  const messages = (data || []).map(item => ({
    id: item.id,
    thread_id: item.thread_id,
    sender_id: item.sender_id,
    body: item.body,
    attachments: item.attachments || [],
    flagged: item.flagged,
    flagged_at: item.flagged_at,
    flagged_by: item.flagged_by,
    flagged_reason: item.flagged_reason,
    created_at: item.created_at,
    sender: item.profiles,
    is_from_current_user: item.sender_id === userId
  }));

  return {
    messages,
    pagination: {
      limit,
      offset,
      total: count ?? messages.length
    }
  };
}

export async function addThreadReply(
  supabase: SupabaseServerClient,
  userId: string,
  threadId: string,
  input: ReplyInput
) {
  if (!input.body && (!input.attachments || input.attachments.length === 0)) {
    throw new MessagingError('Un message ou une pice jointe est requis', 400);
  }

  const thread = await ensureParticipantAccess(supabase, threadId, userId);

  let uploaded: StoredAttachment[] = [];

  try {
    uploaded = await uploadMessageAttachments(supabase, threadId, userId, input.attachments || []);

    const { data, error } = await supabase
      .from('messages_thread')
      .insert({
        thread_id: threadId,
        sender_id: userId,
        body: input.body || '',
        attachments: uploaded
      })
      .select(`
        id,
        thread_id,
        sender_id,
        body,
        attachments,
        created_at,
        profiles:sender_id(
          id,
          name,
          handle,
          profile_image_url
        )
      `)
      .single();

    if (error || !data) {
      throw new MessagingError("Impossible d'enregistrer le message", 500);
    }

    // Log audit event for message creation
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'insert',
        p_entity: 'messages_thread',
        p_entity_id: data.id,
        p_data: {
          thread_id: threadId,
          sender_id: userId,
          has_attachments: uploaded.length > 0,
          attachment_count: uploaded.length
        }
      });
    } catch (auditError) {
      console.error('chec du logging audit pour cration message:', auditError);
    }

    const updateKey = userId === thread.brand_id ? 'unread_for_creator' : 'unread_for_brand';
    const updateNews = input.body ? input.body.slice(0, 100) : 'Piece jointe';

    await supabase
      .from('messages')
      .update({
        [updateKey]: true,
        last_message: updateNews,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    return {
      id: data.id,
      thread_id: data.thread_id,
      sender_id: data.sender_id,
      body: data.body,
      attachments: data.attachments || [],
      created_at: data.created_at,
      sender: data.profiles,
      is_from_current_user: true
    };
  } catch (error) {
    await deleteUploadedAttachments(supabase, uploaded);
    throw error;
  }
}

export async function flagThreadMessage(
  supabase: SupabaseServerClient,
  userId: string,
  threadId: string,
  input: FlagMessageInput
) {
  const thread = await ensureParticipantAccess(supabase, threadId, userId);

  if (thread.brand_id !== userId) {
    throw new MessagingError('Seule la marque peut signaler un message', 403);
  }

  const { data: message, error: fetchError } = await supabase
    .from('messages_thread')
    .select('id, flagged')
    .eq('id', input.messageId)
    .eq('thread_id', threadId)
    .single();

  if (fetchError || !message) {
    throw new MessagingError('Message introuvable', 404);
  }

  if (message.flagged) {
    return message;
  }

  const { data: updated, error } = await supabase
    .from('messages_thread')
    .update({
      flagged: true,
      flagged_at: new Date().toISOString(),
      flagged_by: userId,
      flagged_reason: input.reason || null
    })
    .eq('id', input.messageId)
    .eq('thread_id', threadId)
    .select('id, flagged, flagged_at, flagged_by, flagged_reason')
    .single();

  if (error) {
    throw new MessagingError('Impossible de signaler le message', 500);
  }

  try {
    await supabase.rpc('log_audit_event', {
      p_action: 'update',
      p_entity: 'messages_thread',
      p_entity_id: input.messageId,
      p_data: {
        action: 'flagged',
        thread_id: threadId,
        reason: input.reason || null
      }
    });
  } catch (auditError) {
    console.error('chec du logging audit pour flag message:', auditError);
  }

  return updated;
}


