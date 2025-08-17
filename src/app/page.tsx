"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/* -------------------- Styles utilitaires -------------------- */
const ctaPrimary =
  "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold shadow-[0_10px_25px_-10px_rgba(99,91,255,0.6)] transition";
const ctaGhost =
  "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-semibold transition";

/* -------------------- Hook scroll-spy robuste -------------------- */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const options: IntersectionObserverInit = {
      // Actif quand le centre de la section croise la fenêtre
      root: null,
      rootMargin: "-45% 0% -55% 0%",
      threshold: 0,
    };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && (e.target as HTMLElement).id) {
          setActive((e.target as HTMLElement).id);
        }
      });
    }, options);

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);

  return active;
}

/* ---------- Hook "reveal on scroll" (ajoute .show) ---------- */
function useRevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("show");
        });
      },
      { root: null, threshold: 0.2 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ---------- Hook parallax (piloté par variable CSS) ---------- */
function useHeroParallaxVar() {
  useEffect(() => {
    const onScroll = () =>
      document.documentElement.style.setProperty(
        "--hero-parallax",
        `${window.scrollY * 0.08}px`
      );
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/* -------------------- Page -------------------- */
export default function Home() {
  const sections = useMemo(
    () => ["hero", "product", "creator", "enterprise", "faq"],
    []
  );
  const active = useActiveSection(sections);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Animations & parallax
  useRevealOnScroll();
  useHeroParallaxVar();

  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* -------------------- NAV -------------------- */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/75 dark:bg-zinc-950/75 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* gauche : logo + nav */}
            <div className="flex items-center gap-6">
              <a href="#hero" className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF]" />
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight">ClipRace</span>
              </a>
              <nav className="hidden md:flex items-center gap-2">
                {[
                  { id: "product", label: "Produit" },
                  { id: "creator", label: "Créateur" },
                  { id: "enterprise", label: "Entreprise" },
                  { id: "faq", label: "FAQ" },
                ].map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className={`relative px-3 py-2 rounded-full text-base lg:text-[17px] font-semibold
                                hover:bg-zinc-100 dark:hover:bg-zinc-900 transition
                                ${active === l.id ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* droite : actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-6 py-3 rounded-full border border-zinc-300 dark:border-zinc-700 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                Se connecter
              </Link>
              <a
                href="#cta"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold shadow-[0_10px_25px_-10px_rgba(99,91,255,0.6)] transition"
              >
                Commencer
              </a>
            </div>

            {/* mobile */}
            <button
              aria-label="Menu"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700"
              onClick={() => setMobileOpen((v) => !v)}
            >
              ☰
            </button>
          </div>

          {/* tiroir mobile */}
          {mobileOpen && (
            <div className="md:hidden pb-4">
              <div className="grid gap-2">
                {[
                  { id: "product", label: "Produit" },
                  { id: "creator", label: "Créateur" },
                  { id: "enterprise", label: "Entreprise" },
                  { id: "faq", label: "FAQ" },
                ].map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className={`px-3 py-2 rounded-xl ${
                      active === l.id ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
                <Link href="/login" className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700">
                  Se connecter
                </Link>
                <a
                  href="#cta"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold"
                >
                  Commencer
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* -------------------- HERO -------------------- */}
      <section id="hero" className="relative overflow-hidden">
        {/* Backdrop parallax (aucun style inline) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hero-backdrop" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-10 text-center">
          <h1 className="reveal text-4xl sm:text-6xl font-black tracking-tight leading-[1.1]">
            Lancez des concours <span className="text-[#7C3AED]">viraux</span>. Des vues. Des{" "}
            <span className="text-[#635BFF]">récompenses</span>
          </h1>

          {/* ellipse décor */}
          <div className="reveal mx-auto mt-6 h-3 sm:h-5 w-[78%] max-w-3xl rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />

          <p className="reveal mt-6 text-xl">
            <span className="text-[#7C3AED] font-semibold">Plus d’impact</span> pour les marques.{" "}
            <span className="text-[#7C3AED] font-semibold">Plus de reconnaissance</span> pour les créateurs.
          </p>
          <p className="reveal mt-2 text-zinc-600 dark:text-zinc-300">
            Et si c’était le moment de <span className="text-[#7C3AED] font-semibold">briller</span> ?
          </p>

          <div id="cta" className="reveal mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup?role=brand" className={ctaPrimary}>
              Commencer maintenant
            </Link>
            <a href="#product" className={ctaGhost}>
              Voir le produit
            </a>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            0% côté marque au lancement • 15% commission sur cashout créateurs (Stripe Connect)
          </div>

          {/* mini dashboard “exemple concours” */}
          <div className="reveal mx-auto mt-12 max-w-5xl rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 bg-white/70 dark:bg-zinc-950/60 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.25)]">
            <div className="grid md:grid-cols-3 gap-4">
              <KPI label="Vues 30j" value="1 240 500" />
              <KPI label="Concours actifs" value="3" />
              <KPI label="CPV estimé" value="0,012 €" />
            </div>
            <LeaderboardPreview className="mt-4" />
          </div>
        </div>
      </section>

      {/* -------------------- PRODUIT (noir) -------------------- */}
      <section id="product" className="bg-black text-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="reveal text-5xl sm:text-6xl font-extrabold">Le Produit.</h2>
          <p className="reveal mt-2 text-lg sm:text-xl text-zinc-300">
            Un système simple, pensé pour la performance. Créez. Publiez. <span className="text-[#7C3AED]">Gagnez</span>.
            Créez des concours UGC viraux, récompensez automatiquement vos créateurs et générez du contenu authentique à grande échelle.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-10">
            <div className="reveal">
              <ProductStep
                n="1."
                title="La marque lance un concours"
                bullets={[
                  "Objectif, brief créatif, date limite, budget",
                  "Contrat automatique & règles claires",
                  "Transparence & traçabilité",
                ]}
              />
            </div>
            <div className="reveal d1">
              <ProductStep
                n="2."
                title="Les créateurs participent"
                bullets={[
                  "Publication sur TikTok / Reels / Shorts",
                  "Participation simple & sécurisée",
                  "Respect du brief = validation rapide",
                ]}
              />
            </div>
            <div className="reveal d2">
              <ProductStep
                n="3."
                title="Suivis des performances"
                bullets={[
                  "Vues, likes, commentaires (mock au MVP)",
                  "Classement dynamique & équitable",
                  "KPIs : CPV, ROI estimé",
                ]}
              />
            </div>
            <div className="reveal d3">
              <ProductStep
                n="4."
                title="Récompenser les meilleurs"
                bullets={[
                  "Répartition automatique (modèle top 30)",
                  "Paiements via Stripe Connect",
                  "Export & factures",
                ]}
              />
            </div>
          </div>

          <div className="reveal mt-10">
            <Link href="/signup?role=brand" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
              Créer un concours
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------- CRÉATEUR -------------------- */}
      <section id="creator" className="py-16 sm:py-24 bg-[#7C3AED] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <header className="text-center">
            <h2 className="reveal text-5xl sm:text-6xl font-extrabold">Créateur.</h2>
            <p className="reveal d1 mt-2 text-lg sm:text-xl">
              Tu crées du contenu ? Chaque vue peut te faire gagner de l’argent.
            </p>
            <div className="reveal d2 mt-6">
              <Link href="/signup?role=creator" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
                Participer aux concours
              </Link>
            </div>
          </header>

          <h3 className="reveal d1 mt-12 text-3xl sm:text-4xl font-bold text-center">Comment ça marche ?</h3>

          <div className="mt-10 grid lg:grid-cols-2 gap-8 items-start">
            {/* Images (remplace par tes visuels) */}
            <div className="space-y-6">
              <Image
                src="/window.svg"
                width={900}
                height={640}
                alt="Créatrice filmant"
                className="reveal w-full rounded-xl border border-white/20 bg-white/5 p-6 invert-0 dark:invert"
              />
              <Image
                src="/file.svg"
                width={900}
                height={640}
                alt="Exemple mobile"
                className="reveal d1 w-full rounded-xl border border-white/20 bg-white/5 p-6 invert-0 dark:invert"
              />
            </div>

            {/* Étapes */}
            <ol className="space-y-6">
              <li className="reveal">
                <CreatorStep
                  n="1."
                  title="Choisis un concours"
                  text="Explore les concours sponsorisés. Règles : thème, durée, conditions, cashprize."
                />
              </li>
              <li className="reveal d1">
                <CreatorStep
                  n="2."
                  title="Publie ta vidéo"
                  text="Respecte le brief (#hashtag, format) puis colle ton lien pour valider."
                />
              </li>
              <li className="reveal d2">
                <CreatorStep
                  n="3."
                  title="Suis ton classement"
                  text="Vues, likes, commentaires analysés automatiquement (mock au MVP) avec un coefficient d’équité."
                />
              </li>
              <li className="reveal d3">
                <CreatorStep
                  n="4."
                  title="Récupère ta récompense"
                  text="Si tu es dans le top, tu obtiens ton % du cashprize (jusqu’au Top 30)."
                />
              </li>
              <li className="pt-2 list-none">
                <Link href="/signup?role=creator" className="inline-flex items-center gap-2 underline underline-offset-4 font-semibold">
                  Rejoins un concours <span aria-hidden>↗</span>
                </Link>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* -------------------- ENTREPRISE / MARQUES -------------------- */}
      <section id="enterprise" className="py-16 sm:py-24 bg-[#3f35d3] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="reveal text-5xl sm:text-6xl font-extrabold">Entreprise.</h2>
          <p className="reveal d1 mt-2 text-lg sm:text-xl">
            Créez des campagnes <span className="underline decoration-white/60">virales</span>. Générez des résultats réels.
          </p>

          <div className="reveal d2 mt-8 grid sm:grid-cols-3 gap-6">
            <ValueTile title="Des vues garanties">
              Mobilisez des dizaines de créateurs pour un maximum de visibilité.
            </ValueTile>
            <ValueTile title="UGC de qualité">
              Des contenus authentiques et créatifs que vous pouvez republier.
            </ValueTile>
            <ValueTile title="ROI compétitif">
              KPIs clairs, CPV bas et suivi temps réel.
            </ValueTile>
          </div>

          <div className="reveal d3 mt-6">
            <Link href="/signup?role=brand" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
              Créer un concours
            </Link>
          </div>

          <h3 className="reveal d2 mt-10 text-3xl sm:text-4xl font-bold">Comment ça marche ?</h3>
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <ol className="space-y-6">
              <BrandStep n="1." title="Créez votre concours" />
              <BrandStep n="2." title="Les influenceurs participent" />
              <BrandStep n="3." title="Suivez les performances" />
              <BrandStep n="4." title="Payez les meilleurs" />
            </ol>
            {/* visuels + KPI mini cards */}
            <div className="grid gap-6">
              <div className="rounded-xl bg-white/10 border border-white/20 p-6">
                <div className="text-zinc-100/90">Ventes</div>
                <div className="text-3xl font-bold">212K €</div>
                <div className="mt-3 h-24 rounded-md bg-white/10" />
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-6">
                <div className="h-56 rounded-md bg-white/10" />
                <div className="mt-3">
                  <a href="#cta" className="inline-block px-5 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
                    Booster votre marque
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- WIN-WIN -------------------- */}
      <section className="py-16 sm:py-20 bg-[#d96452] text-black">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="reveal text-2xl sm:text-3xl font-bold">🤝 Une solution gagnant-gagnant</h3>
          <p className="reveal d1 mt-3 text-lg sm:text-xl">Commentaires, photos, avis… valorisez tout votre UGC.</p>
        </div>
      </section>

      {/* -------------------- FAQ -------------------- */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="reveal text-3xl sm:text-4xl font-bold text-center">FAQs</h2>
        <div className="mt-8 space-y-3">
            <FAQ q="Qui peut participer à un concours ?" a="Tout créateur disposant d’un compte TikTok, Instagram Reels ou YouTube Shorts, selon les critères définis par chaque marque (min. abonnés, zone, etc.)." />
            <FAQ q="Comment mes vues sont-elles comptabilisées ?" a="Nous récupérons automatiquement les vues à partir du lien soumis. Un coefficient d’équité s’applique pour des chances justes (mock au MVP)." />
            <FAQ q="Puis-je participer à plusieurs concours ?" a="Oui, en respectant les règles propres à chaque concours." />
            <FAQ q="Comment suis-je payé si je fais partie du top ?" a="Répartition automatique selon le classement (modèle top 30). Cashout sécurisé via Stripe Connect (–15%)." />
            <FAQ q="Est-ce conforme à la législation ?" a="Oui : CGU, règlement de concours, conformité RGPD, suppression de compte sur demande." />
          </div>
        </div>
      </section>

      {/* -------------------- FINAL CTA -------------------- */}
      <section className="py-14 sm:py-20 bg-[#7C3AED] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="reveal text-3xl sm:text-4xl font-bold">Boostez votre succès dès aujourd’hui.</h3>
          <div className="reveal d1 mt-6">
            <a href="#cta" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
              Commencer
            </a>
          </div>
        </div>
      </section>

      {/* -------------------- FOOTER -------------------- */}
      <footer className="py-12 bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 grid gap-10 text-center md:text-left md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold">Légal & Conditions</div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li><Link href="/legal/terms">Conditions d’utilisation</Link></li>
              <li><Link href="/legal/privacy">Politique de confidentialité</Link></li>
              <li><Link href="/legal/rules">Règlement des concours</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">À propos</div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li><Link href="/about">Qui sommes-nous</Link></li>
              <li><Link href="/contact">Contact & support</Link></li>
              <li><Link href="/partners">Partenariats marques</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Réseaux sociaux</div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li><a href="#" aria-disabled>Instagram</a></li>
              <li><a href="#" aria-disabled>TikTok</a></li>
              <li><a href="#" aria-disabled>LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} ClipRace — Données traitées en toute sécurité — Participation encadrée par règlement.
        </div>
      </footer>
    </main>
  );
}

/* -------------------- Composants réutilisables -------------------- */
function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/50 dark:bg-zinc-950/50">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function LeaderboardPreview({ className = "" }: { className?: string }) {
  // Aligné et stable (colonnes fixes + chiffres tabulaires)
  const rows = [
    { rank: 1, creator: "@maya", network: "TikTok", views: 320_451, likes: 18_420, engagement: "7.4%" },
    { rank: 2, creator: "@leo", network: "Reels", views: 291_104, likes: 15_100, engagement: "6.7%" },
    { rank: 3, creator: "@nina", network: "Shorts", views: 250_988, likes: 12_460, engagement: "6.1%" },
  ];
  return (
    <div className={`table-wrap rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
      <div className="text-sm text-zinc-500 mb-2">Classement (exemple)</div>
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col className="w-[70px]" />
          <col className="w-[30%]" />
          <col className="w-[20%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="text-zinc-500">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Rang</th>
            <th className="px-3 py-2 font-medium">Créateur</th>
            <th className="px-3 py-2 font-medium">Réseau</th>
            <th className="px-3 py-2 font-medium text-right">👁 Vues</th>
            <th className="px-3 py-2 font-medium text-right">❤️ Likes</th>
            <th className="px-3 py-2 font-medium text-right">📈 Eng.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="px-3 py-2 align-middle">#{r.rank}</td>
              <td className="px-3 py-2 align-middle">{r.creator}</td>
              <td className="px-3 py-2 align-middle">{r.network}</td>
              <td className="px-3 py-2 align-middle tabular-nums text-right">{r.views.toLocaleString("fr-FR")}</td>
              <td className="px-3 py-2 align-middle tabular-nums text-right">{r.likes.toLocaleString("fr-FR")}</td>
              <td className="px-3 py-2 align-middle tabular-nums text-right">{r.engagement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductStep({ n, title, bullets }: { n: string; title: string; bullets: string[] }) {
  return (
    <div>
      <div className="text-5xl font-extrabold text-[#7C3AED]">{n}</div>
      <div className="mt-2 text-xl font-semibold">{title}</div>
      <ul className="mt-3 space-y-1 text-zinc-300 list-disc list-inside">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function CreatorStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold text-[#345CFF]">
        {n}
        <span className="ml-1">{title}</span>
      </div>
      <p className="mt-2">{text}</p>
    </div>
  );
}

function BrandStep({ n, title }: { n: string; title: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold">
        {n} <span className="font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-zinc-100/90">
        Définissez le brief, mobilisez des créateurs, suivez le ROI et récompensez automatiquement les meilleurs.
      </p>
    </div>
  );
}

function ValueTile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 p-5">
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-zinc-100/90 text-sm">{children}</p>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="reveal group rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/60 dark:bg-zinc-950/60">
      <summary className="cursor-pointer select-none font-medium marker:hidden flex items-center justify-between">
        {q}
        <span className="text-zinc-400 group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{a}</p>
    </details>
  );
}
