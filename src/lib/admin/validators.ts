import { getAdminClient } from '@/lib/admin/supabase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const contestValidators = {
  canPublish: async (contestId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: contest, error } = await admin
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();
    
    if (error || !contest) {
      return { valid: false, errors: ['Contest not found'] };
    }
    
    // Validation budget
    if (contest.budget_cents <= 0) {
      errors.push('Budget must be greater than 0');
    }
    
    // Validation dates
    if (new Date(contest.start_at) >= new Date(contest.end_at)) {
      errors.push('Start date must be before end date');
    }
    
    if (new Date(contest.end_at) < new Date()) {
      errors.push('End date must be in the future');
    }
    
    // Validation assets
    const { data: assets } = await admin
      .from('contest_assets')
      .select('id')
      .eq('contest_id', contestId);
    
    if (!assets || assets.length === 0) {
      errors.push('At least one asset is required');
    }
    
    // Validation terms
    const { data: terms } = await admin
      .from('contest_terms')
      .select('id')
      .eq('contest_id', contestId);
    
    if (!terms || terms.length === 0) {
      errors.push('At least one term is required');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canPause: async (contestId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: contest, error } = await admin
      .from('contests')
      .select('id, status')
      .eq('id', contestId)
      .single();
    
    if (error || !contest) {
      return { valid: false, errors: ['Contest not found'] };
    }
    
    if (contest.status !== 'active') {
      errors.push(`Contest cannot be paused from status: ${contest.status}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canEnd: async (contestId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: contest, error } = await admin
      .from('contests')
      .select('id, status')
      .eq('id', contestId)
      .single();
    
    if (error || !contest) {
      return { valid: false, errors: ['Contest not found'] };
    }
    
    if (contest.status !== 'active') {
      errors.push(`Contest cannot be ended from status: ${contest.status}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canArchive: async (contestId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: contest, error } = await admin
      .from('contests')
      .select('id, status')
      .eq('id', contestId)
      .single();
    
    if (error || !contest) {
      return { valid: false, errors: ['Contest not found'] };
    }
    
    if (!['ended', 'paused'].includes(contest.status)) {
      errors.push(`Contest cannot be archived from status: ${contest.status}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const cashoutValidators = {
  canApprove: async (cashoutId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: cashout, error } = await admin
      .from('cashouts')
      .select('*')
      .eq('id', cashoutId)
      .single();
    
    if (error || !cashout) {
      return { valid: false, errors: ['Cashout not found'] };
    }
    
    // Validation statut
    if (!['requested', 'failed'].includes(cashout.status)) {
      errors.push(`Cashout cannot be approved from status: ${cashout.status}`);
    }
    
    // Validation solde
    const { data: winnings } = await admin
      .from('contest_winnings')
      .select('amount_cents')
      .eq('creator_id', cashout.creator_id)
      .is('paid_at', null);
    
    const available = (winnings ?? []).reduce((sum, w) => sum + Number(w.amount_cents), 0);
    
    if (cashout.amount_cents > available) {
      errors.push(
        `Insufficient balance: required ${cashout.amount_cents / 100}€, ` +
        `available ${available / 100}€`
      );
    }
    
    // Validation minimum
    const MIN_CASHOUT = 1000; // 10€ en centimes
    if (cashout.amount_cents < MIN_CASHOUT) {
      errors.push(`Minimum cashout amount is ${MIN_CASHOUT / 100}€`);
    }
    
    // Validation KYC
    const { data: kyc } = await admin
      .from('kyc_checks')
      .select('status')
      .eq('user_id', cashout.creator_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!kyc || kyc.status !== 'verified') {
      errors.push('KYC verification required');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canReject: async (cashoutId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: cashout, error } = await admin
      .from('cashouts')
      .select('id, status')
      .eq('id', cashoutId)
      .single();
    
    if (error || !cashout) {
      return { valid: false, errors: ['Cashout not found'] };
    }
    
    if (!['requested', 'processing'].includes(cashout.status)) {
      errors.push(`Cashout cannot be rejected from status: ${cashout.status}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canHold: async (cashoutId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: cashout, error } = await admin
      .from('cashouts')
      .select('id, status')
      .eq('id', cashoutId)
      .single();
    
    if (error || !cashout) {
      return { valid: false, errors: ['Cashout not found'] };
    }
    
    if (!['requested', 'processing'].includes(cashout.status)) {
      errors.push(`Cashout cannot be held from status: ${cashout.status}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const userValidators = {
  canChangeRole: async (
    userId: string,
    newRole: 'admin' | 'brand' | 'creator',
    actorId: string
  ): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Vérifier que l'acteur est super-admin pour changer vers admin
    if (newRole === 'admin') {
      const { data: actor } = await admin
        .from('admin_staff')
        .select('is_super_admin')
        .eq('user_id', actorId)
        .single();
      
      if (!actor || !actor.is_super_admin) {
        errors.push('Only super-admins can assign admin role');
      }
    }
    
    // Vérifier que l'utilisateur existe
    const { data: user } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return { valid: false, errors: ['User not found'] };
    }
    
    // Validation métier : ne pas changer le rôle de soi-même vers non-admin
    if (userId === actorId && newRole !== 'admin') {
      errors.push('Cannot change your own role to non-admin');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canImpersonate: async (userId: string, actorId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Vérifier que l'utilisateur existe
    const { data: user, error } = await admin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return { valid: false, errors: ['User not found'] };
    }
    
    // Ne pas permettre l'impersonation d'un autre admin (sauf super-admin)
    if (user.role === 'admin' && userId !== actorId) {
      const { data: actor } = await admin
        .from('admin_staff')
        .select('is_super_admin')
        .eq('user_id', actorId)
        .single();
      
      if (!actor || !actor.is_super_admin) {
        errors.push('Only super-admins can impersonate other admins');
      }
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canResetOnboarding: async (userId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    
    const { data: user, error } = await admin
      .from('profiles')
      .select('id, onboarding_complete')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return { valid: false, errors: ['User not found'] };
    }
    
    // Pas de validation métier spécifique, juste vérifier l'existence
    return { valid: true, errors: [] };
  },
};

export const invoiceValidators = {
  canGenerate: async (invoiceId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: invoice, error } = await admin
      .from('invoices')
      .select('id, status, pdf_url')
      .eq('id', invoiceId)
      .single();
    
    if (error || !invoice) {
      return { valid: false, errors: ['Invoice not found'] };
    }
    
    // Vérifier le statut
    if (invoice.status === 'void') {
      errors.push('Cannot generate PDF for voided invoice');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canVoid: async (invoiceId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: invoice, error } = await admin
      .from('invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();
    
    if (error || !invoice) {
      return { valid: false, errors: ['Invoice not found'] };
    }
    
    if (invoice.status === 'void') {
      errors.push('Invoice already voided');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const brandValidators = {
  canCreate: async (email: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Vérifier que l'email n'existe pas déjà
    const { data: existing, error } = await admin
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    
    if (error) {
      return { valid: false, errors: ['Failed to check existing profile'] };
    }
    
    if (existing) {
      errors.push('A profile with this email already exists');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const moderationValidators = {
  canClaim: async (queueItemId: string, userId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: queueItem, error } = await admin
      .from('moderation_queue')
      .select('id, status, reviewed_by')
      .eq('id', queueItemId)
      .single();
    
    if (error || !queueItem) {
      return { valid: false, errors: ['Queue item not found'] };
    }
    
    if (queueItem.status !== 'pending') {
      if (queueItem.status === 'processing' && queueItem.reviewed_by === userId) {
        // Déjà réclamé par le même utilisateur, c'est OK
        return { valid: true, errors: [] };
      }
      errors.push('Queue item already claimed');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  canRelease: async (queueItemId: string, userId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: queueItem, error } = await admin
      .from('moderation_queue')
      .select('id, status, reviewed_by')
      .eq('id', queueItemId)
      .single();
    
    if (error || !queueItem) {
      return { valid: false, errors: ['Queue item not found'] };
    }
    
    if (queueItem.status !== 'processing' || queueItem.reviewed_by !== userId) {
      errors.push('Queue item cannot be released');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const teamValidators = {
  canCreate: async (email: string, actorId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Vérifier que l'acteur est super-admin
    const { data: actor } = await admin
      .from('admin_staff')
      .select('is_super_admin')
      .eq('user_id', actorId)
      .single();
    
    if (!actor || !actor.is_super_admin) {
      errors.push('Only super-admins can create admin team members');
    }
    
    // Vérifier que l'email n'existe pas déjà (optionnel, car on peut promouvoir un utilisateur existant)
    // Cette validation est déjà gérée dans la route, donc on laisse passer
    
    return { valid: errors.length === 0, errors };
  },
  
  canUpdate: async (userId: string, actorId: string, updates: { is_active?: boolean }): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Ne pas permettre de désactiver son propre accès
    if (userId === actorId && updates.is_active === false) {
      errors.push('Cannot deactivate your own access');
    }
    
    // Vérifier que l'utilisateur existe dans admin_staff
    const { data: staff, error } = await admin
      .from('admin_staff')
      .select('user_id')
      .eq('user_id', userId)
      .single();
    
    if (error || !staff) {
      return { valid: false, errors: ['Admin staff member not found'] };
    }
    
    return { valid: errors.length === 0, errors };
  },
};

