/**
 * Exemple de composant utilisant les optimisations de la Phase 1
 * Démonstration des hooks de cache et des requêtes optimisées
 */

'use client';

import React, { useState } from 'react';
import { useContests, useGlobalStats } from '@/hooks/useCachedData';

interface Contest {
  id: string;
  title: string;
  description: string;
  status: string;
  total_prize_cents: number;
  starts_at: string;
  ends_at: string;
  visibility: string;
  profiles: {
    id: string;
    name: string;
    company_name: string;
  };
}

interface GlobalStats {
  activeContests: number;
  approvedSubmissions: number;
  activeCreators: number;
}

/**
 * Composant de liste de concours optimisée
 */
export function OptimizedContestList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  
  // Utilisation des hooks optimisés
  const { 
    data: contests, 
    loading: contestsLoading, 
    error: contestsError, 
    refetch: refetchContests 
  } = useContests({
    limit: 20,
    search: search || undefined,
    status: status || undefined,
  });
  
  const { 
    data: stats, 
    loading: statsLoading, 
    error: statsError 
  } = useGlobalStats();
  
  // Fonction pour créer un nouveau concours
  const handleCreateContest = async () => {
    try {
      // Données du concours
      const contestData = {
        title: 'Nouveau concours',
        description: 'Description du concours',
        total_prize_cents: 10000, // 100€
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
        visibility: 'public',
        networks: ['tiktok', 'instagram'],
        formats: ['short'],
        hashtags: ['#concours', '#viral'],
      };
      
      // Créer le concours
      const response = await fetch('/api/contests/optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contestData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }
      
      const result = await response.json();
      console.log('Concours créé:', result.data);
      
      // Rafraîchir la liste
      await refetchContests();
      
    } catch (error) {
      console.error('Erreur lors de la création du concours:', error);
      alert('Erreur lors de la création du concours');
    }
  };
  
  if (contestsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Chargement...</span>
      </div>
    );
  }
  
  if (contestsError || statsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">
          Erreur: {contestsError || statsError}
        </p>
        <button 
          onClick={() => refetchContests()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Statistiques globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900">Concours actifs</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.activeContests}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900">Soumissions approuvées</h3>
            <p className="text-2xl font-bold text-green-600">{stats.approvedSubmissions}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900">Créateurs actifs</h3>
            <p className="text-2xl font-bold text-purple-600">{stats.activeCreators}</p>
          </div>
        </div>
      )}
      
      {/* Filtres et recherche */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Rechercher un concours..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Filtrer par statut"
        >
          <option value="active">Actifs</option>
          <option value="draft">Brouillons</option>
          <option value="completed">Terminés</option>
        </select>
        <button
          onClick={handleCreateContest}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Créer un concours
        </button>
      </div>
      
      {/* Liste des concours */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contests?.map((contest: Contest) => (
          <div key={contest.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {contest.title}
            </h3>
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {contest.description}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Prix total:</span>
                <span className="font-semibold text-green-600">
                  {(contest.total_prize_cents / 100).toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Marque:</span>
                <span className="font-medium">{contest.profiles.company_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Statut:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  contest.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {contest.status}
                </span>
              </div>
            </div>
            <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Voir les détails
            </button>
          </div>
        ))}
      </div>
      
      {contests?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucun concours trouvé
        </div>
      )}
    </div>
  );
}
