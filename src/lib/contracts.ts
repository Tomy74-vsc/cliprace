import { getServerSupabase } from '@/lib/supabase/server';

// Contract data interface
export interface ContractData {
  contestTitle: string;
  contestRules: string;
  brandName: string;
  creatorName: string;
  creatorEmail: string;
  submissionDate: string;
  platform: string;
  videoUrl: string;
  compensation: string;
  termsAndConditions: string;
}

// Generate contract data from submission and contest info
export async function generateContractData(
  submissionId: string,
  contestId: string,
  creatorId: string
): Promise<ContractData> {
  const supabase = await getServerSupabase();
  
  // Fetch submission details
  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (submissionError || !submission) {
    throw new Error('Submission not found');
  }

  // Fetch contest details
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single();

  if (contestError || !contest) {
    throw new Error('Contest not found');
  }

  // Fetch creator profile
  const { data: creator, error: creatorError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', creatorId)
    .single();

  if (creatorError || !creator) {
    throw new Error('Creator profile not found');
  }

  // Fetch brand profile
  const { data: brand, error: brandError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', contest.brand_id)
    .single();

  if (brandError || !brand) {
    throw new Error('Brand profile not found');
  }

  return {
    contestTitle: contest.title,
    contestRules: contest.rules_text || 'Règles du concours disponibles sur la plateforme.',
    brandName: brand.display_name || brand.email,
    creatorName: creator.display_name || creator.email,
    creatorEmail: creator.email,
    submissionDate: new Date(submission.created_at).toLocaleDateString('fr-FR'),
    platform: submission.network,
    videoUrl: submission.video_url,
    compensation: `Rémunération selon le modèle ${contest.payout_model} - Budget total : ${(contest.budget_cents / 100).toFixed(2)}€`,
    termsAndConditions: `
      • Le créateur conserve les droits d'auteur sur son contenu
      • La marque obtient une licence d'utilisation pour la durée du concours
      • Le contenu doit respecter les conditions d'utilisation de la plateforme
      • Toute violation des règles entraîne la disqualification
      • La rémunération est versée sous 30 jours après validation
      • En cas de litige, le droit français s'applique
    `
  };
}

// Generate and upload contract PDF
export async function generateAndUploadContract(
  submissionId: string,
  contestId: string,
  creatorId: string
): Promise<string> {
  try {
    const contractData = await generateContractData(submissionId, contestId, creatorId);
    
    // For now, we'll return a placeholder URL
    // In a real implementation, you would:
    // 1. Generate the PDF using @react-pdf/renderer
    // 2. Upload it to Supabase Storage
    // 3. Return the public URL
    
    const supabase = await getServerSupabase();
    const fileName = `contract_${submissionId}_${Date.now()}.pdf`;
    
    // Create a simple text-based contract for now
    const contractContent = `
CONTRAT DE PARTICIPATION AU CONCOURS
ClipRace - Plateforme de Concours de Contenu

1. INFORMATIONS DU CONCOURS
Titre du concours : ${contractData.contestTitle}
Marque organisatrice : ${contractData.brandName}
Date de soumission : ${contractData.submissionDate}

2. INFORMATIONS DU CRÉATEUR
Nom : ${contractData.creatorName}
Email : ${contractData.creatorEmail}
Plateforme : ${contractData.platform}
URL de la vidéo : ${contractData.videoUrl}

3. RÈGLES DU CONCOURS
${contractData.contestRules}

4. RÉMUNÉRATION
${contractData.compensation}

5. CONDITIONS GÉNÉRALES
${contractData.termsAndConditions}

6. SIGNATURE
En signant ce contrat, je confirme avoir lu et accepté toutes les conditions énoncées ci-dessus.

Signature du créateur : _________________
Date : _________________

Ce contrat a été généré automatiquement par ClipRace le ${new Date().toLocaleDateString('fr-FR')}
    `;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(fileName, contractContent, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload contract: ${uploadError.message}`);
    }

    if (!uploadData) {
      throw new Error('Upload failed - no data returned');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error generating contract:', error);
    throw new Error('Failed to generate contract');
  }
}

// Generate signed contract with signature metadata
export async function generateSignedContract(
  submissionId: string,
  signatureData: {
    legalName: string;
    signedAt: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string> {
  try {
    const supabase = await getServerSupabase();
    
    // Fetch submission and related data
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        *,
        contests!inner(*),
        profiles!submissions_creator_id_fkey(*)
      `)
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error('Submission not found');
    }

    const contractData = await generateContractData(
      submissionId,
      submission.contest_id,
      submission.creator_id
    );

    // Add signature information
    const signedContractContent = `
CONTRAT DE PARTICIPATION AU CONCOURS - SIGNÉ
ClipRace - Plateforme de Concours de Contenu

1. INFORMATIONS DU CONCOURS
Titre du concours : ${contractData.contestTitle}
Marque organisatrice : ${contractData.brandName}
Date de soumission : ${contractData.submissionDate}

2. INFORMATIONS DU CRÉATEUR
Nom : ${contractData.creatorName}
Email : ${contractData.creatorEmail}
Plateforme : ${contractData.platform}
URL de la vidéo : ${contractData.videoUrl}

3. RÈGLES DU CONCOURS
${contractData.contestRules}

4. RÉMUNÉRATION
${contractData.compensation}

5. CONDITIONS GÉNÉRALES
${contractData.termsAndConditions}

6. SIGNATURE
En signant ce contrat, je confirme avoir lu et accepté toutes les conditions énoncées ci-dessus.

Signature du créateur : ${signatureData.legalName}
Date de signature : ${new Date(signatureData.signedAt).toLocaleDateString('fr-FR')}
Heure de signature : ${new Date(signatureData.signedAt).toLocaleTimeString('fr-FR')}
${signatureData.ipAddress ? `Adresse IP : ${signatureData.ipAddress}` : ''}
${signatureData.userAgent ? `User Agent : ${signatureData.userAgent}` : ''}

Ce contrat a été signé électroniquement et est juridiquement valide.
Généré automatiquement par ClipRace le ${new Date().toLocaleDateString('fr-FR')}
    `;

    const fileName = `signed_contract_${submissionId}_${Date.now()}.pdf`;
    
    // Upload signed contract
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(fileName, signedContractContent, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload signed contract: ${uploadError.message}`);
    }

    if (!uploadData) {
      throw new Error('Signed contract upload failed - no data returned');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error generating signed contract:', error);
    throw new Error('Failed to generate signed contract');
  }
}
