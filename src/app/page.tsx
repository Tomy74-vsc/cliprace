
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";

/* ==========================================================================
   ClipRace — Landing Page (Premium UX)
   - Apple-like smooth vertical scroll (railless), parallax & subtle motions
   - Gradient animated headings, glassmorphism, elevated CTAs
   - Fully responsive, WCAG AA friendly, reduced-motion aware
   - Self-contained styles via Tailwind + minimal global CSS hooks already present
   ========================================================================= */

/* -------------------- Styles utilitaires -------------------- */
const ctaPrimary =
  "inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold shadow-[0_10px_25px_-10px_rgba(99,91,255,0.6)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#635BFF] dark:focus-visible:ring-offset-zinc-950";
const ctaGhost =
  "inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-700 dark:focus-visible:ring-offset-zinc-950";

/* -------------------- Hook scroll-spy robuste -------------------- */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: "-45% 0% -55% 0%",
      threshold: 0,
    };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const id = (e.target as HTMLElement).id;
        if (e.isIntersecting && id) setActive(id);
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
      (entries, observer) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("show");
            observer.unobserve(e.target); // ✅ évite l’accumulation et les fuites
          }
        });
      },
      { root: null, threshold: 0.2 }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}


/* ---------- Hook parallax (met à jour var CSS) ---------- */
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


/* -------------------- Variants Framer Motion -------------------- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] as const } },
};


const stagger: Variants = {
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

/* -------------------- Page -------------------- */
export default function Home() {
  const sections = useMemo(
    () => ["hero", "product", "creator", "enterprise", "comments", "faq"],
    []
  );
  const active = useActiveSection(sections);
  const [mobileOpen, setMobileOpen] = useState(false);

  useRevealOnScroll();
  useHeroParallaxVar();

  // Apple-like scroll indicator (subtle) based on progress (no rail)
  const { scrollYProgress: progress } = useScroll();
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <main
      className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-[#635BFF]/20"
    >
      {/* -------------------- TOP progress line (thin, no rail) -------------------- */}
      <motion.div
        aria-hidden
        style={{ width }}
        className="fixed left-0 top-0 h-[2px] z-[60] bg-gradient-to-r from-[#7C3AED] via-[#635BFF] to-[#7C3AED]"
      />

      {/* -------------------- NAV -------------------- */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* gauche : logo + nav */}
            <div className="flex items-center gap-6">
              <a href="#hero" className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg ring-1 ring-[#7C3AED]/30" />
                <span className="text-gradient text-xl sm:text-2xl font-extrabold tracking-tight">
                  ClipRace
                </span>
              </a>
              <nav className="hidden md:flex items-center gap-2">
                {[
                  { id: "product", label: "Produit" },
                  { id: "creator", label: "Créateur" },
                  { id: "enterprise", label: "Entreprise" },
                  { id: "comments", label: "Avis" },
                  { id: "faq", label: "FAQ" },
                ].map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className={`relative px-3 py-2 rounded-full text-base lg:text-[17px] font-semibold transition group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#635BFF] dark:focus-visible:ring-offset-zinc-950 ${
                      active === l.id ? "text-[#635BFF]" : "hover:text-[#635BFF]"
                    }`}
                  >
                    {l.label}
                    <span className="absolute left-0 bottom-0 h-[2px] w-0 bg-[#635BFF] transition-all group-hover:w-full" />
                  </a>
                ))}
              </nav>
            </div>

            {/* droite : actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/auth/login"
                className="px-6 py-3 rounded-full border border-zinc-300 dark:border-zinc-700 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                Se connecter
              </Link>
              <Link 
                href="/auth/signup" className={ctaPrimary}>
                Commencer
              </Link>
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
            <div className="md:hidden pb-4 fade-up-soft">
              <div className="grid gap-2">
                {[
                  { id: "product", label: "Produit" },
                  { id: "creator", label: "Créateur" },
                  { id: "enterprise", label: "Entreprise" },
                  { id: "comments", label: "Avis" },
                  { id: "faq", label: "FAQ" },
                ].map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className={`px-3 py-2 rounded-xl ${
                      active === l.id
                        ? "bg-zinc-100 dark:bg-zinc-900"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  href="/auth/login"
                  className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                  onClick={() => setMobileOpen(false)}
                >
                  Se connecter
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold"
                  onClick={() => setMobileOpen(false)}
                >
                  Commencer
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* -------------------- HERO -------------------- */}
      <section id="hero" className="relative overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Backdrop parallax */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hero-backdrop" />
        {/* Particules douces */}
        <div aria-hidden className="particles absolute inset-0 -z-10" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="parallax-hero text-shadow-hero text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] !opacity-100"
          >
            Lancez des concours{" "}
            <span className="text-gradient animate-gradient">viraux</span>. Des vues. Des{" "}
            <span className="text-gradient animate-gradient">récompenses</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-4 text-lg sm:text-xl text-zinc-600 dark:text-zinc-300 !opacity-100"
          >
            La plateforme qui propulse <strong>marques</strong> & <strong>créateurs</strong> vers le succès viral.
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.div variants={fadeUp}>
              <Link href="/auth/signup" className={ctaPrimary}>
                Commencer maintenant
              </Link>
            </motion.div>
            <motion.div variants={fadeUp}>
              <a href="#product" className={ctaGhost}>
                Voir le produit
              </a>
            </motion.div>
          </motion.div>

          <div className="mt-3 text-xs text-zinc-500">
            0% côté marque au lancement • 15% commission sur cashout créateurs (Stripe Connect)
          </div>

          {/* Pills stats */}
          <StatPills
            className="mt-10"
            items={[
              { kpi: "50M+", label: "Vues générées" },
              { kpi: "10K+", label: "Créateurs actifs" },
              { kpi: "500+", label: "Marques partenaires" },
            ]}
          />

          {/* Logos confiance (marquee) */}
          <div className="mt-12">
            <TrustMarquee
              title="Ils nous font confiance"
              logos={["/vercel.svg", "/next.svg", "/globe.svg", "/window.svg", "/file.svg", "/vercel.svg"]}
            />
          </div>
        </div>
      </section>

      {/* -------------------- PRODUIT (noir) -------------------- */}
      <section id="product" className="bg-black text-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-extrabold"
          >
            Le Produit.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-2 text-lg sm:text-xl text-zinc-300"
          >
            Un système simple, pensé pour la performance. Créez. Publiez.{" "}
            <span className="text-[#7C3AED]">Gagnez</span>. Créez des concours UGC viraux, récompensez automatiquement vos créateurs et générez du contenu authentique à grande échelle.
          </motion.p>

          {/* Leaderboard */}
          <LeaderboardPreview className="mt-8 bg-white/5 rounded-2xl" />

          {/* Feature grid */}
          <FeatureGrid className="mt-12" />
        </div>
      </section>

      {/* -------------------- CRÉATEUR -------------------- */}
      <section id="creator" className="relative">
        {/* bloc violet */}
        <div className="bg-[#7C3AED] text-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-4xl sm:text-6xl font-extrabold"
            >
              Créateur.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-2 text-lg sm:text-xl"
            >
              Tu crées du contenu ? Chaque vue peut te faire gagner de l’argent.
            </motion.p>
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-6">
              <Link
                href="/auth/signup"
                className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90"
              >
                Participer aux concours
              </Link>
            </motion.div>

            {/* mini benefits */}
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              {["0€ pour participer", "Paye au résultat", "Top 30 récompensés"].map((t) => (
                <motion.span
                  key={t}
                  variants={fadeUp}
                  className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm"
                >
                  {t}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* bloc gris clair (version “impact”) */}
        <div className="bg-zinc-50 dark:bg-zinc-950 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.h3
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-bold text-center"
            >
              Comment ça marche ?
            </motion.h3>

            <div className="mt-10 grid lg:grid-cols-2 gap-10 items-start">
              {/* Vidéo */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-[0_18px_60px_-25px_rgba(0,0,0,.25)] bg-white"
              >
                <div className="aspect-video">
                  <iframe
                    className="h-full w-full"
                    src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
                    title="Démo ClipRace pour créateurs"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </motion.div>

              {/* Checklist motivante */}
              <ol className="space-y-5">
                <CreatorCheck
                  step="1"
                  title="Choisis un concours"
                  text="Parmi les campagnes sponsorisées du moment (thème, durée, récompenses)."
                />
                <CreatorCheck
                  step="2"
                  title="Publie ta vidéo"
                  text="Suis le brief et soumets simplement ton lien pour la validation."
                />
                <CreatorCheck
                  step="3"
                  title="Monte au classement"
                  text="Vues & engagement agrégés automatiquement (mock MVP) avec équité."
                />
                <CreatorCheck
                  step="4"
                  title="Encaisse"
                  text="Top 30 récompensé, cashout sécurisé via Stripe Connect."
                />
                <li className="pt-2 list-none">
                  <Link href="/auth/signup" className="inline-flex items-center gap-2 underline underline-offset-4 font-semibold">
                    Rejoins un concours <span aria-hidden>↗</span>
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- ENTREPRISE / MARQUES -------------------- */}
      <section id="enterprise" className="relative py-16 sm:py-24 text-white bg-[#0c1330]">
        {/* Orbes flottantes & fond radial doux */}
        <div aria-hidden className="enterprise-orbs pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(99,91,255,.12),transparent_70%),radial-gradient(900px_400px_at_90%_0%,rgba(124,58,237,.12),transparent_70%)]"
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight"
          >
            Entreprise.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-3 text-lg sm:text-xl text-white/90"
          >
            Lancez des campagnes <span className="underline">virales</span> et alignez UGC & résultats business.
          </motion.p>

          {/* 3 bénéfices — cartes “tilt” */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-10 grid sm:grid-cols-3 gap-6"
          >
            {[
              {
                icon: "/globe.svg",
                title: "Des vues garanties",
                text: "Activez des dizaines de créateurs pour une portée massivement organique.",
              },
              {
                icon: "/window.svg",
                title: "UGC réutilisable",
                text: "Des vidéos authentiques utilisables en ads & social (droits inclus).",
              },
              {
                icon: "/file.svg",
                title: "ROI contrôlé",
                text: "KPIs clairs, CPV bas, suivi temps réel et répartition automatique.",
              },
            ].map((c) => (
              <motion.div key={c.title} variants={fadeUp}>
                <EnterpriseCard icon={c.icon} title={c.title} text={c.text} />
              </motion.div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-8">
            <Link href="/auth/signup" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
              Créer un concours
            </Link>
          </motion.div>

          {/* Process / mini dashboard */}
          <motion.h3
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-12 text-3xl sm:text-4xl font-bold"
          >
            Comment ça marche ?
          </motion.h3>
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <ol className="space-y-6">
              <BrandStep n="1." title="Créez votre concours" />
              <BrandStep n="2." title="Les influenceurs participent" />
              <BrandStep n="3." title="Suivez les performances" />
              <BrandStep n="4." title="Payez les meilleurs" />
            </ol>

            <div className="grid gap-6">
              <div className="rounded-xl bg-white/10 border border-white/20 p-6 shadow-[0_18px_60px_-25px_rgba(0,0,0,.5)] enterprise-float">
                <div className="text-white/80">Ventes</div>
                <div className="text-3xl font-bold">212K €</div>
                <div className="mt-3 h-24 rounded-md bg-white/10" />
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-6 shadow-[0_18px_60px_-25px_rgba(0,0,0,.5)] enterprise-float">
                <div className="h-56 rounded-md bg-white/10" />
                <div className="mt-3">
                  <Link href="/auth/signup" className="inline-block px-5 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
                    Booster votre marque
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- COMMENTAIRES (marquee) -------------------- */}
      <section id="comments" className="py-16 sm:py-24 bg-[#d96452] text-black">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.h3
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center"
          >
            Ils témoignent
          </motion.h3>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-2 text-center text-black/80"
          >
            Créateurs et marques racontent leur expérience avec ClipRace.
          </motion.p>

          <TestimonialMarquee className="mt-10" />
        </div>
      </section>

      {/* -------------------- FAQ -------------------- */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center"
          >
            FAQs
          </motion.h2>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <FAQ
              q="Qui peut participer à un concours ?"
              a="Tout créateur disposant d’un compte TikTok, Instagram Reels ou YouTube Shorts, selon les critères définis par chaque marque (min. abonnés, zone, etc.)."
            />
            <FAQ
              q="Comment mes vues sont-elles comptabilisées ?"
              a="Nous récupérons automatiquement les vues à partir du lien soumis. Un coefficient d’équité s’applique pour des chances justes (mock au MVP)."
            />
            <FAQ q="Puis-je participer à plusieurs concours ?" a="Oui, en respectant les règles propres à chaque concours." />
            <FAQ
              q="Comment suis-je payé si je fais partie du top ?"
              a="Répartition automatique selon le classement (modèle top 30). Cashout sécurisé via Stripe Connect (–15%)."
            />
            <FAQ
              q="Est-ce conforme à la législation ?"
              a="Oui : CGU, règlement de concours, conformité RGPD, suppression de compte sur demande."
            />
            <FAQ
              q="Puis-je suivre les performances en temps réel ?"
              a="Oui, via un dashboard clair : nombre de participants, classement et stats globales."
            />
          </div>
        </div>
      </section>

      {/* -------------------- FINAL CTA -------------------- */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-[#7C3AED] via-[#635BFF] to-[#7C3AED] bg-[length:200%_200%] animate-gradient text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.h3
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold"
          >
            Boostez votre succès dès aujourd’hui.
          </motion.h3>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-6">
            <Link href="/auth/signup" className="inline-block px-6 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90">
              Commencer
            </Link>
          </motion.div>
        </div>
      </section>

      {/* -------------------- FOOTER -------------------- */}
      <footer className="py-12 bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 grid gap-10 text-center md:grid-cols-3">
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
              <li><a href="https://www.instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a href="https://www.tiktok.com" target="_blank" rel="noreferrer">TikTok</a></li>
              <li><a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} ClipRace — Données traitées en toute sécurité — Participation encadrée par règlement.
        </div>
      </footer>

      {/* --------- CSS additionnel spécifique à cette page --------- */}
      <style jsx global>{`
        /* Ombre du titre type premium */
        .text-shadow-hero {
          text-shadow:
            0 1px 0 rgba(0, 0, 0, 0.03),
            0 8px 32px rgba(99, 91, 255, 0.12),
            0 18px 48px rgba(124, 58, 237, 0.18);
        }

        /* Glow neutre des bulles */
        .feature-card { position: relative; overflow: hidden; }
        .feature-card::after {
          content: "";
          position: absolute;
          right: -40px;
          top: -40px;
          width: 160px;
          height: 160px;
          border-radius: 9999px;
          background:
            radial-gradient(280px 180px at 96% 8%, rgba(255,255,255,.24), transparent 60%),
            radial-gradient(320px 240px at -10% 120%, rgba(123,67,255,.18), transparent 60%);
          filter: blur(14px);
          pointer-events: none;
        }

        /* Particules du hero */
        @keyframes floaty {
          0% { transform: translateY(0) translateX(0); opacity: .35; }
          50% { transform: translateY(-12px) translateX(6px); opacity: .55; }
          100% { transform: translateY(0) translateX(0); opacity: .35; }
        }
        .particles::before,
        .particles::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(6px 6px at 10% 30%, rgba(124,58,237,.25) 60%, transparent),
            radial-gradient(6px 6px at 80% 20%, rgba(99,91,255,.25) 60%, transparent),
            radial-gradient(6px 6px at 60% 70%, rgba(124,58,237,.25) 60%, transparent),
            radial-gradient(6px 6px at 30% 80%, rgba(99,91,255,.25) 60%, transparent);
          animation: floaty 9s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .particles::after { animation-delay: 1.2s; filter: blur(1px); opacity: .25; }

        /* Orbes & flottement — section entreprise */
        @keyframes orbFloat {
          0% { transform: translate3d(0,-12px,0) scale(1); }
          50% { transform: translate3d(10px,12px,0) scale(1.03); }
          100% { transform: translate3d(0,-12px,0) scale(1); }
        }
        .enterprise-orbs::before,
        .enterprise-orbs::after {
          content: "";
          position: absolute;
          border-radius: 9999px;
          filter: blur(30px);
          opacity: .45;
          animation: orbFloat 18s ease-in-out infinite;
        }
        .enterprise-orbs::before {
          width: 420px; height: 420px; left: -120px; top: -80px;
          background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 70%);
        }
        .enterprise-orbs::after {
          width: 520px; height: 520px; right: -160px; bottom: -120px;
          background: radial-gradient(circle at 70% 70%, #635bff, transparent 70%);
          animation-delay: .8s;
        }

        /* Légère translation sur les cartes entreprise */
        @keyframes floatCard { 0% { transform: translateY(0); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
        .enterprise-float { animation: floatCard 6s ease-in-out infinite; }

        /* Stat bubble (glass) */
        .stat-bubble {
          border-radius: 24px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(24,24,27,0.12);
          box-shadow: 0 18px 60px -25px rgba(124,58,237,.25);
        }
        .dark .stat-bubble {
          background: rgba(24,24,27,0.6);
          border-color: rgba(250,250,250,0.12);
        }
        .hero-backdrop {
          background:
            radial-gradient(900px 480px at 50% -10%, rgba(124,58,237,.10), transparent 60%),
            radial-gradient(700px 360px at 80% 10%, rgba(99,91,255,.08), transparent 60%);
          transform: translateY(var(--hero-parallax));
          will-change: transform, opacity;
        }

      `}</style>
    </main>
  );
}

/* -------------------- Composants réutilisables -------------------- */

/* Pills de stats dans le hero */
function StatPills({
  items,
  className = "",
}: {
  items: { kpi: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`} role="list">
      {items.map((it) => (
        <div
          key={it.label}
          className="stat-bubble p-6 text-center"
          role="listitem"
        >
          <div className="text-4xl font-black text-[#7C3AED]">{it.kpi}</div>
          <div className="mt-2 text-lg text-zinc-600 dark:text-zinc-300">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/* Logos clients défilants */
function TrustMarquee({ logos, title }: { logos: string[]; title?: string }) {
  // Duplique la liste pour l’effet d’infini
  const list = [...logos, ...logos];

  return (
    <section className="space-y-4">
      {title && (
        <div className="text-zinc-600 dark:text-zinc-300 text-center font-medium">
          {title}
        </div>
      )}

      <div className="marquee" role="presentation" aria-hidden>
        {/* ✅ IMPORTANT : classe unifiée avec globals.css */}
        <div className="marquee__track items-center">
          {list.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="h-20 w-28 sm:h-24 sm:w-32 rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur flex items-center justify-center ring-1 ring-inset ring-zinc-200/60 dark:ring-white/10"
            >
              <Image
                src={src}
                alt="Logo partenaire"
                width={96}
                height={32}
                className="opacity-70"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* Tableau d’exemple, colonnes fixes + chiffres tabulaires */
function LeaderboardPreview({ className = "" }: { className?: string }) {
  const rows = [
    { rank: 1, creator: "@maya", network: "TikTok", views: 320_451, likes: 18_420, engagement: "7.4%" },
    { rank: 2, creator: "@leo", network: "Reels", views: 291_104, likes: 15_100, engagement: "6.7%" },
    { rank: 3, creator: "@nina", network: "Shorts", views: 250_988, likes: 12_460, engagement: "6.1%" },
  ];
  return (
    <div className={`table-wrap rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
      <div className="text-sm text-zinc-400 mb-2">Classement (exemple)</div>
      <div className="overflow-x-auto">
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
    </div>
  );
}

/* Feature grid (4 bulles impact) */
function FeatureGrid({ className = "" }: { className?: string }) {
  const items = [
    {
      icon: "/window.svg",
      title: "Connectez Marques & Créateurs",
      desc: "Une plateforme qui unit les marques aux créateurs de contenu les plus talentueux.",
    },
    {
      icon: "/globe.svg",
      title: "Concours Simplifiés",
      desc: "Créez et lancez des concours UGC en quelques clics avec notre interface intuitive.",
    },
    {
      icon: "/file.svg",
      title: "Paiements Sécurisés",
      desc: "Transactions protégées par Stripe et distribution automatique des récompenses.",
    },
    {
      icon: "/next.svg",
      title: "Analytics Avancées",
      desc: "Suivez les performances en temps réel et calculez votre ROI automatiquement.",
    },
  ];

  return (
    <div className={`grid gap-8 md:grid-cols-2 ${className}`}>
      {items.map((it) => (
        <article
          key={it.title}
          className="group relative overflow-hidden rounded-[28px] border border-violet-600/40 bg-[#15131d] text-white/95 shadow-[0_30px_80px_-25px_rgba(124,58,237,0.35)] transition-transform hover:-translate-y-1 hover:shadow-[0_40px_100px_-25px_rgba(124,58,237,0.55)] feature-card"
        >
          <div className="relative p-7 sm:p-9">
            {/* Icône + titre */}
            <div className="flex items-center gap-4 mb-4">
              <div className="h-14 w-14 shrink-0 rounded-2xl border border-violet-500/50 bg-violet-500/10 grid place-items-center">
                <Image src={it.icon} alt="" width={28} height={28} className="opacity-90" />
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-bold tracking-tight leading-snug">
                {it.title}
              </h3>
            </div>

            <p className="text-base sm:text-lg leading-relaxed text-zinc-300/90">
              {it.desc}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* Étapes créateur — version checklist */
function CreatorCheck({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <li className="flex items-start gap-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
      <span className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-[#635BFF] text-white font-bold">
        {step}
      </span>
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <p className="text-zinc-600 dark:text-zinc-300">{text}</p>
      </div>
    </li>
  );
}

/* Carte Entreprise (tilt léger au survol) */
function EnterpriseCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/15 bg-white/10 p-6 shadow-[0_25px_60px_-25px_rgba(0,0,0,.5)] transition will-change-transform hover:-translate-y-1 hover:shadow-[0_35px_80px_-25px_rgba(0,0,0,.6)]">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/20 grid place-items-center">
          <Image src={icon} alt="" width={26} height={26} />
        </div>
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <p className="mt-2 text-white/85">{text}</p>
        </div>
      </div>
      <div className="mt-4 h-px bg-white/15" />
      <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
        En savoir plus <span className="transition-transform group-hover:translate-x-0.5">↗</span>
      </div>
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

/* FAQ premium (verre + chevron animé) */
function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/60 dark:bg-zinc-950/60">
      <summary className="cursor-pointer select-none font-medium marker:hidden flex items-center justify-between">
        {q}
        <span className="text-zinc-400 group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{a}</p>
    </details>
  );
}

/* Témoignages en défilement infini */
function TestimonialMarquee({ className = "" }: { className?: string }) {
  const quotes = [
    { q: "On a triplé nos vues en 2 semaines grâce aux concours.", n: "Élodie M.", r: "CM @BeautyCo" },
    { q: "Simple pour participer, paiements sans prise de tête.", n: "Samir K.", r: "Créateur" },
    { q: "UGC de qualité et ROI très correct.", n: "Louise T.", r: "Head of Brand" },
    { q: "Le classement en temps réel motive vraiment.", n: "Nina R.", r: "Créatrice" },
    { q: "On a récolté 120+ vidéos en 10 jours.", n: "Hugo L.", r: "Growth @DTC" },
  ];
  const loop = [...quotes, ...quotes];
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee__track">
        {loop.map((t, i) => (
          <figure
            key={`${t.n}-${i}`}
            className="mx-2 w-[300px] sm:w-[360px] md:w-[380px] rounded-2xl bg-white/95 text-zinc-900 border border-zinc-200 p-4 shadow-[0_18px_50px_-25px_rgba(0,0,0,.25)]"
          >
            <div className="text-[15px]">“{t.q}”</div>
            <figcaption className="mt-3 text-sm text-zinc-500">
              {t.n} · {t.r}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
