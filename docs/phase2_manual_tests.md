## Phase 2 – Parcours créateur (tests manuels)

1. **Dashboard**
   - Créer un compte créateur, se connecter et vérifier l’affichage des cartes (concours, soumissions, solde).
   - Générer une notification (ex: modérer une soumission) et confirmer qu’elle apparaît dans la section Notifications.
   - Cliquer sur “Tout marquer comme lu” et recharger : le compteur et les badges doivent disparaître.

2. **Discover & Détail concours**
   - Depuis `/app/creator/discover`, ouvrir un concours actif.
   - Vérifier la présence du brief, de la répartition des gains, des ressources et des CGU.
   - Utiliser “Contacter la marque” : la conversation est créée et redirige vers la page Messages.

3. **Soumission**
   - Sur `/app/creator/contests/[id]`, envoyer une soumission (URL TikTok/IG/YouTube autorisée) et vérifier le toast de succès.
   - Confirmer que la carte “Votre participation” affiche le statut.

4. **Messages**
   - Accéder à `/app/creator/messages`, sélectionner un fil existant et envoyer un message.
   - Recharger : les messages sont persistés et les fils non lus affichent le badge “Nouveau”.

5. **Wallet & Cashout**
   - Simuler un gain (`contest_winnings`) puis ouvrir `/app/creator/wallet` et lancer un cashout.
   - Vérifier la création d’une ligne `cashouts` et la notification associée.

6. **Paramètres**
   - Ouvrir `/app/creator/settings`, modifier nom/bio/plateforme principale et sauvegarder.
   - Désactiver/activer une préférence de notification et contrôler la ligne `notification_preferences`.
   - Utiliser “Supprimer mon compte” : `profiles.is_active` passe à `false` et l’utilisateur est déconnecté (via middleware).
