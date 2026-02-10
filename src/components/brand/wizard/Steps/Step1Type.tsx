'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Gift, Info } from 'lucide-react';
import { useContestWizard } from '@/store/useContestWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function Step1Type() {
  const { data, setData, errors } = useContestWizard();

  const isProduct = data.contest_type === 'product';

  const handleSelectType = (type: 'cash' | 'product') => {
    if (type === 'cash') {
      setData({
        contest_type: 'cash',
        product_details: undefined,
        shipping_info: undefined,
      });
    } else {
      setData({
        contest_type: 'product',
        product_details:
          data.product_details ?? {
            name: '',
            value: 0,
            image_url: '',
            brand_url: '',
          },
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Quel type de récompense ?</h2>
        <p className="text-sm text-muted-foreground">
          Choisis entre un cashprize simple ou un produit physique à envoyer aux gagnants.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cash card */}
        <button
          type="button"
          onClick={() => handleSelectType('cash')}
          className="text-left"
        >
          <Card
            className={`h-full transition-all cursor-pointer ${
              data.contest_type === 'cash'
                ? 'border-primary shadow-lg shadow-primary/15 bg-primary/5'
                : 'hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <CardContent className="pt-5 flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Banknote className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Cashprize</p>
                <p className="text-sm text-muted-foreground">
                  Verse un montant fixe en cash repartagé entre les gagnants.
                </p>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Product card */}
        <button
          type="button"
          onClick={() => handleSelectType('product')}
          className="text-left"
        >
          <Card
            className={`h-full transition-all cursor-pointer ${
              isProduct
                ? 'border-primary shadow-lg shadow-primary/15 bg-primary/5'
                : 'hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <CardContent className="pt-5 flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Produit à envoyer</p>
                <p className="text-sm text-muted-foreground">
                  Tu offres ton produit à un certain nombre de créateurs gagnants.
                </p>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Product details */}
      <AnimatePresence initial={false}>
        {isProduct && (
          <motion.div
            key="product-details"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <Card className="border-dashed border-primary/40 bg-muted/40">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 mt-[2px]" />
                  <p>
                    Plus tu détailles le produit, plus il sera facile pour les créateurs de se
                    projeter et de créer du contenu de qualité.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Nom du produit"
                    placeholder="Ex: Coffret skincare GlowBoost"
                    value={data.product_details?.name ?? ''}
                    error={errors['product_details.name'] ?? errors.product_details}
                    onChange={(e) =>
                      setData({
                        product_details: {
                          ...(data.product_details ?? {
                            name: '',
                            value: 0,
                            image_url: '',
                            brand_url: '',
                          }),
                          name: e.target.value,
                        },
                      })
                    }
                  />
                  <Input
                    label="Valeur perçue (en €)"
                    type="number"
                    min={0}
                    placeholder="Ex: 120"
                    value={
                      data.product_details?.value !== undefined
                        ? String(data.product_details.value)
                        : ''
                    }
                    error={errors['product_details.value'] ?? errors.product_details}
                    helpText="C'est le montant qui sera affiché aux créateurs. Une valeur perçue plus élevée augmente souvent le taux de participation."
                    onChange={(e) =>
                      setData({
                        product_details: {
                          ...(data.product_details ?? {
                            name: '',
                            value: 0,
                            image_url: '',
                            brand_url: '',
                          }),
                          value: Number(e.target.value || 0),
                        },
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Image du produit (URL)"
                    placeholder="https://..."
                    value={data.product_details?.image_url ?? ''}
                    error={errors['product_details.image_url'] ?? errors.product_details}
                    onChange={(e) =>
                      setData({
                        product_details: {
                          ...(data.product_details ?? {
                            name: '',
                            value: 0,
                            image_url: '',
                            brand_url: '',
                          }),
                          image_url: e.target.value,
                        },
                      })
                    }
                    helpText="Utilise une image claire qui donne envie."
                  />
                  <Input
                    label="Page produit (URL, optionnel)"
                    placeholder="https://ta-marque.com/produit"
                    value={data.product_details?.brand_url ?? ''}
                    error={errors['product_details.brand_url'] ?? errors.product_details}
                    onChange={(e) =>
                      setData({
                        product_details: {
                          ...(data.product_details ?? {
                            name: '',
                            value: 0,
                            image_url: '',
                            brand_url: '',
                          }),
                          brand_url: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

