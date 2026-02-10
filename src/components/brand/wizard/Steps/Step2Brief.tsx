'use client';

import { useContestWizard } from '@/store/useContestWizard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, UploadCloud } from 'lucide-react';

export function Step2Brief() {
  const { data, setData, errors } = useContestWizard();

  const handleFakeUpload = () => {
    // Simule une URL d'image pour l'aperçu (placeholder immédiat)
    const placeholder = 'https://placehold.co/600x800';
    setData({
      product_details: data.product_details
        ? {
            ...data.product_details,
            image_url: data.product_details.image_url || placeholder,
          }
        : {
            name: '',
            value: 0,
            image_url: placeholder,
            brand_url: '',
          },
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Raconte ton concours</h2>
        <p className="text-sm text-muted-foreground">
          Ce que verront les créateurs sur la page concours. Sois clair, inspirant et concret.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="Titre du concours"
          placeholder="Ex: Challenge UGC #GlowBoost — gagne jusqu’à 1 000€"
          value={data.title}
          error={errors.title}
          onChange={(e) => setData({ title: e.target.value })}
        />
        <Textarea
          label="Description / brief"
          placeholder="Explique aux créateurs ce que tu attends : type de contenu, angles, contraintes, hashtags..."
          rows={6}
          value={data.description}
           error={errors.description}
          onChange={(e) => setData({ description: e.target.value })}
        />
      </div>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="pt-5 flex flex-col md:flex-row items-stretch gap-4">
          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium">Logo ou visuel principal</p>
            <p className="text-xs text-muted-foreground">
              Ajoute une image qui représentera ton concours (logo de la marque, visuel produit,
              campagne...). Cette étape peut être connectée plus tard à ton système d’upload.
            </p>

            <button
              type="button"
              onClick={handleFakeUpload}
              className="w-full mt-2 rounded-xl border border-dashed border-border/80 bg-background/60 hover:bg-muted/50 transition-colors flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Cliquer pour simuler un upload</p>
                  <p className="text-xs text-muted-foreground">
                    Nous pré-remplissons une image placeholder pour que tu voies immédiatement le rendu.
                  </p>
                </div>
              </div>
            </button>

            <p className="text-[11px] text-muted-foreground">
              1200×1600px recommandé • PNG ou JPG • &lt; 5 Mo
            </p>
          </div>

          <div className="w-full md:w-40 rounded-xl border border-dashed border-border/70 bg-background/60 flex items-center justify-center overflow-hidden">
            {data.product_details?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.product_details.image_url}
                alt="Aperçu"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs text-center leading-snug">
                  Aucun visuel sélectionné
                  <br />
                  (aperçu simulé)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

