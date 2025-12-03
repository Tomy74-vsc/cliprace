'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldWithTooltip } from '@/components/ui/field-with-tooltip';
import { Plus, X, Upload, Image as ImageIcon, Video, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { useToastContext } from '@/hooks/use-toast-context';
import type { ContestWizardData } from '../contest-wizard-client';

interface Step0ProductProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  userId: string;
}

const PRODUCT_CATEGORIES = [
  { value: 'boisson', label: 'Boisson' },
  { value: 'mode', label: 'Mode' },
  { value: 'cosmetique', label: 'Cosmétique' },
  { value: 'tech', label: 'Tech' },
  { value: 'restauration', label: 'Restauration' },
  { value: 'autre', label: 'Autre' },
] as const;

const TARGET_AUDIENCE_OPTIONS = [
  { value: 'etudiants', label: 'Étudiants' },
  { value: 'jeunes_actifs', label: 'Jeunes actifs' },
  { value: 'parents', label: 'Parents' },
  { value: 'sportifs', label: 'Sportifs' },
] as const;

interface ProductAsset {
  url: string;
  type: 'image' | 'video' | 'pdf';
  name?: string;
}

export function Step0Product({ data, updateData, errors }: Step0ProductProps) {
  const csrfToken = useCsrfToken();
  const { toast } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [otherTarget, setOtherTarget] = useState('');

  const productBenefits = data.productBenefits || [];
  const productTargetAudience = data.productTargetAudience || [];
  const productAssets = (data.productAssets || []) as ProductAsset[];

  const addBenefit = () => {
    if (productBenefits.length < 3) {
      updateData({ productBenefits: [...productBenefits, ''] });
    }
  };

  const updateBenefit = (index: number, value: string) => {
    const updated = [...productBenefits];
    updated[index] = value;
    updateData({ productBenefits: updated });
  };

  const removeBenefit = (index: number) => {
    const updated = productBenefits.filter((_, i) => i !== index);
    updateData({ productBenefits: updated });
  };

  const toggleTargetAudience = (value: string) => {
    const updated = productTargetAudience.includes(value)
      ? productTargetAudience.filter((v) => v !== value)
      : [...productTargetAudience, value];
    updateData({ productTargetAudience: updated });
  };

  const addOtherTarget = () => {
    if (otherTarget.trim() && !productTargetAudience.includes(`autre:${otherTarget.trim()}`)) {
      updateData({ productTargetAudience: [...productTargetAudience, `autre:${otherTarget.trim()}`] });
      setOtherTarget('');
    }
  };

  const removeTarget = (value: string) => {
    updateData({ productTargetAudience: productTargetAudience.filter((v) => v !== value) });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!data.contest_id) {
      toast({
        type: 'info',
        title: 'Information',
        message: 'Sauvegardez d\'abord le brouillon pour pouvoir uploader des fichiers.',
      });
      return;
    }

    setUploading(true);
    const newAssets: ProductAsset[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validation
        const maxSize = 200 * 1024 * 1024; // 200 MB
        if (file.size > maxSize) {
          toast({
            type: 'error',
            title: 'Erreur',
            message: `Le fichier ${file.name} dépasse 200 Mo.`,
          });
          continue;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'];
        if (!allowedTypes.some((type) => file.type.startsWith(type.split('/')[0]))) {
          toast({
            type: 'error',
            title: 'Erreur',
            message: `Le type de fichier ${file.name} n'est pas supporté.`,
          });
          continue;
        }

        // Obtenir le path signé
        const signResponse = await fetch('/api/uploads/contest-asset/sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify({
            contest_id: data.contest_id,
            filename: file.name,
            mime: file.type,
            size: file.size,
          }),
        });

        if (!signResponse.ok) {
          const error = await signResponse.json();
          // Si l'API retourne une erreur, c'est que le concours n'existe pas ou que l'utilisateur n'est pas propriétaire
          if (signResponse.status === 404) {
            throw new Error('Le concours n\'existe pas. Veuillez sauvegarder le brouillon d\'abord.');
          }
          if (signResponse.status === 403) {
            throw new Error('Vous n\'êtes pas autorisé à uploader des fichiers pour ce concours.');
          }
          throw new Error(error.message || 'Erreur lors de la signature');
        }

        const { bucket, path } = await signResponse.json();

        // Debug: afficher les informations pour le diagnostic
        console.log('Upload attempt:', { bucket, path, contest_id: data.contest_id });

        // Vérifier que l'utilisateur est authentifié
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error('Auth error:', authError);
          throw new Error('Vous devez être connecté pour uploader des fichiers. Veuillez vous reconnecter.');
        }
        console.log('Authenticated user:', user.id);

        // Vérifier que le concours existe et que l'utilisateur est le propriétaire AVANT l'upload
        // Cela permet d'afficher un message d'erreur plus clair si le problème vient de là
        try {
          const checkResponse = await fetch(`/api/contests/${data.contest_id}`, {
            method: 'GET',
            credentials: 'include',
          });
          if (!checkResponse.ok) {
            throw new Error(
              `Le concours n'existe pas ou vous n'avez pas les permissions. ` +
              `Veuillez sauvegarder le brouillon d'abord.`
            );
          }
          const contestData = await checkResponse.json();
          
          // Debug: afficher la structure complète de la réponse
          console.log('Contest data from API:', contestData);
          
          // L'API retourne { ok: true, contest: { ... } }
          const brandId = contestData?.contest?.brand_id;
          
          if (!brandId) {
            console.warn('brand_id not found in contest data:', contestData);
            // Si brand_id n'est pas disponible, on continue quand même
            // La politique RLS vérifiera côté serveur
            console.log('Skipping brand_id check, RLS will verify on server side');
          } else if (brandId !== user.id) {
            throw new Error(
              `Vous n'êtes pas le propriétaire de ce concours. ` +
              `Contest brand_id: ${brandId}, Your ID: ${user.id}`
            );
          } else {
            console.log('Contest ownership verified:', {
              contest_id: data.contest_id,
              brand_id: brandId,
              user_id: user.id,
            });
          }
        } catch (checkError) {
          console.error('Contest verification error:', checkError);
          // Ne pas bloquer l'upload si la vérification échoue
          // La politique RLS vérifiera côté serveur de toute façon
          if (checkError instanceof Error && checkError.message.includes('propriétaire')) {
            throw checkError;
          }
          console.warn('Contest verification failed, continuing with upload (RLS will verify)');
        }

        // L'API a déjà vérifié les permissions, on peut procéder à l'upload
        // Le client Supabase utilisera automatiquement la session stockée dans les cookies
        // Upload vers Supabase Storage
        const uploadResult = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

        // Log complet du résultat pour diagnostic
        console.log('Upload result:', {
          data: uploadResult.data,
          error: uploadResult.error,
          hasError: !!uploadResult.error,
          resultType: typeof uploadResult,
          resultKeys: Object.keys(uploadResult),
        });

        if (uploadResult.error) {
          const uploadError = uploadResult.error;
          
          // Méthode 1: Accès direct aux propriétés
          const directMessage = (uploadError as any).message;
          const directStatus = (uploadError as any).statusCode || (uploadError as any).status;
          const directName = (uploadError as any).name;
          
          // Méthode 2: Conversion en objet
          const errorObj = uploadError as unknown as Record<string, unknown>;
          const errorMessage = directMessage || (errorObj.message as string) || String(uploadError);
          const errorStatus = directStatus || (errorObj.statusCode as string) || (errorObj.status as string);
          const errorName = directName || (errorObj.name as string);
          
          // Méthode 3: Extraire toutes les clés (y compris héritées)
          const errorKeys: string[] = [];
          for (const key in uploadError) {
            errorKeys.push(key);
          }
          const errorValues = errorKeys.map(key => (uploadError as any)[key]);
          
          // Méthode 4: Stringifier avec replacer personnalisé
          let errorStringified = '';
          try {
            errorStringified = JSON.stringify(uploadError, (key, value) => {
              // Inclure toutes les propriétés
              if (value === undefined) return 'undefined';
              if (value === null) return null;
              if (typeof value === 'function') return '[Function]';
              if (value instanceof Error) {
                return {
                  name: value.name,
                  message: value.message,
                  stack: value.stack,
                  ...Object.getOwnPropertyNames(value).reduce((acc, prop) => {
                    acc[prop] = (value as any)[prop];
                    return acc;
                  }, {} as Record<string, unknown>),
                };
              }
              return value;
            }, 2);
          } catch (e) {
            try {
              errorStringified = JSON.stringify(uploadError);
            } catch {
              errorStringified = String(uploadError);
            }
          }
          
          // Méthode 5: Log direct de l'erreur (peut afficher plus d'infos)
          console.error('Upload error (direct log):', uploadError);
          console.error('Upload error (stringified):', errorStringified);
          console.error('Upload error details:', {
            errorMessage,
            errorStatus,
            errorName,
            errorKeys,
            errorValues,
            errorType: typeof uploadError,
            errorConstructor: uploadError?.constructor?.name,
            errorPrototype: Object.getPrototypeOf(uploadError),
            bucket,
            path,
            contest_id: data.contest_id,
            user_id: user.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
          });

          // Message d'erreur plus clair selon le type d'erreur
          const lowerMessage = errorMessage.toLowerCase();
          
          if (lowerMessage.includes('bucket not found') || lowerMessage.includes('not found')) {
            throw new Error(
              'Le bucket de stockage n\'existe pas. Veuillez créer le bucket "contest_assets" dans Supabase Storage ou contacter l\'administrateur.'
            );
          }
          
          if (
            lowerMessage.includes('row-level security') ||
            lowerMessage.includes('rls') ||
            lowerMessage.includes('policy') ||
            lowerMessage.includes('new row violates') ||
            lowerMessage.includes('permission denied') ||
            lowerMessage.includes('access denied')
          ) {
            // Vérifier que le concours existe et que l'utilisateur est bien le propriétaire
            try {
              const checkResponse = await fetch(`/api/contests/${data.contest_id}`, {
                method: 'GET',
                credentials: 'include',
              });
              const contestData = checkResponse.ok ? await checkResponse.json() : null;
              
              const debugInfo = contestData?.contest 
                ? `Contest brand_id: ${contestData.contest.brand_id}, User ID: ${user.id}. ` 
                : 'Contest not found. ';
              
              throw new Error(
                `Erreur de permissions RLS (${errorStatus || 'unknown'}). ` +
                `Contest ID: ${data.contest_id}, User ID: ${user.id}. ` +
                debugInfo +
                `Erreur: ${errorMessage}. ` +
                'Vérifiez que les politiques RLS sont correctement appliquées et que le concours existe avec le bon brand_id.'
              );
            } catch (checkError) {
              throw new Error(
                `Erreur de permissions RLS. Contest ID: ${data.contest_id}, User ID: ${user.id}. ` +
                `Erreur: ${errorMessage}. ` +
                'Vérifiez que les politiques RLS sont correctement appliquées.'
              );
            }
          }
          
          throw new Error(errorMessage || `Erreur lors de l'upload du fichier (${errorStatus || 'unknown'})`);
        }

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        const assetType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'pdf';

        newAssets.push({
          url: urlData.publicUrl,
          type: assetType,
          name: file.name,
        });
      }

      updateData({ productAssets: [...productAssets, ...newAssets] });
      toast({
        type: 'success',
        title: 'Fichiers uploadés',
        message: `${newAssets.length} fichier(s) ajouté(s) avec succès.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible d\'uploader les fichiers.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAsset = (index: number) => {
    const updated = productAssets.filter((_, i) => i !== index);
    updateData({ productAssets: updated });
  };

  return (
    <div className="space-y-8">
      {/* Introduction épurée */}
      <div className="text-center space-y-2 pb-4">
        <h2 className="text-2xl font-semibold">Parlez-nous de votre produit</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          En quelques minutes, préparez tout ce dont les créateurs ont besoin pour comprendre votre produit et créer du contenu de qualité.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Formulaire à gauche */}
        <div className="space-y-6">
          {/* Bloc Produit */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Informations produit</h3>
              <p className="text-sm text-muted-foreground">Les champs marqués d'un * sont obligatoires</p>
            </div>

              <FieldWithTooltip
                label="Nom du produit ou de l'offre"
                tooltip="Le nom exact de votre produit ou offre. Les créateurs utiliseront ce nom dans leurs vidéos."
                required
              >
                <Input
                  value={data.productName || ''}
                  onChange={(e) => updateData({ productName: e.target.value })}
                  placeholder="Ex : Boisson énergisante SparkUp 250ml"
                  error={errors.productName}
                />
              </FieldWithTooltip>

              <FieldWithTooltip
                label="Décrivez votre produit en une phrase"
                tooltip="Une description courte et claire qui explique ce qu'est votre produit. Cette phrase aidera les créateurs à comprendre rapidement votre offre."
                required
              >
                <Textarea
                  value={data.productOneLiner || ''}
                  onChange={(e) => updateData({ productOneLiner: e.target.value })}
                  placeholder="Ex : Une boisson énergisante naturelle pour étudiants et jeunes actifs."
                  error={errors.productOneLiner}
                  rows={3}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Ce texte aidera les créateurs à comprendre ce que vous vendez.
                </p>
              </FieldWithTooltip>

              <FieldWithTooltip
                label="Catégorie"
                tooltip="La catégorie de votre produit. Cela aide à classer et à présenter votre concours aux créateurs appropriés."
              >
                <select
                  value={data.productCategory || ''}
                  onChange={(e) => {
                    updateData({ productCategory: e.target.value || null });
                  }}
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Sélectionnez une catégorie</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </FieldWithTooltip>
          </div>

          {/* Bloc Bénéfices clés */}
          <div className="space-y-4 pt-6 border-t">
            <div>
              <Label className="text-base font-medium">Points clés à mettre en avant</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Jusqu'à 3 bénéfices que les créateurs devraient mentionner (optionnel mais recommandé)
              </p>
            </div>

              {productBenefits.map((benefit, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={benefit}
                    onChange={(e) => updateBenefit(index, e.target.value)}
                    placeholder="Ex : Donne de l'énergie sans crash"
                  />
                  {productBenefits.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBenefit(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {productBenefits.length < 3 && (
                <Button type="button" variant="outline" onClick={addBenefit} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un point
                </Button>
              )}
          </div>

          {/* Bloc Cible / Public visé */}
          <div className="space-y-4 pt-6 border-t">
            <div>
              <Label className="text-base font-medium">Public visé</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Qui est votre cible principale ? (optionnel)
              </p>
            </div>

              <div className="space-y-2">
                {TARGET_AUDIENCE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`target-${option.value}`}
                      checked={productTargetAudience.includes(option.value)}
                      onCheckedChange={() => toggleTargetAudience(option.value)}
                    />
                    <Label
                      htmlFor={`target-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={otherTarget}
                  onChange={(e) => setOtherTarget(e.target.value)}
                  placeholder="Autre (précisez)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOtherTarget();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addOtherTarget}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {productTargetAudience.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {productTargetAudience.map((target) => (
                    <Badge key={target} variant="secondary" className="gap-1">
                      {target.startsWith('autre:') ? target.replace('autre:', '') : TARGET_AUDIENCE_OPTIONS.find((o) => o.value === target)?.label || target}
                      <button
                        type="button"
                        onClick={() => removeTarget(target)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
          </div>

          {/* Bloc Ressources pour les créateurs */}
          <div className="space-y-4 pt-6 border-t">
            <div>
              <Label className="text-base font-medium">Ressources visuelles</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez des photos, vidéos ou votre logo pour aider les créateurs (optionnel)
              </p>
            </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => {
                  if (!data.contest_id) {
                    toast({
                      type: 'info',
                      title: 'Information',
                      message: 'Sauvegardez d\'abord le brouillon pour pouvoir uploader des fichiers.',
                    });
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  uploading
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 hover:shadow-sm'
                } ${!data.contest_id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Upload en cours...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-muted p-4">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cliquez pour sélectionner</p>
                      <p className="text-xs text-muted-foreground mt-1">ou glissez-déposez vos fichiers</p>
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG, MP4 – max 200 Mo</p>
                  </div>
                )}
              </div>

              {productAssets.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {productAssets.map((asset, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-video rounded-lg border overflow-hidden bg-muted">
                        {asset.type === 'image' ? (
                          <img src={asset.url} alt={asset.name || `Asset ${index + 1}`} className="w-full h-full object-cover" />
                        ) : asset.type === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-8 w-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {asset.name && (
                        <p className="mt-1 text-xs text-muted-foreground truncate">{asset.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Aperçu côté créateurs à droite */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="bg-muted/30 rounded-xl border p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Aperçu créateur</h3>
              <p className="text-sm text-muted-foreground">
                Voici ce que les créateurs verront sur la page du concours
              </p>
            </div>
            <div className="space-y-4">
                {data.productName && (
                  <div>
                    <h4 className="font-semibold text-lg">{data.productName}</h4>
                  </div>
                )}
                {data.productOneLiner && (
                  <p className="text-sm text-muted-foreground">{data.productOneLiner}</p>
                )}
                {productBenefits.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Points clés :</h5>
                    <ul className="space-y-1">
                      {productBenefits.filter((b) => b.trim()).map((benefit, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {productTargetAudience.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Public visé :</h5>
                    <div className="flex flex-wrap gap-2">
                      {productTargetAudience.map((target) => (
                        <Badge key={target} variant="outline" className="text-xs">
                          {target.startsWith('autre:') ? target.replace('autre:', '') : TARGET_AUDIENCE_OPTIONS.find((o) => o.value === target)?.label || target}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {productAssets.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Ressources :</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {productAssets.slice(0, 4).map((asset, index) => (
                        <div key={index} className="aspect-video rounded border overflow-hidden bg-muted">
                          {asset.type === 'image' ? (
                            <img src={asset.url} alt="" className="w-full h-full object-cover" />
                          ) : asset.type === 'video' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-6 w-6 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!data.productName && !data.productOneLiner && (
                  <p className="text-sm text-muted-foreground italic">
                    Remplissez les informations du produit pour voir l'aperçu.
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

