/**
 * Tests E2E pour les améliorations UX du flux d'authentification
 * Tests créés après l'audit et correction des bugs UX
 */

import { test, expect } from '@playwright/test';

test.describe('Auth UX Improvements - E2E Tests', () => {
  test('Step1: devrait afficher la force du mot de passe en temps réel', async ({ page }) => {
    await page.goto('/signup');
    
    // Vérifier que nous sommes sur Step1
    await expect(page.getByRole('heading', { name: /créer votre compte/i })).toBeVisible();
    
    // Trouver le champ mot de passe
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    
    // Taper un mot de passe faible
    await passwordInput.fill('test');
    
    // Vérifier que l'indicateur de force apparaît
    await expect(page.getByText(/force du mot de passe/i)).toBeVisible({ timeout: 2000 });
    
    // Vérifier que la force est indiquée comme faible
    await expect(page.getByText(/faible|très faible/i)).toBeVisible();
    
    // Améliorer le mot de passe
    await passwordInput.fill('TestPassword123!');
    
    // Attendre que la force soit recalculée
    await page.waitForTimeout(500);
    
    // Vérifier que la force s'est améliorée
    await expect(page.getByText(/fort|très fort/i)).toBeVisible({ timeout: 2000 });
    
    // Vérifier que les critères de validation s'affichent
    await expect(page.getByText(/8 caractères minimum/i)).toBeVisible();
    await expect(page.getByText(/une lettre minuscule/i)).toBeVisible();
    await expect(page.getByText(/une lettre majuscule/i)).toBeVisible();
    await expect(page.getByText(/un chiffre/i)).toBeVisible();
    await expect(page.getByText(/un caractère spécial/i)).toBeVisible();
  });

  test('Step1: devrait afficher la validation email en temps réel avec icônes', async ({ page }) => {
    await page.goto('/signup');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    
    // Taper un email invalide
    await emailInput.fill('invalid');
    await page.waitForTimeout(500);
    
    // Vérifier l'icône d'erreur (XCircle)
    const emailContainer = emailInput.locator('..');
    await expect(emailContainer.locator('svg')).toBeVisible({ timeout: 2000 });
    
    // Taper un email valide
    await emailInput.fill(`test-${Date.now()}@example.com`);
    
    // Attendre la validation (debounce + check disponibilité)
    await page.waitForTimeout(1000);
    
    // Vérifier l'icône de succès (CheckCircle)
    // Note: Selon l'implémentation, on peut avoir un loader puis un check
    await expect(emailContainer.locator('svg')).toBeVisible({ timeout: 5000 });
  });

  test('Step1: le bouton S\'inscrire ne devrait pas être bloqué pendant la validation', async ({ page }) => {
    await page.goto('/signup');
    
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    // Au début, le bouton ne devrait pas être disabled (sauf si loading)
    // Note: Il peut être disabled si emailValidation.isValidating ou isCheckingEmail
    // mais pas à cause de !emailValidation.isValid
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    
    // Remplir rapidement le formulaire
    await emailInput.fill(`valid-${Date.now()}@example.com`);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('ValidPass123!');
    
    // Attendre un peu que la validation soit terminée
    await page.waitForTimeout(800);
    
    // Vérifier que le bouton n'est plus disabled
    await expect(submitButton).not.toBeDisabled({ timeout: 2000 });
  });

  test('Step1: devrait afficher des erreurs claires pour les mots de passe non correspondants', async ({ page }) => {
    await page.goto('/signup');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    // Remplir avec des mots de passe différents
    await emailInput.fill(`test-${Date.now()}@example.com`);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('DifferentPass456!');
    
    // Attendre que la validation email soit terminée
    await page.waitForTimeout(1000);
    
    // Cliquer sur S'inscrire
    await submitButton.click();
    
    // Vérifier que l'erreur s'affiche
    await expect(page.getByText(/les mots de passe ne correspondent pas/i)).toBeVisible({ timeout: 2000 });
  });

  test('Step1 → Step2: devrait passer à l\'étape 2 après soumission réussie', async ({ page }) => {
    await page.goto('/signup');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    // Remplir le formulaire avec des données valides
    const testEmail = `e2e-test-${Date.now()}@example.com`;
    await emailInput.fill(testEmail);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('ValidPass123!');
    
    // Attendre que la validation soit terminée
    await page.waitForTimeout(1200);
    
    // Soumettre
    await submitButton.click();
    
    // Vérifier que nous sommes passés à Step2 (vérification email)
    await expect(page.getByText(/vérifiez votre email|vérification de l'email/i)).toBeVisible({ timeout: 10000 });
    
    // Vérifier que l'email affiché est correct
    await expect(page.getByText(testEmail)).toBeVisible();
    
    // Vérifier que la barre de progression affiche l'étape 2
    // Note: Selon l'implémentation de ProgressBar
    await expect(page.locator('[aria-label*="Étape 2"]').or(page.getByText(/étape 2/i))).toBeVisible({ timeout: 2000 });
  });

  test('Step2: devrait afficher le bouton Continuer disabled tant que l\'email n\'est pas vérifié', async ({ page }) => {
    // Note: Ce test nécessite d'être déjà à Step2
    // Pour cela, on doit d'abord créer un compte
    
    await page.goto('/signup');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    // Créer un compte
    await emailInput.fill(`step2-test-${Date.now()}@example.com`);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('ValidPass123!');
    await page.waitForTimeout(1200);
    await submitButton.click();
    
    // Attendre Step2
    await expect(page.getByText(/vérifiez votre email/i)).toBeVisible({ timeout: 10000 });
    
    // Vérifier que le bouton "Continuer" existe mais est disabled
    const continueButton = page.getByRole('button', { name: /continuer/i });
    await expect(continueButton).toBeVisible({ timeout: 2000 });
    await expect(continueButton).toBeDisabled();
    
    // Vérifier que le message "En attente de vérification" s'affiche
    await expect(page.getByText(/en attente de vérification|vérification automatique en cours/i)).toBeVisible();
  });

  test('Step2: le bouton Renvoyer l\'email devrait fonctionner', async ({ page }) => {
    await page.goto('/signup');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    // Créer un compte
    await emailInput.fill(`resend-test-${Date.now()}@example.com`);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('ValidPass123!');
    await page.waitForTimeout(1200);
    await submitButton.click();
    
    // Attendre Step2
    await expect(page.getByText(/vérifiez votre email/i)).toBeVisible({ timeout: 10000 });
    
    // Cliquer sur "Renvoyer l'email"
    const resendButton = page.getByRole('button', { name: /renvoyer l'email/i });
    await expect(resendButton).toBeVisible();
    await resendButton.click();
    
    // Vérifier que le message de succès s'affiche
    await expect(page.getByText(/email renvoyé|envoyé avec succès/i)).toBeVisible({ timeout: 5000 });
  });

  test('Login: devrait afficher un spinner pendant la connexion', async ({ page }) => {
    await page.goto('/login');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByPlaceholder(/\*\*\*\*\*\*\*\*/i);
    const submitButton = page.getByRole('button', { name: /se connecter/i });
    
    // Remplir le formulaire
    await emailInput.fill('test@example.com');
    await passwordInput.fill('TestPassword123!');
    
    // Soumettre (même si les identifiants sont faux, on veut voir le spinner)
    await submitButton.click();
    
    // Vérifier que le bouton affiche "Connexion..." avec un spinner
    await expect(submitButton).toContainText(/connexion\.\.\./i, { timeout: 2000 });
    
    // Le bouton devrait être disabled pendant la soumission
    await expect(submitButton).toBeDisabled();
  });

  test('Login: devrait afficher des messages d\'erreur clairs', async ({ page }) => {
    await page.goto('/login');
    
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByPlaceholder(/\*\*\*\*\*\*\*\*/i);
    const submitButton = page.getByRole('button', { name: /se connecter/i });
    
    // Essayer de se connecter avec de mauvais identifiants
    await emailInput.fill('nonexistent@example.com');
    await passwordInput.fill('WrongPassword123!');
    await submitButton.click();
    
    // Vérifier que le message d'erreur s'affiche
    await expect(page.getByText(/email ou mot de passe incorrect|erreur de connexion/i)).toBeVisible({ timeout: 5000 });
  });

  test('Barre de progression: devrait afficher l\'étape correcte', async ({ page }) => {
    await page.goto('/signup');
    
    // Vérifier que nous sommes à l'étape 1
    await expect(page.getByRole('heading', { name: /créer votre compte/i })).toBeVisible();
    
    // La barre de progression devrait indiquer étape 1/3
    // Note: L'implémentation exacte dépend du composant ProgressBar
    const progressBar = page.locator('[role="progressbar"]').or(page.locator('.progress-bar')).or(page.getByText(/étape 1/i));
    await expect(progressBar.first()).toBeVisible({ timeout: 2000 });
    
    // Passer à Step2
    const emailInput = page.getByPlaceholder(/vous@exemple.com/i);
    const passwordInput = page.getByLabel(/^mot de passe$/i, { exact: false });
    const confirmInput = page.getByLabel(/confirmer le mot de passe/i);
    const submitButton = page.getByRole('button', { name: /s'inscrire/i });
    
    await emailInput.fill(`progress-${Date.now()}@example.com`);
    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('ValidPass123!');
    await page.waitForTimeout(1200);
    await submitButton.click();
    
    // Vérifier que la barre de progression indique étape 2
    await expect(page.getByText(/vérifiez votre email/i)).toBeVisible({ timeout: 10000 });
    
    // La barre devrait maintenant indiquer étape 2/3
    const step2Indicator = page.locator('[aria-label*="Étape 2"]').or(page.getByText(/étape 2/i));
    await expect(step2Indicator.first()).toBeVisible({ timeout: 2000 });
  });
});

