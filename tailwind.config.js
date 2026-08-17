import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)"],
        display: ["var(--font-display)"],
      },
      // Échelle nommée : remplace 13 valeurs arbitraires posées à la main.
      // Miroir en --z-* dans index.css pour les règles CSS en !important.
      zIndex: {
        "map-ambient": "400", // échelle, boussole, attribution
        "map-info": "500", // légende, statistiques, légendes de couches
        "map-tooltip": "510", // tooltips de la légende
        "map-search": "600", // contrôle de recherche et ses résultats
        notify: "700", // pile de notifications de carte
        panel: "800", // panneaux latéraux, bannières
        "panel-raised": "810", // voile du panneau de statistiques
        "panel-sheet": "820", // panneau de statistiques lui-même
        rail: "900", // rail de contrôles
        floating: "1000", // panneaux historiques (date, lecture)
        popover: "1100", // contenus Radix, menu de langue
        "tour-overlay": "1200", // voile driver.js
        "tour-popover": "1210", // bulle driver.js
        modal: "1300", // modale d'informations
        toast: "1400", // toasts, lien d'évitement, tooltip de marqueur
      },
      keyframes: {
        'slide-in-left': {
          '0%': {
            opacity: '0',
            transform: 'translateX(-20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        'slide-out-left': {
          '0%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateX(-100%)',
          },
        },
        'slide-out-left-smooth': {
          '0%': {
            opacity: '1',
            transform: 'translateX(0) scale(1)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateX(-100%) scale(0.98)',
          },
        },
        'slide-out-right': {
          '0%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateX(100%)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        'fade-out': {
          '0%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0',
          },
        },
        'scale-in': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.9)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        'scale-out': {
          '0%': {
            opacity: '1',
            transform: 'scale(1)',
          },
          '100%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
        },
        // Entrée du rail de contrôles, jouée une seule fois au montage
        'rail-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-out-left': 'slide-out-left-smooth 0.3s ease-in forwards',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-in',
        'scale-in': 'scale-in 0.3s ease-out',
        'scale-out': 'scale-out 0.3s ease-in',
        'slide-in-left-delayed': 'slide-in-left 0.3s ease-out 0.1s both',
        'rail-in': 'rail-in 0.26s cubic-bezier(0.22, 1.2, 0.36, 1) both',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "3xl":
          "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
