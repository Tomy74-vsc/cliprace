"use client";
import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  FileText, 
  Target, 
  Users, 
  DollarSign, 
  Calendar, 
  CreditCard,
  Plus,
  X,
  Upload,
  Eye,
  Hash
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContestFormData = {
  title: string;
  description: string;
  visual_url: string;
  hashtags: string[];
  rules_text: string;
  rules_file: File | null;
  creator_selection: "all" | "specific";
  selected_creators: string[];
  budget_cents: number;
  prize_distribution: { position: number; percentage: number; }[];
  starts_at: string;
  ends_at: string;
};

const steps = [
  { id: 1, title: "Informations générales", icon: FileText },
  { id: 2, title: "Règles & conditions", icon: Target },
  { id: 3, title: "Sélection créateurs", icon: Users },
  { id: 4, title: "Budget & récompenses", icon: DollarSign },
  { id: 5, title: "Dates & lancement", icon: Calendar },
];

export default function CreateContestPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ContestFormData>({
    title: "",
    description: "",
    visual_url: "",
    hashtags: [],
    rules_text: "",
    rules_file: null,
    creator_selection: "all",
    selected_creators: [],
    budget_cents: 0,
    prize_distribution: [
      { position: 1, percentage: 30 },
      { position: 2, percentage: 20 },
      { position: 3, percentage: 15 },
    ],
    starts_at: "",
    ends_at: "",
  });
  const [hashtagInput, setHashtagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateFormData = useCallback((updates: Partial<ContestFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors when updating - only if there are errors
    setErrors(prev => Object.keys(prev).length > 0 ? {} : prev);
  }, []);

  const addHashtag = () => {
    const hashtag = hashtagInput.trim().replace(/^#/, '');
    if (hashtag && !formData.hashtags.includes(hashtag)) {
      updateFormData({ hashtags: [...formData.hashtags, hashtag] });
      setHashtagInput("");
    }
  };

  const removeHashtag = (hashtag: string) => {
    updateFormData({ hashtags: formData.hashtags.filter(h => h !== hashtag) });
  };

  const handleHashtagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHashtag();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateFormData({ rules_file: file });
    }
  };

  const addPrizePosition = () => {
    const newPosition = formData.prize_distribution.length + 1;
    updateFormData({ 
      prize_distribution: [...formData.prize_distribution, { position: newPosition, percentage: 0 }] 
    });
  };

  const updatePrizePercentage = (position: number, percentage: number) => {
    updateFormData({
      prize_distribution: formData.prize_distribution.map(p => 
        p.position === position ? { ...p, percentage } : p
      )
    });
  };

  const removePrizePosition = (position: number) => {
    updateFormData({
      prize_distribution: formData.prize_distribution.filter(p => p.position !== position)
    });
  };

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.title.trim()) newErrors.title = "Le titre est requis";
        if (!formData.description.trim()) newErrors.description = "La description est requise";
        if (formData.title.length > 100) newErrors.title = "Le titre ne peut pas dépasser 100 caractères";
        if (formData.description.length > 500) newErrors.description = "La description ne peut pas dépasser 500 caractères";
        break;
      case 2:
        if (!formData.rules_text.trim()) newErrors.rules_text = "Les règles sont requises";
        break;
      case 3:
        if (formData.creator_selection === "specific" && formData.selected_creators.length === 0) {
          newErrors.creator_selection = "Veuillez sélectionner au moins un créateur";
        }
        break;
      case 4:
        if (formData.budget_cents <= 0) newErrors.budget = "Le budget doit être supérieur à 0";
        if (formData.prize_distribution.length === 0) newErrors.prize_distribution = "Au moins une récompense est requise";
        const totalPercentage = formData.prize_distribution.reduce((sum, p) => sum + p.percentage, 0);
        if (totalPercentage !== 100) newErrors.prize_distribution = "Le total des pourcentages doit être égal à 100%";
        break;
      case 5:
        if (!formData.starts_at) newErrors.starts_at = "La date de début est requise";
        if (!formData.ends_at) newErrors.ends_at = "La date de fin est requise";
        if (formData.starts_at && formData.ends_at && new Date(formData.starts_at) >= new Date(formData.ends_at)) {
          newErrors.ends_at = "La date de fin doit être après la date de début";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const isStepValid = useMemo(() => {
    return validateStep(currentStep);
  }, [validateStep, currentStep]);

  const nextStep = useCallback(() => {
    if (isStepValid && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  }, [isStepValid, currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    
    setIsSubmitting(true);
    try {
      // TODO: Implement actual contest creation with API call
      console.log("Creating contest with data:", formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to contests list
      window.location.href = "/brand/contests";
    } catch (error) {
      console.error("Error creating contest:", error);
      setErrors({ submit: "Erreur lors de la création du concours" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Titre du concours *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                placeholder="Ex: Mon concours UGC 2024"
                maxLength={100}
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              <p className="text-xs text-zinc-500 mt-1">{formData.title.length}/100 caractères</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Décrivez votre concours, les objectifs, le style attendu..."
                rows={4}
                maxLength={500}
                className={`w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800 ${errors.description ? "border-red-500" : ""}`}
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              <p className="text-xs text-zinc-500 mt-1">{formData.description.length}/500 caractères</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                URL de l&apos;image du concours
              </label>
              <Input
                value={formData.visual_url}
                onChange={(e) => updateFormData({ visual_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                type="url"
              />
              {formData.visual_url && (
                <div className="mt-2">
                  <Image 
                    src={formData.visual_url} 
                    alt="Aperçu" 
                    width={128}
                    height={128}
                    className="h-32 w-32 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Hashtags
              </label>
              <div className="flex gap-2">
                <Input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyPress={handleHashtagKeyPress}
                  placeholder="Ajouter un hashtag"
                />
                <Button onClick={addHashtag} type="button" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.hashtags.map((hashtag) => (
                    <Badge key={hashtag} variant="secondary" className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {hashtag}
                      <button
                        onClick={() => removeHashtag(hashtag)}
                        className="ml-1 hover:text-red-500"
                        aria-label={`Supprimer le hashtag ${hashtag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Règles du concours *
              </label>
              <textarea
                value={formData.rules_text}
                onChange={(e) => updateFormData({ rules_text: e.target.value })}
                placeholder="Détaillez les règles, critères d&apos;évaluation, conditions de participation..."
                rows={6}
                className={`w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800 ${errors.rules_text ? "border-red-500" : ""}`}
              />
              {errors.rules_text && <p className="text-red-500 text-sm mt-1">{errors.rules_text}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Fichier de règles (optionnel)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  id="rules-file"
                />
                <label
                  htmlFor="rules-file"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  Choisir un fichier
                </label>
                {formData.rules_file && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formData.rules_file.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Sélection des créateurs
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    value="all"
                    checked={formData.creator_selection === "all"}
                    onChange={(e) => updateFormData({ creator_selection: e.target.value as "all" | "specific" })}
                    className="text-violet-600"
                  />
                  <span>Ouvert à tous les créateurs</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    value="specific"
                    checked={formData.creator_selection === "specific"}
                    onChange={(e) => updateFormData({ creator_selection: e.target.value as "all" | "specific" })}
                    className="text-violet-600"
                  />
                  <span>Sélectionner des créateurs spécifiques</span>
                </label>
              </div>
              {errors.creator_selection && <p className="text-red-500 text-sm mt-1">{errors.creator_selection}</p>}
            </div>

            {formData.creator_selection === "specific" && (
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  TODO: Implémenter la sélection de créateurs avec recherche et filtres
                </p>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <Users className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Interface de sélection des créateurs à implémenter
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Budget total (€) *
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.budget_cents / 100}
                onChange={(e) => updateFormData({ budget_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                placeholder="1000.00"
                className={errors.budget ? "border-red-500" : ""}
              />
              {errors.budget && <p className="text-red-500 text-sm mt-1">{errors.budget}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Répartition des récompenses *
                </label>
                <Button onClick={addPrizePosition} type="button" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              
              {formData.prize_distribution.map((prize) => (
                <div key={prize.position} className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium w-16">#{prize.position}</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={prize.percentage}
                    onChange={(e) => updatePrizePercentage(prize.position, parseInt(e.target.value || "0"))}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">%</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    (€{((formData.budget_cents * prize.percentage) / 10000).toFixed(2)})
                  </span>
                  {formData.prize_distribution.length > 1 && (
                    <Button
                      onClick={() => removePrizePosition(prize.position)}
                      type="button"
                      variant="outline"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {errors.prize_distribution && <p className="text-red-500 text-sm mt-1">{errors.prize_distribution}</p>}
              
              <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Total: {formData.prize_distribution.reduce((sum, p) => sum + p.percentage, 0)}%
                </p>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Date de début *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => updateFormData({ starts_at: e.target.value })}
                  className={errors.starts_at ? "border-red-500" : ""}
                />
                {errors.starts_at && <p className="text-red-500 text-sm mt-1">{errors.starts_at}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Date de fin *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => updateFormData({ ends_at: e.target.value })}
                  className={errors.ends_at ? "border-red-500" : ""}
                />
                {errors.ends_at && <p className="text-red-500 text-sm mt-1">{errors.ends_at}</p>}
              </div>
            </div>

            {/* Contest Preview */}
            <div className="mt-8 p-6 border border-zinc-200 rounded-2xl bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Aperçu du concours
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">{formData.title || "Titre du concours"}</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formData.description || "Description du concours"}
                  </p>
                </div>
                {formData.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.hashtags.map((hashtag) => (
                      <Badge key={hashtag} variant="secondary" className="text-xs">
                        #{hashtag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <p>Budget: €{(formData.budget_cents / 100).toFixed(2)}</p>
                  <p>Durée: {formData.starts_at && formData.ends_at ? 
                    `${Math.ceil((new Date(formData.ends_at).getTime() - new Date(formData.starts_at).getTime()) / (1000 * 60 * 60 * 24))} jours` : 
                    "Non définie"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div>
          <Link href="/brand/contests" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" />
            Retour aux concours
          </Link>
          <h1 className="mt-2 text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Créer un concours
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Suivez les étapes pour créer votre concours UGC
          </p>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-3 ${currentStep >= step.id ? "text-violet-600" : "text-zinc-400"}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                currentStep >= step.id ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-300 dark:border-zinc-600"
              }`}>
                {currentStep > step.id ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium">{step.title}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`mx-4 h-px w-16 ${currentStep > step.id ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-600"}`} />
            )}
          </div>
        ))}
      </motion.div>

      {/* Step Content */}
      <motion.div 
        key={currentStep} 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        transition={{ duration: 0.3 }} 
        className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {renderStepContent()}
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex items-center justify-between">
        <Button onClick={prevStep} disabled={currentStep === 1} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>

        {currentStep < 5 ? (
          <Button onClick={nextStep} disabled={!isStepValid} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            Suivant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={!isStepValid || isSubmitting} 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                Création...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Créer et payer
              </>
            )}
          </Button>
        )}
      </motion.div>

      {/* Submit Error */}
      {errors.submit && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800"
        >
          <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
        </motion.div>
      )}
    </div>
  );
}
