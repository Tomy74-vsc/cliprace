/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimisations de performance
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },

  // Désactiver ESLint pour le build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimisation des images
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.io",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Compression et optimisation
  compress: true,
  poweredByHeader: false,

  // Headers de sécurité
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    
    // CSP plus permissive en développement pour Framer Motion et React Refresh
    const cspValue = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://js.stripe.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-attr 'unsafe-inline'",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co https://api.stripe.com ws://localhost:* http://localhost:*",
          "frame-src 'self' https://www.youtube-nocookie.com https://js.stripe.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; ")
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://js.stripe.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-attr 'unsafe-inline'",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co https://api.stripe.com",
          "frame-src 'self' https://www.youtube-nocookie.com https://js.stripe.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests",
        ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspValue,
          },
          ...(isDev ? [] : [{
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          }]),
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/auth/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },

  // Webpack optimisations
  webpack: (config, { dev, isServer }) => {
    // Optimisations pour la production
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
          common: {
            name: "common",
            minChunks: 2,
            chunks: "all",
            enforce: true,
          },
        },
      };
    }

    return config;
  },
  // Redirect legacy top-level auth paths to new /auth/* routes
  async redirects() {
    return [
      { source: "/signup", destination: "/auth/signup", permanent: false },
      { source: "/login", destination: "/auth/login", permanent: false },
    ];
  },
};

module.exports = nextConfig;
